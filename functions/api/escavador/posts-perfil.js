// functions/api/escavador/posts-perfil.js
// POST /api/escavador/posts-perfil { cliente_id, username, posts }
//   posts: [{ post_id, post_url, platform, legenda, curtidas,
//             comentarios_count, compartilhamentos, timestamp_publicacao }]
//   -> grava em escavador_posts_perfil e já gera a fila de priorização
//      (origem='perfil_supermetrics') pronta pra virar lotes de extração.
//
// GET /api/escavador/posts-perfil?cliente_id=X -> lista o pool atual

import { gerarFilaPriorizacao, salvarFilaD1 } from '../../lib/escavador/fila-priorizacao.js';

function genId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const arr = crypto.getRandomValues(new Uint8Array(12));
  arr.forEach(b => id += chars[b % chars.length]);
  return id;
}

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');
  if (!clienteId) return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });

  const { results } = await env.DB.prepare(`
    SELECT * FROM escavador_posts_perfil WHERE cliente_id = ? ORDER BY timestamp_publicacao DESC
  `).bind(clienteId).all();

  return Response.json({ posts: results });
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { cliente_id, username, posts } = body;

  if (!cliente_id || !Array.isArray(posts) || !posts.length) {
    return Response.json({ erro: 'cliente_id e posts (array não vazio) são obrigatórios' }, { status: 400 });
  }

  const stmts = posts.map(p => {
    const id = genId();
    return env.DB.prepare(`
      INSERT INTO escavador_posts_perfil
        (id, cliente_id, username, platform, post_id, post_url, legenda,
         curtidas, comentarios_count, compartilhamentos, timestamp_publicacao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cliente_id, post_id) DO UPDATE SET
        curtidas = excluded.curtidas,
        comentarios_count = excluded.comentarios_count,
        compartilhamentos = excluded.compartilhamentos
    `).bind(
      id, cliente_id, username || p.username || '', p.platform || '',
      p.post_id || p.post_url || id, p.post_url || null, p.legenda || '',
      p.curtidas || 0, p.comentarios_count || 0, p.compartilhamentos || 0,
      p.timestamp_publicacao || null
    );
  });
  await env.DB.batch(stmts);

  // Já gera a fila de priorização a partir desse pool, marcada como
  // origem='perfil_supermetrics' — o usuário segue direto pra aba de lotes.
  const postsParaScore = posts.map(p => ({
    post_id: p.post_id || p.post_url,
    post_url: p.post_url,
    platform: p.platform,
    comentarios_count: p.comentarios_count || 0,
    sentimento_negativo_pct: 0, // não disponível vindo do Ekklesia; pondera só por volume/recência/alcance
    timestamp: p.timestamp_publicacao,
    curtidas: p.curtidas || 0,
  }));

  const fila = gerarFilaPriorizacao(postsParaScore, cliente_id, 'perfil_supermetrics');
  await salvarFilaD1(env.DB, fila);

  return Response.json({ ok: true, total_posts: posts.length, total_fila: fila.length });
}
