// functions/api/irx/deepresearch.js — HUB.nexus · Pipeline IRX
// CRUD das fichas de deep research (preenchidas via Gemini) por projeto.
//
// GET    /api/irx/deepresearch?projeto_id=N          → lista fichas do projeto
// GET    /api/irx/deepresearch?projeto_id=N&username=X → ficha específica
// POST   /api/irx/deepresearch                        → cria / upsert ficha
// PUT    /api/irx/deepresearch                        → atualiza campos { projeto_id, username, ...campos }
// DELETE /api/irx/deepresearch?projeto_id=N&username=X → remove ficha

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

const CAMPOS_PERMITIDOS = [
  'nome', 'grau_influencia', 'tipo_perfil', 'validacao_ideologica',
  'historico_profissional', 'posicionamento_redes', 'recomendacoes_acao',
  'assuntos_sensiveis', 'bloco', 'tematica', 'abordagem',
  'status', 'resposta_bruta',
];

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url        = new URL(request.url);
  const projeto_id = url.searchParams.get('projeto_id');
  const username   = url.searchParams.get('username');

  if (!projeto_id) return json({ error: '"projeto_id" obrigatório' }, 400);

  try {
    if (username) {
      const row = await env.DB
        .prepare('SELECT * FROM irx_deepresearch WHERE projeto_id = ? AND username = ?')
        .bind(projeto_id, username).first();
      return json(row || null);
    }

    const { results } = await env.DB
      .prepare('SELECT * FROM irx_deepresearch WHERE projeto_id = ? ORDER BY updated_at DESC')
      .bind(projeto_id).all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── POST — upsert ─────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { projeto_id, username, ...campos } = body;
  if (!projeto_id || !username)
    return json({ error: '"projeto_id" e "username" obrigatórios' }, 400);

  // Filtra só campos permitidos
  const keys   = Object.keys(campos).filter(k => CAMPOS_PERMITIDOS.includes(k));
  const values = keys.map(k => String(campos[k] ?? ''));

  // Monta colunas para INSERT e UPDATE
  const colsInsert = ['projeto_id', 'username', ...keys];
  const placeholders = colsInsert.map(() => '?').join(', ');
  const updateSets   = keys.length
    ? keys.map(k => `${k} = excluded.${k}`).join(', ') + ', updated_at = datetime(\'now\')'
    : 'updated_at = datetime(\'now\')';

  try {
    const { meta } = await env.DB
      .prepare(`
        INSERT INTO irx_deepresearch (${colsInsert.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT(projeto_id, username) DO UPDATE SET ${updateSets}
      `)
      .bind(projeto_id, username, ...values)
      .run();

    return json({ ok: true, id: meta.last_row_id }, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── PUT — atualiza campos específicos ─────────────────────────
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { projeto_id, username, ...campos } = body;
  if (!projeto_id || !username)
    return json({ error: '"projeto_id" e "username" obrigatórios' }, 400);

  const keys = Object.keys(campos).filter(k => CAMPOS_PERMITIDOS.includes(k));
  if (!keys.length) return json({ error: 'Nenhum campo válido' }, 400);

  const sets   = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => String(campos[k] ?? ''));

  try {
    await env.DB
      .prepare(`UPDATE irx_deepresearch SET ${sets}, updated_at = datetime('now') WHERE projeto_id = ? AND username = ?`)
      .bind(...values, projeto_id, username)
      .run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url        = new URL(request.url);
  const projeto_id = url.searchParams.get('projeto_id');
  const username   = url.searchParams.get('username');

  if (!projeto_id || !username)
    return json({ error: '"projeto_id" e "username" obrigatórios' }, 400);

  try {
    await env.DB
      .prepare('DELETE FROM irx_deepresearch WHERE projeto_id = ? AND username = ?')
      .bind(projeto_id, username).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
