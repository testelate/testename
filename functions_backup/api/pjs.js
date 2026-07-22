// functions/api/pjs.js — HUB.nexus
// Controle de Contratos PJ e SOXs (Cloudflare Pages + D1)

const CORS = {
  'Access-Control-Allow-Origin':  'https://hub-nexus.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── GET — Lista todos os contratos ────────────────────────────────────────
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare(`SELECT * FROM pjs_sox ORDER BY id DESC`)
      .all();
    return json(results || []);
  } catch (e) {
    return json({ error: 'Falha ao buscar contratos PJ', detalhe: e.message }, 500);
  }
}

// ── POST — Cadastra novo contrato PJ ─────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const {
      nome_pj,
      cnpj       = '',
      contato    = '',
      telefone   = '',
      email      = '',
      area       = '',
      setor      = '',
      local      = '',
      cliente    = '',
      socs,        // array de SOCs enviado pelo frontend (novo formato)
    } = body;

    if (!nome_pj || !nome_pj.trim()) {
      return json({ error: 'Nome do PJ é obrigatório.' }, 400);
    }

    // Normaliza socs: aceita array ou string JSON
    const socsJson = typeof socs === 'string'
      ? socs
      : JSON.stringify(Array.isArray(socs) ? socs : []);

    const result = await env.DB
      .prepare(`
        INSERT INTO pjs_sox
          (nome_pj, cnpj, contato, telefone, email, area, setor, local, cliente, socs)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        nome_pj.trim(),
        cnpj.trim(),
        contato.trim(),
        telefone.trim(),
        email.trim(),
        area.trim(),
        setor.trim(),
        local.trim(),
        cliente.trim(),
        socsJson
      )
      .run();

    return json({ ok: true, id: result.meta?.last_row_id });
  } catch (e) {
    return json({ error: 'Falha ao cadastrar contrato PJ', detalhe: e.message }, 500);
  }
}

// ── PUT — Atualiza contrato existente ─────────────────────────────────────
export async function onRequestPut({ request, env }) {
  try {
    const body = await request.json();
    const {
      id,
      nome_pj,
      cnpj       = '',
      contato    = '',
      telefone   = '',
      email      = '',
      area       = '',
      setor      = '',
      local      = '',
      cliente    = '',
      socs,        // array de SOCs enviado pelo frontend (novo formato)
    } = body;

    if (!id)                          return json({ error: 'ID do contrato não informado.' }, 400);
    if (!nome_pj || !nome_pj.trim()) return json({ error: 'Nome do PJ é obrigatório.' }, 400);

    // Normaliza socs: aceita array ou string JSON
    const socsJson = typeof socs === 'string'
      ? socs
      : JSON.stringify(Array.isArray(socs) ? socs : []);

    await env.DB
      .prepare(`
        UPDATE pjs_sox SET
          nome_pj  = ?,
          cnpj     = ?,
          contato  = ?,
          telefone = ?,
          email    = ?,
          area     = ?,
          setor    = ?,
          local    = ?,
          cliente  = ?,
          socs     = ?
        WHERE id = ?
      `)
      .bind(
        nome_pj.trim(),
        cnpj.trim(),
        contato.trim(),
        telefone.trim(),
        email.trim(),
        area.trim(),
        setor.trim(),
        local.trim(),
        cliente.trim(),
        socsJson,
        id
      )
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Falha ao atualizar contrato PJ', detalhe: e.message }, 500);
  }
}

// ── DELETE — Remove contrato pelo ID ─────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  try {
    const url = new URL(request.url);
    const id  = url.searchParams.get('id');

    if (!id) return json({ error: 'ID não informado.' }, 400);

    await env.DB
      .prepare(`DELETE FROM pjs_sox WHERE id = ?`)
      .bind(id)
      .run();

    return json({ ok: true });
  } catch (e) {
    return json({ error: 'Falha ao remover contrato PJ', detalhe: e.message }, 500);
  }
}
