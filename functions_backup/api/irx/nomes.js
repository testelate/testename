// functions/api/ir2/nomes.js — HUB.nexus · Pipeline IRX
// CRUD dos mapeamentos de normalização de nomes (nome_orig → nome_canon).
// Salvos por projeto para reutilização entre sessões.
//
// GET    /api/ir2/nomes?projeto_id=N    → lista mapeamentos do projeto
// POST   /api/ir2/nomes                 → upsert em lote [{ nome_orig, nome_canon, projeto_id }]
// DELETE /api/ir2/nomes?id=N            → remove mapeamento específico
// DELETE /api/ir2/nomes?projeto_id=N    → remove todos do projeto

// ── SQL para criar a tabela (rodar no D1 uma vez) ─────────────
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

function cors(request) {
  const origin  = (request && request.headers.get('Origin')) || '';
  const allowed =
    origin.includes('hub-nexus') ||
    origin.includes('pages.dev') ||
    origin.includes('localhost');
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://hub-nexus.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
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
  const url        = new URL(request.url);
  const projeto_id = url.searchParams.get('projeto_id');

  if (!projeto_id)
    return json({ error: '"projeto_id" é obrigatório' }, 400, request);

  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM irx_nomes WHERE projeto_id = ? ORDER BY nome_orig ASC')
      .bind(projeto_id)
      .all();

    return json(results, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — upsert em lote ─────────────────────────────────────
// Body: [{ nome_orig, nome_canon, projeto_id }, ...]
//    ou { nome_orig, nome_canon, projeto_id }  (item único)
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  // Aceita objeto único ou array
  const items = Array.isArray(body) ? body : [body];

  if (!items.length)
    return json({ error: 'Nenhum mapeamento enviado' }, 400, request);

  // Valida campos obrigatórios
  for (const item of items) {
    if (!item.projeto_id || !item.nome_orig || !item.nome_canon)
      return json(
        { error: 'Cada item precisa de "projeto_id", "nome_orig" e "nome_canon"' },
        400, request
      );
  }

  const UPSERT = `
    INSERT INTO irx_nomes (projeto_id, nome_orig, nome_canon)
    VALUES (?, ?, ?)
    ON CONFLICT(projeto_id, nome_orig) DO UPDATE SET
      nome_canon = excluded.nome_canon,
      updated_at = datetime('now')
  `;

  try {
    const stmts = items.map(item =>
      env.DB.prepare(UPSERT).bind(
        Number(item.projeto_id),
        String(item.nome_orig).trim(),
        String(item.nome_canon).trim()
      )
    );

    // D1 batch (max 100 por vez)
    const CHUNK = 100;
    for (let i = 0; i < stmts.length; i += CHUNK) {
      await env.DB.batch(stmts.slice(i, i + CHUNK));
    }

    return json({ ok: true, salvos: items.length }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE — por id ou por projeto_id inteiro ─────────────────
export async function onRequestDelete({ request, env }) {
  const url        = new URL(request.url);
  const id         = url.searchParams.get('id');
  const projeto_id = url.searchParams.get('projeto_id');

  if (!id && !projeto_id)
    return json({ error: '"id" ou "projeto_id" é obrigatório' }, 400, request);

  try {
    if (id) {
      await env.DB
        .prepare('DELETE FROM irx_nomes WHERE id = ?')
        .bind(id)
        .run();
    } else {
      await env.DB
        .prepare('DELETE FROM irx_nomes WHERE projeto_id = ?')
        .bind(projeto_id)
        .run();
    }

    return json({ ok: true }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
