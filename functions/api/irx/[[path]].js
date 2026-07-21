// functions/api/irx/[[path]].js — HUB.nexus · Pipeline IRX
//
// Roteador único para todos os endpoints do Pipeline IRX.
// Necessário porque o Cloudflare Pages só roteia via [[path]].js,
// não via arquivos individuais em subpastas da mesma rota.
//
// GET    /api/irx/projetos                          → lista projetos
// GET    /api/irx/projetos?id=N                     → projeto específico
// POST   /api/irx/projetos                          → cria projeto
// PUT    /api/irx/projetos                          → atualiza projeto
// DELETE /api/irx/projetos?id=N                     → remove projeto (cascata)
//
// GET    /api/irx/nomes?projeto_id=N                → mapeamentos do projeto
// POST   /api/irx/nomes                             → upsert em lote
// DELETE /api/irx/nomes?id=N                        → remove por id
// DELETE /api/irx/nomes?projeto_id=N                → remove todos do projeto
//
// GET    /api/irx/deepresearch?projeto_id=N          → lista fichas
// GET    /api/irx/deepresearch?projeto_id=N&username=X → ficha específica
// POST   /api/irx/deepresearch                       → upsert ficha
// PUT    /api/irx/deepresearch                       → atualiza campos
// DELETE /api/irx/deepresearch?projeto_id=N&username=X → remove ficha
//
// ── SQL (rodar no D1 uma vez) ─────────────────────────────────
// CREATE TABLE IF NOT EXISTS irx_projetos (
//   id         INTEGER PRIMARY KEY AUTOINCREMENT,
//   nome       TEXT    NOT NULL,
//   cliente    TEXT    NOT NULL DEFAULT '',
//   tema       TEXT    NOT NULL DEFAULT '',
//   created_at TEXT    NOT NULL DEFAULT (datetime('now')),
//   updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
// );
//
// CREATE TABLE IF NOT EXISTS irx_nomes (
//   id          INTEGER PRIMARY KEY AUTOINCREMENT,
//   projeto_id  INTEGER NOT NULL,
//   nome_orig   TEXT    NOT NULL,
//   nome_canon  TEXT    NOT NULL,
//   created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
//   updated_at  TEXT    NOT NULL DEFAULT (datetime('now')),
//   UNIQUE(projeto_id, nome_orig)
// );
// CREATE INDEX IF NOT EXISTS idx_irx_nomes_projeto ON irx_nomes(projeto_id);
//
// CREATE TABLE IF NOT EXISTS irx_deepresearch (
//   id                    INTEGER PRIMARY KEY AUTOINCREMENT,
//   projeto_id            INTEGER NOT NULL,
//   username              TEXT    NOT NULL,
//   nome                  TEXT    NOT NULL DEFAULT '',
//   status                TEXT    NOT NULL DEFAULT 'pendente',
//   resposta_bruta        TEXT    NOT NULL DEFAULT '',
//   grau_influencia       TEXT    NOT NULL DEFAULT '',
//   regiao                TEXT    NOT NULL DEFAULT '',
//   uf                    TEXT    NOT NULL DEFAULT '',
//   links_outras_redes    TEXT    NOT NULL DEFAULT '',
//   tipo_perfil           TEXT    NOT NULL DEFAULT '',
//   validacao_ideologica  TEXT    NOT NULL DEFAULT '',
//   historico_profissional TEXT   NOT NULL DEFAULT '',
//   posicionamento_redes  TEXT    NOT NULL DEFAULT '',
//   recomendacoes_acao    TEXT    NOT NULL DEFAULT '',
//   processos_juridicos   TEXT    NOT NULL DEFAULT '',
//   conar                 TEXT    NOT NULL DEFAULT '',
//   polemicas             TEXT    NOT NULL DEFAULT '',
//   assuntos_sensiveis    TEXT    NOT NULL DEFAULT '',
//   bloco                 TEXT    NOT NULL DEFAULT '',
//   tematica              TEXT    NOT NULL DEFAULT '',
//   abordagem             TEXT    NOT NULL DEFAULT '',
//   created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
//   updated_at            TEXT    NOT NULL DEFAULT (datetime('now')),
//   UNIQUE(projeto_id, username)
// );
// CREATE INDEX IF NOT EXISTS idx_irx_dr_projeto ON irx_deepresearch(projeto_id);

