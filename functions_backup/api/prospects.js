// api/prospects.js — HUB.nexus Fila de Espera / Prospects via Cloudflare D1
// GET    /api/prospects          → lista todos os prospects
// POST   /api/prospects          → cria prospect
// PUT    /api/prospects          → atualiza prospect { id, ...campos }
// DELETE /api/prospects?id=x    → remove prospect

const ORIGIN = 'https://hub-nexus.pages.dev';

function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), { status, headers: getCorsHeaders(request) });
}

function deserialize(row) {
  if (!row) return row;
  const out = { ...row };
  ['arquivos'].forEach(k => {
    if (typeof out[k] === 'string') {
      try { out[k] = JSON.parse(out[k]); } catch { out[k] = []; }
    }
  });
  return out;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM prospects ORDER BY created_at DESC')
      .all();
    return json(results.map(deserialize));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── POST ──────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  if (!body.nome_empresa) return json({ error: 'nome_empresa obrigatório' }, 400);

  try {
    const { meta } = await env.DB
      .prepare(`
        INSERT INTO prospects
          (nome_empresa, contato_nome, contato_email, responsavel,
           etapa, data_apresentacao, data_proposta, data_limite_resposta,
           resposta_status, valor_estimado, arquivos, obs, convertido)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
      `)
      .bind(
        body.nome_empresa,
        body.contato_nome         || '',
        body.contato_email        || '',
        body.responsavel          || '',
        body.etapa                || 'apresentacao',
        body.data_apresentacao    || null,
        body.data_proposta        || null,
        body.data_limite_resposta || null,
        body.resposta_status      || 'aguardando',
        body.valor_estimado       || 0,
        JSON.stringify(body.arquivos || []),
        body.obs                  || '',
        0,
      )
      .run();

    // Agenda notificação se tem data_limite_resposta e responsavel
    if (body.data_limite_resposta && body.responsavel && body.email_responsavel) {
      // Retorna o id para o front poder agendar notificação via /api/notificar
      return json({ ok: true, id: meta.last_row_id, agendar_notif: true }, 201);
    }

    return json({ ok: true, id: meta.last_row_id }, 201, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT ───────────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, ...campos } = body;
  if (!id) return json({ error: 'id obrigatório' }, 400, request);

  if (campos.arquivos !== undefined) campos.arquivos = JSON.stringify(campos.arquivos);

  const ALLOWED = [
    'nome_empresa','contato_nome','contato_email','responsavel',
    'etapa','data_apresentacao','data_proposta','data_limite_resposta',
    'resposta_status','valor_estimado','arquivos','obs','convertido',
  ];

  const entries = Object.entries(campos).filter(([k]) => ALLOWED.includes(k));
  if (!entries.length) return json({ error: 'nenhum campo para atualizar' }, 400, request);

  const sets   = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  try {
    await env.DB
      .prepare(`UPDATE prospects SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...values, id)
      .run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id obrigatório' }, 400, request);

  try {
    await env.DB.prepare('DELETE FROM prospects WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
