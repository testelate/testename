/* ═══════════════════════════════════════════
   HUB.nexus — utils.js
   Funções compartilhadas entre todas as telas
   ═══════════════════════════════════════════ */

// ─── BUSCA GLOBAL (Top Priority) ───
function openGlobalSearch() {
  const overlayId = 'search-overlay';
  if (!document.getElementById(overlayId)) {
    if (typeof initGlobalSearch === 'function') initGlobalSearch();
  }
  const el = document.getElementById(overlayId);
  if (!el) return console.error('Houve um erro ao inicializar o modal de busca.');
  
  el.classList.add('open');
  const inp = document.getElementById('global-search-input');
  if (inp) {
    inp.value = '';
    inp.focus();
  }
  const results = document.getElementById('search-results');
  if (results) results.innerHTML = '<div class="search-empty">Digite pelo menos 2 caracteres...</div>';
}

function closeGlobalSearch() {
  const el = document.getElementById('search-overlay');
  if (el) el.classList.remove('open');
}

// ─── TOAST ───
function showToast(msg, duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => el.classList.remove('show'), duration);
}

// ─── MODO CLARO / ESCURO ───
const MODE_KEY = 'hubnexus-mode';

function initMode() {
  const saved = localStorage.getItem(MODE_KEY) || 'dark';
  applyMode(saved, false);
}

function applyMode(mode, animate = true) {
  const root = document.documentElement;
  if (animate) root.style.transition = 'background 0.4s';
  document.body.classList.toggle('dark',  mode === 'dark');
  document.body.classList.toggle('light', mode === 'light');
  localStorage.setItem(MODE_KEY, mode);

  const sw    = document.getElementById('modeSwitch');
  const thumb = document.getElementById('modeThumb');
  if (sw)    sw.className    = 'mode-switch ' + (mode === 'dark' ? 'is-dark' : 'is-light');
  if (thumb) thumb.className = 'sw-thumb '    + (mode === 'dark' ? 'thumb-dark' : 'thumb-light');
}

function toggleMode() {
  const current = document.body.classList.contains('dark') ? 'dark' : 'light';
  applyMode(current === 'dark' ? 'light' : 'dark');
}

function getMode() {
  return document.body.classList.contains('dark') ? 'dark' : 'light';
}

// ─── NAVEGAÇÃO ───
// Caminhos sempre relativos à raiz — cada página corrige via isInsidePages
const PAGES_ROOT = {
  dashboard:     'index.html',
  monitoramento: 'pages/monitoramento.html',
  tasks:         'pages/tasks.html',
  kanban:        'pages/kanban.html',
  briefing:      'pages/briefing-team.html',
  tutorials:     'pages/tutorials.html',
  ekklesia:      'pages/ekklesia.html',
  'ekklesia-embratur': 'pages/ekklesia-embratur.html',
  'alertas-panoramas': 'pages/alertas-panoramas.html',
  voxia:         'pages/voxia.html',
  gestao:        'pages/gestao.html',
  irx:           'pages/pipeline-irx.html',
  guruquest:     'pages/guruquest.html',
  reputaition:   'pages/reputaition.html',
};

// PAGES usado por navigate() — detecta se está em /pages/ automaticamente
const PAGES = PAGES_ROOT;

const GESTAO_HASH = '7e6abff0ad0d80158153f8cad5e9ef40da03a2e70fa20f2f22fb8b6470c686e4'; // Nexus123##

