// functions/api/escavador/importar.js
// POST /api/escavador/importar
// body: {
//   cliente_id, fonte: 'exportcomments' | 'apify',
//   platform (obrigatório se fonte='apify'; auto-detectado se 'exportcomments'),
//   linhas: [...],            // linhas já lidas no front via PapaParse (CSV) ou JSON (Apify)
//   post_url, post_id         // opcionais — override manual (recomendado pro Facebook)
// }
//
// Retorna uma prévia (contagens) ANTES de confirmar a gravação definitiva,
// pra UI mostrar "X comentários, Y autores únicos" antes do usuário confirmar.
// Confirmação definitiva: mesma chamada com confirmar: true.

import { parseExportComments } from '../../lib/escavador/parser-exportcomments.js';
import { parseApify } from '../../lib/escavador/parser-apify.js';
import { inserirComentariosD1 } from '../../lib/escavador/parser-utils.js';
import { marcarExtraidoD1 } from '../../lib/escavador/fila-priorizacao.js';

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { cliente_id, fonte, platform, linhas, post_url, post_id, confirmar } = body;

  if (!cliente_id || !fonte || !Array.isArray(linhas)) {
    return Response.json({ erro: 'cliente_id, fonte e linhas (array) são obrigatórios' }, { status: 400 });
  }

  let normalizadas;
  try {
    if (fonte === 'exportcomments') {
      normalizadas = await parseExportComments(linhas, cliente_id, { post_url, post_id });
    } else if (fonte === 'apify') {
      if (!platform) return Response.json({ erro: 'platform é obrigatório pra fonte apify' }, { status: 400 });
      normalizadas = await parseApify(linhas, cliente_id, platform);
    } else {
      return Response.json({ erro: `fonte desconhecida: ${fonte}` }, { status: 400 });
    }
  } catch (e) {
    return Response.json({ erro: e.message }, { status: 422 });
  }

  const autoresUnicos = new Set(normalizadas.map(c => c.author_normalizado)).size;
  const postsUnicos = new Set(normalizadas.map(c => c.post_id)).size;

  // Modo prévia: não grava nada ainda, só mostra o que seria importado
  if (!confirmar) {
    return Response.json({
      previa: true,
      total_comentarios: normalizadas.length,
      autores_unicos: autoresUnicos,
      posts_unicos: postsUnicos,
      platform: normalizadas[0]?.platform || platform,
      precisa_post_url: fonte === 'exportcomments' && normalizadas[0]?.platform === 'facebook' && !post_url,
      amostra: normalizadas.slice(0, 3),
    });
  }

  await inserirComentariosD1(env.DB, normalizadas);

  // Marca a fila de priorização como extraída pros posts que vieram dela
  const postIds = [...new Set(normalizadas.map(c => c.post_id))];
  try {
    await marcarExtraidoD1(env.DB, cliente_id, postIds);
  } catch (_) {
    // não falha a importação se o post não estava na fila (import manual/ad-hoc)
  }

  return Response.json({
    ok: true,
    total_comentarios: normalizadas.length,
    autores_unicos: autoresUnicos,
    posts_unicos: postsUnicos,
  });
}
