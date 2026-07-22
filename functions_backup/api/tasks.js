// api/tasks.js — HUB.nexus Tasks via Cloudflare D1
import { notificarResponsavel } from '../utils/push.js';
// GET    /api/tasks?email=x  → lista tarefas (todas ou por email)
// POST   /api/tasks           → cria tarefa
// PUT    /api/tasks           → atualiza tarefa { id, ...campos }
// DELETE /api/tasks?id=x     → remove tarefa

const ORIGIN = 'https://hub-nexus.pages.dev';

function getCorsHeaders(request) {
  const origin = request?.headers?.get('Origin') || ORIGIN;
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

// Campos cujo valor é JSON serializado como TEXT no D1
const JSON_FIELDS = ['avatars', 'tags'];

function deserialize(row) {
  if (!row) return row;
  const out = { ...row };
  for (const f of JSON_FIELDS) {
    if (typeof out[f] === 'string') {
      try { out[f] = JSON.parse(out[f]); } catch { out[f] = []; }
    }
  }
  out.done = out.done === 1;
  return out;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const email = new URL(request.url).searchParams.get('email');
  try {
    const stmt = email
      ? env.DB.prepare('SELECT * FROM tasks WHERE email = ? ORDER BY ordem ASC, created_at DESC').bind(email)
      : env.DB.prepare('SELECT * FROM tasks ORDER BY created_at DESC');

    const { results } = await stmt.all();
    return json(results.map(deserialize));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── POST ──────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  if (!body.titulo) return json({ error: 'titulo obrigatório' }, 400);

  try {
    const { meta } = await env.DB
      .prepare(`
        INSERT INTO tasks
          (email, titulo, descricao, status, prio, tipo, prof_id, responsavel,
           avatars, tags, prazo, est, nota, done, prog, ordem, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, datetime('now'))
      `)
      .bind(
        body.email       || '',
        body.titulo,
        body.descricao   || '',
        body.status      || 'pendente',
        body.prio        || 'media',
        body.tipo        || '',
        body.prof_id     || '',
        body.responsavel || '',
        JSON.stringify(body.avatars || []),
        JSON.stringify(body.tags    || []),
        body.prazo       || '',
        body.est         || 'producao',
        body.nota        || '',
        body.done        ? 1 : 0,
        body.prog        || 0,
        body.ordem       || 0,
      )
      .run();

    // Notifica o responsável sobre nova tarefa atribuída
    if (body.responsavel) {
      await notificarResponsavel(env, {
        responsavel: body.responsavel,
        titulo:      '🆕 Nova tarefa atribuída',
        mensagem:    `"${body.titulo}" foi atribuída a você.`,
        url:         '/pages/tasks.html',
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

  // Serializa campos JSON e booleanos antes de persistir
  if (campos.avatars !== undefined) campos.avatars = JSON.stringify(campos.avatars);
  if (campos.tags    !== undefined) campos.tags    = JSON.stringify(campos.tags);
  if (campos.done    !== undefined) campos.done    = campos.done ? 1 : 0;

  const keys   = Object.keys(campos);
  if (!keys.length) return json({ error: 'nenhum campo para atualizar' }, 400, request);

  const sets   = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => campos[k]);

  try {
    await env.DB
      .prepare(`UPDATE tasks SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .bind(...values, id)
      .run();

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
    await env.DB.prepare('DELETE FROM tasks WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
