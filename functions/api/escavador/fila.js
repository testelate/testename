// functions/api/escavador/fila.js
// GET  /api/escavador/fila?cliente_id=X        -> lista a fila atual (pendentes primeiro)
// POST /api/escavador/fila { cliente_id, posts } -> recalcula score e salva no D1
//
// `posts` no POST vem da base de monitoramento já existente (Ekklesia/IRX):
// [{ post_id, post_url, platform, comentarios_count, sentimento_negativo_pct, timestamp, curtidas }]

import { gerarFilaPriorizacao, salvarFilaD1 } from '../../lib/escavador/fila-priorizacao.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');
  if (!clienteId) {
    return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });
  }

  const { results } = await env.DB.prepare(`
    SELECT * FROM escavador_fila_priorizacao
    WHERE cliente_id = ?
    ORDER BY status ASC, score_final DESC
  `).bind(clienteId).all();

  return Response.json({ fila: results });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { cliente_id, posts } = body;

  if (!cliente_id || !Array.isArray(posts)) {
    return Response.json({ erro: 'cliente_id e posts (array) são obrigatórios' }, { status: 400 });
  }

  const filaPriorizada = gerarFilaPriorizacao(posts, cliente_id);
  await salvarFilaD1(env.DB, filaPriorizada);

  return Response.json({ ok: true, total: filaPriorizada.length, fila: filaPriorizada });
}
