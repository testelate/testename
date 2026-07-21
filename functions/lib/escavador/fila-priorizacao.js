// =====================================================================
// Escavador de Comentários — fila de priorização
// Decide, entre todos os posts monitorados de um cliente (vindos do
// Ekklesia/IRX), quais merecem uma das 5 vagas de extração do
// ExportComments.
//
// Pesos (ajustáveis): volume > sentimento/risco > recência > alcance.
// Volume é o que mais importa porque padrão de perfil repetido ou
// narrativa orquestrada só aparece com massa de comentários — um post
// com 10 comentários não tem amostra suficiente, mesmo que tenha
// viralizado em curtidas.
// =====================================================================

const PESOS = {
  volume: 0.40,
  sentimento: 0.30,
  recencia: 0.20,
  alcance: 0.10,
};

const JANELA_RECENCIA_HORAS = 48; // posts dentro dessa janela pontuam o máximo em recência

/**
 * Normaliza um valor pro intervalo 0-1 dado o máximo do lote.
 * Evita que um outlier (ex: um post com 50k comentários) zere
 * o score de todos os outros — usa raiz quadrada pra suavizar.
 */
function normalizar(valor, maximo) {
  if (!maximo || maximo <= 0) return 0;
  const ratio = Math.min(valor / maximo, 1);
  return Math.sqrt(ratio); // suaviza outliers, mantém ordenação
}

function scoreRecencia(timestampPost) {
  if (!timestampPost) return 0;
  const horasDesdePost = (Date.now() - new Date(timestampPost).getTime()) / 3_600_000;
  if (horasDesdePost < 0) return 1; // post "futuro" (clock skew) — trata como recente
  if (horasDesdePost >= JANELA_RECENCIA_HORAS * 4) return 0; // muito antigo, zera
  return Math.max(0, 1 - horasDesdePost / (JANELA_RECENCIA_HORAS * 4));
}

/**
 * Calcula o score de um post dado o contexto (máximos do lote pra normalização).
 * @param {Object} post - { post_id, post_url, platform, comentarios_count,
 *                           sentimento_negativo_pct (0-1), timestamp, curtidas }
 * @param {Object} maximos - { comentarios_count, curtidas }
 */
function calcularScore(post, maximos) {
  const scoreVolume = normalizar(post.comentarios_count || 0, maximos.comentarios_count);
  const scoreSentimento = Math.max(0, Math.min(1, post.sentimento_negativo_pct || 0));
  const scoreRec = scoreRecencia(post.timestamp);
  const scoreAlc = normalizar(post.curtidas || 0, maximos.curtidas);

  const final =
    scoreVolume * PESOS.volume +
    scoreSentimento * PESOS.sentimento +
    scoreRec * PESOS.recencia +
    scoreAlc * PESOS.alcance;

  return {
    score_final: Number(final.toFixed(4)),
    score_volume: Number(scoreVolume.toFixed(4)),
    score_sentimento: Number(scoreSentimento.toFixed(4)),
    score_recencia: Number(scoreRec.toFixed(4)),
    score_alcance: Number(scoreAlc.toFixed(4)),
  };
}

/**
 * Gera a fila de priorização ordenada (maior score primeiro) a partir
 * de uma lista de posts monitorados (vindos do Ekklesia/IRX).
 * @param {Array<Object>} posts
 * @param {string} clienteId
 * @returns {Array<Object>} posts com score, ordenados, prontos pra
 *          inserir em escavador_fila_priorizacao ou exibir na UI
 */
export function gerarFilaPriorizacao(posts, clienteId, origem) {
  if (!posts?.length) return [];

  const maximos = {
    comentarios_count: Math.max(...posts.map(p => p.comentarios_count || 0)),
    curtidas: Math.max(...posts.map(p => p.curtidas || 0)),
  };

  return posts
    .map(post => {
      const scores = calcularScore(post, maximos);
      return {
        id: `${clienteId}:${post.post_id}`,
        cliente_id: clienteId,
        post_id: post.post_id,
        post_url: post.post_url,
        platform: post.platform || null,
        origem: origem || null,
        ...scores,
        metricas_origem: JSON.stringify({
          comentarios_count: post.comentarios_count || 0,
          sentimento_negativo_pct: post.sentimento_negativo_pct || 0,
          timestamp: post.timestamp || null,
          curtidas: post.curtidas || 0,
        }),
        status: 'pendente',
      };
    })
    .sort((a, b) => b.score_final - a.score_final);
}

