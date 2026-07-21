// functions/api/irx/projetos.js — HUB.nexus · Pipeline IRX
// CRUD de projetos do pipeline de seleção de influenciadores.
//
// GET    /api/irx/projetos          → lista todos os projetos
// GET    /api/irx/projetos?id=N     → projeto específico
// POST   /api/irx/projetos          → cria projeto { nome, cliente?, tema? }
// PUT    /api/irx/projetos          → atualiza { id, nome?, cliente?, tema? }
// DELETE /api/irx/projetos?id=N     → remove projeto

// ── SQL para criar a tabela (rodar no D1 uma vez) ─────────────
// CREATE TABLE IF NOT EXISTS irx_projetos (
//   id         INTEGER PRIMARY KEY AUTOINCREMENT,
//   nome       TEXT    NOT NULL,
//   cliente    TEXT    NOT NULL DEFAULT '',
//   tema       TEXT    NOT NULL DEFAULT '',
//   created_at TEXT    NOT NULL DEFAULT (datetime('now')),
//   updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
// );

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

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');

  try {
    if (id) {
      const row = await env.DB
        .prepare('SELECT * FROM irx_projetos WHERE id = ?')
        .bind(id).first();
      if (!row) return json({ error: 'Projeto não encontrado' }, 404, request);
      return json(row, 200, request);
    }

    const { results } = await env.DB
      .prepare('SELECT * FROM irx_projetos ORDER BY updated_at DESC')
      .all();
    return json(results, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — criar projeto ──────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { nome, cliente = '', tema = '' } = body;
  if (!nome || !nome.trim())
    return json({ error: '"nome" é obrigatório' }, 400, request);

  try {
    const { meta } = await env.DB
      .prepare(`
        INSERT INTO irx_projetos (nome, cliente, tema)
        VALUES (?, ?, ?)
      `)
      .bind(nome.trim(), cliente.trim(), tema.trim())
      .run();

    return json({ ok: true, id: meta.last_row_id, nome, cliente, tema }, 201, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT — atualizar projeto ───────────────────────────────────
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, ...campos } = body;
  if (!id) return json({ error: '"id" é obrigatório' }, 400, request);

  const ALLOWED = ['nome', 'cliente', 'tema'];
  const sets    = [];
  const values  = [];

  for (const k of ALLOWED) {
    if (campos[k] !== undefined) {
      sets.push(`${k} = ?`);
      values.push(String(campos[k]).trim());
    }
  }

  if (!sets.length) return json({ error: 'Nenhum campo válido' }, 400, request);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  try {
    const { meta } = await env.DB
      .prepare(`UPDATE irx_projetos SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    if (meta.changes === 0)
      return json({ error: 'Projeto não encontrado' }, 404, request);

    return json({ ok: true }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');

  if (!id) return json({ error: '"id" é obrigatório' }, 400, request);

  try {
    // Cascata manual: remove nomes e deep research vinculados
    await env.DB.batch([
      env.DB.prepare('DELETE FROM irx_nomes      WHERE projeto_id = ?').bind(id),
      env.DB.prepare('DELETE FROM irx_deepresearch WHERE projeto_id = ?').bind(id),
      env.DB.prepare('DELETE FROM irx_projetos   WHERE id = ?').bind(id),
    ]);

    return json({ ok: true }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
