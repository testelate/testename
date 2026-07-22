// =====================================================================
// Escavador de Comentários — parser ExportComments
// Input esperado: array de objetos (linhas), já lido via SheetJS/PapaParse
// no front-end (mesmo padrão usado no upload do GuruQuest/Tagger).
//
// O ExportComments NÃO usa o mesmo cabeçalho pra todas as plataformas:
//   - Facebook: Name, Profile ID, Date, Likes, Live video timestamp,
//               Comment, Image URLs, Comment Permalink, Depth, Mentions,
//               Reactions, Author Avatar, Comment Edited, Comment URL
//   - Instagram: Name, Username, Profile ID, Date, Likes, Comment,
//               User Verified, Thumbnail, Comment ID, Profile URL, Comment URL
//
// Diferenças importantes pro Escavador:
//   - Facebook não tem "Username" real, só Name (texto livre) e Profile ID
//     (numérico, esse sim é estável) — então a chave de autor usa Profile ID.
//   - Facebook não traz o link do post original, só um link de preview do
//     próprio ExportComments (com um UUID do job de exportação).
//   - Instagram traz Username (handle real) e o shortcode do post embutido
//     no "Comment URL" (ex: instagram.com/p/DZvXZVpjhUw/c/123456).
// =====================================================================

import { gerarIdComentario, normalizarData, normalizarAutor } from './parser-utils.js';

function detectarPlatform(headers, sourceUrl) {
  const h = headers.map(x => x.toLowerCase().trim());
  // Detecção por colunas específicas do ExportComments
  if (h.includes('username') && h.includes('user verified')) return 'instagram';
  if (h.includes('reactions') || h.includes('live video timestamp') || h.includes('comment permalink')) return 'facebook';
  // XLSX do ExportComments não tem "User Verified" — detecta pela Source URL dos metadados
  if (sourceUrl) {
    const url = sourceUrl.toLowerCase();
    if (url.includes('instagram.com')) return 'instagram';
    if (url.includes('facebook.com') || url.includes('fb.com')) return 'facebook';
    if (url.includes('tiktok.com')) return 'tiktok';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'x';
    if (url.includes('youtube.com')) return 'youtube';
  }
  // Fallback: XLSX com Username mas sem User Verified → Instagram (formato mais comum)
  if (h.includes('username') && h.includes('profile id')) return 'instagram';
  return 'desconhecido';
}

// Shortcode do post no Instagram: instagram.com/p/{shortcode}/c/{commentId}
function extrairPostIdInstagram(commentUrl) {
  if (!commentUrl) return null;
  const m = commentUrl.match(/\/p\/([A-Za-z0-9_-]+)\//);
  return m ? m[1] : null;
}

// Facebook não traz o post original — usa o UUID do job de exportação
// como proxy de post_id (válido dentro do mesmo arquivo/exportação).
// Se vocês tiverem o link real do post, passem via options.post_url.
function extrairJobIdFacebook(commentUrl) {
  if (!commentUrl) return null;
  const m = commentUrl.match(/\/done\/([a-f0-9-]+)\//);
  return m ? m[1] : null;
}

/**
 * Converte as linhas brutas do ExportComments pro schema unificado.
 * @param {Array<Object>} linhasBrutas - linhas lidas do CSV
 * @param {string} clienteId
 * @param {Object} [options]
 * @param {string} [options.post_url] - link real do post, se vocês tiverem (recomendado pro Facebook)
 * @param {string} [options.post_id] - força um post_id específico, ignorando a extração automática
 * @returns {Promise<Array<Object>>}
 */
export async function parseExportComments(linhasBrutas, clienteId, options = {}) {
  if (!linhasBrutas?.length) return [];

  const headers = Object.keys(linhasBrutas[0]);
  const sourceUrl = options.post_url || linhasBrutas[0]?.['_source_url'] || null;
  const platform = detectarPlatform(headers, sourceUrl);

  const normalizadas = [];
  for (const linha of linhasBrutas) {
    const texto = (linha['Comment'] || '').toString().trim();
    if (!texto) continue; // ignora linhas sem comentário (reações sem texto, etc.)

    const commentUrl = linha['Comment URL'] || null;
    const profileId = linha['Profile ID'] ? linha['Profile ID'].toString().trim() : null;
    const nome = linha['Name'] || null;

    let authorHandle = null;
    let authorNormalizado = null;

    if (platform === 'instagram') {
      authorHandle = linha['Username'] || null;
      // Username é estável e único no Instagram — chave primária de autor
      authorNormalizado = `ig:${normalizarAutor(authorHandle || profileId || nome)}`;
    } else if (platform === 'facebook') {
      authorHandle = null; // Facebook não expõe handle nesta exportação
      // Profile ID é numérico e estável — melhor chave que o Name (texto livre, pode repetir)
      authorNormalizado = profileId ? `fb:${profileId}` : `fb:${normalizarAutor(nome)}`;
    } else {
      authorNormalizado = normalizarAutor(nome || profileId);
    }

    let postId = options.post_id || null;
    if (!postId) {
      if (platform === 'instagram') postId = extrairPostIdInstagram(commentUrl);
      else if (platform === 'facebook') postId = extrairJobIdFacebook(commentUrl);
    }
    // Fallback: deriva da source URL do arquivo — cada XLSX vira um post_id distinto
    if (!postId && sourceUrl) {
      try {
        const u = new URL(sourceUrl);
        postId = (u.hostname + u.pathname).replace(/\/$/, '').replace(/[^a-z0-9_.\-\/]/gi, '_');
      } catch (_) {
        postId = sourceUrl.replace(/[^a-z0-9_.\-\/]/gi, '_').slice(0, 80);
      }
    }
    if (!postId) postId = 'sem-post-id';

    const base = {
      cliente_id: clienteId,
      post_id: postId,
      post_url: options.post_url || null,
      platform,
      fonte: 'exportcomments',
      author_handle: authorHandle,
      author_nome: nome,
      author_normalizado: authorNormalizado,
      texto,
      timestamp_comentario: normalizarData(linha['Date']),
      likes: parseInt(linha['Likes'], 10) || 0,
      raw_json: JSON.stringify(linha),
    };

    base.id = await gerarIdComentario(base);
    normalizadas.push(base);
  }

  return normalizadas;
}
