// functions/api/pontos-atencao.js — HUB.nexus "Google Keep" clone
// GET    /api/pontos-atencao          → todos os pontos ativos
// POST   /api/pontos-atencao          → criar ponto { cliente, conteudo, cor, criado_por }
// PUT    /api/pontos-atencao          → atualizar { id, conteudo, cor, fixado, ativo }
// DELETE /api/pontos-atencao?id=x     → desativar

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM pontos_atencao WHERE ativo = 1 ORDER BY fixado DESC, updated_at DESC')
      .all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body.cliente) return json({ error: 'cliente obrigatório' }, 400);

  try {
    const { meta } = await env.DB.prepare(`
      INSERT INTO pontos_atencao (cliente, conteudo, cor, fixado, criado_por)
      VALUES (?,?,?,?,?)
    `).bind(
      body.cliente,
      body.conteudo   || '',
      body.cor        || '#ff6500',
      body.fixado ? 1 : 0,
      body.criado_por || ''
    ).run();
    return json({ ok: true, id: meta.last_row_id }, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  const { id, ...campos } = body;
  if (!id) return json({ error: 'id obrigatório' }, 400);

  if (campos.fixado !== undefined) campos.fixado = campos.fixado ? 1 : 0;
  if (campos.ativo  !== undefined) campos.ativo  = campos.ativo  ? 1 : 0;
  campos.updated_at = new Date().toISOString();

  const keys   = Object.keys(campos);
  const sets   = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => campos[k]);

  try {
    await env.DB.prepare(`UPDATE pontos_atencao SET ${sets} WHERE id = ?`).bind(...values, id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id obrigatório' }, 400);
  try {
    await env.DB.prepare('UPDATE pontos_atencao SET ativo = 0 WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
