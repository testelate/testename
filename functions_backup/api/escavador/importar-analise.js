// functions/api/escavador/importar-analise.js
// POST /api/escavador/importar-analise { export_id, narrativas }
// `narrativas`: [{ rotulo, descricao, suspeita_orquestracao, comentarios: [1,5,9] }]
// Resolve os índices numéricos pros comentario_id reais (via
// escavador_export_itens) e grava em escavador_narrativas +
// escavador_narrativa_comentarios.

function genId(prefix) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const arr = crypto.getRandomValues(new Uint8Array(12));
  arr.forEach(b => id += chars[b % chars.length]);
  return `${prefix}-${id}`;
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { export_id, narrativas, resumo_executivo } = body;

  if (!export_id || !Array.isArray(narrativas)) {
    return Response.json({ erro: 'export_id e narrativas (array) são obrigatórios' }, { status: 400 });
  }

  const exportRow = await env.DB.prepare(`
    SELECT * FROM escavador_exports_analise WHERE id = ?
  `).bind(export_id).first();

  if (!exportRow) {
    return Response.json({ erro: 'export_id não encontrado — gere o TXT novamente antes de colar o resultado.' }, { status: 404 });
  }

  // Busca os itens em páginas de 1000 pra não estourar CPU do Worker
  const mapaIndice = new Map();
  let offset = 0;
  while (true) {
    const { results: pagina } = await env.DB.prepare(`
      SELECT indice, comentario_id FROM escavador_export_itens
      WHERE export_id = ? ORDER BY indice LIMIT 1000 OFFSET ?
    `).bind(export_id, offset).all();
    pagina.forEach(i => mapaIndice.set(i.indice, i.comentario_id));
    if (pagina.length < 1000) break;
    offset += 1000;
  }

  const stmts = [];
  const resumo = [];
  let indicesNaoEncontrados = 0;

  for (const n of narrativas) {
    if (!n.rotulo || !Array.isArray(n.comentarios)) continue;

    const narrativaId = genId('narr');
    const comentarioIds = [];
    for (const indice of n.comentarios) {
      const comentarioId = mapaIndice.get(Number(indice));
      if (!comentarioId) { indicesNaoEncontrados++; continue; }
      comentarioIds.push(comentarioId);
    }
    if (!comentarioIds.length) continue;

    stmts.push(env.DB.prepare(`
      INSERT INTO escavador_narrativas
        (id, cliente_id, cluster_label, descricao_ia, comentarios_count, flag_orquestracao,
         tom, confianca_orquestracao, justificativa_orquestracao, export_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      narrativaId, exportRow.cliente_id, n.rotulo, n.descricao || '',
      comentarioIds.length, n.suspeita_orquestracao ? 1 : 0,
      n.tom || '', n.confianca_orquestracao || '', n.justificativa_orquestracao || '', export_id
    ));

    comentarioIds.forEach(cId => {
      stmts.push(env.DB.prepare(`
        INSERT INTO escavador_narrativa_comentarios (narrativa_id, comentario_id)
        VALUES (?, ?)
        ON CONFLICT(narrativa_id, comentario_id) DO NOTHING
      `).bind(narrativaId, cId));
    });

    resumo.push({
      id: narrativaId, rotulo: n.rotulo, comentarios: comentarioIds.length,
      suspeita_orquestracao: !!n.suspeita_orquestracao, tom: n.tom || '',
    });
  }

  if (!stmts.length) {
    return Response.json({ erro: 'Nenhuma narrativa válida pra gravar — confira o formato do JSON colado.' }, { status: 422 });
  }

  // Processar em chunks de 15 pra não estourar CPU limit do Worker
  const CHUNK = 15;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await env.DB.batch(stmts.slice(i, i + CHUNK));
  }

  await env.DB.prepare(`
    UPDATE escavador_exports_analise SET status = 'processado', processado_em = datetime('now'), resumo_executivo = ? WHERE id = ?
  `).bind(resumo_executivo || '', export_id).run();

  return Response.json({
    ok: true,
    narrativas_gravadas: resumo.length,
    indices_nao_encontrados: indicesNaoEncontrados,
    resumo,
  });
}
