// functions/api/escavador/narrativas.js
// GET /api/escavador/narrativas?cliente_id=X
// Lista as narrativas já gravadas pra esse cliente, com contagem de
// autores distintos calculada na hora (não fica armazenada, pra não
// desatualizar se mais comentários entrarem depois).

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');
  if (!clienteId) {
    return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });
  }

  const { results: narrativas } = await env.DB.prepare(`
    SELECT n.*,
      (SELECT COUNT(DISTINCT ec.author_normalizado)
       FROM escavador_narrativa_comentarios nc
       JOIN escavador_comentarios ec ON ec.id = nc.comentario_id
       WHERE nc.narrativa_id = n.id) AS autores_distintos
    FROM escavador_narrativas n
    WHERE n.cliente_id = ?
    ORDER BY n.criado_em DESC
  `).bind(clienteId).all();

  return Response.json({ narrativas });
}
