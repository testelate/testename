/* ═══════════════════════════════════════════════════════
   HUB.nexus — hub-search.js
   Motor interno de matching texto → ferramentas
   Sem API externa. Puro NLP artesanal em PT-BR.
   ═══════════════════════════════════════════════════════ */

const HUB_TOOLS = [
  {
    key: 'ekklesia-social',
    name: 'Ekklesia para Social',
    label: 'Monitor de narrativas — redes sociais',
    desc: 'Unificação, normalização e análise de bases de redes sociais (Brandwatch, Stilingue, Supermetrics, Apify). Dashboard, classificação IA, CENA social e exportação.',
    emoji: '🏛️',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="48" cy="12" r="7"/><circle cx="48" cy="52" r="7"/><circle cx="14" cy="32" r="7"/><line x1="21" y1="28" x2="41" y2="16"/><line x1="21" y1="36" x2="41" y2="48"/></svg>`,
    color: '#6366F1',
    colorSoft: 'rgba(99,102,241,0.12)',
    tags: [
      'ekklesia', 'social', 'redes sociais', 'base de dados',
      'unificação', 'normalização', 'tratamento', 'perfis',
      'influenciadores', 'dados sociais', 'instagram', 'twitter',
      'facebook', 'youtube', 'tiktok', 'planilha',
      'exportar', 'score', 'ir2', 'ir²',
      'ranking', 'engajamento', 'brandwatch', 'stilingue',
      'supermetrics', 'apify', 'cena social', 'narrativas',
      'base', 'bases', 'upload', 'subir', 'importar', 'bluesky', 'linkedin',
      'analise social', 'classificacao', 'x twitter',
    ],
  },
  {
    key: 'ekklesia-eleicoes',
    name: 'Nexus Eleições 2026',
    label: 'Prisma Eleitoral — dashboard público das eleições',
    desc: 'Upload de bases de redes sociais (Brandwatch) e imprensa (Knewin) sobre a eleição 2026, com análise editorial via IA e publicação de um dashboard público único e permanente.',
    emoji: '🗳️',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M32 8v20"/><path d="M18 56h28"/><path d="M12 56l8-28h24l8 28"/><circle cx="32" cy="8" r="4"/></svg>`,
    color: '#FF6B1A',
    colorSoft: 'rgba(255,107,26,0.14)',
    tags: [
      'eleicoes', 'eleições', 'eleição', 'prisma eleitoral', 'nexus eleições',
      'presidenciável', 'governador', 'deputado', 'candidato', 'candidatos',
      'voto', 'urna', 'tse', 'brandwatch', 'knewin', 'imprensa', 'redes sociais',
      'dashboard público', 'monitoramento eleitoral', 'tema da semana', '2026',
    ],
  },
  {
    key: 'ekklesia-embratur',
    name: 'Ekklesia para Embratur',
    label: 'Diário de monitoramento internacional',
    desc: 'Monitoramento diário de redes sociais por país para a Embratur. Upload da base do dia, cálculo automático de KPIs, análise editorial via IA e geração de link público por país.',
    emoji: '✈️',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M52 12L8 30l14 6 4 16 8-10"/><path d="M22 36l8-8"/></svg>`,
    color: '#0A3161',
    colorSoft: 'rgba(10,49,97,0.14)',
    tags: [
      'embratur', 'internacional', 'país', 'diário',
      'monitoramento diário', 'eua', 'espanha', 'frança',
      'reino unido', 'alemanha', 'china', 'relatório diário',
      'kpi', 'menções', 'sentimento', 'alcance',
      'top 3', 'tendências', 'turismo', 'brandwatch',
    ],
  },
  {
    key: 'ekklesia-press',
    name: 'Ekklesia para Press',
    label: 'Monitor de narrativas — imprensa',
    desc: 'Análise de clipping de imprensa. Upload de Info4, Fábrica, BoxNet, Clipei, Knewing e WClipper. CENA Imprensa, Pontuação, Porta-voz, Pautas Trabalhadas, Panorama e Agregador.',
    emoji: '📰',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="12" y="10" width="40" height="44" rx="5"/><line x1="20" y1="22" x2="44" y2="22"/><line x1="20" y1="30" x2="44" y2="30"/><line x1="20" y1="38" x2="36" y2="38"/></svg>`,
    color: '#0EA5E9',
    colorSoft: 'rgba(14,165,233,0.12)',
    tags: [
      'ekklesia', 'press', 'imprensa', 'clipping',
      'clipadora', 'cena imprensa', 'cena press', 'ifsb',
      'porta-voz', 'pautas', 'pautas trabalhadas', 'panorama imprensa',
      'agregador', 'pontuação imprensa', 'info4', 'fabrica',
      'boxnet', 'clipei', 'knewing', 'wclipper',
      'knewin', 'veiculo', 'valoração', 'concorrencial imprensa',
    ],
  },
  {
    key: 'alertas-panoramas',
    name: 'Sentinela',
    label: 'Criador de alertas e panoramas',
    desc: 'Organize alertas e panoramas de redes sociais e imprensa em uma area unica do hub.',
    emoji: 'ST',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="22" cy="40" r="10"/><circle cx="42" cy="40" r="10"/><path d="M22 30v-4a4 4 0 014-4h12a4 4 0 014 4v4"/><path d="M32 26v6"/><circle cx="22" cy="40" r="3" fill="currentColor" stroke="none"/><circle cx="42" cy="40" r="3" fill="currentColor" stroke="none"/></svg>`,
    color: '#14B8A6',
    colorSoft: 'rgba(20,184,166,0.12)',
    tags: [
      'sentinela', 'alertas', 'panoramas', 'alertas e panoramas',
      'redes sociais', 'social', 'imprensa', 'press',
      'monitoramento', 'crise', 'risco', 'relatorio',
      'relatorio executivo', 'panorama redes', 'panorama imprensa',
      'clipping', 'narrativas', 'central', 'suricato',
    ],
  },
  {
    key: 'irx',
    name: 'Pipeline IRX',
    label: 'Classificação de influenciadores',
    desc: 'Pipeline de classificação de influenciadores por setor. Processa listas do Stilingue/Brandwatch.',
    emoji: '⚡',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="10,20 10,44 26,32" fill="currentColor" fill-opacity="0.25"/><polygon points="26,20 26,44 42,32" fill="currentColor" fill-opacity="0.55"/><polygon points="42,20 42,44 58,32" fill="currentColor" fill-opacity="0.9"/></svg>`,
    color: '#F59E0B',
    colorSoft: 'rgba(245,158,11,0.12)',
    tags: [
      'irx', 'pipeline', 'influenciador', 'classificar',
      'classificação', 'stilingue', 'brandwatch', 'setor',
      'agro', 'petróleo', 'energia', 'química',
      'saneamento', 'lista', 'perfil', 'processar',
      'lote', 'upload', 'csv',
    ],
  },
  {
    key: 'kanban',
    name: 'Kanban',
    label: 'Gestão de demandas',
    desc: 'Organize demandas por status: novo, em andamento, revisão, concluído.',
    emoji: '📋',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="20" width="14" height="32" rx="4"/><rect x="26" y="12" width="14" height="40" rx="4"/><rect x="44" y="26" width="14" height="26" rx="4"/></svg>`,
    color: '#3B82F6',
    colorSoft: 'rgba(59,130,246,0.12)',
    tags: [
      'kanban', 'demanda', 'tarefa', 'organizar',
      'trabalho', 'pendente', 'andamento', 'revisão',
      'concluir', 'entregar', 'prazo', 'projeto',
      'cliente', 'briefing executar', 'status', 'gestão',
    ],
  },
  {
    key: 'tasks',
    name: 'Tarefas',
    label: 'Minhas tarefas pessoais',
    desc: 'Lista pessoal de to-dos e tarefas com prazo e prioridade.',
    emoji: '✅',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="20"/><path d="M22 32 L29 39 L43 24"/></svg>`,
    color: '#22C55E',
    colorSoft: 'rgba(34,197,94,0.12)',
    tags: [
      'tarefa', 'task', 'to-do', 'lista',
      'pessoal', 'lembrete', 'anotação', 'anotar',
      'fazer', 'to do', 'minha lista', 'minhas tarefas',
      'check',
    ],
  },
  {
    key: 'briefing',
    name: 'Briefing',
    label: 'Criação de briefings',
    desc: 'Crie e gerencie briefings de projetos para clientes.',
    emoji: '📄',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="20" height="20" rx="4"/><rect x="36" y="8" width="20" height="20" rx="4"/><rect x="8" y="36" width="20" height="20" rx="4"/><rect x="36" y="36" width="20" height="20" rx="4"/><line x1="28" y1="18" x2="36" y2="18"/><line x1="33" y1="15" x2="36" y2="18"/><line x1="33" y1="21" x2="36" y2="18"/><line x1="18" y1="28" x2="18" y2="36"/><line x1="15" y1="33" x2="18" y2="36"/><line x1="21" y1="33" x2="18" y2="36"/></svg>`,
    color: '#8B5CF6',
    colorSoft: 'rgba(139,92,246,0.12)',
    tags: [
      'briefing', 'brief', 'cliente', 'proposta',
      'escopo', 'novo projeto', 'criar projeto', 'detalhar',
      'documento', 'especificação', 'levantar requisitos',
    ],
  },
  {
    key: 'monitoramento',
    name: 'Monitoramento',
    label: 'Monitoramento diário de clientes',
    desc: 'Acompanhe o status de monitoramentos diários por cliente e horário.',
    emoji: '👁️',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="20"/><path d="M13 32 C16 32 18 22 21 22 C24 22 26 42 29 42 C32 42 34 22 37 22 C40 22 42 42 45 42 C48 42 50 32 51 32"/></svg>`,
    color: '#EC4899',
    colorSoft: 'rgba(236,72,153,0.12)',
    tags: [
      'monitoramento', 'monitor', 'diário', 'acompanhar',
      'clipping', 'notícia', 'mídia', 'imprensa',
      'envio', 'disparo', 'relatório diário', 'entrega',
      'horário',
    ],
  },
  {
    key: 'voxia',
    name: 'Vox.ia',
    label: 'Diagnóstico de presença em IA',
    desc: 'Analise como a Nexus e seus clientes aparecem nas respostas de IAs como ChatGPT e Gemini.',
    emoji: '🤖',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 26 L3 32 L6 38"/><path d="M58 26 L61 32 L58 38"/><path d="M13 32 C16 32 18 22 21 22 C24 22 26 42 29 42 C32 42 34 22 37 22 C40 22 42 42 45 42 C48 42 50 32 51 32"/></svg>`,
    color: '#14B8A6',
    colorSoft: 'rgba(20,184,166,0.12)',
    tags: [
      'vox', 'voxia', 'vox.ia', 'ia',
      'inteligência artificial', 'chatgpt', 'gemini', 'grok',
      'perplexity', 'llm', 'aeo', 'geo',
      'presença', 'reputação ia', 'diagnóstico', 'menção',
      'visibilidade ia', 'sov', 'share of voice',
    ],
  },
  {
    key: 'gestao',
    name: 'Gestão',
    label: 'Financeiro e gestão interna',
    desc: 'Controle financeiro, precificação, prospects e gestão de projetos internos.',
    emoji: '💼',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="38" width="14" height="18" rx="3"/><rect x="26" y="28" width="14" height="28" rx="3"/><rect x="44" y="18" width="14" height="38" rx="3"/><polyline points="50,10 46,6 42,10"/><line x1="46" y1="6" x2="46" y2="20"/></svg>`,
    color: '#F97316',
    colorSoft: 'rgba(249,115,22,0.12)',
    tags: [
      'gestão', 'gestao', 'financeiro', 'precificação',
      'preço', 'proposta comercial', 'prospect', 'venda',
      'receita', 'custo', 'administração', 'interno',
      'contrato',
    ],
  },
  {
    key: 'tutorials',
    name: 'Faculdade Marília',
    label: 'Tutoriais e treinamentos',
    desc: 'Assista tutoriais em vídeo sobre as ferramentas da Nexus.',
    emoji: '🎓',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="32,10 58,24 32,38 6,24"/><path d="M18 30 L18 46 C18 46 24 54 32 54 C40 54 46 46 46 46 L46 30"/><line x1="58" y1="24" x2="58" y2="38"/><circle cx="58" cy="40" r="2.5" fill="currentColor" stroke="none"/></svg>`,
    color: '#F43F5E',
    colorSoft: 'rgba(244,63,94,0.12)',
    tags: [
      'tutorial', 'tutoriais', 'treinamento', 'aprender',
      'video', 'vídeo', 'curso', 'faculdade',
      'marília', 'aprendizado', 'estudar', 'como usar',
      'ajuda', 'como funciona', 'dúvida', 'capacitação',
    ],
  },
  {
    key: 'guruquest',
    name: 'GuruQuest',
    label: 'Quiz e gamificação',
    desc: 'Teste seus conhecimentos sobre as ferramentas da Nexus.',
    emoji: '⭐',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M32 6 C34 22 44 30 58 32 C44 34 34 42 32 58 C30 42 20 34 6 32 C20 30 30 22 32 6 Z" fill="currentColor" fill-opacity="0.9"/></svg>`,
    color: '#A855F7',
    colorSoft: 'rgba(168,85,247,0.12)',
    tags: [
      'guruquest', 'guru', 'quest', 'quiz',
      'jogo', 'game', 'gamificação', 'pontos',
      'ranking', 'teste', 'conhecimento', 'desafio',
    ],
  },
  {
    key: 'ekklesia-multi',
    name: 'Ekklesia para Monitoramento',
    label: 'Fluxo operacional multi-cliente de monitoramento',
    desc: 'Produção, revisão e entrega de relatórios com IA para múltiplos clientes. Gerencie bases, prompts e acompanhe o status de cada entrega.',
    emoji: '🏭',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="16" width="18" height="18" rx="4"/><rect x="23" y="16" width="18" height="18" rx="4"/><rect x="42" y="16" width="18" height="18" rx="4"/><rect x="4" y="38" width="18" height="10" rx="3"/><rect x="23" y="38" width="18" height="10" rx="3"/><rect x="42" y="38" width="18" height="10" rx="3"/></svg>`,
    color: '#F97316',
    colorSoft: 'rgba(249,115,22,0.12)',
    tags: [
      'ekklesia monitoramento', 'ekklesia para monitoramento', 'monitoramento',
      'embratur', 'secom', 'multi-cliente', 'multi cliente',
      'produção', 'fluxo', 'relatorio diario', 'workflow',
      'geração ia', 'ia', 'prompt', 'automacao',
      'entrega', 'revisao', 'aprovacao', 'clientes',
    ],
  },
  {
    key: 'ekklesia-secom',
    name: 'Ekklesia para SECOM',
    label: 'Produção do diário de monitoramento — SECOM',
    desc: 'Página de produção do relatório diário SECOM: upload da base, KPIs automáticos, geração de prompt para IA, textos editoriais, pontos de atenção e abertura do radar.',
    emoji: '📡',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="6"/><path d="M20 20 A17 17 0 0 1 44 20"/><path d="M14 14 A26 26 0 0 1 50 14"/><path d="M8 8 A34 34 0 0 1 56 8"/><line x1="32" y1="38" x2="32" y2="56"/><line x1="20" y1="56" x2="44" y2="56"/></svg>`,
    color: '#183EFF',
    colorSoft: 'rgba(24,62,255,0.12)',
    tags: [
      'secom', 'ekklesia secom', 'ekklesia para secom',
      'producao', 'diario secom', 'upload', 'base secom',
      'kpi', 'prompt ia', 'textos editoriais', 'links externos',
      'pontos de atencao', 'radar secom', 'monitoramento',
      'redes sociais', 'sentimento', 'relatorio', 'governo',
    ],
  },
  {
    key: 'ekklesia-para',
    name: 'Ekklesia para Governo do Pará',
    label: 'Produção do relatório semanal — Governo do Pará',
    desc: 'Página de produção e visualização do relatório de performance semanal para Governo do Pará (Hana Ghassan e Helder Barbalho): cenário geral, por redes, destaques, posts principais e horários.',
    emoji: '🏛️',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 60 L60 60"/><path d="M8 24 L56 24"/><path d="M12 24 L12 60"/><path d="M22 24 L22 60"/><path d="M32 24 L32 60"/><path d="M42 24 L42 60"/><path d="M52 24 L52 60"/><path d="M32 4 L4 24 L60 24 Z"/></svg>`,
    color: '#D92626',
    colorSoft: 'rgba(217,38,38,0.12)',
    tags: [
      'para', 'governo do para', 'ekklesia para', 'helder barbalho', 'hana ghassan',
      'producao', 'semanal para', 'upload', 'base para',
      'kpi', 'narrativas', 'posts', 'horarios', 'monitoramento',
      'redes sociais', 'sentimento', 'relatorio', 'governo',
    ],
  },
  {
    key: 'ekklesia-multi-radar',
    name: 'Radar SECOM',
    label: 'Relatório visual de monitoramento — SECOM',
    desc: 'Relatório visual de monitoramento diário para SECOM: sentimento por volume e interação, KPIs, temas e pontos de atenção.',
    emoji: '📊',
    icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="32" width="10" height="24" rx="2"/><rect x="22" y="20" width="10" height="36" rx="2"/><rect x="36" y="8" width="10" height="48" rx="2"/><rect x="50" y="24" width="10" height="32" rx="2"/></svg>`,
    color: '#183EFF',
    colorSoft: 'rgba(24,62,255,0.12)',
    tags: [
      'radar', 'radar diario', 'radar secom', 'relatorio visual',
      'monitor diario', 'monitoramento', 'sentimento', 'visualizacao',
      'share', 'exportar', 'pdf', 'governo', 'social',
    ],
  },
];

/* ─── Normaliza texto para matching ─── */
function _normalize(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/* ─── Score de relevância de uma ferramenta para uma query ─── */
function _scoreToolForQuery(tool, normalizedQuery) {
  let score = 0;
  const words = normalizedQuery.split(' ').filter(w => w.length > 2);

  for (const tag of tool.tags) {
    const normTag = _normalize(tag);
    // Match exato de tag
    if (normalizedQuery.includes(normTag)) {
      score += normTag.length > 5 ? 10 : 6;
    }
    // Match de palavras individuais da tag na query
    for (const word of words) {
      if (normTag.includes(word)) {
        score += 2;
      } else {
        const stem = _stem(word);
        if (stem !== word && stem.length > 2 && normTag.includes(stem)) score += 1;
      }
      if (word.includes(normTag)) score += 1;
    }
  }

  // Bonus: nome da ferramenta mencionado
  const normName = _normalize(tool.name);
  if (normalizedQuery.includes(normName)) score += 15;

  return score;
}

/* ─── Stemmer PT-BR: reduz plurais e variações morfológicas ─── */
function _stem(word) {
  if (word.length <= 4) return word;
  if (word.endsWith('oes')) return word.slice(0, -3) + 'ao'; // informacoes → informacao
  if (word.endsWith('ais')) return word.slice(0, -2) + 'l';  // canais → canal
  if (word.endsWith('eis')) return word.slice(0, -2) + 'l';  // niveis → nivel
  if (word.endsWith('uis')) return word.slice(0, -2) + 'l';  // azuis → azul
  if (word.endsWith('ns')) return word.slice(0, -1);         // itens → iten
  if (word.endsWith('s')) return word.slice(0, -1);         // bases → base
  return word;
}

/* ─── API pública: busca ferramentas para uma query ─── */
function hubSearch(query, maxResults = 4) {
  if (!query || query.trim().length < 2) return [];
  const q = _normalize(query);

  const scored = HUB_TOOLS.map(tool => ({
    tool,
    score: _scoreToolForQuery(tool, q),
  })).filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  return scored.map(r => r.tool);
}

/* ─── Saudação contextual ─── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

function getTimeContext() {
  const d = new Date();
  const dias = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${dias[d.getDay()]}, ${d.getDate()} de ${meses[d.getMonth()]}`;
}

function getTimeQuestion() {
  const h = new Date().getHours();
  if (h < 12) return 'O que você quer fazer nessa manhã?';
  if (h < 18) return 'O que você quer fazer nessa tarde?';
  return 'O que você quer fazer essa noite?';
}

/* ─── Favoritos / recentes ─── */
const FAV_KEY = 'hubnexus-fav-tools';
const RECENT_KEY = 'hubnexus-recent-tools';

// Migração: substitui chaves legadas no localStorage
(function migrateKeys() {
  const migrations = { 'ekklesia': 'ekklesia-social', 'hub-press': 'ekklesia-press' };
  try {
    const favs = JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
    const migrated = favs.map(k => migrations[k] || k);
    if (JSON.stringify(favs) !== JSON.stringify(migrated))
      localStorage.setItem(FAV_KEY, JSON.stringify([...new Set(migrated)]));
    const recents = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const migratedR = recents.map(k => migrations[k] || k);
    if (JSON.stringify(recents) !== JSON.stringify(migratedR))
      localStorage.setItem(RECENT_KEY, JSON.stringify([...new Set(migratedR)]));
  } catch (e) { }
})();

function getFavorites() {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; }
}