// ── MIGRAÇÃO para bases existentes (rodar no D1 se a tabela já existir) ──
// ALTER TABLE irx_deepresearch ADD COLUMN regiao TEXT NOT NULL DEFAULT '';
// ALTER TABLE irx_deepresearch ADD COLUMN uf TEXT NOT NULL DEFAULT '';
// ALTER TABLE irx_deepresearch ADD COLUMN links_outras_redes TEXT NOT NULL DEFAULT '';
// ALTER TABLE irx_deepresearch ADD COLUMN processos_juridicos TEXT NOT NULL DEFAULT '';
// ALTER TABLE irx_deepresearch ADD COLUMN conar TEXT NOT NULL DEFAULT '';
// ALTER TABLE irx_deepresearch ADD COLUMN polemicas TEXT NOT NULL DEFAULT '';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── ROUTER ────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const url      = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/irx\/?/, '').split('/').filter(Boolean);
  const resource = segments[0]; // projetos | nomes | deepresearch
  const method   = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  try {
    if (resource === 'projetos')    return handleProjetos(method, url, request, env);
    if (resource === 'nomes')       return handleNomes(method, url, request, env);
    if (resource === 'deepresearch') return handleDeepResearch(method, url, request, env);
    return json({ error: `Recurso desconhecido: ${resource}` }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ══════════════════════════════════════════════════════════════
// PROJETOS
// ══════════════════════════════════════════════════════════════
async function handleProjetos(method, url, request, env) {
  const id = url.searchParams.get('id');

  if (method === 'GET') {
    if (id) {
      const row = await env.DB
        .prepare('SELECT * FROM irx_projetos WHERE id = ?')
        .bind(id).first();
      if (!row) return json({ error: 'Projeto não encontrado' }, 404);
      return json(row);
    }
    const { results } = await env.DB
      .prepare('SELECT * FROM irx_projetos ORDER BY updated_at DESC')
      .all();
    return json(results || []);
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON inválido' }, 400); }

    const { nome, cliente = '', tema = '' } = body;
    if (!nome?.trim()) return json({ error: '"nome" é obrigatório' }, 400);

    const { meta } = await env.DB
      .prepare('INSERT INTO irx_projetos (nome, cliente, tema) VALUES (?, ?, ?)')
      .bind(nome.trim(), cliente.trim(), tema.trim())
      .run();
    return json({ ok: true, id: meta.last_row_id, nome, cliente, tema }, 201);
  }

  if (method === 'PUT') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON inválido' }, 400); }

    const { id: pid, ...campos } = body;
    if (!pid) return json({ error: '"id" é obrigatório' }, 400);

    const ALLOWED = ['nome', 'cliente', 'tema'];
    const sets = [], values = [];
    for (const k of ALLOWED) {
      if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(String(campos[k]).trim()); }
    }
    if (!sets.length) return json({ error: 'Nenhum campo válido' }, 400);
    sets.push("updated_at = datetime('now')");
    values.push(pid);

    const { meta } = await env.DB
      .prepare(`UPDATE irx_projetos SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values).run();
    if (meta.changes === 0) return json({ error: 'Projeto não encontrado' }, 404);
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: '"id" é obrigatório' }, 400);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM irx_nomes        WHERE projeto_id = ?').bind(id),
      env.DB.prepare('DELETE FROM irx_deepresearch WHERE projeto_id = ?').bind(id),
      env.DB.prepare('DELETE FROM irx_projetos     WHERE id = ?').bind(id),
    ]);
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ══════════════════════════════════════════════════════════════
// NOMES (normalização)
// ══════════════════════════════════════════════════════════════
async function handleNomes(method, url, request, env) {
  const id         = url.searchParams.get('id');
  const projeto_id = url.searchParams.get('projeto_id');

  if (method === 'GET') {
    if (!projeto_id) return json({ error: '"projeto_id" é obrigatório' }, 400);
    const { results } = await env.DB
      .prepare('SELECT * FROM irx_nomes WHERE projeto_id = ? ORDER BY nome_orig ASC')
      .bind(projeto_id).all();
    return json(results || []);
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON inválido' }, 400); }

    const items = Array.isArray(body) ? body : [body];
    if (!items.length) return json({ error: 'Nenhum mapeamento enviado' }, 400);

    for (const item of items) {
      if (!item.projeto_id || !item.nome_orig || !item.nome_canon)
        return json({ error: 'Cada item precisa de "projeto_id", "nome_orig" e "nome_canon"' }, 400);
    }

    const UPSERT = `
      INSERT INTO irx_nomes (projeto_id, nome_orig, nome_canon)
      VALUES (?, ?, ?)
      ON CONFLICT(projeto_id, nome_orig) DO UPDATE SET
        nome_canon = excluded.nome_canon,
        updated_at = datetime('now')
    `;
    const CHUNK = 100;
    const stmts = items.map(i =>
      env.DB.prepare(UPSERT).bind(Number(i.projeto_id), String(i.nome_orig).trim(), String(i.nome_canon).trim())
    );
    for (let i = 0; i < stmts.length; i += CHUNK) {
      await env.DB.batch(stmts.slice(i, i + CHUNK));
    }
    return json({ ok: true, salvos: items.length });
  }

  if (method === 'DELETE') {
    if (!id && !projeto_id) return json({ error: '"id" ou "projeto_id" é obrigatório' }, 400);
    if (id) {
      await env.DB.prepare('DELETE FROM irx_nomes WHERE id = ?').bind(id).run();
    } else {
      await env.DB.prepare('DELETE FROM irx_nomes WHERE projeto_id = ?').bind(projeto_id).run();
    }
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ══════════════════════════════════════════════════════════════
// DEEP RESEARCH
// ══════════════════════════════════════════════════════════════
const DR_CAMPOS = [
  'nome', 'grau_influencia',
  'regiao', 'uf', 'links_outras_redes',
  'tipo_perfil', 'validacao_ideologica',
  'historico_profissional', 'posicionamento_redes', 'recomendacoes_acao',
  'processos_juridicos', 'conar', 'polemicas',
  'assuntos_sensiveis', 'bloco', 'tematica', 'abordagem',
  'status', 'resposta_bruta',
];

async function handleDeepResearch(method, url, request, env) {
  const projeto_id = url.searchParams.get('projeto_id');
  const username   = url.searchParams.get('username');

  if (method === 'GET') {
    if (!projeto_id) return json({ error: '"projeto_id" obrigatório' }, 400);
    if (username) {
      const row = await env.DB
        .prepare('SELECT * FROM irx_deepresearch WHERE projeto_id = ? AND username = ?')
        .bind(projeto_id, username).first();
      return json(row || null);
    }
    const { results } = await env.DB
      .prepare('SELECT * FROM irx_deepresearch WHERE projeto_id = ? ORDER BY updated_at DESC')
      .bind(projeto_id).all();
    return json(results || []);
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON inválido' }, 400); }

    const { projeto_id: pid, username: user, ...campos } = body;
    if (!pid || !user) return json({ error: '"projeto_id" e "username" obrigatórios' }, 400);

    const keys   = Object.keys(campos).filter(k => DR_CAMPOS.includes(k));
    const values = keys.map(k => String(campos[k] ?? ''));
    const colsInsert   = ['projeto_id', 'username', ...keys];
    const placeholders = colsInsert.map(() => '?').join(', ');
    const updateSets   = keys.length
      ? keys.map(k => `${k} = excluded.${k}`).join(', ') + ", updated_at = datetime('now')"
      : "updated_at = datetime('now')";

    const { meta } = await env.DB
      .prepare(`
        INSERT INTO irx_deepresearch (${colsInsert.join(', ')})
        VALUES (${placeholders})
        ON CONFLICT(projeto_id, username) DO UPDATE SET ${updateSets}
      `)
      .bind(pid, user, ...values)
      .run();
    return json({ ok: true, id: meta.last_row_id }, 201);
  }

  if (method === 'PUT') {
    let body;
    try { body = await request.json(); }
    catch { return json({ error: 'JSON inválido' }, 400); }

    const { projeto_id: pid, username: user, ...campos } = body;
    if (!pid || !user) return json({ error: '"projeto_id" e "username" obrigatórios' }, 400);

    const keys = Object.keys(campos).filter(k => DR_CAMPOS.includes(k));
    if (!keys.length) return json({ error: 'Nenhum campo válido' }, 400);

    const sets   = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => String(campos[k] ?? ''));

    await env.DB
      .prepare(`UPDATE irx_deepresearch SET ${sets}, updated_at = datetime('now') WHERE projeto_id = ? AND username = ?`)
      .bind(...values, pid, user)
      .run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!projeto_id || !username)
      return json({ error: '"projeto_id" e "username" obrigatórios' }, 400);
    await env.DB
      .prepare('DELETE FROM irx_deepresearch WHERE projeto_id = ? AND username = ?')
      .bind(projeto_id, username).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}
