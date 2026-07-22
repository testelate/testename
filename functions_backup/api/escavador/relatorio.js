// functions/api/escavador/relatorio.js
// GET /api/escavador/relatorio?cliente_id=X
// Toda computação pesada (trigramas, pico de velocidade, score) fica
// no frontend — o Worker só faz SQL e devolve os dados brutos necessários.

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const clienteId = url.searchParams.get('cliente_id');
  if (!clienteId) {
    return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });
  }

  const exportRecente = await env.DB.prepare(`
    SELECT resumo_executivo, processado_em FROM escavador_exports_analise
    WHERE cliente_id = ? AND status = 'processado'
    ORDER BY processado_em DESC LIMIT 1
  `).bind(clienteId).first();

  const totaisRow = await env.DB.prepare(`
    SELECT COUNT(*) as total_comentarios,
           COUNT(DISTINCT post_id) as total_posts,
           COUNT(DISTINCT author_normalizado) as total_autores
    FROM escavador_comentarios WHERE cliente_id = ?
  `).bind(clienteId).first();

  const totalNarrativas = await env.DB.prepare(`
    SELECT COUNT(*) as cnt FROM escavador_narrativas WHERE cliente_id = ?
  `).bind(clienteId).first();

  const totais = {
    comentarios: totaisRow?.total_comentarios || 0,
    posts:       totaisRow?.total_posts || 0,
    autores:     totaisRow?.total_autores || 0,
    narrativas:  totalNarrativas?.cnt || 0,
  };

  const { results: topPosts } = await env.DB.prepare(`
    SELECT post_id, post_url, platform,
           COUNT(*) as total_comentarios,
           COUNT(DISTINCT author_normalizado) as autores_distintos
    FROM escavador_comentarios
    WHERE cliente_id = ?
    GROUP BY post_id
    ORDER BY total_comentarios DESC
    LIMIT 10
  `).bind(clienteId).all();

  const { results: autoresCoordenados } = await env.DB.prepare(`
    SELECT ec.author_normalizado,
           COUNT(DISTINCT nc.narrativa_id) as narrativas_distintas,
           COUNT(*)                         as total_comentarios
    FROM escavador_narrativa_comentarios nc
    JOIN escavador_comentarios ec ON ec.id = nc.comentario_id
    JOIN escavador_narrativas n   ON n.id  = nc.narrativa_id
    WHERE n.cliente_id = ?
    GROUP BY ec.author_normalizado
    HAVING narrativas_distintas > 1
    ORDER BY narrativas_distintas DESC, total_comentarios DESC
    LIMIT 10
  `).bind(clienteId).all();

  const { results: narrativas } = await env.DB.prepare(`
    SELECT n.*,
      (SELECT COUNT(DISTINCT ec.author_normalizado)
       FROM escavador_narrativa_comentarios nc2
       JOIN escavador_comentarios ec ON ec.id = nc2.comentario_id
       WHERE nc2.narrativa_id = n.id) AS autores_distintos
    FROM escavador_narrativas n
    WHERE n.cliente_id = ?
    ORDER BY n.comentarios_count DESC
  `).bind(clienteId).all();

  const { results: distribuicaoPlataforma } = await env.DB.prepare(`
    SELECT platform, COUNT(*) as total
    FROM escavador_comentarios
    WHERE cliente_id = ?
    GROUP BY platform ORDER BY total DESC
  `).bind(clienteId).all();

  const { results: timelineHora } = await env.DB.prepare(`
    SELECT substr(timestamp_comentario, 1, 13) as hora, COUNT(*) as total
    FROM escavador_comentarios
    WHERE cliente_id = ? AND timestamp_comentario IS NOT NULL
    GROUP BY hora ORDER BY hora ASC
  `).bind(clienteId).all();

  const { results: timeline } = await env.DB.prepare(`
    SELECT substr(timestamp_comentario, 1, 10) as dia, COUNT(*) as total
    FROM escavador_comentarios
    WHERE cliente_id = ? AND timestamp_comentario IS NOT NULL
    GROUP BY dia ORDER BY dia ASC
  `).bind(clienteId).all();

  // ── Dados brutos pra cálculo no frontend ─────────────────────────
  // Timestamps: só o campo necessário, limitado a 10k (suficiente pra pico)
  const { results: timestamps } = await env.DB.prepare(`
    SELECT timestamp_comentario, author_normalizado
    FROM escavador_comentarios
    WHERE cliente_id = ? AND timestamp_comentario IS NOT NULL
    ORDER BY timestamp_comentario ASC
    LIMIT 10000
  `).bind(clienteId).all();

  // Textos: amostra para detecção de cópias — só texto + autor, sem raw_json
  const { results: amostrasTexto } = await env.DB.prepare(`
    SELECT author_normalizado, texto, post_id
    FROM escavador_comentarios
    WHERE cliente_id = ? AND length(texto) > 20 AND length(texto) < 400
    ORDER BY timestamp_comentario DESC
    LIMIT 500
  `).bind(clienteId).all();

  const { results: arestasBrutas } = await env.DB.prepare(`
    SELECT n.id as narrativa_id, n.cluster_label, n.flag_orquestracao,
           ec.author_normalizado, COUNT(*) as peso
    FROM escavador_narrativa_comentarios nc
    JOIN escavador_comentarios ec ON ec.id = nc.comentario_id
    JOIN escavador_narrativas n ON n.id = nc.narrativa_id
    WHERE n.cliente_id = ?
    GROUP BY n.id, ec.author_normalizado
  `).bind(clienteId).all();

  const grafo = montarGrafo(arestasBrutas);

  return Response.json({
    resumo_executivo:      exportRecente?.resumo_executivo || '',
    gerado_em:             exportRecente?.processado_em || null,
    totais,
    top_posts:             topPosts,
    autores_coordenados:   autoresCoordenados,
    narrativas,
    distribuicao_plataforma: distribuicaoPlataforma,
    timeline,
    timeline_hora:         timelineHora,
    // dados brutos para processamento no frontend:
    _timestamps:           timestamps,
    _amostras_texto:       amostrasTexto,
    _narrativas_orq_count: narrativas.filter(n => n.flag_orquestracao).length,
    grafo,
  });
}

