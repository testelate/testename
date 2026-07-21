// functions/api/ir2/[[path]].js — HUB.nexus · IR² Backend
//
// GET    /api/ir2/projetos                  → lista projetos
// POST   /api/ir2/projetos                  → cria projeto
// PUT    /api/ir2/projetos                  → atualiza projeto
// DELETE /api/ir2/projetos?id=N             → remove projeto
//
// GET    /api/ir2/nomes?projeto_id=N        → mapeamentos do projeto + globais
// GET    /api/ir2/nomes?global=1            → só globais
// POST   /api/ir2/nomes                     → cria/atualiza mapeamento
// DELETE /api/ir2/nomes?id=N               → remove mapeamento
//
// GET    /api/ir2/analises?projeto_id=N     → análises do projeto
// POST   /api/ir2/analises                  → salva/atualiza análise
// DELETE /api/ir2/analises?id=N            → remove análise

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const json  = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });
const tryP  = (s, fb = {}) => { try { return JSON.parse(s); } catch { return fb; } };

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── ROUTER ────────────────────────────────────────────────────
export async function onRequest({ request, env }) {
  const url      = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/ir2\/?/, '').split('/').filter(Boolean);
  const resource = segments[0]; // projetos | nomes | analises
  const method   = request.method.toUpperCase();

  try {
    if (resource === 'projetos') return handleProjetos(method, url, request, env);
    if (resource === 'nomes')    return handleNomes(method, url, request, env);
    if (resource === 'analises') return handleAnalises(method, url, request, env);
    return json({ error: 'Rota não encontrada' }, 404);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ════════════════════════════════════════════════════════════════
// PROJETOS
// ════════════════════════════════════════════════════════════════
async function handleProjetos(method, url, request, env) {
  const id = url.searchParams.get('id');

  if (method === 'GET') {
    if (id) {
      const row = await env.DB.prepare(
        'SELECT * FROM ir2_projetos WHERE id = ?'
      ).bind(id).first();
      if (!row) return json({ error: 'Projeto não encontrado' }, 404);
      return json({ ...row, pesos: tryP(row.pesos), meta: tryP(row.meta) });
    }
    const { results } = await env.DB
      .prepare('SELECT * FROM ir2_projetos ORDER BY updated_at DESC LIMIT 100')
      .all();
    return json(results.map(r => ({ ...r, pesos: tryP(r.pesos), meta: tryP(r.meta) })));
  }

  if (method === 'POST') {
    const body = await request.json();
    const { nome, cliente, pesos, meta } = body;
    if (!nome) return json({ error: 'nome obrigatório' }, 400);
    const { meta: m } = await env.DB.prepare(`
      INSERT INTO ir2_projetos (nome, cliente, pesos, meta)
      VALUES (?,?,?,?)
    `).bind(nome, cliente||'', JSON.stringify(pesos||{}), JSON.stringify(meta||{})).run();
    return json({ ok: true, id: m.last_row_id }, 201);
  }

  if (method === 'PUT') {
    const body = await request.json();
    const { id: bid, nome, cliente, pesos, meta } = body;
    if (!bid) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare(`
      UPDATE ir2_projetos SET nome=?, cliente=?, pesos=?, meta=?, updated_at=datetime('now') WHERE id=?
    `).bind(nome||'', cliente||'', JSON.stringify(pesos||{}), JSON.stringify(meta||{}), bid).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare('DELETE FROM ir2_projetos WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// NOMES
// ════════════════════════════════════════════════════════════════
async function handleNomes(method, url, request, env) {
  const id         = url.searchParams.get('id');
  const projetoId  = url.searchParams.get('projeto_id');
  const globalOnly = url.searchParams.get('global') === '1';

  if (method === 'GET') {
    // Globais apenas
    if (globalOnly) {
      const { results } = await env.DB
        .prepare('SELECT * FROM ir2_nomes WHERE projeto_id IS NULL ORDER BY nome_orig')
        .all();
      return json(results);
    }
    // Projeto + globais (merge, projeto sobrescreve global)
    if (projetoId) {
      const { results: globais } = await env.DB
        .prepare('SELECT * FROM ir2_nomes WHERE projeto_id IS NULL ORDER BY nome_orig')
        .all();
      const { results: especificos } = await env.DB
        .prepare('SELECT * FROM ir2_nomes WHERE projeto_id = ? ORDER BY nome_orig')
        .bind(projetoId).all();
      // Merge: específico tem prioridade sobre global
      const mapa = {};
      globais.forEach(r => { mapa[r.nome_orig] = r; });
      especificos.forEach(r => { mapa[r.nome_orig] = r; });
      return json(Object.values(mapa));
    }
    // Todos
    const { results } = await env.DB
      .prepare('SELECT * FROM ir2_nomes ORDER BY nome_orig')
      .all();
    return json(results);
  }

  if (method === 'POST') {
    const body = await request.json();
    // Suporta batch: [{ nome_orig, nome_canon, projeto_id? }] ou objeto único
    const entries = Array.isArray(body) ? body : [body];
    let inserted = 0;
    for (const entry of entries) {
      const { nome_orig, nome_canon, projeto_id: pid } = entry;
      if (!nome_orig || !nome_canon) continue;
      const pidVal = pid || null;
      await env.DB.prepare(`
        INSERT INTO ir2_nomes (projeto_id, nome_orig, nome_canon)
        VALUES (?,?,?)
        ON CONFLICT(projeto_id, nome_orig) DO UPDATE SET nome_canon = excluded.nome_canon
      `).bind(pidVal, nome_orig.trim(), nome_canon.trim()).run();
      inserted++;
    }
    return json({ ok: true, inserted }, 201);
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare('DELETE FROM ir2_nomes WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// ANALISES
// ════════════════════════════════════════════════════════════════
async function handleAnalises(method, url, request, env) {
  const id        = url.searchParams.get('id');
  const projetoId = url.searchParams.get('projeto_id');

  if (method === 'GET') {
    if (!projetoId) return json({ error: 'projeto_id obrigatório' }, 400);
    const { results } = await env.DB
      .prepare('SELECT * FROM ir2_analises WHERE projeto_id = ? ORDER BY updated_at DESC')
      .bind(projetoId).all();
    return json(results);
  }

  if (method === 'POST') {
    const body = await request.json();
    const { projeto_id, chave, texto } = body;
    if (!projeto_id || !chave) return json({ error: 'projeto_id e chave obrigatórios' }, 400);
    await env.DB.prepare(`
      INSERT INTO ir2_analises (projeto_id, chave, texto)
      VALUES (?,?,?)
      ON CONFLICT(projeto_id, chave) DO UPDATE SET texto = excluded.texto, updated_at = datetime('now')
    `).bind(projeto_id, chave, texto||'').run();
    return json({ ok: true }, 201);
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare('DELETE FROM ir2_analises WHERE id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}
