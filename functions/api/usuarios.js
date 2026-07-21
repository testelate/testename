// api/usuarios.js — HUB.nexus Usuários via Cloudflare D1
// GET  /api/usuarios        → lista todos os usuários
// POST /api/usuarios        → upsert pelo email

const CORS = {
  'Access-Control-Allow-Origin':  'https://hub-nexus.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── GET — lista usuários ou busca por email ───────────────────
export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const email = url.searchParams.get('email');

    if (email) {
      const row = await env.DB
        .prepare('SELECT * FROM usuarios WHERE email = ? LIMIT 1')
        .bind(email.toLowerCase().trim())
        .first();
      return json(row || null);
    }

    const { results } = await env.DB
      .prepare('SELECT * FROM usuarios ORDER BY nome ASC')
      .all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── POST — upsert (cria ou ignora se email já existe) ─────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { nome, email } = body;

  if (!email || !email.includes('@')) {
    return json({ error: 'E-mail inválido' }, 400);
  }

  try {
    await env.DB
      .prepare(`
        INSERT INTO usuarios (nome, email)
        VALUES (?, ?)
        ON CONFLICT(email) DO UPDATE SET nome = excluded.nome
      `)
      .bind(
        nome || email.split('@')[0],
        email.toLowerCase().trim(),
      )
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
