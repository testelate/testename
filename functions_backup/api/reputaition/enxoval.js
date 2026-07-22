// functions/api/reputaition/enxoval.js — HUB.nexus · Reputaition
// CRUD do "Enxoval de Crise": banco de pacotes de premissas reutilizáveis,
// compartilhado por toda a equipe (D1). Cada pacote guarda um JSON com
// regras_globais/logica_etapa1/2/prem_* e listas de mensagens-chave/temas,
// usando {{CLIENTE}} como placeholder para o nome do cliente.
//
// GET    /api/reputaition/enxoval?q=termo&categoria=Governo   → lista (busca opcional)
// POST   /api/reputaition/enxoval                              → cria pacote
// POST   /api/reputaition/enxoval  { id, acao:'usar' }         → incrementa contador de uso
// PUT    /api/reputaition/enxoval  { id, ... }                 → atualiza pacote existente
// DELETE /api/reputaition/enxoval?id=N                         → remove pacote

// ── SQL para criar a tabela (rodar no D1 uma vez) ─────────────
// CREATE TABLE IF NOT EXISTS reputaition_enxoval (
//   id          INTEGER PRIMARY KEY AUTOINCREMENT,
//   titulo      TEXT    NOT NULL,
//   categoria   TEXT    DEFAULT '',
//   tags        TEXT    DEFAULT '',
//   descricao   TEXT    DEFAULT '',
//   conteudo    TEXT    NOT NULL,           -- JSON: regras_globais, logica_etapa1/2, prem_*, mensagens_chave[], temas[]
//   criado_por  TEXT    DEFAULT '',
//   usos        INTEGER NOT NULL DEFAULT 0,
//   created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
//   updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
// );
// CREATE INDEX IF NOT EXISTS idx_reputaition_enxoval_categoria ON reputaition_enxoval(categoria);

function cors(request) {
  const origin  = (request && request.headers.get('Origin')) || '';
  const allowed =
    origin.includes('hub-nexus') ||
    origin.includes('pages.dev') ||
    origin.includes('localhost');
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://hub-nexus.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

const json = (data, status = 200, req) =>
  new Response(JSON.stringify(data), { status, headers: cors(req) });

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request) });
}

// ── GET — lista, com busca opcional por título/tags/categoria ──
export async function onRequestGet({ request, env }) {
  const url       = new URL(request.url);
  const q         = (url.searchParams.get('q') || '').trim();
  const categoria = (url.searchParams.get('categoria') || '').trim();

  try {
    const where  = [];
    const params = [];

    if (q) {
      where.push('(titulo LIKE ? OR tags LIKE ? OR categoria LIKE ? OR descricao LIKE ?)');
      const like = `%${q}%`;
      params.push(like, like, like, like);
    }
    if (categoria) { where.push('categoria = ?'); params.push(categoria); }

    const sql = `SELECT * FROM reputaition_enxoval`
      + (where.length ? ` WHERE ${where.join(' AND ')}` : '')
      + ` ORDER BY usos DESC, titulo ASC`;

    const stmt = params.length ? env.DB.prepare(sql).bind(...params) : env.DB.prepare(sql);
    const { results } = await stmt.all();

    return json(results, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — cria novo pacote, ou incrementa uso quando { acao: 'usar' } ──
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  // Atalho: incrementar contador de uso
  if (body && body.acao === 'usar' && body.id) {
    try {
      await env.DB.prepare(`UPDATE reputaition_enxoval SET usos = usos + 1, updated_at = datetime('now') WHERE id = ?`)
        .bind(Number(body.id)).run();
      return json({ ok: true }, 200, request);
    } catch (e) {
      return json({ error: e.message }, 500, request);
    }
  }

  const { titulo, categoria, tags, descricao, conteudo, criado_por } = body || {};
  if (!titulo || !String(titulo).trim())
    return json({ error: '"titulo" é obrigatório' }, 400, request);
  if (!conteudo)
    return json({ error: '"conteudo" é obrigatório' }, 400, request);

  try {
    const result = await env.DB.prepare(`
      INSERT INTO reputaition_enxoval (titulo, categoria, tags, descricao, conteudo, criado_por)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      String(titulo).trim(),
      String(categoria || ''),
      String(tags || ''),
      String(descricao || ''),
      typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo),
      String(criado_por || ''),
    ).run();

    return json({ ok: true, id: result.meta?.last_row_id }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT — atualiza pacote existente ──
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, titulo, categoria, tags, descricao, conteudo } = body || {};
  if (!id) return json({ error: '"id" é obrigatório' }, 400, request);
  if (!titulo || !String(titulo).trim())
    return json({ error: '"titulo" é obrigatório' }, 400, request);

  try {
    await env.DB.prepare(`
      UPDATE reputaition_enxoval
      SET titulo = ?, categoria = ?, tags = ?, descricao = ?, conteudo = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      String(titulo).trim(),
      String(categoria || ''),
      String(tags || ''),
      String(descricao || ''),
      typeof conteudo === 'string' ? conteudo : JSON.stringify(conteudo),
      Number(id),
    ).run();

    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE — remove um pacote ──
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) return json({ error: '"id" é obrigatório' }, 400, request);

  try {
    await env.DB.prepare('DELETE FROM reputaition_enxoval WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
