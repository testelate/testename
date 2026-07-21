// functions/api/relatorio-modelo/[[path]].js
// HUB.nexus — Modelo padrao de relatorio (duplicavel por qualquer pessoa a partir
// do card "Modelo Padrao" em ekklesia-multi.html). Modulo isolado: nao mexe em
// nenhuma tabela/rota da Embratur ou do Ekklesia multi-cliente.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });
const tryP = (value, fallback) => { try { return JSON.parse(value); } catch { return fallback; } };

const TEMPLATE_ID = 'modelo-padrao';

function slugify(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

function genToken() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let t = '';
  crypto.getRandomValues(new Uint8Array(12)).forEach(b => t += chars[b % chars.length]);
  return t;
}

function defaultSecoes() {
  return [
    { id: 's1', titulo: 'Resumo do período', corpo: 'Escreva aqui um resumo executivo do período coberto por este relatório.', imagem: '' },
    { id: 's2', titulo: 'Principais destaques', corpo: 'Liste os pontos mais relevantes observados no período.', imagem: '' },
    { id: 's3', titulo: 'Pontos de atenção', corpo: 'Descreva riscos, crises ou temas que exigem atenção da equipe.', imagem: '' },
    { id: 's4', titulo: 'Próximos passos', corpo: 'Recomendações e ações sugeridas para o próximo período.', imagem: '' },
  ];
}

let _schemaReady = false;

