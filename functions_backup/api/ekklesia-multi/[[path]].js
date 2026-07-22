// functions/api/ekklesia-multi/[[path]].js
// HUB.nexus - Ekklesia multi-cliente (modulo separado do Ekklesia Embratur)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });
const tryJson = (value, fallback = {}) => {
  try { return JSON.parse(value); } catch { return fallback; }
};
const boolInt = value => (value === true || value === 1 || value === '1' ? 1 : 0);
const VALID_TIPOS = ['diario', 'semanal', 'mensal'];
const VALID_STATUS = ['producao', 'revisao', 'finalizado'];

function parseMetricNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let raw = String(value).trim().toLowerCase();
  const mult = raw.includes('mi') || raw.endsWith('m') ? 1000000 : raw.endsWith('k') || raw.includes('mil') ? 1000 : 1;
  raw = raw.replace(/\s/g, '').replace(/mi|mil|k|m/g, '');
  const hasComma = raw.includes(',');
  const hasDot = raw.includes('.');
  if (hasComma && hasDot) raw = raw.replace(/\./g, '').replace(',', '.');
  else if (hasComma) raw = raw.replace(',', '.');
  else if (/^-?\d{1,3}\.\d{3}(\.\d{3})*$/.test(raw)) raw = raw.replace(/\./g, '');
  else if ((raw.match(/\./g) || []).length > 1) raw = raw.replace(/\./g, '');
  const n = Number(raw.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n * mult : 0;
}

