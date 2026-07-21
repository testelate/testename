// functions/api/check-prazos.js — HUB.nexus
// Rotina de verificação de prazos próximos (24h) e disparo de notificações Push

const ORIGIN = 'https://hub-nexus.pages.dev';

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || ORIGIN;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(request) });
  }

  try {
    // 1. Garantir que a tabela de controle de notificações existe
    await env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS notificacoes_prazos (
        id INTEGER PRIMARY KEY, item_id TEXT, type TEXT, notified_at TEXT
      )
    `).run();

    const today    = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];

    const logs = [];

    // -------------------------------------------------------
    // 2. TAREFAS PESSOAIS (tasks)
    // Schema real: "prazo" (não "deadline"), "titulo" (não "title")
    // Email do responsável está no campo direto "email" da task.
    // -------------------------------------------------------
    const { results: tasks } = await env.DB
      .prepare(`
        SELECT id, titulo, prazo, email
        FROM tasks
        WHERE done = 0
          AND prazo != ''
          AND (prazo = ?1 OR prazo = ?2)
      `)
      .bind(today, tomorrow)
      .all();

    for (const task of tasks) {
      const emailResponsavel = task.email;
      if (!emailResponsavel) continue;

      const itemKey = `task_${task.id}`;

      const already = await env.DB
        .prepare(`SELECT id FROM notificacoes_prazos WHERE item_id = ?1 AND notified_at = ?2`)
        .bind(itemKey, today)
        .first();

      if (already) continue;

      await fetch(new URL('/api/notificar', request.url), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email_responsavel: emailResponsavel,
          titulo:   'Prazo Proximo',
          mensagem: `A tarefa "${task.titulo}" vence ${task.prazo === today ? 'HOJE' : 'AMANHA'}!`,
          url:      '/pages/tasks.html',
        }),
      });

      await env.DB
        .prepare('INSERT INTO notificacoes_prazos (item_id, type, notified_at) VALUES (?, ?, ?)')
        .bind(itemKey, 'task', today)
        .run();

      logs.push(`Notificado ${emailResponsavel} sobre task ${task.id}`);
    }

    // -------------------------------------------------------
    // 3. KANBAN
    // Schema real: "data_entrega" (nao "dataEntrega")
    // avatars: [{ nome, cor }] — sem email. Busca email via usuarios.nome
    // -------------------------------------------------------
    const { results: cards } = await env.DB
      .prepare(`
        SELECT id, title, data_entrega, responsavel, avatars
        FROM kanban
        WHERE col != 'concluido'
          AND data_entrega != ''
          AND (data_entrega = ?1 OR data_entrega = ?2)
      `)
      .bind(today, tomorrow)
      .all();

    for (const card of cards) {
      const nomesParaNotificar = new Set();

      if (card.responsavel) nomesParaNotificar.add(card.responsavel.trim());

      if (card.avatars) {
        try {
          const avatarList = JSON.parse(card.avatars);
          if (Array.isArray(avatarList)) {
            for (const av of avatarList) {
              if (av && av.nome) nomesParaNotificar.add(av.nome.trim());
            }
          }
        } catch { }
      }

      for (const nome of nomesParaNotificar) {
        if (!nome) continue;

        const itemKey = `kanban_${card.id}_${nome.replace(/\s+/g, '_')}`;

        const already = await env.DB
          .prepare(`SELECT id FROM notificacoes_prazos WHERE item_id = ?1 AND notified_at = ?2`)
          .bind(itemKey, today)
          .first();

        if (already) continue;

        const user = await env.DB
          .prepare('SELECT email FROM usuarios WHERE nome = ?')
          .bind(nome)
          .first();

        if (!user || !user.email) continue;

        await fetch(new URL('/api/notificar', request.url), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email_responsavel: user.email,
            titulo:   'Alerta Kanban',
            mensagem: `A demanda "${card.title}" vence ${card.data_entrega === today ? 'HOJE' : 'AMANHA'}!`,
            url:      '/pages/kanban.html',
          }),
        });

        await env.DB
          .prepare('INSERT INTO notificacoes_prazos (item_id, type, notified_at) VALUES (?, ?, ?)')
          .bind(itemKey, 'kanban', today)
          .run();

        logs.push(`Notificado ${user.email} sobre kanban ${card.id}`);
      }
    }

    return new Response(JSON.stringify({ ok: true, logs }), { headers: getCorsHeaders(request) });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: getCorsHeaders(request),
    });
  }
}
