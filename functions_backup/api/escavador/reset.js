// functions/api/escavador/reset.js
// POST /api/escavador/reset { cliente_id }
// Apaga todos os dados do Escavador para um cliente específico:
// comentários, fila de priorização, pool de posts, exports e narrativas.
// Usado pelo botão "Zerar base" na UI.

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { cliente_id } = body;

  if (!cliente_id) {
    return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });
  }

  const tabelas = [
    'escavador_comentarios',
    'escavador_fila_priorizacao',
    'escavador_posts_perfil',
    'escavador_exports_analise',
    'escavador_narrativas',
  ];

  // narrativa_comentarios e export_itens são filhos — apagar via narrativas/exports
  await env.DB.batch([
    // filhos primeiro pra não violar FK implícita
    env.DB.prepare(`
      DELETE FROM escavador_narrativa_comentarios
      WHERE narrativa_id IN (
        SELECT id FROM escavador_narrativas WHERE cliente_id = ?
      )
    `).bind(cliente_id),
    env.DB.prepare(`
      DELETE FROM escavador_export_itens
      WHERE export_id IN (
        SELECT id FROM escavador_exports_analise WHERE cliente_id = ?
      )
    `).bind(cliente_id),
    // pais
    ...tabelas.map(t =>
      env.DB.prepare(`DELETE FROM ${t} WHERE cliente_id = ?`).bind(cliente_id)
    ),
  ]);

  return Response.json({ ok: true, cliente_id });
}