function toggleFavorite(key) {
  const favs = getFavorites();
  const idx = favs.indexOf(key);
  if (idx >= 0) favs.splice(idx, 1);
  else favs.push(key);
  localStorage.setItem(FAV_KEY, JSON.stringify(favs));
  return favs.includes(key);
}

function getRecentTools() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}

function addRecentTool(key) {
  const recents = getRecentTools().filter(k => k !== key);
  recents.unshift(key);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recents.slice(0, 6)));
}

function getDisplayTools() {
  const favs = getFavorites();
  const recents = getRecentTools();
  const all = [...new Set([...favs, ...recents])];
  const defaults = ['ekklesia-social', 'ekklesia-press', 'voxia', 'monitoramento', 'automacoes', 'kanban', 'irx', 'storydesk', 'briefing', 'tasks', 'linkly'];
  const keys = [...new Set([...all, ...defaults])];
  return keys
    .map(k => HUB_TOOLS.find(t => t.key === k))
    .filter(Boolean)
    .slice(0, 6);
}

window.hubSearch = hubSearch;
window.getGreeting = getGreeting;
window.getTimeContext = getTimeContext;
window.getTimeQuestion = getTimeQuestion;
window.getFavorites = getFavorites;
window.toggleFavorite = toggleFavorite;
window.addRecentTool = addRecentTool;
window.getDisplayTools = getDisplayTools;
window.HUB_TOOLS = HUB_TOOLS;
window._stem = _stem;