/**
 * Agrupa a fila selecionada em LOTES pra extração no ExportComments.
 * O campo "comments per URL" do formulário deles é único por lote
 * (todas as URLs daquele job usam o mesmo cap) — então a forma certa
 * de dar mais cota aos posts prioritários é rodar lotes separados,
 * cada um com seu próprio cap, em vez de tentar variar por linha.
 *
 * Ex. com orçamento 50.000 e 25 posts selecionados, 2 camadas:
 *   Lote 1 (top 5, maior prioridade)  -> cap mais alto por URL
 *   Lote 2 (próximos 20)              -> cap menor por URL
 *
 * @param {Array<Object>} filaTop - posts selecionados (com score_final), já ordenados
 * @param {number} orcamentoTotal - limite do plano (ex: 50000 comentários/extração)
 * @param {Array<number>} tamanhosCamadas - quantos posts em cada camada, em ordem de prioridade (ex: [5, 20])
 * @returns {Array<{camada, posts, cap_por_url, urls}>}
 */
export function agruparEmLotes(filaTop, orcamentoTotal = 50000, tamanhosCamadas = [5, 20]) {
  if (!filaTop?.length) return [];

  // pesos de orçamento por camada: a primeira camada leva proporcionalmente mais
  // (ex: 2 camadas -> 65%/35%; ajustável conforme o número de camadas)
  const pesosPadrao = [0.65, 0.35, 0.20]; // usado conforme o índice da camada, normalizado depois
  const pesosUsados = tamanhosCamadas.map((_, i) => pesosPadrao[i] ?? 0.15);
  const somaPesos = pesosUsados.reduce((a, b) => a + b, 0);

  const lotes = [];
  let cursor = 0;
  tamanhosCamadas.forEach((tamanho, i) => {
    const posts = filaTop.slice(cursor, cursor + tamanho);
    cursor += tamanho;
    if (!posts.length) return;

    const orcamentoCamada = orcamentoTotal * (pesosUsados[i] / somaPesos);
    const capPorUrl = Math.floor(orcamentoCamada / posts.length);

    lotes.push({
      camada: i + 1,
      posts: posts.map(p => ({ post_id: p.post_id, post_url: p.post_url, score_final: p.score_final })),
      cap_por_url: capPorUrl,
      urls: posts.map(p => p.post_url), // já pronto pra colar no formulário
    });
  });

  return lotes;
}

/**
 * Retorna só as top N URLs, no formato pronto pra colar no
 * formulário de bulk do ExportComments (uma URL por linha).
 * Plano atual permite até 25 URLs por lote.
 */
export function topUrlsParaExtracao(filaPriorizada, n = 25) {
  return filaPriorizada
    .filter(p => p.status === 'pendente')
    .slice(0, n)
    .map(p => p.post_url);
}

/**
 * Insere/atualiza a fila no D1.
 */
export async function salvarFilaD1(db, filaPriorizada) {
  const stmts = filaPriorizada.map(p =>
    db.prepare(`
      INSERT INTO escavador_fila_priorizacao
        (id, cliente_id, post_id, post_url, platform, score_final,
         score_volume, score_sentimento, score_recencia, score_alcance,
         metricas_origem, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(cliente_id, post_id) DO UPDATE SET
        score_final = excluded.score_final,
        score_volume = excluded.score_volume,
        score_sentimento = excluded.score_sentimento,
        score_recencia = excluded.score_recencia,
        score_alcance = excluded.score_alcance,
        metricas_origem = excluded.metricas_origem
      WHERE escavador_fila_priorizacao.status = 'pendente'
    `).bind(
      p.id, p.cliente_id, p.post_id, p.post_url, p.platform, p.score_final,
      p.score_volume, p.score_sentimento, p.score_recencia, p.score_alcance,
      p.metricas_origem, p.status
    )
  );
  return db.batch(stmts);
}

/**
 * Marca posts como já extraídos (depois que você roda o bulk export
 * no ExportComments e importa o resultado pelo parser).
 */
export async function marcarExtraidoD1(db, clienteId, postIds) {
  const stmts = postIds.map(postId =>
    db.prepare(`
      UPDATE escavador_fila_priorizacao
      SET status = 'extraido', extraido_em = datetime('now')
      WHERE cliente_id = ? AND post_id = ?
    `).bind(clienteId, postId)
  );
  return db.batch(stmts);
}
