// functions/api/rascunho/[[path]].js — HUB.nexus Rascunhos de Briefing via D1
// Permite salvar o progresso do briefing e retomar via token em qualquer dispositivo
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

// Gera token alfanumérico de 12 chars
function gerarToken() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

// ── GET /api/rascunho/:token  — carrega rascunho pelo token ──
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const token = pathParts[2]; // /api/rascunho/:token

  if (!token) return json({ error: 'Token obrigatório' }, 400);

  try {
    const row = await env.DB
      .prepare('SELECT * FROM rascunhos WHERE token = ?')
      .bind(token)
      .first();

    if (!row) return json({ error: 'Rascunho não encontrado ou expirado' }, 404);

    // Verifica expiração (7 dias)
    const criado = new Date(row.created_at).getTime();
    const atualizado = new Date(row.updated_at || row.created_at).getTime();
    if (Date.now() - atualizado > 7 * 24 * 60 * 60 * 1000) {
      await env.DB.prepare('DELETE FROM rascunhos WHERE token = ?').bind(token).run();
      return json({ error: 'Rascunho expirado (7 dias)' }, 410);
    }

    return json({
      ok: true,
      token: row.token,
      produto: row.produto,
      estado: JSON.parse(row.estado || '{}'),
      updated_at: row.updated_at,
    });
  } catch (e) {
    return json({ error: 'Erro ao carregar rascunho: ' + e.message }, 500);
  }
}

// ── POST /api/rascunho  — cria novo rascunho, retorna token ──
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { produto, estado } = body;
  if (!produto) return json({ error: 'produto obrigatório' }, 400);

  const token = gerarToken();

  try {
    await env.DB
      .prepare(`
        INSERT INTO rascunhos (token, produto, estado, created_at, updated_at)
        VALUES (?, ?, ?, datetime('now'), datetime('now'))
      `)
      .bind(token, produto, JSON.stringify(estado || {}))
      .run();

    return json({ ok: true, token }, 201);
  } catch (e) {
    return json({ error: 'Erro ao criar rascunho: ' + e.message }, 500);
  }
}

// ── PUT /api/rascunho/:token  — atualiza rascunho existente ──
export async function onRequestPut({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const token = pathParts[2];

  if (!token) return json({ error: 'Token obrigatório' }, 400);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  try {
    const exists = await env.DB
      .prepare('SELECT token FROM rascunhos WHERE token = ?')
      .bind(token)
      .first();

    if (!exists) return json({ error: 'Rascunho não encontrado' }, 404);

    await env.DB
      .prepare(`UPDATE rascunhos SET estado = ?, produto = ?, updated_at = datetime('now') WHERE token = ?`)
      .bind(JSON.stringify(body.estado || {}), body.produto || '', token)
      .run();

    return json({ ok: true, token });
  } catch (e) {
    return json({ error: 'Erro ao atualizar rascunho: ' + e.message }, 500);
  }
}

// ── DELETE /api/rascunho/:token  — remove após envio final ──
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const token = url.pathname.split('/').filter(Boolean)[2];
  if (!token) return json({ error: 'Token obrigatório' }, 400);
  try {
    await env.DB.prepare('DELETE FROM rascunhos WHERE token = ?').bind(token).run();
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Erro ao remover rascunho: ' + e.message }, 500);
  }
}