// (alias ekklesia removido — migration no localStorage já trata backward compat)

// Studio adicionado dinamicamente
HUB_TOOLS.push({
  key: 'studio',
  name: 'Studio',
  label: 'Editor de apresentações',
  desc: 'Crie apresentações com dados do Hub. Arraste, edite e exporte slides.',
  emoji: '🎨',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="18" y="38" width="36" height="16" rx="4"/><rect x="12" y="26" width="36" height="16" rx="4"/><rect x="8" y="14" width="36" height="16" rx="4"/></svg>`,
  color: '#EC4899',
  colorSoft: 'rgba(236,72,153,0.12)',
  tags: [
    'studio', 'apresentação', 'slide', 'canva',
    'powerpoint', 'editar', 'criar slide', 'relatório visual',
    'gráfico', 'template', 'exportar', 'design',
    'visual',
  ],
});

// StoryDesk adicionado dinamicamente
HUB_TOOLS.push({
  key: 'automacoes',
  name: 'HUB.Automações',
  label: 'Automações e utilitários',
  desc: 'Concatenador de Semanas, Agrupador de Imagens para PDF, Knewing Monitoring (conteúdo full-text) e Panorama Redes com IA.',
  emoji: '⚙️',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="32" cy="32" r="9"/><path d="M32 10 L32 16 M32 48 L32 54 M10 32 L16 32 M48 32 L54 32 M17 17 L21 21 M43 43 L47 47 M47 17 L43 21 M21 43 L17 47"/></svg>`,
  color: '#6B7280',
  colorSoft: 'rgba(107,114,128,0.12)',
  tags: [
    'automacao', 'utilitario', 'semanas', 'serie historica',
    'imagens', 'pdf', 'knewing monitoring', 'panorama redes',
    'concatenador',
  ],
});

