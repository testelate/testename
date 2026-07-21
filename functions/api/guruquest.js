// ══════════════════════════════════════════════════════════════
//  /api/guruquest — CRUD da biblioteca GuruQuest
//  Cloudflare Pages Functions · D1 Database
// ══════════════════════════════════════════════════════════════

const json = (data, status = 200, request = null) => {
  const origin = request?.headers?.get('Origin') || 'https://hub-nexus.pages.dev';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
};

export async function onRequestOptions({ request }) {
  return json({}, 204, request);
}

// ── GET — lista por email ou busca por id ──────────────────────
export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const email = url.searchParams.get('email');
  const id    = url.searchParams.get('id');

  try {
    if (id) {
      const row = await env.DB
        .prepare('SELECT * FROM guruquest WHERE id = ?')
        .bind(id).first();
      if (!row) return json({ error: 'Não encontrado' }, 404, request);
      return json({ ok: true, data: parseRow(row) }, 200, request);
    }
    // Retorna todos os questionários (visíveis para toda a equipe)
    const { results } = await env.DB
      .prepare('SELECT * FROM guruquest ORDER BY updated_at DESC LIMIT 200')
      .all();
    return json({ ok: true, data: results.map(parseRow) }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — criar questionário ──────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const {
    titulo, tag = 'Outro', cliente = '', metodo = '', duracao = '',
    descricao = '', blocos = [], nQuestoes = 0, criado_por = '', ano,
    origem = 'chat',
  } = body || {};

  if (!titulo?.trim()) return json({ error: 'Campo titulo obrigatório' }, 400, request);

  try {
    const nQ     = nQuestoes || blocos.reduce((a, b) => a + (b.questoes?.length || 0), 0);
    const anoVal = ano || new Date().getFullYear();

    const result = await env.DB
      .prepare(`INSERT INTO guruquest (titulo, tag, cliente, metodo, duracao, descricao, blocos, n_questoes, ano, criado_por, origem)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(titulo.trim(), tag, cliente, metodo, duracao, descricao, JSON.stringify(blocos), nQ, anoVal, criado_por, origem)
      .run();

    return json({ ok: true, id: result.meta?.last_row_id }, 201, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT — atualizar questionário ──────────────────────────────
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, titulo, tag, cliente, metodo, duracao, descricao, blocos, nQuestoes } = body || {};
  if (!id) return json({ error: 'Campo id obrigatório' }, 400, request);

  try {
    const sets = [], vals = [];
    if (titulo    !== undefined) { sets.push('titulo = ?');    vals.push(titulo.trim()); }
    if (tag       !== undefined) { sets.push('tag = ?');       vals.push(tag); }
    if (cliente   !== undefined) { sets.push('cliente = ?');   vals.push(cliente); }
    if (metodo    !== undefined) { sets.push('metodo = ?');    vals.push(metodo); }
    if (duracao   !== undefined) { sets.push('duracao = ?');   vals.push(duracao); }
    if (descricao !== undefined) { sets.push('descricao = ?'); vals.push(descricao); }
    if (blocos    !== undefined) {
      sets.push('blocos = ?');
      vals.push(JSON.stringify(blocos));
      sets.push('n_questoes = ?');
      vals.push(nQuestoes ?? blocos.reduce((a, b) => a + (b.questoes?.length || 0), 0));
    }
    if (!sets.length) return json({ error: 'Nenhum campo para atualizar' }, 400, request);
    sets.push("updated_at = datetime('now')");
    vals.push(id);

    await env.DB.prepare(`UPDATE guruquest SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE ─────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'Parâmetro id obrigatório' }, 400, request);
  try {
    await env.DB.prepare('DELETE FROM guruquest WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

function parseRow(row) {
  if (!row) return null;
  let blocos = [];
  try { blocos = JSON.parse(row.blocos || '[]'); } catch {}
  return { ...row, blocos };
}
