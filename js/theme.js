/* ═══════════════════════════════════════════════
   HUB.nexus — Theme System v1.1
   Cor customizável — sem redeclarar MODE_KEY
   ═══════════════════════════════════════════════ */

const THEME_PRESETS = [
  { name: 'Nexus',  hex: '#FF6500' },
  { name: 'Rose',   hex: '#F43F5E' },
  { name: 'Purple', hex: '#A855F7' },
  { name: 'Blue',   hex: '#3B82F6' },
  { name: 'Teal',   hex: '#14B8A6' },
  { name: 'Green',  hex: '#22C55E' },
  { name: 'Amber',  hex: '#F59E0B' },
  { name: 'Indigo', hex: '#6366F1' },
  { name: 'Pink',   hex: '#EC4899' },
  { name: 'Cyan',   hex: '#06B6D4' },
  { name: 'Lime',   hex: '#84CC16' },
  { name: 'Slate',  hex: '#64748B' },
];

// Usa a mesma chave que utils.js (sem redeclarar)
const THEME_KEY = 'hubnexus-theme-color';
// NÃO redeclara MODE_KEY — já existe em utils.js

function hexToHsl(hex) {
  hex = hex.replace('#', '');
  if (hex.length === 3) hex = hex.split('').map(c => c+c).join('');
  const r = parseInt(hex.slice(0,2),16)/255, g = parseInt(hex.slice(2,4),16)/255, b = parseInt(hex.slice(4,6),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h=0, s=0; const l=(max+min)/2;
  if (max!==min) {
    const d=max-min; s=l>.5?d/(2-max-min):d/(max+min);
    switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}
  }
  return {h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};
}

function isValidHex(hex) { return /^#?([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hex); }

function normalizeHex(hex) {
  hex = hex.trim().replace('#','');
  if (hex.length===3) hex=hex.split('').map(c=>c+c).join('');
  return '#'+hex.toUpperCase();
}

function applyThemeColor(hex) {
  const {h,s,l} = hexToHsl(hex);
  const root = document.documentElement;
  root.style.setProperty('--theme-h', h);
  root.style.setProperty('--theme-s', s+'%');
  root.style.setProperty('--theme-l', l+'%');
  localStorage.setItem(THEME_KEY, hex);
  updateSwatchActive(hex);
  const preview = document.getElementById('hexPreview');
  if (preview) preview.style.background = hex;
  const input = document.getElementById('hexInput');
  if (input) input.value = normalizeHex(hex);
  const nativePicker = document.getElementById('nativeColorPicker');
  if (nativePicker) nativePicker.value = hex;
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || '#FF6500';
  applyThemeColor(saved);
  renderSwatches();
  const input = document.getElementById('hexInput');
  if (input) input.value = normalizeHex(saved);
  if (typeof initA11y === 'function') initA11y();
}

function renderSwatches() {
  const grid = document.getElementById('swatchGrid');
  if (!grid) return;
  const saved = normalizeHex(localStorage.getItem(THEME_KEY) || '#FF6500');
  grid.innerHTML = THEME_PRESETS.map(p => `
    <div class="swatch" style="background:${p.hex}" title="${p.name}"
         onclick="applyThemeColor('${p.hex}');closePicker();"
         data-hex="${p.hex.toUpperCase()}"></div>`).join('');
  updateSwatchActive(saved);
}

function updateSwatchActive(hex) {
  const norm = normalizeHex(hex);
  document.querySelectorAll('.swatch').forEach(el => {
    el.classList.toggle('active', normalizeHex(el.dataset.hex||'') === norm);
  });
}

function onHexInput(val) {
  const preview = document.getElementById('hexPreview');
  if (!preview) return;
  const hex = val.startsWith('#') ? val : '#'+val;
  if (isValidHex(hex)) preview.style.background = hex;
}

function applyHexColor() {
  const input = document.getElementById('hexInput');
  if (!input) return;
  let val = input.value.trim();
  if (!val.startsWith('#')) val = '#'+val;
  if (!isValidHex(val)) { input.style.borderColor='var(--red)'; setTimeout(()=>{input.style.borderColor='';},1200); return; }
  applyThemeColor(normalizeHex(val));
  closePicker();
}

document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.activeElement?.id==='hexInput') applyHexColor();
});