async function ensureSchema(db) {
  if (_schemaReady) return;
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS relatorio_modelos (
      id           TEXT PRIMARY KEY,
      nome_cliente TEXT NOT NULL,
      titulo       TEXT NOT NULL DEFAULT '',
      capa         TEXT NOT NULL DEFAULT '',
      secoes       TEXT NOT NULL DEFAULT '[]',
      is_template  INTEGER NOT NULL DEFAULT 0 CHECK (is_template IN (0, 1)),
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS relatorio_modelo_shares (
      token        TEXT PRIMARY KEY,
      relatorio_id TEXT NOT NULL,
      dados        TEXT NOT NULL DEFAULT '{}',
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_relatorio_modelo_shares_rel ON relatorio_modelo_shares (relatorio_id)').run();

  const seed = await db.prepare('SELECT id FROM relatorio_modelos WHERE id = ?').bind(TEMPLATE_ID).first();
  if (!seed) {
    await db.prepare(`
      INSERT INTO relatorio_modelos (id, nome_cliente, titulo, capa, secoes, is_template)
      VALUES (?, ?, ?, ?, ?, 1)
    `).bind(TEMPLATE_ID, 'Modelo Padrão', 'Relatório Semanal', '', JSON.stringify(defaultSecoes())).run();
  }
  _schemaReady = true;
}

function normalizeDoc(row) {
  return {
    id: row.id,
    nome_cliente: row.nome_cliente,
    titulo: row.titulo,
    capa: row.capa,
    secoes: tryP(row.secoes, []),
    is_template: !!row.is_template,
    updated_at: row.updated_at,
  };
}

async function uniqueId(db, base) {
  let id = base || 'relatorio';
  let n = 2;
  while (await db.prepare('SELECT 1 FROM relatorio_modelos WHERE id = ?').bind(id).first()) {
    id = `${base}-${n++}`;
  }
  return id;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const resource = url.pathname.replace(/^\/api\/relatorio-modelo\/?/, '').split('/').filter(Boolean)[0];
  const method = request.method.toUpperCase();

  try {
    await ensureSchema(env.DB);
    if (resource === 'lista') return handleLista(method, env);
    if (resource === 'doc') return handleDoc(method, url, request, env);
    if (resource === 'duplicar') return handleDuplicar(method, request, env);
    if (resource === 'excluir') return handleExcluir(method, request, env);
    if (resource === 'publicar') return handlePublicar(method, request, env);
    if (resource === 'share') return handleShare(method, url, env);
    return json({ error: 'Rota não encontrada' }, 404);
  } catch (error) {
    return json({ error: String(error?.message || error) }, 500);
  }
}

async function handleLista(method, env) {
  if (method !== 'GET') return json({ error: 'Método não suportado' }, 405);
  const { results } = await env.DB.prepare(
    'SELECT id, nome_cliente, titulo, capa, secoes, is_template, updated_at FROM relatorio_modelos WHERE is_template = 0 ORDER BY updated_at DESC'
  ).all();
  return json({ ok: true, relatorios: (results || []).map(normalizeDoc) });
}

async function handleDoc(method, url, request, env) {
  if (method === 'GET') {
    const id = url.searchParams.get('id') || TEMPLATE_ID;
    const row = await env.DB.prepare(
      'SELECT id, nome_cliente, titulo, capa, secoes, is_template, updated_at FROM relatorio_modelos WHERE id = ?'
    ).bind(id).first();
    if (!row) return json({ error: 'Relatório não encontrado' }, 404);
    return json({ ok: true, doc: normalizeDoc(row) });
  }

  if (method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    if (!id) return json({ error: 'id obrigatório' }, 400);
    const nomeCliente = String(body?.nome_cliente || '').trim() || 'Cliente sem nome';
    const titulo = String(body?.titulo || '').trim() || 'Relatório';
    const capa = typeof body?.capa === 'string' ? body.capa : '';
    const secoes = Array.isArray(body?.secoes) ? body.secoes.map((s, i) => ({
      id: String(s?.id || `s${i + 1}`),
      tipo: ['texto', 'imprensa'].includes(String(s?.tipo || 'texto')) ? String(s?.tipo || 'texto') : 'texto',
      titulo: String(s?.titulo || '').slice(0, 200),
      corpo: String(s?.corpo || '').slice(0, 8000),
      imagem: typeof s?.imagem === 'string' ? s.imagem : '',
      materias: Array.isArray(s?.materias) ? s.materias.slice(0, 12).map((m) => ({
        fonte: String(m?.fonte || '').slice(0, 120),
        titulo: String(m?.titulo || '').slice(0, 240),
        resumo: String(m?.resumo || '').slice(0, 800),
        tom: String(m?.tom || '').slice(0, 40),
        url: String(m?.url || '').slice(0, 1000),
      })) : [],
    })) : [];

    await env.DB.prepare(`
      INSERT INTO relatorio_modelos (id, nome_cliente, titulo, capa, secoes, is_template, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        nome_cliente = excluded.nome_cliente,
        titulo = excluded.titulo,
        capa = excluded.capa,
        secoes = excluded.secoes,
        updated_at = datetime('now')
    `).bind(id, nomeCliente, titulo, capa, JSON.stringify(secoes)).run();

    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

async function handleDuplicar(method, request, env) {
  if (method !== 'POST') return json({ error: 'Método não suportado' }, 405);
  const body = await request.json().catch(() => ({}));
  const origemId = String(body?.origem_id || TEMPLATE_ID).trim();
  const nomeCliente = String(body?.nome_cliente || '').trim();
  if (!nomeCliente) return json({ error: 'nome_cliente obrigatório' }, 400);

  const origem = await env.DB.prepare(
    'SELECT nome_cliente, titulo, capa, secoes FROM relatorio_modelos WHERE id = ?'
  ).bind(origemId).first();
  if (!origem) return json({ error: 'Relatório de origem não encontrado' }, 404);

  const id = await uniqueId(env.DB, slugify(nomeCliente));
  await env.DB.prepare(`
    INSERT INTO relatorio_modelos (id, nome_cliente, titulo, capa, secoes, is_template)
    VALUES (?, ?, ?, ?, ?, 0)
  `).bind(id, nomeCliente, origem.titulo, origem.capa, origem.secoes).run();

  const row = await env.DB.prepare(
    'SELECT id, nome_cliente, titulo, capa, secoes, is_template, updated_at FROM relatorio_modelos WHERE id = ?'
  ).bind(id).first();
  return json({ ok: true, doc: normalizeDoc(row) }, 201);
}

async function handleExcluir(method, request, env) {
  if (method !== 'POST') return json({ error: 'Método não suportado' }, 405);
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  if (!id || id === TEMPLATE_ID) return json({ error: 'id inválido' }, 400);
  await env.DB.prepare('DELETE FROM relatorio_modelos WHERE id = ?').bind(id).run();
  await env.DB.prepare('DELETE FROM relatorio_modelo_shares WHERE relatorio_id = ?').bind(id).run();
  return json({ ok: true });
}

async function handlePublicar(method, request, env) {
  if (method !== 'POST') return json({ error: 'Método não suportado' }, 405);
  const body = await request.json().catch(() => ({}));
  const id = String(body?.id || '').trim();
  if (!id) return json({ error: 'id obrigatório' }, 400);

  const doc = await env.DB.prepare(
    'SELECT id, nome_cliente, titulo, capa, secoes FROM relatorio_modelos WHERE id = ?'
  ).bind(id).first();
  if (!doc) return json({ error: 'Relatório não encontrado' }, 404);

  const dados = JSON.stringify(normalizeDoc(doc));
  const existente = await env.DB.prepare(
    'SELECT token FROM relatorio_modelo_shares WHERE relatorio_id = ?'
  ).bind(id).first();

  if (existente) {
    await env.DB.prepare('UPDATE relatorio_modelo_shares SET dados = ?, updated_at = datetime(\'now\') WHERE token = ?')
      .bind(dados, existente.token).run();
    return json({ ok: true, token: existente.token });
  }

  const token = genToken();
  await env.DB.prepare('INSERT INTO relatorio_modelo_shares (token, relatorio_id, dados) VALUES (?, ?, ?)')
    .bind(token, id, dados).run();
  return json({ ok: true, token }, 201);
}

async function handleShare(method, url, env) {
  if (method !== 'GET') return json({ error: 'Método não suportado' }, 405);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'token obrigatório' }, 400);
  const row = await env.DB.prepare(
    'SELECT dados, updated_at FROM relatorio_modelo_shares WHERE token = ?'
  ).bind(token).first();
  if (!row) return json({ error: 'Relatório não encontrado ou expirado' }, 404);
  return json({ ok: true, dados: tryP(row.dados, {}), updated_at: row.updated_at });
}
