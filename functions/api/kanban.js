// api/kanban.js — HUB.nexus Kanban via Cloudflare D1
import { notificarResponsavel } from '../utils/push.js';
// GET    /api/kanban          → lista todos os cards
// POST   /api/kanban          → cria card
// PUT    /api/kanban          → atualiza card { id, ...campos }
// DELETE /api/kanban?id=x     → remove card

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

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), { status, headers: getCorsHeaders(request) });
}

function deserialize(row) {
  if (!row) return row;
  const out = { ...row };
  
  // Converte string do banco de volta para Array no JSON
  if (typeof out.avatars === 'string') {
    try { out.avatars = JSON.parse(out.avatars); } catch { out.avatars = []; }
  }
  if (typeof out.files === 'string') {
    try { out.files = JSON.parse(out.files); } catch { out.files = []; }
  }
  
  return out;
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  try {
    const { results } = await env.DB
      .prepare('SELECT * FROM kanban ORDER BY ordem ASC, created_at DESC')
      .all();
    return json(results.map(deserialize), 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST ──────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  if (!body.title) return json({ error: 'title obrigatório' }, 400);

  try {
    const { meta } = await env.DB
      .prepare(`
        INSERT INTO kanban
          (col, title, tipo, prio, prof_id, responsavel, dias_offset, avatars, files, descricao, recorrencia, bar, ordem, data_entrega, data_revisao, data_apresentacao, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
      `)
      .bind(
        body.col         || 'entrada',
        body.title,
        body.tipo        || '',
        body.prio        || 'media',
        body.prof_id     || '',
        body.responsavel || '',
        body.dias_offset ?? 3,
        JSON.stringify(body.avatars || []),
        JSON.stringify(body.files || []),
        body.descricao   || '',
        body.recorrencia || '',
        body.bar         || '#ff6500',
        body.ordem       || 0,
        body.data_entrega || '',
        body.data_revisao || '',
        body.data_apresentacao || ''
      )
      .run();

    // Notifica cada avatar (responsável) sobre novo card atribuído
    for (const avatar of (body.avatars || [])) {
      if (avatar.nome) await notificarResponsavel(env, {
        responsavel: avatar.nome,
        titulo:      '🆕 Nova tarefa atribuída',
        mensagem:    `"${body.title}" foi atribuída a você no Kanban.`,
        url:         '/pages/kanban.html',
      });
    }

    return json({ ok: true, id: meta.last_row_id }, 201, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT ───────────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, ...campos } = body;
  if (!id) return json({ error: 'id obrigatório' }, 400, request);

  // Arrays precisam ser transformados em string antes de salvar no SQLite (D1)
  if (campos.avatars !== undefined) campos.avatars = JSON.stringify(campos.avatars);
  if (campos.files !== undefined) campos.files = JSON.stringify(campos.files);

  const keys   = Object.keys(campos);
  if (!keys.length) return json({ error: 'nenhum campo para atualizar' }, 400, request);

  const sets   = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => campos[k]);

  try {
    await env.DB
      .prepare(`UPDATE kanban SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...values, id)
      .run();

    // Notifica novos responsáveis se avatars foi alterado
    if (body.avatars && Array.isArray(body.avatars)) {
      for (const avatar of body.avatars) {
        if (avatar.nome) await notificarResponsavel(env, {
          responsavel: avatar.nome,
          titulo:      '📋 Tarefa atualizada',
          mensagem:    `Você foi atribuído ou a tarefa "${body.title || 'Kanban'}" foi atualizada.`,
          url:         '/pages/kanban.html',
        });
      }
    }

    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id obrigatório' }, 400, request);

  try {
    await env.DB.prepare('DELETE FROM kanban WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
