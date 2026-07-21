// functions/api/escavador/exportar-analise.js
// POST /api/escavador/exportar-analise { cliente_id, limite? }

const LIMITE_PADRAO = 50000;

const PROMPT_TEMPLATE = `Você é um analista sênior de inteligência digital especializado em detecção de Comportamento Coordenado Inautêntico (CIB). Vai analisar uma base de comentários de redes sociais coletada para monitoramento de reputação — frequentemente em contexto de crise de imagem, disputa de narrativa pública ou suspeita de astroturfing.

Seu objetivo é identificar:
1. QUAIS narrativas estruturam o debate (agrupamento temático)
2. O QUE cada narrativa representa (argumento real, não só sentimento)
3. SE há sinais de orquestração por trás de alguma narrativa (Comportamento Coordenado Inautêntico)

══════════════════════════════════════════════════════════════
CONTEXTO METODOLÓGICO — leia antes de analisar
══════════════════════════════════════════════════════════════

Os comentários podem vir de posts diferentes e plataformas diferentes (Instagram, Facebook, TikTok, X/Twitter). Cada linha inclui: número de índice [N], autor anonimizado, ID do post de origem e timestamp. Use essas informações para detectar padrões — não ignore o autor e o post, eles são tão importantes quanto o texto.

SOBRE COMPORTAMENTO COORDENADO INAUTÊNTICO (CIB):
O CIB ocorre quando um conjunto de contas age de forma orquestrada para amplificar artificialmente uma narrativa, criando a ilusão de consenso orgânico. Manifesta-se em três dimensões que você deve investigar:

  DIMENSÃO DE REDE — "quem fala junto"
  → Autores que aparecem em múltiplos posts comentando SEMPRE na mesma direção
  → Pequenos grupos que concentram volume desproporcional de comentários
  → Ausência de variação: os mesmos perfis, sempre a mesma postura

  DIMENSÃO TEMPORAL — "quando falam"
  → Rajadas: muitos comentários similares em janela de poucos minutos de autores distintos
  → Padrão de turno: atividade que some em horários noturnos locais (sinal de automação)
  → Sincronização: comentários quase simultâneos após publicação do post

  DIMENSÃO SEMÂNTICA — "como falam"
  → Texto quase-idêntico entre autores diferentes (mesma frase, mesmo erro de digitação, mesma estrutura atípica) — sinal FORTE de roteiro compartilhado
  → Vocabulário padronizado: termos muito específicos repetidos por autores sem relação aparente
  → Ausência de variação estilística: textos que parecem gerados da mesma fonte

IMPORTANTE: Distingua CIB de debate orgânico. Múltiplas pessoas com a mesma opinião sobre um fato público NÃO é CIB. CIB exige a combinação de pelo menos dois sinais das três dimensões acima.

══════════════════════════════════════════════════════════════
TAREFA 1 — NARRATIVAS
══════════════════════════════════════════════════════════════

Agrupe os comentários por tema/argumento predominante. Cada narrativa deve capturar um argumento específico — não apenas um sentimento genérico.

Narrativas válidas: "defesa da medida X citando Y", "acusação de Z sem evidência", "ironia sobre o fato", "cobrança de posicionamento", "elogio ao produto/pessoa", "desinformação sobre tema W".
Narrativas inválidas como rótulo isolado: "positivo", "negativo", "comentários gerais".

Regras:
- Todo comentário deve ir para exatamente uma narrativa
- Comentários sem conteúdo verbal (só emoji, saudações, sem argumento) → narrativa "Outros / sem conteúdo classificável", suspeita_orquestracao: false
- Evite narrativas com comentário único (exceto ameaças, denúncias graves ou conteúdo atípico relevante)
- Se detectar sub-grupos claramente distintos dentro de um mesmo tema, separe em narrativas diferentes

══════════════════════════════════════════════════════════════
TAREFA 2 — DETECÇÃO DE CIB (suspeita de orquestração)
══════════════════════════════════════════════════════════════

Para cada narrativa, investigue ativamente os três sinais:

SINAL FORTE (sozinho já justifica suspeita):
  ✦ Texto quase-idêntico de autores diferentes (cite os índices: "comentários [12] e [47] têm 90% do texto igual")
  ✦ Rajada temporal: 10+ comentários da mesma narrativa em menos de 5 minutos de autores distintos

SINAL MÉDIO (requer combinação com outro):
  ✦ Mesmo pequeno grupo de autores aparecendo em narrativas/posts diferentes sempre na mesma direção
  ✦ Nomes de usuário com padrão suspeito (sequenciais, gerados, aleatórios) todos comentando similar
  ✦ Ausência total de variação estilística (parece template)

SINAL FRACO (apenas contextualiza):
  ✦ Volume desproporcional de uma narrativa vs. as demais sem motivo aparente
  ✦ Autores com histórico de comentário único na base (contas de uso único)

Para cada narrativa com suspeita_orquestracao: true:
- Indique confianca_orquestracao: "baixa" | "media" | "alta"
- Em justificativa_orquestracao: cite QUAL sinal detectou e em QUAIS índices (ex: "comentários [23], [67] e [112] têm texto quase-idêntico apesar de autores distintos; autor ig:xyz aparece em 3 posts diferentes sempre com a mesma mensagem")

NÃO marque suspeita só porque muita gente concorda com algo. O debate orgânico legítimo pode ser intenso e unânime.

══════════════════════════════════════════════════════════════
TAREFA 3 — RESUMO EXECUTIVO
══════════════════════════════════════════════════════════════

Escreva 4 a 6 frases para lideranças não-técnicas. Responda implicitamente:
- Qual é o tom geral do debate?
- Quais são as 2-3 narrativas que mais concentram volume?
- Há sinais de orquestração? Se sim, qual é a gravidade?
- O que isso significa para a gestão de crise/comunicação?

Escreva com precisão analítica — sem sensacionalismo, sem eufemismos. Se não há sinais de CIB, diga claramente que o debate parece orgânico.

══════════════════════════════════════════════════════════════
FORMATO DE RESPOSTA
══════════════════════════════════════════════════════════════

Responda SOMENTE com JSON válido, sem markdown, sem texto antes ou depois:

{
  "resumo_executivo": "4 a 6 frases para lideranças",
  "narrativas": [
    {
      "rotulo": "nome curto e descritivo da narrativa",
      "descricao": "1-2 frases explicando o argumento central e o que o grupo defende ou ataca",
      "tom": "positivo" | "negativo" | "neutro" | "misto",
      "suspeita_orquestracao": true | false,
      "confianca_orquestracao": "baixa" | "media" | "alta" | "",
      "justificativa_orquestracao": "cite sinais concretos e índices dos comentários; vazio se false",
      "comentarios": [1, 5, 9, 14]
    }
  ]
}

Use APENAS os números de índice [N] para referenciar comentários — nunca copie o texto, nunca invente índices inexistentes.

BASE DE COMENTÁRIOS (formato: [índice] autor | post_id | timestamp | texto)
==========================================================================
`;

