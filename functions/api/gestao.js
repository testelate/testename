// functions/gestao.js — HUB.nexus
const ORIGIN = 'https://hub-nexus.pages.dev';

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    
    // Verificação de Login
    if (body.senha) {
      if (body.senha === env.GESTAO_PASSWORD) {
        return new Response(JSON.stringify({ ok: true }), { headers: getCorsHeaders(request) });
      }
      return new Response(JSON.stringify({ error: 'Senha incorreta' }), { status: 401, headers: getCorsHeaders(request) });
    }

    // Salvar Projeto no Banco D1 (Binding "DB" conforme seu wrangler.toml)
    const query = `
      INSERT INTO gestao_projetos (
        nome, cliente, responsavel, data_entrega, 
        horas_est, horas_real, valor, faturamento, 
        pjs, ferramentas, obs
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
    `;

    await env.DB.prepare(query).bind(
      body.nome || 'Novo Projeto',
      body.cliente || '',
      body.responsavel || '',
      body.data_entrega || null,
      parseInt(body.horas_est) || 0,
      parseInt(body.horas_real) || 0,
      parseFloat(body.valor) || 0,
      body.faturamento || 'pendente',
      JSON.stringify(body.pjs || []),
      JSON.stringify(body.ferramentas || []),
      body.obs || ''
    ).run();

    return new Response(JSON.stringify({ ok: true }), { status: 201, headers: getCorsHeaders(request) });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getCorsHeaders(request) });
  }
}

export async function onRequestDelete({ env, request }) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) return new Response(JSON.stringify({ error: 'id obrigatório' }), { status: 400, headers: getCorsHeaders(request) });

    await env.DB.prepare('DELETE FROM gestao_projetos WHERE id = ?1').bind(id).run();
    return new Response(JSON.stringify({ ok: true }), { headers: getCorsHeaders(request) });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getCorsHeaders(request) });
  }
}

export async function onRequestPut({ request, env }) {
  try {
    const body = await request.json();
    const { id, ...campos } = body;
    
    if (!id) return new Response(JSON.stringify({ error: 'id obrigatório' }), { status: 400, headers: getCorsHeaders(request) });

    // Serializa campos JSON antes de persistir
    if (campos.pjs !== undefined)         campos.pjs         = JSON.stringify(campos.pjs);
    if (campos.ferramentas !== undefined) campos.ferramentas = JSON.stringify(campos.ferramentas);
    if (campos.arquivos !== undefined)    campos.arquivos    = JSON.stringify(campos.arquivos);

    const keys   = Object.keys(campos).filter(k => k !== 'updated_at' && k !== 'created_at');
    if (!keys.length) return new Response(JSON.stringify({ error: 'nenhum campo para atualizar' }), { status: 400, headers: getCorsHeaders(request) });

    const sets   = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => campos[k]);

    await env.DB
      .prepare(`UPDATE gestao_projetos SET ${sets} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return new Response(JSON.stringify({ ok: true }), { headers: getCorsHeaders(request) });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getCorsHeaders(request) });
  }
}

export async function onRequestGet({ env, request }) {
  const { results } = await env.DB.prepare("SELECT * FROM gestao_projetos ORDER BY created_at DESC").all();

  // pjs, ferramentas e arquivos são salvos como JSON string no D1 — precisam ser parsed antes de retornar
  const parsed = results.map(row => ({
    ...row,
    pjs:         safeParse(row.pjs,         []),
    ferramentas: safeParse(row.ferramentas, []),
    arquivos:    safeParse(row.arquivos,    []),
  }));

  return new Response(JSON.stringify(parsed), { headers: getCorsHeaders(request) });
}

function safeParse(value, fallback) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return fallback; }
  }
  return fallback;
}
