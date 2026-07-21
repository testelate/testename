// ─── ROADMAP HUB.NEXUS ───────────────────────────────────────────────────────
// Modal de acompanhamento de progresso da ferramenta
// Mostra features em produção e planejadas, permite adicionar novas

(function() {

// ── Estado local (fallback quando API não disponível) ──────────────────────
const STORAGE_KEY = 'hubnexus-roadmap-features';

const DEFAULT_FEATURES = [
  // EM PRODUÇÃO
  { id: 'f001', titulo: 'Dashboard Bento Grid', descricao: 'Painel principal com widgets de tarefas, kanban, prazos e monitoramento.', categoria: 'infraestrutura', status: 'producao', prioridade: 'alta', dataCriacao: '2025-01-01' },
  { id: 'f002', titulo: 'Kanban Board', descricao: 'Gestão visual de tarefas com colunas personalizáveis e drag & drop.', categoria: 'gestao', status: 'producao', prioridade: 'alta', dataCriacao: '2025-01-01' },
  { id: 'f003', titulo: 'Ekklesia — Análise de Narrativas', descricao: 'Ingestão de dados Brandwatch/Stilingue/SuperMetrics, TF-IDF, IR², rankings e dashboards.', categoria: 'inteligencia', status: 'producao', prioridade: 'alta', dataCriacao: '2025-02-01' },
  { id: 'f004', titulo: 'Vox.ia — Monitoramento de IA', descricao: 'Matriz de posicionamento quadrante e exportação de corpus para Iramuteq.', categoria: 'inteligencia', status: 'producao', prioridade: 'media', dataCriacao: '2025-03-01' },
  { id: 'f005', titulo: 'Gestão de Projetos', descricao: 'Pipeline de prospecção, pipeline kanban, controle de PJs e custos por projeto.', categoria: 'gestao', status: 'producao', prioridade: 'alta', dataCriacao: '2025-03-01' },
  { id: 'f006', titulo: 'Monitoramento de Prazos', descricao: 'Alertas via Notification API (60/30 min antes), widget de prazos no dashboard.', categoria: 'gestao', status: 'producao', prioridade: 'media', dataCriacao: '2025-03-15' },
  { id: 'f007', titulo: 'Autenticação com TTL', descricao: 'Login com sessão de 8h via localStorage, sem dependência de auth externo.', categoria: 'infraestrutura', status: 'producao', prioridade: 'alta', dataCriacao: '2025-01-01' },
  { id: 'f008', titulo: 'Cloudflare D1 — Backend', descricao: 'Banco SQLite na edge via Cloudflare D1, sem Supabase. APIs em functions/api/.', categoria: 'infraestrutura', status: 'producao', prioridade: 'alta', dataCriacao: '2025-03-01' },
  { id: 'f009', titulo: 'Busca Global (Ctrl+K)', descricao: 'Busca unificada em tarefas, páginas e projetos com atalho de teclado.', categoria: 'ux', status: 'producao', prioridade: 'media', dataCriacao: '2025-04-01' },
  { id: 'f010', titulo: 'Ekklesia — Conversor Reputation', descricao: 'Exportação bidirecional Ekklesia ↔ Reputation (24 colunas) com deduplicação.', categoria: 'inteligencia', status: 'producao', prioridade: 'media', dataCriacao: '2025-03-20' },

  // GESTÃO DE PJs, FINANCEIRO E COMERCIAL
  { id: 'f011', titulo: 'Painel PJs e SOXs — Regra da Grazi', descricao: 'Painel que replica a lógica das planilhas de gestão para controlar saldos e cotas recorrentes de freelancers (PJs). Contagem de dias com alertas visuais proativos: azul (atenção), amarelo (saldo baixo) e vermelho (vencimento crítico), evitando descobrir problemas somente na hora do pagamento.', categoria: 'gestao', status: 'planejado', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f012', titulo: 'Dashboard Comercial Integrado', descricao: 'Incorporar nativamente ao Hub Nexus o dashboard comercial desenvolvido pelo time de inteligência (Rodrigo), centralizando propostas enviadas, projetos cadastrados, faturamento e taxas de conversão.', categoria: 'gestao', status: 'planejado', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f013', titulo: 'Relatórios e Filtros de Faturamento', descricao: 'Relatórios rápidos de entradas, saídas e faturamento com diferenciação por praça (Brasília / São Paulo) e braço de atuação (público x privado).', categoria: 'gestao', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },
  { id: 'f014', titulo: 'Calculadora de Precificação e Regra de Ouro', descricao: 'Tabela de precificação integrada à aba de gestão para montagem de propostas. Travas de segurança automáticas que exigem aprovação da diretoria quando a margem de lucro for inferior a 52%.', categoria: 'gestao', status: 'planejado', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f015', titulo: 'IDs e Números de Pedido nos PJs', descricao: 'Inclusão do número do pedido/SOC do PJ em cada registro para facilitar buscas e o cancelamento de contratos.', categoria: 'gestao', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },
  { id: 'f016', titulo: 'Acompanhamento de Ferramentas e Contratos', descricao: 'Painel para rastrear ferramentas contratadas cruzando com as demandas ativas, permitindo visualizar custo real por projeto e identificar sobreposições ou desperdícios.', categoria: 'gestao', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },

  // FLUXO DE TRABALHO E ACOMPANHAMENTO DE DEMANDAS
  { id: 'f017', titulo: 'Observatório de Demandas — Estilo Correios', descricao: 'Visualização em "prateleira" das etapas das demandas, permitindo rastrear o andamento estilo rastreio dos Correios. Cada demanda recebe ID única e registra histórico e trânsito regional/setorial.', categoria: 'gestao', status: 'desenvolvimento', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f018', titulo: 'Histórico e Observações por Etapa', descricao: 'Campos de observação em cada etapa da demanda que alimentam um histórico persistente no banco de dados, garantindo rastreabilidade completa do projeto.', categoria: 'gestao', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },
  { id: 'f019', titulo: 'Onboarding e Pós-venda Estruturado', descricao: 'Fluxo de onboarding para clientes perenes e de longo prazo com links dedicados para coleta de informações. Formulários automáticos de feedback ao fim dos projetos.', categoria: 'gestao', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },

  // UX E INTERFACE
  { id: 'f020', titulo: 'Unificação de Abas — Megazord', descricao: 'Juntar briefing, gestão, automações de IA (Reputation) e Kanban (movido para parte inferior) em um único "Hubão", eliminando a necessidade de abrir múltiplos sites.', categoria: 'ux', status: 'desenvolvimento', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f021', titulo: 'Central de Notificações e Alertas', descricao: 'Central interna de alertas limpa e sem excesso de botões. Avisos por e-mail e integração com Slack ou WhatsApp para lembrar a equipe de entregas iminentes.', categoria: 'ux', status: 'planejado', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f022', titulo: 'Perfis de Usuário', descricao: 'Aba de perfil estilo Slack: foto, biografia, cargo, estado, núcleo de atuação e vínculo empregatício do colaborador.', categoria: 'ux', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },
  { id: 'f023', titulo: 'Gestão de Acessos por Perfil', descricao: 'Limitação de visualização de informações financeiras e dados sensíveis de PJs apenas para gestão e diretoria, separando os acessos dos analistas.', categoria: 'infraestrutura', status: 'planejado', prioridade: 'alta', dataCriacao: '2025-04-01' },

  // BRIEFINGS E INTELIGÊNCIA ARTIFICIAL
  { id: 'f024', titulo: 'Briefings como Checklists Modulares', descricao: 'Formulários de briefing modulares que funcionam como checklists rigorosos para a equipe de atendimento, adaptando as perguntas com base nas dores do cliente e evitando propostas com escopo vago.', categoria: 'inteligencia', status: 'planejado', prioridade: 'alta', dataCriacao: '2025-04-01' },
  { id: 'f025', titulo: 'Botão "Converter em Prospect"', descricao: 'Automação que, ao validar um briefing, envia as informações do cliente para o funil de vendas (CRM) na aba de Gestão com um clique, sem necessidade de redigitação manual.', categoria: 'integracao', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },
  { id: 'f026', titulo: 'Nuvem de Palavras e Separação de Concorrentes', descricao: 'Evolução do processamento de limpeza de textos para gerar nuvens de palavras automatizadas e separar dados de concorrentes de forma estruturada.', categoria: 'inteligencia', status: 'planejado', prioridade: 'media', dataCriacao: '2025-04-01' },
];

// ── Categorias ─────────────────────────────────────────────────────────────
const CATEGORIAS = {
  infraestrutura: { label: 'Infraestrutura', color: '#6b7cff' },
  gestao:         { label: 'Gestão',         color: '#ff6500' },
  inteligencia:   { label: 'Inteligência',   color: '#22d3a8' },
  ux:             { label: 'UX/Interface',   color: '#f59e0b' },
  integracao:     { label: 'Integração',     color: '#e879f9' },
  outro:          { label: 'Outro',          color: '#94a3b8' },
};

const STATUS_CONFIG = {
  producao:     { label: 'Em Produção',    icon: '✦', color: '#22d3a8', bg: 'rgba(34,211,168,0.12)' },
  desenvolvimento: { label: 'Em Dev',     icon: '◈', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  planejado:    { label: 'Planejado',      icon: '◇', color: '#6b7cff', bg: 'rgba(107,124,255,0.12)' },
  pausado:      { label: 'Pausado',        icon: '◉', color: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
};

// ── Persistência local ─────────────────────────────────────────────────────
function loadFeatures() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return DEFAULT_FEATURES;
}

function saveFeatures(features) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
  } catch(e) {}
}

// ── Injetar CSS ────────────────────────────────────────────────────────────
function injectCSS() {
  if (document.getElementById('roadmap-css')) return;
  const style = document.createElement('style');
  style.id = 'roadmap-css';
  style.textContent = `
    /* ── BOTÃO NA SIDEBAR ── */
    .roadmap-sidebar-btn {
      width: 36px; height: 36px;
      border-radius: 10px;
      background: none;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.45);
      transition: color 0.2s, background 0.2s, transform 0.2s;
      position: relative;
    }
    .roadmap-sidebar-btn:hover {
      color: #ff6500;
      background: rgba(255,101,0,0.1);
      transform: scale(1.08);
    }
    .roadmap-sidebar-btn svg { width: 17px; height: 17px; }
    .roadmap-badge {
      position: absolute;
      top: 4px; right: 4px;
      width: 7px; height: 7px;
      background: #f59e0b;
      border-radius: 50%;
      border: 1px solid #0e0a04;
      animation: roadmap-pulse 2s ease-in-out infinite;
    }
    @keyframes roadmap-pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:0.5; transform:scale(0.8); }
    }

    /* ── OVERLAY ── */
    #roadmap-overlay {
      position: fixed; inset: 0; z-index: 9990;
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(10px);
      display: none; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.25s ease;
    }
    #roadmap-overlay.open { display: flex; opacity: 1; }

    /* ── MODAL ── */
    .roadmap-modal {
      width: 96vw; max-width: 860px;
      max-height: 88vh;
      background: #100800;
      border: 1px solid rgba(255,101,0,0.18);
      border-radius: 20px;
      box-shadow: 0 32px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04);
      display: flex; flex-direction: column;
      overflow: hidden;
      transform: translateY(12px) scale(0.98);
      transition: transform 0.25s ease;
    }
    #roadmap-overlay.open .roadmap-modal { transform: translateY(0) scale(1); }

    /* header */
    .roadmap-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 20px 24px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-shrink: 0;
    }
    .roadmap-header-left { display: flex; align-items: center; gap: 12px; }
    .roadmap-header-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: rgba(255,101,0,0.12);
      border: 1px solid rgba(255,101,0,0.25);
      display: flex; align-items: center; justify-content: center;
    }
    .roadmap-header-icon svg { width: 18px; height: 18px; color: #ff6500; }
    .roadmap-title { font-size: 15px; font-weight: 600; color: #fff; letter-spacing: -0.3px; }
    .roadmap-subtitle { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 1px; }
    .roadmap-close {
      width: 30px; height: 30px; border-radius: 8px;
      background: rgba(255,255,255,0.05); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.4); transition: all 0.15s;
    }
    .roadmap-close:hover { background: rgba(255,60,60,0.15); color: #ff6060; }
    .roadmap-close svg { width: 14px; height: 14px; }

    /* tabs */
    .roadmap-tabs {
      display: flex; gap: 2px;
      padding: 12px 24px 0;
      flex-shrink: 0;
    }
    .roadmap-tab {
      padding: 7px 14px; border-radius: 8px;
      font-size: 12px; font-weight: 500;
      border: none; cursor: pointer;
      background: transparent;
      color: rgba(255,255,255,0.4);
      transition: all 0.15s;
      display: flex; align-items: center; gap: 6px;
    }
    .roadmap-tab:hover { background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.7); }
    .roadmap-tab.active { background: rgba(255,101,0,0.15); color: #ff6500; }
    .roadmap-tab-count {
      font-size: 10px; padding: 1px 6px;
      border-radius: 10px;
      background: rgba(255,255,255,0.08);
    }
    .roadmap-tab.active .roadmap-tab-count { background: rgba(255,101,0,0.25); color: #ff9955; }

    /* filtros */
    .roadmap-filters {
      display: flex; gap: 8px; align-items: center;
      padding: 10px 24px;
      flex-shrink: 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      flex-wrap: wrap;
    }
    .roadmap-filter-label { font-size: 10px; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.5px; }
    .roadmap-filter-chip {
      padding: 4px 10px; border-radius: 20px;
      font-size: 11px; font-weight: 500;
      border: 1px solid rgba(255,255,255,0.1);
      background: transparent; cursor: pointer;
      color: rgba(255,255,255,0.45);
      transition: all 0.15s;
    }
    .roadmap-filter-chip:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.7); }
    .roadmap-filter-chip.active { border-color: rgba(255,101,0,0.4); background: rgba(255,101,0,0.1); color: #ff7733; }
    .roadmap-add-btn {
      margin-left: auto;
      display: flex; align-items: center; gap: 6px;
      padding: 6px 14px; border-radius: 8px;
      background: rgba(255,101,0,0.15);
      border: 1px solid rgba(255,101,0,0.3);
      color: #ff6500; font-size: 12px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }
    .roadmap-add-btn:hover { background: rgba(255,101,0,0.25); border-color: rgba(255,101,0,0.5); }
    .roadmap-add-btn svg { width: 13px; height: 13px; }

    /* lista */
    .roadmap-body {
      flex: 1; overflow-y: auto; padding: 16px 24px;
    }
    .roadmap-body::-webkit-scrollbar { width: 4px; }
    .roadmap-body::-webkit-scrollbar-track { background: transparent; }
    .roadmap-body::-webkit-scrollbar-thumb { background: rgba(255,101,0,0.25); border-radius: 4px; }

    /* progress bar summary */
    .roadmap-progress-bar-wrap {
      margin-bottom: 16px;
      padding: 14px 16px;
      background: rgba(255,255,255,0.02);
      border: 1px solid rgba(255,255,255,0.05);
      border-radius: 12px;
      display: flex; align-items: center; gap: 16px;
    }
    .roadmap-progress-stats { display: flex; gap: 16px; flex: 1; }
    .roadmap-stat { text-align: center; }
    .roadmap-stat-num { font-size: 20px; font-weight: 700; color: #fff; line-height: 1; }
    .roadmap-stat-label { font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 2px; }
    .roadmap-progress-track {
      flex: 2; height: 6px; border-radius: 10px;
      background: rgba(255,255,255,0.06);
      overflow: hidden; position: relative;
    }
    .roadmap-progress-fill {
      height: 100%; border-radius: 10px;
      background: linear-gradient(90deg, #ff6500, #ff9922);
      transition: width 0.5s ease;
    }
    .roadmap-progress-pct { font-size: 11px; color: rgba(255,255,255,0.4); min-width: 32px; text-align: right; }

    /* grid de cards */
    .roadmap-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    @media (max-width: 600px) { .roadmap-grid { grid-template-columns: 1fr; } }

    /* card */
    .roadmap-card {
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 12px;
      padding: 14px;
      display: flex; flex-direction: column; gap: 8px;
      transition: border-color 0.2s, background 0.2s;
      position: relative;
    }
    .roadmap-card:hover { border-color: rgba(255,101,0,0.2); background: rgba(255,101,0,0.03); }
    .roadmap-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
    .roadmap-card-title { font-size: 13px; font-weight: 600; color: #fff; line-height: 1.3; flex: 1; }
    .roadmap-card-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
    .roadmap-card:hover .roadmap-card-actions { opacity: 1; }
    .roadmap-card-action-btn {
      width: 24px; height: 24px; border-radius: 6px;
      background: rgba(255,255,255,0.06); border: none;
      cursor: pointer; display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.4); font-size: 11px; transition: all 0.15s;
    }
    .roadmap-card-action-btn:hover { background: rgba(255,255,255,0.12); color: #fff; }
    .roadmap-card-action-btn.del:hover { background: rgba(255,60,60,0.15); color: #ff6060; }
    .roadmap-card-desc { font-size: 11.5px; color: rgba(255,255,255,0.4); line-height: 1.5; }
    .roadmap-card-footer { display: flex; align-items: center; gap: 6px; margin-top: 2px; }
    .roadmap-status-badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 8px; border-radius: 6px;
      font-size: 10px; font-weight: 600;
    }
    .roadmap-cat-chip {
      padding: 3px 8px; border-radius: 6px;
      font-size: 10px; font-weight: 500;
      background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.35);
    }
    .roadmap-pri-chip {
      margin-left: auto;
      font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px;
      color: rgba(255,255,255,0.2);
    }
    .roadmap-pri-chip.alta { color: rgba(255,101,0,0.6); }
    .roadmap-pri-chip.media { color: rgba(245,158,11,0.55); }

    /* empty state */
    .roadmap-empty {
      grid-column: 1/-1;
      padding: 40px; text-align: center;
      color: rgba(255,255,255,0.2); font-size: 13px;
    }

    /* ── FORM NOVA FEATURE ── */
    .roadmap-form-overlay {
      position: absolute; inset: 0; z-index: 10;
      background: rgba(10,5,0,0.92);
      backdrop-filter: blur(6px);
      border-radius: 20px;
      display: none; flex-direction: column;
      padding: 24px;
      gap: 14px;
    }
    .roadmap-form-overlay.open { display: flex; }
    .roadmap-form-title { font-size: 14px; font-weight: 600; color: #fff; }
    .roadmap-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .roadmap-form-full { grid-column: 1/-1; }
    .roadmap-form-label { font-size: 10px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .roadmap-form-input, .roadmap-form-select, .roadmap-form-textarea {
      width: 100%; background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px; padding: 8px 12px;
      color: #fff; font-size: 13px; font-family: inherit;
      outline: none; box-sizing: border-box;
      transition: border-color 0.15s;
    }
    .roadmap-form-input:focus, .roadmap-form-select:focus, .roadmap-form-textarea:focus {
      border-color: rgba(255,101,0,0.4);
    }
    .roadmap-form-textarea { resize: vertical; min-height: 70px; }
    .roadmap-form-select option { background: #1a0f05; }
    .roadmap-form-actions { display: flex; gap: 8px; margin-top: auto; }
    .roadmap-form-cancel {
      padding: 8px 18px; border-radius: 8px;
      background: rgba(255,255,255,0.05); border: none;
      color: rgba(255,255,255,0.5); font-size: 13px;
      cursor: pointer; transition: all 0.15s;
    }
    .roadmap-form-cancel:hover { background: rgba(255,255,255,0.09); color: #fff; }
    .roadmap-form-submit {
      padding: 8px 20px; border-radius: 8px;
      background: rgba(255,101,0,0.2);
      border: 1px solid rgba(255,101,0,0.35);
      color: #ff6500; font-size: 13px; font-weight: 500;
      cursor: pointer; transition: all 0.15s;
    }
    .roadmap-form-submit:hover { background: rgba(255,101,0,0.3); }

    /* light mode adjustments */
    body.light .roadmap-modal { background: #faf6f2; border-color: rgba(255,101,0,0.2); }
    body.light .roadmap-header { border-bottom-color: rgba(180,100,40,0.1); }
    body.light .roadmap-card { background: rgba(255,255,255,0.6); border-color: rgba(180,100,40,0.1); }
    body.light .roadmap-card:hover { background: rgba(255,101,0,0.04); border-color: rgba(255,101,0,0.25); }
    body.light .roadmap-card-title { color: #1a0800; }
    body.light .roadmap-card-desc { color: rgba(0,0,0,0.45); }
    body.light .roadmap-title { color: #1a0800; }
    body.light .roadmap-form-overlay { background: rgba(250,246,242,0.96); }
    body.light .roadmap-form-input,
    body.light .roadmap-form-select,
    body.light .roadmap-form-textarea { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.12); color: #1a0800; }
  `;
  document.head.appendChild(style);
}

// ── Render ─────────────────────────────────────────────────────────────────
let activeTab = 'todos';
let activeCat = 'todas';
let features = loadFeatures();
let editingId = null;

function getFilteredFeatures() {
  return features.filter(f => {
    const tabOk = activeTab === 'todos' ? true :
                  activeTab === 'producao' ? f.status === 'producao' :
                  activeTab === 'backlog'  ? ['planejado','desenvolvimento','pausado'].includes(f.status) : true;
    const catOk = activeCat === 'todas' || f.categoria === activeCat;
    return tabOk && catOk;
  });
}

function countByStatus(s) { return features.filter(f => f.status === s).length; }

function renderStats() {
  const total = features.length;
  const prod  = countByStatus('producao');
  const pct   = total ? Math.round((prod / total) * 100) : 0;
  return `
    <div class="roadmap-progress-bar-wrap">
      <div class="roadmap-progress-stats">
        <div class="roadmap-stat">
          <div class="roadmap-stat-num">${features.length}</div>
          <div class="roadmap-stat-label">Total</div>
        </div>
        <div class="roadmap-stat">
          <div class="roadmap-stat-num" style="color:#22d3a8">${countByStatus('producao')}</div>
          <div class="roadmap-stat-label">Em Produção</div>
        </div>
        <div class="roadmap-stat">
          <div class="roadmap-stat-num" style="color:#f59e0b">${countByStatus('desenvolvimento')}</div>
          <div class="roadmap-stat-label">Em Dev</div>
        </div>
        <div class="roadmap-stat">
          <div class="roadmap-stat-num" style="color:#6b7cff">${countByStatus('planejado')}</div>
          <div class="roadmap-stat-label">Planejado</div>
        </div>
      </div>
      <div class="roadmap-progress-track">
        <div class="roadmap-progress-fill" style="width:${pct}%"></div>
      </div>
      <div class="roadmap-progress-pct">${pct}%</div>
    </div>`;
}

function renderCard(f) {
  const s = STATUS_CONFIG[f.status] || STATUS_CONFIG.planejado;
  const c = CATEGORIAS[f.categoria] || CATEGORIAS.outro;
  return `
    <div class="roadmap-card" data-id="${f.id}">
      <div class="roadmap-card-top">
        <div class="roadmap-card-title">${escHtml(f.titulo)}</div>
        <div class="roadmap-card-actions">
          <button class="roadmap-card-action-btn" onclick="window._roadmap.editFeature('${f.id}')" title="Editar">✎</button>
          <button class="roadmap-card-action-btn del" onclick="window._roadmap.deleteFeature('${f.id}')" title="Remover">✕</button>
        </div>
      </div>
      ${f.descricao ? `<div class="roadmap-card-desc">${escHtml(f.descricao)}</div>` : ''}
      <div class="roadmap-card-footer">
        <span class="roadmap-status-badge" style="background:${s.bg};color:${s.color}">
          ${s.icon} ${s.label}
        </span>
        <span class="roadmap-cat-chip" style="color:${c.color}88">${c.label}</span>
        <span class="roadmap-pri-chip ${f.prioridade || ''}">${f.prioridade === 'alta' ? '↑ Alta' : f.prioridade === 'media' ? '→ Média' : ''}</span>
      </div>
    </div>`;
}

function renderList() {
  const filtered = getFilteredFeatures();
  if (!filtered.length) return `<div class="roadmap-empty">Nenhuma feature encontrada.</div>`;
  return filtered.map(renderCard).join('');
}

function tabCount(tab) {
  if (tab === 'todos') return features.length;
  if (tab === 'producao') return features.filter(f => f.status === 'producao').length;
  return features.filter(f => ['planejado','desenvolvimento','pausado'].includes(f.status)).length;
}

function rerenderBody() {
  const body = document.getElementById('roadmap-grid');
  if (body) body.innerHTML = renderList();
  const statsEl = document.getElementById('roadmap-stats');
  if (statsEl) statsEl.innerHTML = renderStats();
  // atualizar contadores tabs
  document.querySelectorAll('.roadmap-tab').forEach(t => {
    const tab = t.dataset.tab;
    const cnt = t.querySelector('.roadmap-tab-count');
    if (cnt) cnt.textContent = tabCount(tab);
  });
}

// ── Modal principal ────────────────────────────────────────────────────────
function buildModal() {
  const tabs = [
    { key: 'todos',    label: 'Tudo' },
    { key: 'producao', label: 'Em Produção' },
    { key: 'backlog',  label: 'Backlog' },
  ];

  return `
    <div class="roadmap-modal" id="roadmap-modal">
      <div class="roadmap-header">
        <div class="roadmap-header-left">
          <div class="roadmap-header-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
            </svg>
          </div>
          <div>
            <div class="roadmap-title">Roadmap — HUB.nexus</div>
            <div class="roadmap-subtitle">Progresso e features da plataforma</div>
          </div>
        </div>
        <button class="roadmap-close" onclick="window._roadmap.close()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="roadmap-tabs">
        ${tabs.map(t => `
          <button class="roadmap-tab ${t.key === activeTab ? 'active' : ''}" data-tab="${t.key}" onclick="window._roadmap.setTab('${t.key}')">
            ${t.label}
            <span class="roadmap-tab-count">${tabCount(t.key)}</span>
          </button>`).join('')}
      </div>

      <div class="roadmap-filters">
        <span class="roadmap-filter-label">Categoria</span>
        <button class="roadmap-filter-chip ${activeCat === 'todas' ? 'active' : ''}" onclick="window._roadmap.setCat('todas')">Todas</button>
        ${Object.entries(CATEGORIAS).map(([k,v]) => `
          <button class="roadmap-filter-chip ${activeCat === k ? 'active' : ''}" onclick="window._roadmap.setCat('${k}')"
                  style="${activeCat === k ? `border-color:${v.color}55;background:${v.color}15;color:${v.color}` : ''}">
            ${v.label}
          </button>`).join('')}
        <button class="roadmap-add-btn" onclick="window._roadmap.openForm()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nova feature
        </button>
      </div>

      <div class="roadmap-body">
        <div id="roadmap-stats">${renderStats()}</div>
        <div class="roadmap-grid" id="roadmap-grid">${renderList()}</div>
      </div>

      <!-- Form de nova/edição de feature -->
      <div class="roadmap-form-overlay" id="roadmap-form">
        <div class="roadmap-form-title" id="roadmap-form-title">Nova Feature</div>
        <div class="roadmap-form-grid">
          <div class="roadmap-form-full">
            <div class="roadmap-form-label">Título *</div>
            <input class="roadmap-form-input" id="rf-titulo" placeholder="Nome da feature..." autocomplete="off">
          </div>
          <div class="roadmap-form-full">
            <div class="roadmap-form-label">Descrição</div>
            <textarea class="roadmap-form-textarea" id="rf-descricao" placeholder="Descreva brevemente..."></textarea>
          </div>
          <div>
            <div class="roadmap-form-label">Status</div>
            <select class="roadmap-form-select" id="rf-status">
              ${Object.entries(STATUS_CONFIG).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="roadmap-form-label">Categoria</div>
            <select class="roadmap-form-select" id="rf-categoria">
              ${Object.entries(CATEGORIAS).map(([k,v]) => `<option value="${k}">${v.label}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="roadmap-form-label">Prioridade</div>
            <select class="roadmap-form-select" id="rf-prioridade">
              <option value="alta">↑ Alta</option>
              <option value="media" selected>→ Média</option>
              <option value="baixa">↓ Baixa</option>
            </select>
          </div>
        </div>
        <div class="roadmap-form-actions">
          <button class="roadmap-form-cancel" onclick="window._roadmap.closeForm()">Cancelar</button>
          <button class="roadmap-form-submit" onclick="window._roadmap.submitForm()">Salvar Feature</button>
        </div>
      </div>
    </div>`;
}

// ── API pública ────────────────────────────────────────────────────────────
window._roadmap = {
  open() {
    features = loadFeatures(); // reload fresh
    const ol = document.getElementById('roadmap-overlay');
    ol.innerHTML = buildModal();
    requestAnimationFrame(() => ol.classList.add('open'));
  },
  close() {
    const ol = document.getElementById('roadmap-overlay');
    ol.classList.remove('open');
  },
  setTab(t) {
    activeTab = t;
    document.querySelectorAll('.roadmap-tab').forEach(el => el.classList.toggle('active', el.dataset.tab === t));
    rerenderBody();
  },
  setCat(c) {
    activeCat = c;
    rerenderBody();
  },
  openForm(id) {
    editingId = id || null;
    const form = document.getElementById('roadmap-form');
    const titleEl = document.getElementById('roadmap-form-title');
    if (id) {
      const f = features.find(x => x.id === id);
      if (!f) return;
      titleEl.textContent = 'Editar Feature';
      document.getElementById('rf-titulo').value     = f.titulo || '';
      document.getElementById('rf-descricao').value  = f.descricao || '';
      document.getElementById('rf-status').value     = f.status;
      document.getElementById('rf-categoria').value  = f.categoria;
      document.getElementById('rf-prioridade').value = f.prioridade || 'media';
    } else {
      titleEl.textContent = 'Nova Feature';
      document.getElementById('rf-titulo').value     = '';
      document.getElementById('rf-descricao').value  = '';
      document.getElementById('rf-status').value     = 'planejado';
      document.getElementById('rf-categoria').value  = 'outro';
      document.getElementById('rf-prioridade').value = 'media';
    }
    form.classList.add('open');
    document.getElementById('rf-titulo').focus();
  },
  closeForm() {
    document.getElementById('roadmap-form').classList.remove('open');
    editingId = null;
  },
  submitForm() {
    const titulo = document.getElementById('rf-titulo').value.trim();
    if (!titulo) { document.getElementById('rf-titulo').focus(); return; }
    if (editingId) {
      const idx = features.findIndex(f => f.id === editingId);
      if (idx >= 0) {
        features[idx] = {
          ...features[idx],
          titulo,
          descricao:  document.getElementById('rf-descricao').value.trim(),
          status:     document.getElementById('rf-status').value,
          categoria:  document.getElementById('rf-categoria').value,
          prioridade: document.getElementById('rf-prioridade').value,
        };
      }
    } else {
      features.push({
        id: 'f' + Date.now(),
        titulo,
        descricao:  document.getElementById('rf-descricao').value.trim(),
        status:     document.getElementById('rf-status').value,
        categoria:  document.getElementById('rf-categoria').value,
        prioridade: document.getElementById('rf-prioridade').value,
        dataCriacao: new Date().toISOString().split('T')[0],
      });
    }
    saveFeatures(features);
    this.closeForm();
    rerenderBody();
    // atualiza badge
    updateBadge();
  },
  editFeature(id)   { this.openForm(id); },
  deleteFeature(id) {
    if (!confirm('Remover esta feature?')) return;
    features = features.filter(f => f.id !== id);
    saveFeatures(features);
    rerenderBody();
    updateBadge();
  },
};

// ── Badge (itens em dev) ───────────────────────────────────────────────────
function updateBadge() {
  const badge = document.getElementById('roadmap-badge');
  if (!badge) return;
  const inDev = features.filter(f => f.status === 'desenvolvimento').length;
  badge.style.display = inDev > 0 ? 'block' : 'none';
}

// ── Injetar botão na sidebar ───────────────────────────────────────────────
function injectSidebarButton() {
  // Aguarda sidebar existir
  const sidebarBottom = document.querySelector('.sidebar-bottom');
  if (!sidebarBottom) return;

  // Evita duplicata
  if (document.getElementById('roadmap-sidebar-btn')) return;

  const btn = document.createElement('button');
  btn.id = 'roadmap-sidebar-btn';
  btn.className = 'roadmap-sidebar-btn';
  btn.title = 'Roadmap — progresso da plataforma';
  btn.onclick = () => window._roadmap.open();
  btn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
    <span class="roadmap-badge" id="roadmap-badge" style="display:none"></span>
  `;

  // Inserir ANTES do dark-mode toggle (primeiro item do sidebar-bottom)
  sidebarBottom.insertBefore(btn, sidebarBottom.firstChild);
  updateBadge();
}

// ── Overlay container ──────────────────────────────────────────────────────
function injectOverlay() {
  if (document.getElementById('roadmap-overlay')) return;
  const ol = document.createElement('div');
  ol.id = 'roadmap-overlay';
  ol.onclick = (e) => { if (e.target === ol) window._roadmap.close(); };
  document.body.appendChild(ol);
}

// ── Escape key ─────────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const form = document.getElementById('roadmap-form');
    if (form && form.classList.contains('open')) { window._roadmap.closeForm(); return; }
    const ol = document.getElementById('roadmap-overlay');
    if (ol && ol.classList.contains('open')) { window._roadmap.close(); }
  }
});

// ── Util ───────────────────────────────────────────────────────────────────
function escHtml(s) {
  return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Init ───────────────────────────────────────────────────────────────────
function init() {
  injectCSS();
  injectOverlay();
  injectSidebarButton();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  // sidebar pode ser injetada pelo utils.js depois do DOMContentLoaded
  // então observamos o DOM
  init();
  const observer = new MutationObserver(() => {
    if (document.querySelector('.sidebar-bottom') && !document.getElementById('roadmap-sidebar-btn')) {
      injectSidebarButton();
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

})();
