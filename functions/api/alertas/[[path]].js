// functions/api/alertas/[[path]].js — HUB.nexus Sentinela: histórico de alertas por cliente (D1)
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function ensureSchema(db) {
  await db.prepare(`
    CREATE TABLE IF NOT EXISTS sentinela_clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL UNIQUE,
      prompt_single TEXT NOT NULL DEFAULT '',
      prompt_multi TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(() => {});
}

export async function onRequestGet({ request, env }) {
  const url  = new URL(request.url);
  const path = url.pathname;

  try {
    await ensureSchema(env.DB);
  } catch (e) {
    console.error('Error ensuring schema:', e);
  }

  if (path.endsWith('/clientes')) {
    try {
      const { results } = await env.DB.prepare('SELECT * FROM sentinela_clientes ORDER BY nome').all();
      return json(results);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  const cliente = url.searchParams.get('cliente');
  try {
    const stmt = cliente
      ? env.DB.prepare('SELECT * FROM alertas WHERE cliente = ? ORDER BY padrao DESC, created_at DESC LIMIT 10').bind(cliente)
      : env.DB.prepare('SELECT * FROM alertas ORDER BY padrao DESC, created_at DESC LIMIT 50');
    const { results } = await stmt.all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  const url  = new URL(request.url);
  const path = url.pathname;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  try {
    await ensureSchema(env.DB);
  } catch (e) {
    console.error('Error ensuring schema:', e);
  }

  if (path.endsWith('/clientes')) {
    const { nome, prompt_single, prompt_multi } = body;
    if (!nome) return json({ error: 'nome obrigatório' }, 400);
    try {
      await env.DB.prepare(`
        INSERT INTO sentinela_clientes (nome, prompt_single, prompt_multi, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(nome) DO UPDATE SET
          prompt_single = excluded.prompt_single,
          prompt_multi = excluded.prompt_multi,
          updated_at = excluded.updated_at
      `).bind(nome.trim(), prompt_single || '', prompt_multi || '').run();
      
      const row = await env.DB.prepare('SELECT * FROM sentinela_clientes WHERE nome = ?').bind(nome.trim()).first();
      return json({ ok: true, cliente: row });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (path.endsWith('/salvar')) {
    const { cliente, texto_gerado, fonte, modelo, periodo, total_publicacoes, padrao } = body;
    if (!cliente) return json({ error: 'cliente obrigatório' }, 400);
    if (!texto_gerado) return json({ error: 'texto_gerado obrigatório' }, 400);
    try {
      if (padrao) {
        await env.DB.prepare('UPDATE alertas SET padrao = 0 WHERE cliente = ?').bind(cliente).run();
      }
      const { meta } = await env.DB.prepare(`
        INSERT INTO alertas (cliente, texto_gerado, fonte, modelo, periodo, total_publicacoes, padrao)
        VALUES (?,?,?,?,?,?,?)
      `).bind(cliente, texto_gerado, fonte || '', modelo || '', periodo || '', total_publicacoes || 0, padrao ? 1 : 0).run();
      return json({ ok: true, id: meta.last_row_id }, 201);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (path.endsWith('/marcar-padrao')) {
    const { id, cliente } = body;
    if (!id || !cliente) return json({ error: 'id e cliente obrigatórios' }, 400);
    try {
      await env.DB.prepare('UPDATE alertas SET padrao = 0 WHERE cliente = ?').bind(cliente).run();
      await env.DB.prepare('UPDATE alertas SET padrao = 1 WHERE id = ? AND cliente = ?').bind(id, cliente).run();
      return json({ ok: true });
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  return json({ error: 'Rota não encontrada' }, 404);
}

