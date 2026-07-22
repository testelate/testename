// functions/api/reputaition/[[path]].js — HUB.nexus · Reputaition Projects Backend
//
// GET    /api/reputaition/projetos           → lista projetos do usuário
// GET    /api/reputaition/projetos?id=N      → carrega projeto completo
// POST   /api/reputaition/projetos           → cria projeto
// PUT    /api/reputaition/projetos           → atualiza projeto
// DELETE /api/reputaition/projetos?id=N      → remove projeto

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const json  = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });
const tryP  = (s, fb = {}) => { try { return JSON.parse(s); } catch { return fb; } };

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest({ request, env }) {
  const url      = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/reputaition\/?/, '').split('/').filter(Boolean);
  const resource = segments[0];
  const method   = request.method.toUpperCase();

  try {
    if (resource === 'projetos') return handleProjetos(method, url, request, env);
    return json({ error: 'Rota não encontrada' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function ensureTable(env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS reputaition_projetos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now')),
      nome        TEXT    NOT NULL,
      anchors     TEXT    DEFAULT '{}',
      tt_casos    TEXT    DEFAULT '{}'
    )
  `).run();
}

async function handleProjetos(method, url, request, env) {
  await ensureTable(env);
  const id = url.searchParams.get('id');

  if (method === 'GET') {
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM reputaition_projetos WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Projeto não encontrado' }, 404);
      return json({ ...row, anchors: tryP(row.anchors, {}), tt_casos: tryP(row.tt_casos, {}) });
    }
    const { results } = await env.DB
      .prepare('SELECT id, nome, created_at, updated_at FROM reputaition_projetos ORDER BY updated_at DESC LIMIT 200')
      .all();
    return json(results);
  }

  if (method === 'POST') {
    const body = await request.json();
    const { nome, anchors, tt_casos } = body;
    if (!nome) return json({ error: 'nome obrigatório' }, 400);
    const { meta } = await env.DB.prepare(`
      INSERT INTO reputaition_projetos (nome, anchors, tt_casos) VALUES (?, ?, ?)
    `).bind(nome.trim(), JSON.stringify(anchors || {}), JSON.stringify(tt_casos || {})).run();
    return json({ ok: true, id: meta.last_row_id }, 201);
  }

  if (method === 'PUT') {
    const body = await request.json();
    const { id: bid, nome, anchors, tt_casos } = body;
    if (!bid) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare(`
      UPDATE reputaition_projetos
      SET nome=?, anchors=?, tt_casos=?, updated_at=datetime('now')
      WHERE id=?
    `).bind(nome || '', JSON.stringify(anchors || {}), JSON.stringify(tt_casos || {}), bid).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare('DELETE FROM reputaition_projetos WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}