HUB_TOOLS.push({
  key: 'storydesk',
  name: 'StoryDesk',
  label: 'Monitoramento de stories de DOLs',
  desc: 'Monitore e analise stories de médicos influenciadores (DOLs) com IA. Transcrição, tabulação e dashboard por cliente.',
  emoji: '📱',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="20" y="8" width="24" height="42" rx="5"/><circle cx="32" cy="46" r="3"/><circle cx="32" cy="27" r="10"/><circle cx="32" cy="27" r="4" fill="currentColor" fill-opacity="0.8" stroke="none"/></svg>`,
  color: '#06B6D4',
  colorSoft: 'rgba(6,182,212,0.12)',
  tags: [
    'storydesk', 'story', 'stories', 'instagram',
    'dol', 'médico', 'influenciador', 'monitoramento',
    'transcrição', 'análise', 'gemini', 'drive',
    'tabulação', 'novo nordisk', 'saúde', 'pharma',
    'farmacêutico', 'KOL', 'key opinion leader',
  ],
});

HUB_TOOLS.push({
  key: 'reputaition',
  name: 'Reputaition',
  label: 'Cadastro de cliente e Enxoval de Crise',
  desc: 'Wizard passo a passo para cadastrar um novo cliente no Reputaition (termos, premissas, temas, canais) e banco compartilhado de pacotes de premissas de crise reutilizáveis entre clientes.',
  emoji: '🆘',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M40 28v18a6 6 0 01-6 6H16a6 6 0 01-6-6V20a6 6 0 016-6h18"/><polyline points="38,8 56,8 56,26"/><line x1="24" y1="38" x2="56" y2="6"/></svg>`,
  color: '#D97706',
  colorSoft: 'rgba(217,119,6,0.12)',
  tags: [
    'reputaition', 'reputation', 'cadastro de cliente', 'premissas',
    'enxoval', 'crise', 'banco de premissas', 'classificação',
    'configuração de prompt', 'termos de detecção', 'mensagem-chave', 'temas monitorados',
    'canais monitorados', 'porta-vozes', 'calibrar', 'refinar premissas',
  ],
});

