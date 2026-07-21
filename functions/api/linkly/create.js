// functions/api/linkly/create.js — HUB.nexus Linkly URL Shortener API
// POST /api/linkly/create
// Inputs: { original_url, created_by }
// Outputs: { ok: true, short_code, url_curta: "/l/{short_code}" }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
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

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'JSON inválido' }, 400);
  }

  const { original_url, created_by } = body;

  if (!original_url) {
    return json({ error: 'original_url é obrigatória.' }, 400);
  }

  // Basic URL verification
  if (!original_url.startsWith('http://') && !original_url.startsWith('https://')) {
    return json({ error: 'original_url inválida (deve começar com http:// ou https://)' }, 400);
  }

  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let shortCode = '';
  let success = false;
  let attempts = 0;

  while (!success && attempts < 10) {
    attempts++;
    shortCode = '';
    for (let i = 0; i < 6; i++) {
      shortCode += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const uuid = crypto.randomUUID();

    try {
      await env.DB.prepare(`
        INSERT INTO linkly_urls (id, original_url, short_code, clicks, created_by, created_at)
        VALUES (?, ?, ?, 0, ?, datetime('now'))
      `).bind(
        uuid,
        original_url.trim(),
        shortCode,
        created_by ? created_by.trim() : null
      ).run();
      success = true;
    } catch (e) {
      if (e.message && e.message.includes('UNIQUE constraint failed')) {
        continue;
      }
      return json({ error: 'Erro no banco de dados: ' + e.message }, 500);
    }
  }

  if (!success) {
    return json({ error: 'Falha ao gerar um código curto único após várias tentativas.' }, 500);
  }

  return json({ ok: true, short_code: shortCode, url_curta: `/l/${shortCode}` });
}
