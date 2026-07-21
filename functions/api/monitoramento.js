// functions/api/monitoramento.js — HUB.nexus Tarefas Fixas de Monitoramento
import { notificarResponsavel } from '../utils/push.js';

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: CORS }); }
export async function onRequestOptions() { return new Response(null, { status: 204, headers: CORS }); }

export async function onRequestGet({ request, env }) {
  const url   = new URL(request.url);
  const tipo  = url.searchParams.get('tipo');
  const turno = url.searchParams.get('turno');
  const email = url.searchParams.get('email');

  try {
    let q = 'SELECT * FROM monitoramento_tarefas WHERE ativo = 1';
    const binds = [];
    if (tipo)  { q += ' AND tipo = ?';  binds.push(tipo); }
    if (turno) { q += ' AND turno = ?'; binds.push(turno); }
    if (email) { q += ' AND (responsavel LIKE ? OR responsavel = ?)'; binds.push(`%${email}%`, email); }
    q += ' ORDER BY hora ASC, tipo ASC';

    const stmt = env.DB.prepare(q);
    const { results } = await stmt.bind(...binds).all();
    return json(results);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body.titulo) return json({ error: 'titulo obrigatório' }, 400);

  try {
    const { meta } = await env.DB.prepare(`
      INSERT INTO monitoramento_tarefas (titulo, cliente, tipo, turno, hora, responsavel, status, recorrencia, ativo)
      VALUES (?,?,?,?,?,?,?,?,?)
    `).bind(
      body.titulo, body.cliente || '', body.tipo || 'DIÁRIO', body.turno || '',
      body.hora || '', body.responsavel || '', body.status || 'pendente', body.recorrencia || 'diaria', 1
    ).run();

    // NOVO: Notifica se a nova demanda já tiver um responsável logo na criação
    if (body.responsavel) {
      await notificarResponsavel(env, {
        responsavel: body.responsavel,
        titulo:      '🆕 Nova tarefa atribuída',
        mensagem:    `"${body.titulo}" foi atribuída a você no Monitoramento.`,
        url:         '/pages/monitoramento.html',
      });
    }

    return json({ ok: true, id: meta.last_row_id }, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  const { id, ...campos } = body;
  if (!id) return json({ error: 'id obrigatório' }, 400);

  const keys   = Object.keys(campos);
  if (!keys.length) return json({ error: 'nenhum campo' }, 400);
  const sets   = keys.map(k => `${k} = ?`).join(', ');
  const values = keys.map(k => campos[k]);

  try {
    await env.DB.prepare(`UPDATE monitoramento_tarefas SET ${sets} WHERE id = ?`).bind(...values, id).run();

    const tarefa = await env.DB.prepare('SELECT titulo, responsavel FROM monitoramento_tarefas WHERE id = ?').bind(id).first();

    // Notifica se houve mudança de STATUS
    if (campos.status && tarefa?.responsavel) {
      await notificarResponsavel(env, {
        responsavel: tarefa.responsavel,
        titulo:      '📋 Status atualizado',
        mensagem:    `"${tarefa.titulo}" → ${campos.status}`,
        url:         '/pages/monitoramento.html',
      });
    }

    // NOVO: Notifica se alguém alterou o RESPONSÁVEL por essa demanda
    if (campos.responsavel && campos.responsavel !== '') {
      await notificarResponsavel(env, {
        responsavel: campos.responsavel,
        titulo:      '📋 Tarefa assumida/atribuída',
        mensagem:    `Você agora é responsável por "${tarefa?.titulo || 'Tarefa'}" no Monitoramento.`,
        url:         '/pages/monitoramento.html',
      });
    }

    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

export async function onRequestDelete({ request, env }) {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'id obrigatório' }, 400);
  try {
    await env.DB.prepare('UPDATE monitoramento_tarefas SET ativo = 0 WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) { return json({ error: e.message }, 500); }
}
