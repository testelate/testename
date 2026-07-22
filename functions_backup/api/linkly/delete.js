// functions/api/linkly/delete.js — HUB.nexus Linkly Delete URL API

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const { short_code, email } = await request.json();
    
    if (!short_code) {
      return new Response(JSON.stringify({ ok: false, error: 'Código curto não informado' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Deleta o registro no banco D1
    // Se o email for informado, validamos se o link pertence a esse criador
    let query = 'DELETE FROM linkly_urls WHERE short_code = ?';
    let params = [short_code];
    
    if (email) {
      query += ' AND created_by = ?';
      params.push(email);
    }
    
    const result = await env.DB.prepare(query).bind(...params).run();
    
    if (result.meta.changes === 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Link não encontrado ou não autorizado' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