function montarGrafo(arestasBrutas, maxAutores = 40) {
  const pesoTotalPorAutor = new Map();
  arestasBrutas.forEach(a => {
    pesoTotalPorAutor.set(a.author_normalizado,
      (pesoTotalPorAutor.get(a.author_normalizado) || 0) + a.peso);
  });
  const autoresPermitidos = new Set(
    [...pesoTotalPorAutor.entries()]
      .sort((a, b) => b[1] - a[1]).slice(0, maxAutores).map(([id]) => id)
  );

  const narrativasMap = new Map();
  const autoresMap    = new Map();
  const edges         = [];

  arestasBrutas.forEach(a => {
    if (!autoresPermitidos.has(a.author_normalizado)) return;

    if (!narrativasMap.has(a.narrativa_id)) {
      narrativasMap.set(a.narrativa_id, {
        id: 'n_' + a.narrativa_id, tipo: 'narrativa',
        label: a.cluster_label, flag_orquestracao: !!a.flag_orquestracao, valor: 0,
      });
    }
    narrativasMap.get(a.narrativa_id).valor += a.peso;

    if (!autoresMap.has(a.author_normalizado)) {
      autoresMap.set(a.author_normalizado, {
        id: 'a_' + a.author_normalizado, tipo: 'autor',
        label: a.author_normalizado, valor: 0, narrativas_distintas: 0,
      });
    }
    const n = autoresMap.get(a.author_normalizado);
    n.valor += a.peso;
    n.narrativas_distintas += 1;

    edges.push({ source: 'a_' + a.author_normalizado, target: 'n_' + a.narrativa_id, peso: a.peso });
  });

  return { nodes: [...narrativasMap.values(), ...autoresMap.values()], edges };
}