async function _hashSenha(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

function _mostrarModalGestao(onOk) {
  const existing = document.getElementById('_gestao-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = '_gestao-modal';
  modal.style.cssText = `
    position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;
    background:rgba(0,0,0,0.6);backdrop-filter:blur(4px);
  `;
  modal.innerHTML = `
    <div style="background:var(--surface,#1a1a1a);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:32px;width:320px;display:flex;flex-direction:column;gap:16px;box-shadow:0 24px 64px rgba(0,0,0,0.5);">
      <div style="display:flex;align-items:center;gap:10px;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--orange,#f97316)" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path class="sb-shackle" d="M7 11V7a5 5 0 0110 0v4"/></svg>
        <span style="font-size:13px;font-weight:600;color:var(--text-primary,#fff);">Acesso restrito — Gestão</span>
      </div>
      <p style="font-size:11px;color:var(--text-muted,#888);margin:0;">Esta área requer senha de administrador.</p>
      <input id="_gestao-pw" type="password" placeholder="Senha de gestão" autocomplete="off"
        style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:8px;padding:10px 14px;font-size:13px;color:var(--text-primary,#fff);outline:none;width:100%;box-sizing:border-box;" />
      <div id="_gestao-erro" style="font-size:11px;color:#f87171;display:none;">Senha incorreta. Tente novamente.</div>
      <div style="display:flex;gap:8px;justify-content:flex-end;">
        <button id="_gestao-cancel" style="padding:8px 16px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);background:transparent;color:var(--text-muted,#888);font-size:12px;cursor:pointer;">Cancelar</button>
        <button id="_gestao-ok" style="padding:8px 16px;border-radius:8px;border:none;background:var(--orange,#f97316);color:#fff;font-size:12px;font-weight:600;cursor:pointer;">Entrar</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const pw  = modal.querySelector('#_gestao-pw');
  const err = modal.querySelector('#_gestao-erro');

  const fechar = () => modal.remove();

  modal.querySelector('#_gestao-cancel').onclick = fechar;
  modal.onclick = e => { if (e.target === modal) fechar(); };

  const tentar = async () => {
    const okBtn = modal.querySelector('#_gestao-ok');
    okBtn.disabled = true; okBtn.textContent = '...';
    try {
      const res = await fetch('/api/otp', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:'gestao@hubnexus.app', senha:pw.value}) });
      const data = await res.json();
      if (data.ok) { fechar(); onOk(); }
      else { err.style.display = 'block'; pw.value = ''; pw.focus(); }
    } catch { err.style.display = 'block'; err.textContent = 'Erro de conexão.'; }
    okBtn.disabled = false; okBtn.textContent = 'Entrar';
  };

  modal.querySelector('#_gestao-ok').onclick = tentar;
  pw.addEventListener('keydown', e => { if (e.key === 'Enter') tentar(); });
  setTimeout(() => pw.focus(), 80);
}

function navigate(page) {
  const isInsidePages = window.location.pathname.includes('/pages/');
  const map = {
    dashboard:     isInsidePages ? '../index.html'      : 'index.html',
    monitoramento: isInsidePages ? 'monitoramento.html' : 'pages/monitoramento.html',
    tasks:         isInsidePages ? 'tasks.html'         : 'pages/tasks.html',
    kanban:        isInsidePages ? 'kanban.html'        : 'pages/kanban.html',
    briefing:      isInsidePages ? 'briefing-team.html' : 'pages/briefing-team.html',
    tutorials:     isInsidePages ? 'tutorials.html'     : 'pages/tutorials.html',
    ekklesia:      isInsidePages ? 'ekklesia.html'      : 'pages/ekklesia.html',
    'ekklesia-embratur': isInsidePages ? 'ekklesia-embratur.html' : 'pages/ekklesia-embratur.html',
    'alertas-panoramas': isInsidePages ? 'alertas-panoramas.html' : 'pages/alertas-panoramas.html',
    voxia:         isInsidePages ? 'voxia.html'         : 'pages/voxia.html',
    gestao:        isInsidePages ? 'gestao.html'        : 'pages/gestao.html',
    irx:           isInsidePages ? 'pipeline-irx.html'  : 'pages/pipeline-irx.html',
    studio:        isInsidePages ? 'studio.html'          : 'pages/studio.html',
    guruquest:     isInsidePages ? 'guruquest.html'      : 'pages/guruquest.html',
    reputaition:   isInsidePages ? 'reputaition.html'    : 'pages/reputaition.html',
  };
  if (!map[page]) return;
  if (page === 'gestao') {
    _mostrarModalGestao(() => { window.location.href = map[page]; });
  } else {
    window.location.href = map[page];
  }
}

// ─── SIDEBAR ATIVA ───
function setActiveSidebar(pageKey) {
  document.querySelectorAll('.nav-item[data-page]').forEach(el => {
    el.classList.toggle('active', el.dataset.page === pageKey);
  });
}

// ─── FORMATAR NÚMERO ───
function formatNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}

// ─── FORMATAR DATA ───
function formatDate(date) {
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(date);
}

// ─── AUTENTICAÇÃO ───
const AUTH_KEY  = 'hubnexus-auth';
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 horas

function checkAuth() {
  try {
    const raw = localStorage.getItem(AUTH_KEY);

    if (!raw) {
      window.location.href = _loginPath();
      return false;
    }

    const sessao = JSON.parse(raw);
    const expirou = Date.now() - sessao.ts > SESSION_TTL;
    if (expirou) {
      localStorage.removeItem(AUTH_KEY);
      window.location.href = _loginPath();
      return false;
    }

    // Garante que nome e email ficam disponíveis nas chaves legadas
    if (sessao.email) localStorage.setItem('hubnexus-email', sessao.email);
    if (sessao.nome)  localStorage.setItem('hubnexus-name',  sessao.nome);

    return sessao;
  } catch {
    localStorage.removeItem(AUTH_KEY);
    window.location.href = _loginPath();
    return false;
  }
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem('hubnexus-email');
  localStorage.removeItem('hubnexus-name');
  localStorage.removeItem('hubnexus-token');
  window.location.href = _loginPath();
}

// Alias usado nos botões HTML
function handleLogout() {
  if (confirm('Deseja sair do HUB.nexus?')) {
    logout();
  }
}

function _loginPath() {
  return window.location.pathname.includes('/pages/') ? '../login.html' : 'login.html';
}

// ─── CLAUDE API (via /api/claude — Cloudflare Pages Function) ───
async function callClaude(prompt, maxTokens = 1000) {
  try {
    const res = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens }),
    });
    if (!res.ok) throw new Error('Erro no servidor');
    const data = await res.json();
    return data.content || '';
  } catch (err) {
    console.error('callClaude error:', err);
    showToast('Erro ao contatar a IA.');
    return '';
  }
}


// ─── NAVBAR (substituiu sidebar — topbar compacta para páginas internas) ───
function renderSidebar(activePage) {
  // Alias para compatibilidade — chama renderNavbar
  return renderNavbar(activePage);
}

function renderNavbar(activePage) {
  const isInsidePages = window.location.pathname.includes('/pages/');
  const homeHref = isInsidePages ? '../index.html' : 'index.html';

  // Pega nome do usuário para o avatar
  let initials = '?';
  try {
    const auth  = JSON.parse(localStorage.getItem('hubnexus-auth') || '{}');
    const nome  = auth.nome || (auth.email ? auth.email.split('@')[0].replace(/[._-]/g,' ').replace(/\b\w/g,l=>l.toUpperCase()) : '');
    const parts = nome.trim().split(/\s+/).filter(Boolean);
    initials = parts.length >= 2
      ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase()
      : (parts[0]?.slice(0,2).toUpperCase() || '?');
  } catch(e) {}

  const profileHref = isInsidePages ? 'profile.html' : 'pages/profile.html';

  return `
    <nav class="page-navbar">
      <a href="${homeHref}" class="pnav-home-btn" title="Voltar ao início">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" width="15" height="15">
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span>Hub</span>
      </a>

      <div class="pnav-page-label" id="pnav-label"></div>

      <div class="pnav-spacer"></div>

      <div class="pnav-controls">
        <div class="notif-btn font-size-btn" id="fontSizeBtn" onclick="cycleFontSize()" title="Tamanho do texto: 100%">
          <span class="fsz-label">A</span>
        </div>
        <div class="notif-btn" id="a11yBtn" onclick="toggleA11y()" title="Modo acessibilidade W3C">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
            <circle cx="12" cy="12" r="10.5"/><circle cx="12" cy="6.8" r="2.4" fill="currentColor" stroke="none"/>
            <line x1="12" y1="10.8" x2="1.5" y2="12"/><line x1="12" y1="10.8" x2="22.5" y2="12"/>
            <circle cx="1.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="22.5" cy="12" r="1.3" fill="currentColor" stroke="none"/>
            <line x1="12" y1="13.2" x2="4.6" y2="19.4"/><line x1="12" y1="13.2" x2="19.4" y2="19.4"/>
            <circle cx="4.6" cy="19.4" r="1.3" fill="currentColor" stroke="none"/><circle cx="19.4" cy="19.4" r="1.3" fill="currentColor" stroke="none"/>
          </svg>
        </div>
        <div class="palette-btn" id="paletteBtn" onclick="togglePicker()" title="Personalizar cor"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 114.03 4.03l-8.06 8.08"/><path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1 1 2.4 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 00-3-3.02z" fill="currentColor" opacity="0.35"/></svg>
        </div>
        <div class="notif-btn mode-btn" onclick="toggleMode()" title="Alternar modo">
          <svg viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>
        </div>
        <button class="notif-btn mode-btn" onclick="handleLogout()" title="Sair" style="color:rgba(239,68,68,.6);">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
        <a href="${profileHref}" style="text-decoration:none;">
          <div class="avatar-mini" style="font-family:var(--font-ui,sans-serif);font-size:11px;font-weight:800;">${initials}</div>
        </a>
      </div>

      <!-- Theme picker -->
      <div class="theme-picker-panel" id="themePanel" style="top:62px;right:16px;">
        <div class="theme-picker-title">🎨 Cor do hub</div>
        <div class="theme-swatches" id="swatchGrid"></div>
        <div class="theme-divider"></div>
        <div style="font-family:var(--font-ui);font-size:10px;font-weight:800;color:var(--text-muted);letter-spacing:.6px;text-transform:uppercase;margin-bottom:7px;">Código HEX personalizado</div>
        <div class="hex-row">
          <div class="hex-preview" id="hexPreview" title="Clique para escolher cor" onclick="this.querySelector('input').click()" style="position:relative;overflow:hidden;">
          <input type="color" id="nativeColorPicker" value="#FF6500" 
                 style="position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;border:none;padding:0;"
                 oninput="applyThemeColor(this.value);document.getElementById('hexInput').value=this.value;document.getElementById('hexPreview').style.background=this.value"
                 onchange="applyThemeColor(this.value);closePicker()"/>
        </div>
          <input class="hex-input" id="hexInput" type="text" placeholder="#FF6500" maxlength="7" oninput="onHexInput(this.value)"/>
          <button class="hex-apply-btn" onclick="applyHexColor()">OK</button>
        </div>
        <div class="theme-divider"></div>
        <div class="theme-picker-title">Modo</div>
        <div class="mode-row">
          <div class="mode-option" id="mode-light" onclick="applyMode('light')">☀️ Claro</div>
          <div class="mode-option" id="mode-dark"  onclick="applyMode('dark')">🌙 Escuro</div>
        </div>
      </div>
    </nav>`;
}

// Atualiza label da página na navbar
function setNavLabel(label) {
  const el = document.getElementById('pnav-label');
  if (el) el.textContent = label;
}

function _sbClick(el) {
  el.classList.remove('sb-on');
  void el.offsetWidth;
  el.classList.add('sb-on');
  setTimeout(() => el.classList.remove('sb-on'), 1400);
}

// ─── BUSCA GLOBAL ───
function initGlobalSearch() {
  // 1. Injetar HTML do Modal se não existir
  if (!document.getElementById('search-overlay')) {
    const overlay = document.createElement('div');
    overlay.id = 'search-overlay';
    overlay.className = 'search-overlay';
    overlay.innerHTML = `
      <div class="search-modal">
        <div class="search-header">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" id="global-search-input" placeholder="Buscar em tudo... (Esc para sair)" autocomplete="off">
          <div class="search-kbd">ESC</div>
        </div>
        <div id="search-results" class="search-results">
          <div class="search-empty">Digite pelo menos 2 caracteres...</div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // 2. Injetar CSS
    const style = document.createElement('style');
    style.textContent = `
      .search-overlay { position:fixed; inset:0; z-index:9999; background:rgba(0,0,0,0.6); backdrop-filter:blur(8px); display:none; align-items:flex-start; justify-content:center; padding-top:12vh; opacity:0; transition:opacity 0.2s ease; }
      .search-overlay.open { display:flex; opacity:1; }
      .search-modal { width:95%; max-width:600px; background:#1a0f05; border:1px solid rgba(255,101,0,0.25); border-radius:16px; box-shadow:0 20px 50px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05); overflow:hidden; transform:translateY(-10px); transition:transform 0.2s ease; }
      .search-overlay.open .search-modal { transform:translateY(0); }
      .search-header { display:flex; align-items:center; padding:16px 20px; border-bottom:1px solid rgba(255,255,255,0.08); gap:12px; }
      .search-icon { width:18px; height:18px; color:var(--orange-2); opacity:0.7; }

      /* Animações de clique nos ícones da sidebar */
      .nav-item svg * { transform-box: fill-box; transform-origin: center; }

      @keyframes sb-eye-open { 0%{transform:scaleY(1)} 20%{transform:scaleY(0.04)} 60%{transform:scaleY(1.45)} 80%{transform:scaleY(0.88)} 100%{transform:scaleY(1)} }
      .nav-item.sb-on .sb-pupil { animation: sb-eye-open 1.1s ease forwards; }

      @keyframes sb-check-draw { 0%{stroke-dashoffset:22;opacity:.15} 70%{stroke-dashoffset:0;opacity:1} 85%{stroke-dashoffset:-2} 100%{stroke-dashoffset:0} }
      .nav-item.sb-on .sb-check { stroke-dasharray: 22; animation: sb-check-draw 0.9s ease forwards; }

      @keyframes sb-col-up { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
      .nav-item.sb-on .sb-col1 { animation: sb-col-up 0.7s 0.00s ease both; }
      .nav-item.sb-on .sb-col2 { animation: sb-col-up 0.7s 0.15s ease both; }
      .nav-item.sb-on .sb-col3 { animation: sb-col-up 0.7s 0.30s ease both; }

      @keyframes sb-line-write { from{stroke-dashoffset:20} to{stroke-dashoffset:0} }
      .nav-item.sb-on .sb-line1 { stroke-dasharray: 20; animation: sb-line-write 0.55s 0.00s ease forwards; }
      .nav-item.sb-on .sb-line2 { stroke-dasharray: 20; animation: sb-line-write 0.55s 0.45s ease forwards; }

      @keyframes sb-flash { 0%,100%{opacity:1;stroke-width:1.5} 35%{opacity:0.05;stroke-width:3.5} 65%{opacity:1} }
      .nav-item.sb-on .sb-cam { animation: sb-flash 0.9s ease; }

      @keyframes sb-globe-spin { 0%{transform:rotate(0)} 70%{transform:rotate(370deg)} 100%{transform:rotate(360deg)} }
      .nav-item.sb-on .sb-globe { animation: sb-globe-spin 1.1s cubic-bezier(.4,0,.2,1); }

      @keyframes sb-wave { 0%,100%{transform:scaleY(1)} 40%{transform:scaleY(0.08)} 70%{transform:scaleY(1.15)} }
      .nav-item.sb-on .sb-w1 { animation: sb-wave 1.0s 0.00s ease-in-out; }
      .nav-item.sb-on .sb-w2 { animation: sb-wave 1.0s 0.12s ease-in-out; }
      .nav-item.sb-on .sb-w3 { animation: sb-wave 1.0s 0.24s ease-in-out; }
      .nav-item.sb-on .sb-w4 { animation: sb-wave 1.0s 0.12s ease-in-out; }
      .nav-item.sb-on .sb-w5 { animation: sb-wave 1.0s 0.00s ease-in-out; }

      @keyframes sb-shackle { 0%,100%{transform:translateY(0) rotate(0)} 40%{transform:translateY(-8px) rotate(-28deg)} 75%{transform:translateY(-6px) rotate(-22deg)} }
      .nav-item.sb-on .sb-shackle { transform-origin: 20% 100%; animation: sb-shackle 1.1s ease; }

      @keyframes sb-pulse { 0%{stroke-dashoffset:60;opacity:.4} 50%{opacity:1} 100%{stroke-dashoffset:-60;opacity:.4} }
      .nav-item.sb-on .sb-pulse { stroke-dasharray: 32 65; animation: sb-pulse 1.0s ease-in-out; }

      @keyframes sb-star { 0%,100%{transform:scale(1) rotate(0)} 30%{transform:scale(1.35) rotate(18deg)} 60%{transform:scale(0.88) rotate(-8deg)} 80%{transform:scale(1.1) rotate(5deg)} }
      .nav-item.sb-on .sb-star { animation: sb-star 1.0s ease; }
      #global-search-input { flex:1; background:none; border:none; color:#fff; font-size:16px; outline:none; font-family:inherit; }
      .search-kbd { font-size:10px; padding:4px 8px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1); border-radius:4px; color:var(--text-muted); }
      .search-results { max-height:400px; overflow-y:auto; padding:8px 0; }
      .search-empty { padding:32px; text-align:center; color:var(--text-muted); font-size:13px; }
      .search-item { display:flex; align-items:center; gap:14px; padding:12px 20px; cursor:pointer; transition:background 0.1s; text-decoration:none; }
      .search-item:hover { background:rgba(255,101,0,0.1); }
      .search-item-icon { width:32px; height:32px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0; background:rgba(255,255,255,0.03); }
      .search-item-info { flex:1; min-width:0; }
      .search-item-title { color:#fff; font-size:14px; font-weight:500; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .search-item-sub { color:var(--text-muted); font-size:11px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .search-item-tag { font-size:10px; text-transform:uppercase; font-weight:700; color:var(--orange-2); opacity:0.6; width:70px; text-align:right; }
    `;
    document.head.appendChild(style);

    // Eventos
    overlay.addEventListener('click', (e) => { if(e.target === overlay) closeGlobalSearch(); });
    document.getElementById('global-search-input').addEventListener('input', (e) => performGlobalSearch(e.target.value));
  }
}



let _searchDebounce;
async function performGlobalSearch(q) {
  clearTimeout(_searchDebounce);
  const resultsEl = document.getElementById('search-results');
  if (q.trim().length < 2) {
    resultsEl.innerHTML = '<div class="search-empty">Digite pelo menos 2 caracteres...</div>';
    return;
  }

  _searchDebounce = setTimeout(async () => {
    resultsEl.innerHTML = '<div class="search-empty"><div class="pulse-dot" style="margin:0 auto 8px;"></div>Buscando...</div>';
    try {
      const isInsidePages = window.location.pathname.includes('/pages/');
      const apiUrl = isInsidePages ? '../api/search?q=' : '/api/search?q=';
      const res = await fetch(apiUrl + encodeURIComponent(q));
      const data = await res.json();
      
      if (!data.length) {
        resultsEl.innerHTML = '<div class="search-empty">Nenhum resultado encontrado para "'+q+'"</div>';
        return;
      }

      resultsEl.innerHTML = data.map(item => {
        const icon = item.type === 'kanban' ? '📋' : item.type === 'task' ? '✅' : item.type === 'projeto' ? '🚀' : '🤝';
        // Corrige link se estiver dentro de /pages/
        let finalLink = item.link;
        if (isInsidePages && !finalLink.startsWith('..')) {
           finalLink = finalLink.replace('pages/', '');
        }

        return `
          <a href="${finalLink}" class="search-item">
            <div class="search-item-icon">${icon}</div>
            <div class="search-item-info">
              <div class="search-item-title">${item.title}</div>
              <div class="search-item-sub">${item.sub || ''}</div>
            </div>
            <div class="search-item-tag">${item.type}</div>
          </a>
        `;
      }).join('');
    } catch(e) {
      console.error('Busca Global Fetch Error:', e);
      resultsEl.innerHTML = '<div class="search-empty">Erro ao pesquisar.</div>';
    }
  }, 300);
}

// Atalhos de teclado (Ctrl+K ou CMD+K)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    openGlobalSearch();
  }
  if (e.key === 'Escape') {
    closeGlobalSearch();
  }
});

// Inicialização robusta
function _initGlobalSearchSafe() {
  if (typeof initGlobalSearch === 'function') {
    initGlobalSearch();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initGlobalSearchSafe);
} else {
  _initGlobalSearchSafe();
}
