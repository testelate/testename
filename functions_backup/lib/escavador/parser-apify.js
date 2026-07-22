// =====================================================================
// Escavador de Comentários — parser Apify
// Input esperado: array de items do dataset retornado pelo actor
// (mesmo JSON que o Ekklesia já consome dos parsers de Apify).
// Cada actor (Instagram/Facebook/TikTok/X) usa nomes de campo um
// pouco diferentes — o parser tenta as variações conhecidas.
// =====================================================================

import { normalizarAutor, gerarIdComentario, normalizarData } from './parser-utils.js';

/**
 * Extrai um campo de um item testando múltiplas chaves possíveis,
 * já que actors diferentes nomeiam os campos de forma diferente.
 */
function pegar(item, chaves) {
  for (const chave of chaves) {
    if (item[chave] !== undefined && item[chave] !== null && item[chave] !== '') {
      return item[chave];
    }
  }
  return null;
}

const CAMPOS = {
  texto:    ['text', 'comment', 'commentText', 'message'],
  author:   ['ownerUsername', 'authorUsername', 'username', 'userUsername', 'author'],
  authorNome: ['ownerFullName', 'authorName', 'fullName', 'name'],
  postId:   ['postId', 'mediaId', 'videoId', 'parentId', 'id'],
  postUrl:  ['postUrl', 'url', 'inputUrl'],
  data:     ['timestamp', 'createdAt', 'createTime', 'date'],
  likes:    ['likesCount', 'likeCount', 'likes'],
};

/**
 * Converte items de um dataset Apify pro schema unificado.
 * @param {Array<Object>} items - dataset items retornados pelo actor
 * @param {string} clienteId
 * @param {string} platform - 'instagram' | 'facebook' | 'tiktok' | 'twitter' | 'youtube'
 * @returns {Promise<Array<Object>>} linhas normalizadas, prontas pra inserirComentariosD1
 */
export async function parseApify(items, clienteId, platform) {
  if (!items?.length) return [];

  const normalizadas = [];
  for (const item of items) {
    const texto = (pegar(item, CAMPOS.texto) || '').toString().trim();
    if (!texto) continue;

    const authorHandleRaw = pegar(item, CAMPOS.author);
    const authorNome = pegar(item, CAMPOS.authorNome);
    const authorNormalizado = normalizarAutor(authorHandleRaw || authorNome);
    const postId = (pegar(item, CAMPOS.postId) || pegar(item, CAMPOS.postUrl) || 'sem-post-id').toString();

    const base = {
      cliente_id: clienteId,
      post_id: postId,
      post_url: pegar(item, CAMPOS.postUrl),
      platform,
      fonte: 'apify',
      author_handle: authorHandleRaw || null,
      author_nome: authorNome || null,
      author_normalizado: authorNormalizado,
      texto,
      timestamp_comentario: normalizarData(pegar(item, CAMPOS.data)),
      likes: parseInt(pegar(item, CAMPOS.likes), 10) || 0,
      raw_json: JSON.stringify(item),
    };

    base.id = await gerarIdComentario(base);
    normalizadas.push(base);
  }

  return normalizadas;
}
