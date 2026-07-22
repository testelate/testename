// =====================================================================
// Escavador de Comentários — utils compartilhados pelos parsers
// =====================================================================

/**
 * Normaliza um handle/username pra permitir agrupar variações
 * (@joão_silva vs joaosilva123 vs Joao.Silva).
 * Mesma lógica de espírito do normalizador de nomes do Ekklesia,
 * adaptada pra handles (sem usar Levenshtein aqui — isso fica
 * pra etapa de merge em lote, ver mergeAutoresSimilares).
 */
export function normalizarAutor(handleOuNome) {
  if (!handleOuNome) return '';
  return handleOuNome
    .toString()
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9]/g, ''); // remove pontuação, espaços, emojis
}

/**
 * Gera um ID determinístico pro comentário, evitando duplicar
 * a mesma linha se a exportação for rodada/importada mais de uma vez.
 */
export async function gerarIdComentario({ cliente_id, post_id, author_normalizado, texto }) {
  const base = `${cliente_id}|${post_id}|${author_normalizado}|${texto}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(base);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Tenta normalizar datas em formatos variados (ExportComments e Apify
 * usam formatos diferentes por plataforma) pra ISO 8601.
 * Retorna null se não conseguir parsear — não quebra a ingestão.
 */
export function normalizarData(valor) {
  if (!valor) return null;
  const d = new Date(valor);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/**
 * Similaridade simples por trigrama (Jaccard), usada na heurística
 * de "possível ação coordenada": comentários quase-idênticos de
 * autores diferentes em janela curta de tempo.
 * Mais barata que chamar IA generativa pra esse sinal específico.
 */
export function similaridadeTrigrama(textoA, textoB) {
  const trigramas = (txt) => {
    const limpo = txt.toLowerCase().replace(/\s+/g, ' ').trim();
    const set = new Set();
    for (let i = 0; i < limpo.length - 2; i++) set.add(limpo.slice(i, i + 3));
    return set;
  };
  const a = trigramas(textoA);
  const b = trigramas(textoB);
  if (a.size === 0 || b.size === 0) return 0;
  let intersecao = 0;
  for (const t of a) if (b.has(t)) intersecao++;
  return intersecao / (a.size + b.size - intersecao); // Jaccard
}

/**
 * Insere em lote na escavador_comentarios, ignorando duplicatas
 * (graças ao UNIQUE constraint + id determinístico).
 */
export async function inserirComentariosD1(db, linhasNormalizadas) {
  const stmts = linhasNormalizadas.map(c =>
    db.prepare(`
      INSERT INTO escavador_comentarios
        (id, cliente_id, post_id, post_url, platform, fonte, author_handle,
         author_nome, author_normalizado, texto, timestamp_comentario, likes, raw_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cliente_id, post_id, author_normalizado, texto) DO NOTHING
    `).bind(
      c.id, c.cliente_id, c.post_id, c.post_url, c.platform, c.fonte,
      c.author_handle, c.author_nome, c.author_normalizado, c.texto,
      c.timestamp_comentario, c.likes, c.raw_json
    )
  );
  return db.batch(stmts);
}