HUB_TOOLS.push({
  key: 'irx-classificacao',
  name: 'Classificação IRX',
  label: 'Preenchimento assistido de fichas de influenciadores',
  desc: 'Importe a planilha de influenciadores, preencha fichas com apoio de IA e gere links de acesso para freelas classificarem externamente.',
  emoji: '📋',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="10" y="8" width="44" height="48" rx="6"/><circle cx="22" cy="24" r="6"/><line x1="32" y1="20" x2="46" y2="20"/><line x1="32" y1="27" x2="46" y2="27"/><line x1="16" y1="38" x2="48" y2="38"/><line x1="16" y1="45" x2="40" y2="45"/></svg>`,
  color: '#F59E0B',
  colorSoft: 'rgba(245,158,11,0.12)',
  tags: [
    'classificacao', 'irx', 'influenciador', 'ficha',
    'freela', 'curadoria', 'aprovação', 'swipe',
    'card', 'perfil', 'planilha', 'upload',
    'preenchimento', 'pipeline', 'revisão', 'decisão',
  ],
});

HUB_TOOLS.push({
  key: 'escavador',
  name: 'Escavador de Comentários',
  label: 'Padrões e narrativas em comentários',
  desc: 'Unifica exportações do ExportComments e Apify, prioriza quais posts extrair e identifica autores recorrentes e narrativas orquestradas entre comentários.',
  emoji: '🕳️',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 38 L28 24 L34 30 L20 44 Z"/><path d="M28 24 L40 12 L46 18 L34 30"/><line x1="42" y1="14" x2="50" y2="6"/><circle cx="46" cy="44" r="10"/><line x1="53" y1="51" x2="60" y2="58"/></svg>`,
  color: '#92400E',
  colorSoft: 'rgba(146,64,14,0.12)',
  tags: [
    'escavador', 'comentarios', 'comentários', 'exportcomments',
    'apify', 'padrão', 'padroes', 'padrões',
    'narrativa', 'narrativas', 'perfil recorrente', 'perfis recorrentes',
    'orquestração', 'orquestrado', 'manifestação coordenada', 'autor recorrente',
    'crise', 'sentimento', 'triangulação', 'quadriangulação',
  ],
});