function togglePicker() {
  const panel = document.getElementById('themePanel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) updateModeButtons();
}

function closePicker() {
  const panel = document.getElementById('themePanel');
  if (panel) panel.classList.remove('open');
}

document.addEventListener('click', e => {
  const panel = document.getElementById('themePanel');
  const btn   = document.getElementById('paletteBtn');
  if (!panel||!btn) return;
  if (!panel.contains(e.target) && !btn.contains(e.target)) panel.classList.remove('open');
});

// Modo claro/escuro — delega para utils.js se disponível, caso contrário define aqui
function applyMode(mode) {
  document.body.classList.remove('dark','light');
  document.body.classList.add(mode==='dark'?'dark':'light');
  // Usa a chave já definida em utils.js se existir, senão usa string direta
  const key = (typeof MODE_KEY !== 'undefined') ? MODE_KEY : 'hubnexus-mode';
  localStorage.setItem(key, mode);
  updateModeButtons();
}

function toggleMode() {
  applyMode(document.body.classList.contains('dark') ? 'light' : 'dark');
}

function updateModeButtons() {
  const isDark = document.body.classList.contains('dark');
  document.getElementById('mode-light')?.classList.toggle('active', !isDark);
  document.getElementById('mode-dark')?.classList.toggle('active',  isDark);
}

window.initTheme         = initTheme;
window.applyThemeColor   = applyThemeColor;
window.applyHexColor     = applyHexColor;
window.onHexInput        = onHexInput;
window.togglePicker      = togglePicker;
window.closePicker       = closePicker;
window.updateModeButtons = updateModeButtons;
window.renderSwatches    = renderSwatches;
window.applyMode         = applyMode;
window.toggleMode        = toggleMode;

/* ══════════════════════════════════
   ACESSIBILIDADE: Tamanho de fonte + W3C
══════════════════════════════════ */
const FONT_SCALE_KEY = 'hubnexus-font-scale';
const A11Y_KEY       = 'hubnexus-a11y';
const FONT_SCALES    = [1, 1.15, 1.30];
const FONT_LABELS    = ['A', 'A+', 'A++'];

function _applyFontScale(idx) {
  document.documentElement.style.zoom = FONT_SCALES[idx];
  const btn = document.getElementById('fontSizeBtn');
  if (btn) {
    btn.querySelector('.fsz-label').textContent = FONT_LABELS[idx];
    btn.title = 'Tamanho do texto: ' + Math.round(FONT_SCALES[idx] * 100) + '%';
    btn.classList.toggle('active', idx > 0);
  }
}

function cycleFontSize() {
  const current = parseInt(localStorage.getItem(FONT_SCALE_KEY) || '0', 10);
  const next = (current + 1) % FONT_SCALES.length;
  localStorage.setItem(FONT_SCALE_KEY, next);
  _applyFontScale(next);
}

function _applyA11y(isOn) {
  document.body.classList.toggle('accessible', isOn);
  const btn = document.getElementById('a11yBtn');
  if (btn) btn.classList.toggle('active', isOn);
}

function toggleA11y() {
  const isOn = !document.body.classList.contains('accessible');
  localStorage.setItem(A11Y_KEY, isOn ? 'on' : 'off');
  _applyA11y(isOn);
}

function initA11y() {
  const scaleIdx = parseInt(localStorage.getItem(FONT_SCALE_KEY) || '0', 10);
  if (scaleIdx > 0) _applyFontScale(scaleIdx);
  if (localStorage.getItem(A11Y_KEY) === 'on') _applyA11y(true);
}

window.cycleFontSize = cycleFontSize;
window.toggleA11y    = toggleA11y;
window.initA11y      = initA11y;