function sanitizeRowMetrics(row) {
  const next = { ...row };
  ['interacoes', 'seguidores', 'alcance', 'reach', 'likes', 'comentarios', 'compartilhamentos'].forEach(key => {
    if (next[key] !== undefined && next[key] !== '') next[key] = parseMetricNumber(next[key]);
  });
  return next;
}

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function newId(prefix = 'cfg') {
  if (crypto.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

let _schemaReady = false;

async function ensureSchema(db) {
  if (_schemaReady) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ekklesia_clientes (
      id         TEXT PRIMARY KEY,
      nome       TEXT NOT NULL,
      ativo      INTEGER NOT NULL DEFAULT 1 CHECK (ativo IN (0, 1)),
      favorito   INTEGER NOT NULL DEFAULT 0 CHECK (favorito IN (0, 1)),
      possui_cena INTEGER NOT NULL DEFAULT 0 CHECK (possui_cena IN (0, 1)),
      workflow_status TEXT NOT NULL DEFAULT 'producao' CHECK (workflow_status IN ('producao', 'revisao', 'finalizado')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO ekklesia_clientes (id, nome, ativo, favorito, workflow_status)
    VALUES ('governo-para', 'Governo do Pará', 1, 1, 'producao')
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO ekklesia_clientes (id, nome, ativo, favorito, workflow_status)
    VALUES ('embratur-nacional', 'Embratur Nacional', 1, 1, 'producao')
  `).run();
  await ensureColumn(db, 'ekklesia_clientes', 'favorito', 'INTEGER NOT NULL DEFAULT 0 CHECK (favorito IN (0, 1))');
  await ensureColumn(db, 'ekklesia_clientes', 'possui_cena', 'INTEGER NOT NULL DEFAULT 0 CHECK (possui_cena IN (0, 1))');
  await ensureColumn(db, 'ekklesia_clientes', 'workflow_status', "TEXT NOT NULL DEFAULT 'producao' CHECK (workflow_status IN ('producao', 'revisao', 'finalizado'))");

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ekklesia_prompts_config (
      id              TEXT PRIMARY KEY,
      cliente_id      TEXT NOT NULL,
      tipo_relatorio  TEXT NOT NULL CHECK (tipo_relatorio IN ('diario', 'semanal', 'mensal')),
      prompt_contexto TEXT NOT NULL DEFAULT '',
      prompt_regras   TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES ekklesia_clientes(id) ON DELETE CASCADE,
      UNIQUE (cliente_id, tipo_relatorio)
    )
  `).run();

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS ekklesia_multi_base (
      id         TEXT NOT NULL,
      cliente_id TEXT NOT NULL,
      tipo_relatorio TEXT NOT NULL DEFAULT 'diario' CHECK (tipo_relatorio IN ('diario', 'semanal', 'mensal')),
      data_rel   TEXT NOT NULL,
      dados      TEXT NOT NULL DEFAULT '{}',
      manual     INTEGER NOT NULL DEFAULT 0 CHECK (manual IN (0, 1)),
      criado_em  TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (cliente_id, id),
      FOREIGN KEY (cliente_id) REFERENCES ekklesia_clientes(id) ON DELETE CASCADE
    )
  `).run();
  await ensurePromptTipoMensal(db);
  await ensureColumn(db, 'ekklesia_multi_base', 'tipo_relatorio', "TEXT NOT NULL DEFAULT 'diario' CHECK (tipo_relatorio IN ('diario', 'semanal', 'mensal'))");
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_ekklesia_clientes_ativo ON ekklesia_clientes (ativo, favorito, nome)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_ekklesia_multi_base_cliente_data ON ekklesia_multi_base (cliente_id, tipo_relatorio, data_rel)').run();
  _schemaReady = true;
}

async function ensureColumn(db, table, column, definition) {
  const info = await db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = (info.results || []).some(row => row.name === column);
  if (!exists) await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

async function ensurePromptTipoMensal(db) {
  const row = await db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'ekklesia_prompts_config'").first();
  if (!row?.sql || row.sql.includes("'mensal'")) return;
  await db.prepare('ALTER TABLE ekklesia_prompts_config RENAME TO ekklesia_prompts_config_old').run();
  await db.prepare(`
    CREATE TABLE ekklesia_prompts_config (
      id              TEXT PRIMARY KEY,
      cliente_id      TEXT NOT NULL,
      tipo_relatorio  TEXT NOT NULL CHECK (tipo_relatorio IN ('diario', 'semanal', 'mensal')),
      prompt_contexto TEXT NOT NULL DEFAULT '',
      prompt_regras   TEXT NOT NULL DEFAULT '',
      created_at      TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (cliente_id) REFERENCES ekklesia_clientes(id) ON DELETE CASCADE,
      UNIQUE (cliente_id, tipo_relatorio)
    )
  `).run();
  await db.prepare(`
    INSERT OR IGNORE INTO ekklesia_prompts_config
      (id, cliente_id, tipo_relatorio, prompt_contexto, prompt_regras, created_at, updated_at)
    SELECT id, cliente_id, tipo_relatorio, prompt_contexto, prompt_regras, created_at, updated_at
    FROM ekklesia_prompts_config_old
  `).run();
  await db.prepare('DROP TABLE ekklesia_prompts_config_old').run();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const resource = url.pathname.replace(/^\/api\/ekklesia-multi\/?/, '').split('/').filter(Boolean)[0];
  const method = request.method.toUpperCase();

  try {
    await ensureSchema(env.DB);
    if (resource === 'clientes') return handleClientes(method, url, request, env);
    if (resource === 'prompts') return handlePrompts(method, url, request, env);
    if (resource === 'base') return handleBase(method, url, request, env);
    if (resource === 'export') return handleExport(method, request);
    return json({ error: 'Rota nao encontrada' }, 404);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}

async function handleClientes(method, url, request, env) {
  if (method === 'GET') {
    const id = url.searchParams.get('id');
    const ativos = url.searchParams.get('ativos') !== '0';
    if (id) {
      const row = await env.DB.prepare(
        'SELECT id, nome, ativo, favorito, possui_cena, workflow_status, created_at, updated_at FROM ekklesia_clientes WHERE id = ?'
      ).bind(id).first();
      if (!row) return json({ error: 'Cliente nao encontrado' }, 404);
      return json({ ok: true, cliente: normalizeCliente(row) });
    }
    const sql = ativos
      ? 'SELECT id, nome, ativo, favorito, possui_cena, workflow_status, created_at, updated_at FROM ekklesia_clientes WHERE ativo = 1 ORDER BY favorito DESC, nome'
      : 'SELECT id, nome, ativo, favorito, possui_cena, workflow_status, created_at, updated_at FROM ekklesia_clientes ORDER BY favorito DESC, nome';
    const { results } = await env.DB.prepare(sql).all();
    return json({ ok: true, clientes: (results || []).map(normalizeCliente) });
  }

  if (method === 'POST') {
    const body = await request.json();
    const nome = String(body?.nome || '').trim();
    const id = slugify(body?.id || nome);
    const ativo = body?.ativo === false || body?.ativo === 0 ? 0 : 1;
    const favorito = boolInt(body?.favorito);
    const possuiCena = boolInt(body?.possui_cena);
    const status = VALID_STATUS.includes(body?.workflow_status) ? body.workflow_status : 'producao';
    if (!id || !nome) return json({ error: 'id/nome obrigatorios' }, 400);

    await env.DB.prepare(`
      INSERT INTO ekklesia_clientes (id, nome, ativo, favorito, possui_cena, workflow_status, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        nome = excluded.nome,
        ativo = excluded.ativo,
        favorito = excluded.favorito,
        possui_cena = excluded.possui_cena,
        workflow_status = excluded.workflow_status,
        updated_at = excluded.updated_at
    `).bind(id, nome, ativo, favorito, possuiCena, status).run();
    return json({ ok: true, cliente: { id, nome, ativo: !!ativo, favorito: !!favorito, possui_cena: !!possuiCena, workflow_status: status } });
  }

  return json({ error: 'Metodo nao suportado' }, 405);
}

async function handlePrompts(method, url, request, env) {
  if (method === 'GET') {
    const clienteId = url.searchParams.get('cliente_id');
    const tipo = url.searchParams.get('tipo_relatorio');
    if (!clienteId) return json({ error: 'cliente_id obrigatorio' }, 400);

    const cliente = await env.DB.prepare('SELECT id FROM ekklesia_clientes WHERE id = ?').bind(clienteId).first();
    if (!cliente) return json({ error: 'Cliente nao encontrado' }, 404);

    if (tipo) {
      const row = await env.DB.prepare(`
        SELECT id, cliente_id, tipo_relatorio, prompt_contexto, prompt_regras, updated_at
        FROM ekklesia_prompts_config
        WHERE cliente_id = ? AND tipo_relatorio = ?
      `).bind(clienteId, tipo).first();
      return json({
        ok: true,
        prompt: row || {
          id: '',
          cliente_id: clienteId,
          tipo_relatorio: tipo,
          prompt_contexto: '',
          prompt_regras: '',
          updated_at: null,
        },
      });
    }

    const { results } = await env.DB.prepare(`
      SELECT id, cliente_id, tipo_relatorio, prompt_contexto, prompt_regras, updated_at
      FROM ekklesia_prompts_config
      WHERE cliente_id = ?
      ORDER BY tipo_relatorio
    `).bind(clienteId).all();
    return json({ ok: true, prompts: results || [] });
  }

  if (method === 'POST') {
    const body = await request.json();
    const clienteId = String(body?.cliente_id || '').trim();
    const tipo = String(body?.tipo_relatorio || 'diario').trim();
    if (!clienteId) return json({ error: 'cliente_id obrigatorio' }, 400);
    if (!VALID_TIPOS.includes(tipo)) return json({ error: 'tipo_relatorio invalido' }, 400);

    const cliente = await env.DB.prepare('SELECT id FROM ekklesia_clientes WHERE id = ?').bind(clienteId).first();
    if (!cliente) return json({ error: 'Cliente nao encontrado' }, 404);

    const id = body?.id || `${clienteId}-${tipo}`;
    const contexto = String(body?.prompt_contexto || '');
    const regras = String(body?.prompt_regras || '');
    await env.DB.prepare(`
      INSERT INTO ekklesia_prompts_config (id, cliente_id, tipo_relatorio, prompt_contexto, prompt_regras, updated_at)
      VALUES (?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(cliente_id, tipo_relatorio) DO UPDATE SET
        prompt_contexto = excluded.prompt_contexto,
        prompt_regras = excluded.prompt_regras,
        updated_at = excluded.updated_at
    `).bind(id || newId('prompt'), clienteId, tipo, contexto, regras).run();
    return json({ ok: true });
  }

  return json({ error: 'Metodo nao suportado' }, 405);
}

async function handleBase(method, url, request, env) {
  if (method === 'GET') {
    const clienteId = url.searchParams.get('cliente_id');
    if (!clienteId) return json({ error: 'cliente_id obrigatorio' }, 400);
    const dias = Math.min(parseInt(url.searchParams.get('dias') || '30', 10), 180);
    const tipo = url.searchParams.get('tipo_relatorio');
    const corte = new Date();
    corte.setUTCDate(corte.getUTCDate() - dias);
    const corteISO = corte.toISOString().slice(0, 10);

    const { results } = await env.DB.prepare(`
      SELECT id, tipo_relatorio, data_rel, dados, manual, criado_em, updated_at
      FROM ekklesia_multi_base
      WHERE cliente_id = ? AND data_rel >= ? ${VALID_TIPOS.includes(tipo) ? 'AND tipo_relatorio = ?' : ''}
      ORDER BY data_rel DESC, criado_em DESC
      LIMIT 5000
    `).bind(...(VALID_TIPOS.includes(tipo) ? [clienteId, corteISO, tipo] : [clienteId, corteISO])).all();

    const rows = (results || []).map(row => ({
      ...tryJson(row.dados, {}),
      _id: row.id,
      _dataRel: row.data_rel,
      _tipoRelatorio: row.tipo_relatorio || 'diario',
      _manual: !!row.manual,
      _criadoEm: row.criado_em,
      _updatedAt: row.updated_at,
    }));
    return json({ ok: true, rows });
  }

  if (method === 'POST') {
    const body = await request.json();
    const clienteId = String(body?.cliente_id || '').trim();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const force = !!body?.force;
    const defaultTipo = VALID_TIPOS.includes(body?.tipo_relatorio) ? body.tipo_relatorio : 'diario';
    if (!clienteId || !rows.length) return json({ error: 'cliente_id e rows obrigatorios' }, 400);

    const cliente = await env.DB.prepare('SELECT id FROM ekklesia_clientes WHERE id = ?').bind(clienteId).first();
    if (!cliente) return json({ error: 'Cliente nao encontrado' }, 404);

    const stmt = env.DB.prepare(force
      ? `INSERT INTO ekklesia_multi_base (id, cliente_id, tipo_relatorio, data_rel, dados, manual, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
         ON CONFLICT(cliente_id, id) DO UPDATE SET
           tipo_relatorio = excluded.tipo_relatorio,
           data_rel = excluded.data_rel,
           // Um export do Reputaition pode trazer "SEM REGRA" (normalizado
           // pelo cliente como vazio) para o mesmo post já classificado pelo
           // Brandwatch. Preservamos a classificação existente nesse caso.
           dados = CASE
             WHEN COALESCE(NULLIF(json_extract(excluded.dados, '$.sentimento'), ''), '') = ''
             THEN CASE
               WHEN lower(COALESCE(json_extract(ekklesia_multi_base.dados, '$.sentimento'), ''))
                    IN ('', 'sem regra', 'sem classificacao', 'nao classificado', 'n/a')
               THEN excluded.dados
               ELSE json_set(excluded.dados, '$.sentimento', json_extract(ekklesia_multi_base.dados, '$.sentimento'))
             END
             ELSE excluded.dados
           END,
           manual = excluded.manual,
           updated_at = datetime('now')`
      : `INSERT OR IGNORE INTO ekklesia_multi_base (id, cliente_id, tipo_relatorio, data_rel, dados, manual)
         VALUES (?, ?, ?, ?, ?, ?)`);

    let salvas = 0;
    let ignoradas = 0;
    const CHUNK = 80;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK).map(row => {
        const id = row.id || row._id || row.link_publicacao || newId('row');
        const dataRel = row.data_rel || row._dataRel || (row.data || '').slice(0, 10);
        const tipo = VALID_TIPOS.includes(row.tipo_relatorio || row._tipoRelatorio) ? (row.tipo_relatorio || row._tipoRelatorio) : defaultTipo;
        const manual = row.manual || row._manual ? 1 : 0;
        if (!id || !dataRel) { ignoradas++; return null; }
        const {
          id: _id,
          _id: __id,
          data_rel: _dataRel,
          _dataRel: __dataRel,
          tipo_relatorio: _tipoRelatorio,
          _tipoRelatorio: __tipoRelatorio,
          manual: _manual,
          _manual: __manual,
          ...dados
        } = row;
        const cleanDados = sanitizeRowMetrics(dados);
        return force
          ? stmt.bind(id, clienteId, tipo, dataRel, JSON.stringify(cleanDados), manual)
          : stmt.bind(id, clienteId, tipo, dataRel, JSON.stringify(cleanDados), manual);
      }).filter(Boolean);
      if (batch.length) {
        const result = await env.DB.batch(batch);
        result.forEach(item => { salvas += item.meta?.changes || 0; });
      }
    }
    return json({ ok: true, salvas, ignoradas });
  }

  if (method === 'DELETE') {
    const clienteId = url.searchParams.get('cliente_id');
    const id = url.searchParams.get('id');
    const dataRel = url.searchParams.get('data_rel');
    if (!clienteId) return json({ error: 'cliente_id obrigatorio' }, 400);
    if (id) {
      await env.DB.prepare('DELETE FROM ekklesia_multi_base WHERE cliente_id = ? AND id = ?').bind(clienteId, id).run();
      return json({ ok: true });
    }
    if (dataRel) {
      const res = await env.DB.prepare('DELETE FROM ekklesia_multi_base WHERE cliente_id = ? AND data_rel = ?')
        .bind(clienteId, dataRel).run();
      return json({ ok: true, removidas: res.meta?.changes || 0 });
    }
    return json({ error: 'id ou data_rel obrigatorio' }, 400);
  }

  return json({ error: 'Metodo nao suportado' }, 405);
}

function normalizeCliente(row) {
  return {
    ...row,
    ativo: !!row.ativo,
    favorito: !!row.favorito,
    possui_cena: !!row.possui_cena,
    workflow_status: row.workflow_status || 'producao',
  };
}

async function handleExport(method, request) {
  if (method !== 'POST') return json({ error: 'Metodo nao suportado' }, 405);
  const body = await request.json();
  const formato = String(body?.formato || 'html').toLowerCase();
  const cliente = body?.cliente || {};
  const meta = body?.meta || {};
  const rows = Array.isArray(body?.rows) ? body.rows.slice(0, 5000) : [];
  const kpis = body?.kpis || {};
  const cena = body?.cena || null;
  const title = `Ekklesia - ${cliente.nome || cliente.id || 'cliente'} - ${meta.tipo_relatorio || 'relatorio'}`;
  if (formato === 'json') return json({ ok: true, filename: safeFile(title, 'json'), contentType: 'application/json', content: JSON.stringify({ cliente, meta, kpis, cena, rows }, null, 2) });
  if (formato === 'txt') {
    const lines = [
      title,
      `Periodo: ${meta.data_rel || meta.periodo || '-'}`,
      `Mencoes: ${kpis.total || rows.length}`,
      `Interacoes: ${kpis.interacoes || 0}`,
      cena ? `CENA: ${cena.nota}` : '',
      '',
      ...rows.map((row, index) => `${index + 1}. ${row.data || row._dataRel || ''} | ${row.canal || '-'} | ${row.sentimento || '-'} | ${row.conteudo || ''}`)
    ].filter(Boolean);
    return json({ ok: true, filename: safeFile(title, 'txt'), contentType: 'text/plain;charset=utf-8', content: lines.join('\n') });
  }
  const cards = [
    ['Mencoes', kpis.total || rows.length],
    ['Interacoes', kpis.interacoes || 0],
    ['Alcance estimado', kpis.alcance || 0],
    ['Canal principal', kpis.topCanal || '-'],
    ['Sentimento', kpis.topSent || '-'],
  ];
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{margin:0;font-family:Inter,Arial,sans-serif;background:#11131a;color:#f4f0ea;padding:32px}main{max-width:1080px;margin:auto}.k{color:#ff934f;text-transform:uppercase;font-size:11px;letter-spacing:.08em}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:20px 0}.card{border:1px solid #2b2f3a;border-radius:8px;padding:14px;background:#181b24}.card b{display:block;font-size:24px;margin-top:6px}.cena{border-color:#ff934f;background:#241a15}table{width:100%;border-collapse:collapse;font-size:12px}td,th{padding:9px;border-bottom:1px solid #2b2f3a;text-align:left;vertical-align:top}th{color:#aaa;text-transform:uppercase;font-size:10px}</style></head><body><main>
<div class="k">Ekklesia Multi-Cliente</div><h1>${escapeHtml(title)}</h1><p>${escapeHtml(meta.data_rel || meta.periodo || '')}</p>
<section class="grid">${cards.map(([label, value]) => `<div class="card"><span class="k">${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`).join('')}${cena ? `<div class="card cena"><span class="k">Indice CENA</span><b>${escapeHtml(cena.nota)}</b></div>` : ''}</section>
<table><thead><tr><th>Data</th><th>Canal</th><th>Sentimento</th><th>Tema</th><th>Publicacao</th></tr></thead><tbody>${rows.slice(0, 300).map(row => `<tr><td>${escapeHtml(row.data || row._dataRel || '')}</td><td>${escapeHtml(row.canal || '')}</td><td>${escapeHtml(row.sentimento || '')}</td><td>${escapeHtml(row.tema || '')}</td><td>${escapeHtml(row.conteudo || '')}</td></tr>`).join('')}</tbody></table>
</main></body></html>`;
  return json({ ok: true, filename: safeFile(title, 'html'), contentType: 'text/html;charset=utf-8', content: html });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[ch]));
}

function safeFile(title, ext) {
  return `${slugify(title) || 'ekklesia-export'}.${ext}`;
}