function genExportId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  const arr = crypto.getRandomValues(new Uint8Array(16));
  arr.forEach(b => id += chars[b % chars.length]);
  return id;
}

export async function onRequestPost({ request, env }) {
  const body = await request.json();
  const { cliente_id, limite } = body;

  if (!cliente_id) {
    return Response.json({ erro: 'cliente_id é obrigatório' }, { status: 400 });
  }

  const teto = limite || LIMITE_PADRAO;

  // Busca ordenando por post + timestamp — mantém comentários do mesmo post juntos,
  // o que ajuda a IA a detectar rajadas temporais dentro de uma publicação
  const { results: comentarios } = await env.DB.prepare(`
    SELECT id, author_normalizado, post_id, texto, timestamp_comentario
    FROM escavador_comentarios
    WHERE cliente_id = ?
    ORDER BY post_id, timestamp_comentario ASC
    LIMIT ?
  `).bind(cliente_id, teto + 1).all();

  const truncado = comentarios.length > teto;
  const selecionados = comentarios.slice(0, teto);

  if (!selecionados.length) {
    return Response.json({ erro: 'Nenhum comentário encontrado pra esse cliente.' }, { status: 404 });
  }

  // Injeta estatísticas pré-calculadas no cabeçalho do TXT
  // para ajudar a IA a contextualizar a escala antes de ler os comentários
  const totalAutores = new Set(selecionados.map(c => c.author_normalizado)).size;
  const totalPosts = new Set(selecionados.map(c => c.post_id)).size;
  const autoresComMaisDeUm = (() => {
    const cnt = new Map();
    selecionados.forEach(c => cnt.set(c.author_normalizado, (cnt.get(c.author_normalizado) || 0) + 1));
    return [...cnt.values()].filter(v => v > 1).length;
  })();

  const estatisticas = `
ESTATÍSTICAS DA BASE (calculadas automaticamente):
- Total de comentários: ${selecionados.length}
- Autores distintos: ${totalAutores}
- Posts distintos: ${totalPosts}
- Autores com mais de 1 comentário: ${autoresComMaisDeUm} (${((autoresComMaisDeUm/totalAutores)*100).toFixed(1)}% do total de autores)
- Média de comentários por autor: ${(selecionados.length / totalAutores).toFixed(1)}
${truncado ? `- AVISO: base truncada em ${teto} comentários — considere dividir a análise` : ''}

`;

  const exportId = genExportId();

  await env.DB.prepare(`
    INSERT INTO escavador_exports_analise (id, cliente_id, total_comentarios, status)
    VALUES (?, ?, ?, 'pendente')
  `).bind(exportId, cliente_id, selecionados.length).run();

  const stmts = selecionados.map((c, i) =>
    env.DB.prepare(`
      INSERT INTO escavador_export_itens (export_id, indice, comentario_id)
      VALUES (?, ?, ?)
    `).bind(exportId, i + 1, c.id)
  );
  // Chunk de 50 pra não estourar CPU limit do Worker
  for (let i = 0; i < stmts.length; i += 50) {
    await env.DB.batch(stmts.slice(i, i + 50));
  }

  const linhasBase = selecionados.map((c, i) => {
    const data = c.timestamp_comentario ? c.timestamp_comentario.replace('T', ' ').slice(0, 16) : '—';
    const textoLimpo = (c.texto || '').replace(/\s+/g, ' ').trim();
    return `[${i + 1}] ${c.author_normalizado} | ${c.post_id} | ${data} | ${textoLimpo}`;
  }).join('\n');

  const txt = PROMPT_TEMPLATE + estatisticas + linhasBase;

  return Response.json({
    export_id: exportId,
    txt,
    total_comentarios: selecionados.length,
    truncado,
  });
}
