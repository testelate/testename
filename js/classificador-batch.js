/**
 * classificador-batch.js — Motor de Classificação em Lote
 * Hub.nexus / Nexus FSB
 *
 * Responsável por:
 *  - Pré-processar publicações (strip HTML, stopwords, truncate)
 *  - Gerar prompts compactos pipe-delimited em lotes
 *  - Parsear respostas no formato "ID:CÓDIGO"
 *  - Persistir progresso no localStorage
 *
 * Exporta: window.HubBatch { Classifier, MODELOS, COD_TO_SENT, renderUI }
 */
(function (G) {
  'use strict';

  /* ── Stopwords PT-BR ─────────────────────────────────────────── */
  const STOPS = new Set([
    'de','da','do','dos','das','em','no','na','nos','nas','por','para',
    'com','que','se','é','um','uma','os','as','ao','à','aos','às',
    'pelo','pela','pelos','pelas','mas','ou','e','o','a','num','numa',
    'seu','sua','seus','suas','este','esta','estes','estas','esse',
    'essa','esses','essas','isso','isto','ele','ela','eles','elas',
    'eu','tu','nós','me','te','nos','lhe','lhes','foi','são','ser',
    'ter','há','já','não','mais','sobre','entre','até','após','ante',
    'sob','sem','desde','durante','como','quando','onde','muito',
    'pouco','bem','ainda','também','porém','então','assim','logo',
    'apenas','só','mesmo','cada','todo','toda','todos','todas',
    'novo','nova','novos','novas','após','ante','seu','sua',
  ]);

  /* ── Modelos e tamanhos de lote ──────────────────────────────── */
  const MODELOS = {
    'gemini-25':     { label: 'Gemini 2.5 Pro / Flash',    batchSize: 5000 },
    'gemini-flash':  { label: 'Gemini 1.5 / 2.0 Flash',   batchSize: 2500 },
    'claude-sonnet': { label: 'Claude Sonnet (200k ctx)',  batchSize: 700  },
    'gpt4o':         { label: 'GPT-4o (128k ctx)',         batchSize: 400  },
    'gpt4o-mini':    { label: 'GPT-4o mini / Haiku',       batchSize: 250  },
  };

  /* ── Mapa código → sentimento ────────────────────────────────── */
  const COD_TO_SENT = {
    P: 'Positivo',
    F: 'Favorável',
    N: 'Neutro',
    D: 'Desfavorável',
    X: 'Negativo',
    E: 'Fora de escopo',
  };

  /* ── Pré-processamento ───────────────────────────────────────── */
  function stripHtml(s) {
    if (!s) return '';
    return String(s)
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ').trim();
  }

  function semStopwords(text) {
    return text.split(/\s+/)
      .filter(w => w.length > 2 && !STOPS.has(w.toLowerCase()))
      .join(' ');
  }

  function compactar(text, maxChars, usarStops = false) {
    let t = stripHtml(text);
    if (usarStops) t = semStopwords(t);
    return t.slice(0, maxChars).replace(/[|\n\r]/g, ' ').trim();
  }

  /* ── Geração de prompt ───────────────────────────────────────── */
  function gerarSistema(cfg) {
    const { empresa, premissas, mensagensChave, tipoBase } = cfg;
    const base = tipoBase === 'press' ? 'matéria de imprensa' : 'publicação em rede social';

    const blocoMK = (mensagensChave || '').trim()
      ? `\nMENSAGENS-CHAVE (presença dessas mensagens pode elevar para Positivo/Favorável):\n${mensagensChave.trim()}`
      : '';

    return `Você é classificador de reputação da empresa/instituição "${empresa}".
Avalie o impacto reputacional de cada ${base} para essa empresa.

CÓDIGOS DE CLASSIFICAÇÃO:
P = Positivo      (destaque positivo explícito, beneficia a imagem)
F = Favorável     (contexto favorável, menção neutra-positiva)
N = Neutro        (sem impacto claro, apenas informativo)
D = Desfavorável  (contexto negativo indireto, menção problemática)
X = Negativo      (crítica, crise, dano explícito à imagem)
E = Fora de escopo (não menciona ou não é relevante para a empresa)

PREMISSAS DE CLASSIFICAÇÃO:
${(premissas || 'Classifique pelo sentimento geral em relação à empresa.').trim()}${blocoMK}

INSTRUÇÃO DE RESPOSTA:
Responda APENAS com os pares ID:CÓDIGO separados por vírgula, em UMA linha.
Exemplo: 1:P,2:N,3:X,4:F,5:D,6:E
Sem texto extra. Sem explicações. Sem quebras de linha.`.trim();
  }

  function gerarBlocoPubs(rows, campos) {
    return rows.map(r => {
      const id      = r.__batchId;
      const titulo  = compactar(r[campos.titulo]  || r.titulo  || '', 130);
      const veiculo = compactar(r[campos.veiculo] || r.veiculo || r.canal || '', 40);
      const extra   = campos.conteudo
        ? compactar(r[campos.conteudo] || r.conteudo || '', 90, true)
        : '';
      return extra ? `${id}|${titulo}|${veiculo}|${extra}` : `${id}|${titulo}|${veiculo}`;
    }).join('\n');
  }

  /* ── Parser de resposta ──────────────────────────────────────── */
  function parseResposta(text) {
    const res = {};
    for (const m of text.matchAll(/(\d+)\s*:\s*([PFNDXEpfndxe])/g)) {
      res[parseInt(m[1])] = m[2].toUpperCase();
    }
    return res;
  }

  /* ── Classifier ──────────────────────────────────────────────── */
  class Classifier {
    /**
     * @param {object} opts
     *   db        — array de rows (modificado in-place com .sentimento)
     *   config    — { empresa, premissas, mensagensChave, tipoBase, campos }
     *               campos: { titulo, veiculo, conteudo } → nomes das colunas no row
     *   modelKey  — chave em MODELOS
     *   storeKey  — chave localStorage para persistência
     *   onUpdate  — callback(aplicados) após cada resposta aplicada
     */
    constructor(opts) {
      this.db       = opts.db;
      this.config   = opts.config;
      this.modelKey = opts.modelKey || 'gemini-25';
      this.storeKey = opts.storeKey || 'hub_batch_clf';
      this.onUpdate = opts.onUpdate || (() => {});
      this._tagIds();
      this._load();
    }

    get modelo()     { return MODELOS[this.modelKey]; }
    get batchSize()  { return this.modelo.batchSize; }
    get total()      { return this.db.length; }
    get feitos()     { return Object.keys(this.state.res).length; }
    get pendentes()  { return this._pending(); }
    get pct()        { return this.total ? Math.round(this.feitos / this.total * 100) : 0; }
    get loteAtual()  { return this.state.lote; }
    get totalLotes() { return Math.ceil(this.db.length / this.batchSize); }
    get lotesPend()  { return Math.ceil(this.pendentes.length / this.batchSize); }

    _tagIds() {
      this.db.forEach((r, i) => { r.__batchId = i + 1; });
    }

    _pending() {
      const done = new Set(Object.keys(this.state?.res || {}).map(Number));
      return this.db.filter(r => !done.has(r.__batchId));
    }

    _load() {
      try {
        const s = JSON.parse(localStorage.getItem(this.storeKey) || 'null');
        this.state = s && s.empresa === this.config.empresa
          ? s
          : { empresa: this.config.empresa, lote: 0, res: {} };
      } catch { this.state = { empresa: this.config.empresa, lote: 0, res: {} }; }
      this._aplicarSalvos();
    }

    _save() {
      try { localStorage.setItem(this.storeKey, JSON.stringify(this.state)); } catch {}
    }

    _aplicarSalvos() {
      // Reaplica resultados salvos ao DB em memória
      for (const [id, cod] of Object.entries(this.state.res)) {
        const row = this.db.find(r => r.__batchId === parseInt(id));
        if (row) row.sentimento = COD_TO_SENT[cod] || row.sentimento;
      }
    }

    resetar() {
      this.state = { empresa: this.config.empresa, lote: 0, res: {} };
      this._save();
      this.db.forEach(r => { delete r.sentimento; });
    }

    /** Retorna o prompt pronto para copiar para o lote pendente atual */
    promptLoteAtual() {
      const pend  = this._pending();
      if (!pend.length) return null;
      const lote  = pend.slice(0, this.batchSize);
      const sist  = gerarSistema(this.config);
      const pubs  = gerarBlocoPubs(lote, this.config.campos || {});
      const cabec = `PUBLICAÇÕES PARA CLASSIFICAR (${lote.length} de ${pend.length} restantes):\n` +
                    `Formato: ID|Título|Veículo[|Conteúdo extra]\n`;
      return `${sist}\n\n${cabec}\n${pubs}\n\nClassifique as ${lote.length} publicações acima:`;
    }

    /** Aplica resposta da IA. Retorna { aplicados, naoReconhecidos } */
    aplicar(textoResposta) {
      const parsed = parseResposta(textoResposta);
      let aplicados = 0, naoRec = 0;
      for (const [id, cod] of Object.entries(parsed)) {
        const row = this.db.find(r => r.__batchId === parseInt(id));
        if (row && COD_TO_SENT[cod]) {
          row.sentimento       = COD_TO_SENT[cod];
          this.state.res[id]   = cod;
          aplicados++;
        } else { naoRec++; }
      }
      this.state.lote++;
      this._save();
      this.onUpdate(aplicados);
      return { aplicados, naoRec };
    }

    status() {
      return {
        total:      this.total,
        feitos:     this.feitos,
        pendentes:  this.pendentes.length,
        pct:        this.pct,
        loteAtual:  this.loteAtual,
        totalLotes: this.totalLotes,
        lotesPend:  this.lotesPend,
        modelo:     this.modelo.label,
        batchSize:  this.batchSize,
      };
    }
  }

  /* ── UI Helper: renderiza o painel completo de classificação ──── */
  /**
   * renderUI(containerId, db, repAnchors, tipoBase, onDone)
   *
   * Renderiza dentro do elemento #containerId o painel completo de
   * classificação em lote. Reutilizável em ekklesia e ekklesia-press.
   *
   * repAnchors — objeto com { nome, premissas_rs/imp, msg_chave }
   * tipoBase   — 'social' | 'press'
   * onDone     — callback quando 100% classificado
   */
  function renderUI(containerId, db, repAnchors = {}, tipoBase = 'social', onDone) {
    const cont = document.getElementById(containerId);
    if (!cont) return;

    // Estado local da UI
    const uiKey = `hub_batch_ui_${tipoBase}`;
    let clf = null;

    function getState() {
      try { return JSON.parse(sessionStorage.getItem(uiKey) || '{}'); } catch { return {}; }
    }
    function saveState(s) {
      try { sessionStorage.setItem(uiKey, JSON.stringify(s)); } catch {}
    }

    const premDefault = tipoBase === 'press'
      ? (repAnchors.premissas_imp || repAnchors.premissas_rs || repAnchors.foco_cliente_imp || '')
      : (repAnchors.premissas_rs  || repAnchors.foco_cliente_rs || '');

    const camposDefault = tipoBase === 'press'
      ? { titulo: 'titulo', veiculo: 'veiculo', conteudo: '' }
      : { titulo: 'titulo', veiculo: 'canal',   conteudo: 'conteudo' };

    function build() {
      const s       = getState();
      const empresa = s.empresa || repAnchors.nome || '';
      const modelKey = s.modelKey || 'gemini-25';
      const premissas = s.premissas !== undefined ? s.premissas : premDefault;
      const mkChave   = s.mkChave  !== undefined ? s.mkChave  : (repAnchors.msg_chave || '');

      const totalDb = db.length;
      const classif = db.filter(r => r.sentimento).length;
      const pct     = totalDb ? Math.round(classif / totalDb * 100) : 0;
      const semClass = totalDb - classif;

      const modelOpts = Object.entries(MODELOS).map(([k, m]) =>
        `<option value="${k}" ${k === modelKey ? 'selected' : ''}>${m.label} — até ${m.batchSize.toLocaleString('pt-BR')} pubs/lote</option>`
      ).join('');

      cont.innerHTML = `
        <div style="max-width:860px;">

          <!-- Status bar -->
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:var(--r-xl);padding:16px 20px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);">
                ⚡ Classificador em Lote
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <span style="font-size:12px;font-weight:700;color:${pct===100?'var(--green)':'var(--orange-2)'};">${pct}%</span>
                <span style="font-size:11px;color:var(--text-muted);">${classif.toLocaleString('pt-BR')} / ${totalDb.toLocaleString('pt-BR')} classificadas</span>
                ${pct > 0 ? `<button onclick="window._batchReset()" style="padding:3px 10px;background:rgba(255,82,82,.10);border:1px solid rgba(255,82,82,.25);border-radius:var(--r-sm);font-size:10px;color:#ff8080;cursor:pointer;font-family:'Inter',sans-serif;">Resetar</button>` : ''}
              </div>
            </div>
            <div style="height:6px;background:rgba(255,255,255,.07);border-radius:3px;overflow:hidden;">
              <div style="height:100%;width:${pct}%;background:${pct===100?'var(--green)':'var(--orange)'};border-radius:3px;transition:width .4s;"></div>
            </div>
            ${pct === 100 ? `<div style="margin-top:8px;font-size:11px;color:var(--green);">✅ Base totalmente classificada! Acesse a aba CENA para ver os resultados.</div>` : ''}
          </div>

          <!-- Config -->
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:var(--r-xl);padding:16px 20px;margin-bottom:16px;">
            <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:14px;">Configuração</div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Empresa / Cliente</div>
                <input id="batchEmpresa" class="macro-input" style="width:100%;" placeholder="Nome da empresa analisada"
                  value="${empresa.replace(/"/g,'&quot;')}" oninput="window._batchSaveCfg()"/>
              </div>
              <div>
                <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Modelo de IA</div>
                <select id="batchModelo" class="macro-input filtro-sel" style="width:100%;" onchange="window._batchSaveCfg()">
                  ${modelOpts}
                </select>
              </div>
            </div>

            <div style="margin-bottom:12px;">
              <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">
                Premissas de classificação
                ${premDefault ? `<button onclick="document.getElementById('batchPremissas').value=${JSON.stringify(premDefault)};window._batchSaveCfg();" style="margin-left:8px;padding:1px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:4px;font-size:9px;color:var(--text-muted);cursor:pointer;font-family:'Inter',sans-serif;">← do Reputaition</button>` : ''}
              </div>
              <textarea id="batchPremissas" class="config-textarea" style="height:80px;" placeholder="Cole aqui as premissas do cliente — critérios de positivo, negativo, fora de escopo…"
                oninput="window._batchSaveCfg()">${escAttr(premissas)}</textarea>
            </div>

            <div>
              <div style="font-size:10px;color:var(--text-muted);font-weight:600;text-transform:uppercase;letter-spacing:.4px;margin-bottom:5px;">Mensagens-chave (opcional)</div>
              <textarea id="batchMK" class="config-textarea" style="height:50px;" placeholder="Mensagens-chave cuja presença eleva a classificação para Positivo/Favorável…"
                oninput="window._batchSaveCfg()">${escAttr(mkChave)}</textarea>
            </div>
          </div>

          <!-- Ação -->
          ${semClass === 0 ? '' : `
          <div style="background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.09);border-radius:var(--r-xl);padding:16px 20px;margin-bottom:16px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
              <div style="font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;">
                Lote de Classificação
              </div>
              <button onclick="window._batchGerar()" id="batchBtnGerar"
                style="padding:8px 20px;background:var(--orange);border:none;border-radius:var(--r-md);font-size:12px;font-weight:600;color:#fff;cursor:pointer;font-family:'Inter',sans-serif;">
                ⚡ Gerar Prompt do Lote
              </button>
            </div>

            <div id="batchPromptArea" style="display:none;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                <span style="font-size:10px;color:var(--text-muted);">Copie e cole em qualquer IA (Claude, Gemini, ChatGPT…)</span>
                <button onclick="window._batchCopiarPrompt()" style="padding:4px 12px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:var(--r-sm);font-size:10px;color:var(--text-secondary);cursor:pointer;font-family:'Inter',sans-serif;">
                  📋 Copiar prompt
                </button>
              </div>
              <textarea id="batchPromptTxt" class="config-textarea" style="height:160px;font-family:monospace;font-size:11px;" readonly></textarea>

              <div style="margin-top:14px;">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
                  <span style="font-size:10px;color:var(--text-muted);">Cole aqui a resposta da IA</span>
                  <span style="font-size:10px;color:var(--orange-2);">Formato esperado: 1:P,2:N,3:X…</span>
                </div>
                <textarea id="batchRespTxt" class="config-textarea" style="height:90px;font-family:monospace;font-size:11px;"
                  placeholder="1:P,2:N,3:F,4:X,5:D,6:E…"></textarea>
                <div style="display:flex;gap:8px;margin-top:8px;">
                  <button onclick="window._batchAplicar()" id="batchBtnAplicar"
                    style="padding:8px 20px;background:var(--orange);border:none;border-radius:var(--r-md);font-size:12px;font-weight:600;color:#fff;cursor:pointer;font-family:'Inter',sans-serif;">
                    ✓ Aplicar classificação
                  </button>
                  <div id="batchAplicarLog" style="font-size:11px;color:var(--green);align-self:center;"></div>
                </div>
              </div>
            </div>
          </div>`}

          <!-- Dica de formatos -->
          <div style="background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.06);border-radius:var(--r-xl);padding:14px 18px;">
            <div style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;">Como funciona</div>
            <div style="font-size:11px;color:var(--text-muted);line-height:1.8;">
              O Hub compacta cada publicação em uma linha <code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;">ID|Título|Veículo</code>,
              agrupa em lotes conforme o modelo escolhido e gera um prompt com as premissas já embutidas.
              Você cola o prompt na IA de preferência, copia a resposta no formato <code style="background:rgba(255,255,255,.08);padding:1px 5px;border-radius:3px;">1:P,2:N,3:X</code>
              e aplica. O progresso é salvo automaticamente — se fechar e voltar, continua do ponto onde parou.
            </div>
          </div>
        </div>`;

      // Funções expostas globalmente para os handlers inline
      window._batchSaveCfg = () => {
        saveState({
          empresa:   document.getElementById('batchEmpresa')?.value || '',
          modelKey:  document.getElementById('batchModelo')?.value  || 'gemini-25',
          premissas: document.getElementById('batchPremissas')?.value || '',
          mkChave:   document.getElementById('batchMK')?.value || '',
        });
      };

      window._batchGerar = () => {
        const s = getState();
        const cfg = {
          empresa:       s.empresa   || repAnchors.nome || '',
          premissas:     s.premissas || premDefault,
          mensagensChave: s.mkChave  || '',
          tipoBase,
          campos: camposDefault,
        };
        clf = new Classifier({ db, config: cfg, modelKey: s.modelKey || 'gemini-25',
          storeKey: `hub_batch_clf_${tipoBase}`,
          onUpdate: () => build(),
        });
        const prompt = clf.promptLoteAtual();
        if (!prompt) { showToast?.('✅ Tudo classificado!'); return; }
        const area = document.getElementById('batchPromptArea');
        if (area) area.style.display = 'block';
        const txt = document.getElementById('batchPromptTxt');
        if (txt) txt.value = prompt;
        const st = clf.status();
        showToast?.(`Lote ${st.loteAtual + 1}/${st.totalLotes} — ${st.batchSize} pubs/lote (${MODELOS[s.modelKey || 'gemini-25'].label})`);
      };

      window._batchCopiarPrompt = () => {
        const txt = document.getElementById('batchPromptTxt')?.value;
        if (!txt) return;
        navigator.clipboard.writeText(txt).then(() => showToast?.('📋 Prompt copiado!'));
      };

      window._batchAplicar = () => {
        const resp = document.getElementById('batchRespTxt')?.value?.trim();
        if (!resp) { showToast?.('⚠️ Cole a resposta da IA primeiro'); return; }
        if (!clf) window._batchGerar();
        const { aplicados, naoRec } = clf.aplicar(resp);
        const log = document.getElementById('batchAplicarLog');
        if (log) log.textContent = `✅ ${aplicados} classificadas${naoRec ? ` · ${naoRec} não reconhecidas` : ''}`;
        if (document.getElementById('batchRespTxt'))
          document.getElementById('batchRespTxt').value = '';
        setTimeout(() => build(), 400);
        if (onDone && clf.pendentes.length === 0) onDone();
      };

      window._batchReset = () => {
        if (!confirm('Resetar toda a classificação em lote? Os sentimentos aplicados serão removidos.')) return;
        clf?.resetar();
        saveState({});
        build();
      };
    }

    function escAttr(s) {
      return (s || '').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    build();
  }

  /* ── Export ──────────────────────────────────────────────────── */
  G.HubBatch = { Classifier, MODELOS, COD_TO_SENT, renderUI };

})(window);
