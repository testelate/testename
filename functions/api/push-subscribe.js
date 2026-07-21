// functions/api/push-subscribe.js
// POST   /api/push-subscribe  → salva subscription do usuário
// DELETE /api/push-subscribe  → remove subscription

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { email, subscription } = body;
  if (!email || !subscription) return json({ error: 'email e subscription obrigatórios' }, 400);

  try {
    await env.DB
      .prepare(`UPDATE usuarios SET push_subscription = ? WHERE email = ?`)
      .bind(JSON.stringify(subscription), email.toLowerCase().trim())
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { email } = body;
  if (!email) return json({ error: 'email obrigatório' }, 400);

  try {
    await env.DB
      .prepare(`UPDATE usuarios SET push_subscription = NULL WHERE email = ?`)
      .bind(email.toLowerCase().trim())
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
