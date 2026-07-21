/* ═══════════════════════════════════════════════
   HUB.nexus — /api/studio
   CRUD de apresentações no Cloudflare D1
   ═══════════════════════════════════════════════ */

export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url    = new URL(request.url);

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (method === 'OPTIONS') return new Response(null, { headers: cors });

  // ─── GET ?id=xxx → carrega apresentação ───
  if (method === 'GET') {
    const id = url.searchParams.get('id');
    if (!id) {
      // Lista todas apresentações
      try {
        const rows = await env.DB.prepare(
          'SELECT id, name, updated_at FROM studio_presentations ORDER BY updated_at DESC LIMIT 50'
        ).all();
        return Response.json(rows.results || [], { headers: cors });
      } catch(e) {
        return Response.json([], { headers: cors });
      }
    }
    try {
      const row = await env.DB.prepare(
        'SELECT * FROM studio_presentations WHERE id = ?'
      ).bind(id).first();
      if (!row) return Response.json({ error: 'Not found' }, { status: 404, headers: cors });
      row.slides = JSON.parse(row.slides_json || '[]');
      delete row.slides_json;
      return Response.json(row, { headers: cors });
    } catch(e) {
      return Response.json({ error: e.message }, { status: 500, headers: cors });
    }
  }

  // ─── POST → salva / atualiza apresentação ───
  if (method === 'POST') {
    try {
      const body = await request.json();
      const { id, name, slides } = body;
      const slidesJson = JSON.stringify(slides || []);
      const now        = new Date().toISOString();

      if (id) {
        // Update
        await env.DB.prepare(
          'UPDATE studio_presentations SET name=?, slides_json=?, updated_at=? WHERE id=?'
        ).bind(name || 'Sem nome', slidesJson, now, id).run();
        return Response.json({ ok: true, id }, { headers: cors });
      } else {
        // Insert
        const newId = crypto.randomUUID();
        await env.DB.prepare(
          'INSERT INTO studio_presentations (id, name, slides_json, created_at, updated_at) VALUES (?,?,?,?,?)'
        ).bind(newId, name || 'Sem nome', slidesJson, now, now).run();
        return Response.json({ ok: true, id: newId }, { headers: cors });
      }
    } catch(e) {
      return Response.json({ error: e.message }, { status: 500, headers: cors });
    }
  }

  // ─── DELETE ?id=xxx ───
  if (method === 'DELETE') {
    const id = url.searchParams.get('id');
    if (!id) return Response.json({ error: 'id required' }, { status: 400, headers: cors });
    try {
      await env.DB.prepare('DELETE FROM studio_presentations WHERE id=?').bind(id).run();
      return Response.json({ ok: true }, { headers: cors });
    } catch(e) {
      return Response.json({ error: e.message }, { status: 500, headers: cors });
    }
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405, headers: cors });
}