HUB_TOOLS.push({
  key: 'manifestacao',
  name: 'Detector de Manifestação',
  label: 'Quem fala x quem é citado em matérias',
  desc: 'Analisa planilhas de clipping com IA para identificar, em cada matéria, quais porta-vozes se manifestam (têm fala própria) versus quem é apenas mencionado, com revisão humana antes de exportar.',
  emoji: '\ud83c\udf99\ufe0f',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10h16l8 8v28a4 4 0 01-4 4H20a4 4 0 01-4-4V14a4 4 0 014-4z"/><path d="M36 10v8h8"/><path d="M22 32c2 4 4 4 6 0s4-4 6 0 4 4 6 0"/><line x1="22" y1="42" x2="36" y2="42"/></svg>`,
  color: '#10B981',
  colorSoft: 'rgba(16,185,129,0.12)',
  tags: [
    'manifestacao', 'manifestação', 'detector', 'porta-voz',
    'porta-vozes', 'fala', 'mencao', 'menção',
    'clipping', 'imprensa', 'noticia', 'notícia',
    'planilha', 'xlsx', 'cena', 'gemini',
    'revisao', 'revisão', 'classificacao', 'classificação',
  ],
});

// Linkly encurtador de links adicionado dinamicamente
HUB_TOOLS.push({
  key: 'linkly',
  name: 'Linkly',
  label: 'Encurtador de links',
  desc: 'Encurte links longos do HUB.nexus de forma simples e rápida.',
  emoji: '🐢',
  icon: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 32a10 10 0 0 1 10-10h8a10 10 0 0 1 10 10M18 32v12a4 4 0 0 0 4 4h16a4 4 0 0 0 4-4V32M32 10 L32 22"/></svg>`,
  color: '#14B8A6',
  colorSoft: 'rgba(20,184,166,0.12)',
  tags: [
    'linkly', 'encurtador', 'link curto', 'encurtar',
    'url', 'clicks', 'cliques', 'tartaruga', 'mascote',
    'gerar link',
  ],
});
