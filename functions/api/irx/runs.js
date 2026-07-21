// functions/api/irx/runs.js — HUB.nexus · Pipeline IRX
// Registra e atualiza as execuções do pipeline para rastreabilidade.
//
// GET  /api/irx/runs            → lista execuções recentes
// GET  /api/irx/runs?id=uuid    → execução específica
// POST /api/irx/runs            → cria nova execução
// PUT  /api/irx/runs            → atualiza status/progresso

function cors(request) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = origin.includes('hub-nexus') || origin.includes('pages.dev') || origin.includes('localhost');
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://hub-nexus.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
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
        .prepare('SELECT * FROM irx_pipeline_runs WHERE id = ?')
        .bind(id).first();
      if (!row) return json({ error: 'Run não encontrada' }, 404, request);
      return json({ ...row, log_resumo: JSON.parse(row.log_resumo || '{}') }, 200, request);
    }

    const { results } = await env.DB
      .prepare('SELECT * FROM irx_pipeline_runs ORDER BY created_at DESC LIMIT 50')
      .all();

    return json(results.map(r => ({
      ...r,
      log_resumo: (() => { try { return JSON.parse(r.log_resumo || '{}'); } catch { return {}; } })(),
    })), 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — criar nova execução ────────────────────────────────
// Body: { id: "uuid", segmento: "..." }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, segmento } = body;
  if (!id || !segmento)
    return json({ error: '"id" e "segmento" são obrigatórios' }, 400, request);

  try {
    await env.DB
      .prepare(`
        INSERT INTO irx_pipeline_runs (id, segmento, status, etapa_atual, log_resumo)
        VALUES (?, ?, 'running', 'ingestao', '{}')
      `)
      .bind(id, segmento)
      .run();

    return json({ ok: true, id }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT — atualizar progresso / status ────────────────────────
// Body: { id, status?, etapa_atual?, total_bw_bruto?, ... log_resumo? }
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, ...campos } = body;
  if (!id) return json({ error: '"id" obrigatório' }, 400, request);

  const ALLOWED_NUM = [
    'total_bw_bruto','total_bw_limpo','total_autores',
    'total_tagger','total_unified','total_ia','total_aprovados',
  ];
  const ALLOWED_STR = ['status','etapa_atual'];

  const sets   = [];
  const values = [];

  for (const k of ALLOWED_STR) {
    if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(String(campos[k])); }
  }
  for (const k of ALLOWED_NUM) {
    if (campos[k] !== undefined) { sets.push(`${k} = ?`); values.push(Number(campos[k])); }
  }
  if (campos.log_resumo !== undefined) {
    sets.push('log_resumo = ?');
    values.push(JSON.stringify(campos.log_resumo));
  }

  if (!sets.length) return json({ error: 'Nenhum campo válido' }, 400, request);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  try {
    await env.DB
      .prepare(`UPDATE irx_pipeline_runs SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    return json({ ok: true }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
