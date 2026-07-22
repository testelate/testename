// functions/api/escavador/comentarios.js
// GET /api/escavador/comentarios?cliente_id=X&post_id=&autor=&limit=200
//   -> lista de comentários (com filtros opcionais) + agregado de autores recorrentes
//
// "Autor recorrente" = aparece em mais de 1 post distinto desse cliente.
// É o sinal mais direto que a Kath/Aline pediram (mesmo perfil em vários posts).

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');
  const postId = url.searchParams.get('post_id');
  const autor = url.searchParams.get('autor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 1000);

  if (!clienteId) {
    return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });
  }

  let query = `SELECT * FROM escavador_comentarios WHERE cliente_id = ?`;
  const params = [clienteId];

  if (postId) { query += ` AND post_id = ?`; params.push(postId); }
  if (autor) { query += ` AND author_normalizado = ?`; params.push(autor); }
  query += ` ORDER BY timestamp_comentario DESC LIMIT ?`;
  params.push(limit);

  const { results: comentarios } = await env.DB.prepare(query).bind(...params).all();

  // Autores recorrentes: aparecem em mais de 1 post distinto
  const { results: autoresRecorrentes } = await env.DB.prepare(`
    SELECT
      author_normalizado,
      COUNT(*) as total_comentarios,
      COUNT(DISTINCT post_id) as posts_distintos,
      MIN(timestamp_comentario) as primeira_aparicao,
      MAX(timestamp_comentario) as ultima_aparicao
    FROM escavador_comentarios
    WHERE cliente_id = ?
    GROUP BY author_normalizado
    HAVING posts_distintos > 1
    ORDER BY posts_distintos DESC, total_comentarios DESC
    LIMIT 50
  `).bind(clienteId).all();

  return Response.json({ comentarios, autores_recorrentes: autoresRecorrentes });
}
