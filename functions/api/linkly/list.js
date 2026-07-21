// functions/api/linkly/list.js — HUB.nexus Linkly URL Shortener API
// GET /api/linkly/list?created_by=x (or &email=x)
// Outputs: { ok: true, links: [...] }

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
    const url = new URL(request.url);
    const createdBy = url.searchParams.get('created_by') || url.searchParams.get('email');

    let stmt;
    if (createdBy && createdBy.trim()) {
      stmt = env.DB.prepare('SELECT * FROM linkly_urls WHERE created_by = ? ORDER BY created_at DESC')
        .bind(createdBy.trim());
    } else {
      // Default fallback: return all links or top 100
      stmt = env.DB.prepare('SELECT * FROM linkly_urls ORDER BY created_at DESC LIMIT 100');
    }

    const { results } = await stmt.all();
    return json({ ok: true, links: results || [] });
  } catch (e) {
    return json({ error: 'Erro interno ao listar links: ' + e.message }, 500);
  }
}
