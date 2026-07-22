// functions/api/search.js — HUB.nexus
// Endpoint para busca global em todas as tabelas (Versão Robusta)

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

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}

export async function onRequestGet({ request, env }) {
  try {
    const url = new URL(request.url);
    const q = url.searchParams.get('q');
    
    if (!q || q.length < 2) {
      return new Response(JSON.stringify([]), { headers: getCorsHeaders(request) });
    }

    const pattern = `%${q}%`;
    const results = [];

    // --- 1. Buscar no KANBAN ---
    try {
      const kanban = await env.DB.prepare(`
        SELECT id, title as title, descricao as sub, 'kanban' as type, col as meta
        FROM kanban 
        WHERE title LIKE ?1 OR descricao LIKE ?1 OR responsavel LIKE ?1
        LIMIT 8
      `).bind(pattern).all();
      if (kanban.results) {
        results.push(...kanban.results.map(r => ({ ...r, link: 'pages/kanban.html' })));
      }
    } catch (e) { console.error('Busca Kanban falhou:', e.message); }

    // --- 2. Buscar em TAREFAS ---
    try {
      const tasks = await env.DB.prepare(`
        SELECT id, titulo as title, nota as sub, 'task' as type, prazo as meta
        FROM tasks 
        WHERE titulo LIKE ?1 OR nota LIKE ?1 OR responsavel LIKE ?1
        LIMIT 8
      `).bind(pattern).all();
      if (tasks.results) {
        results.push(...tasks.results.map(r => ({ ...r, link: 'pages/tasks.html' })));
      }
    } catch (e) { console.error('Busca Tasks falhou:', e.message); }

    // --- 3. Buscar em PROJETOS ---
    try {
      const projects = await env.DB.prepare(`
        SELECT id, nome as title, cliente as sub, 'projeto' as type, data_entrega as meta
        FROM gestao_projetos 
        WHERE nome LIKE ?1 OR cliente LIKE ?1 OR responsavel LIKE ?1
        LIMIT 8
      `).bind(pattern).all();
      if (projects.results) {
        results.push(...projects.results.map(r => ({ ...r, link: 'pages/gestao.html' })));
      }
    } catch (e) { console.error('Busca Projetos falhou:', e.message); }

    // --- 4. Buscar em PROSPECTS ---
    try {
      const prospects = await env.DB.prepare(`
        SELECT id, nome_empresa as title, contato_nome as sub, 'prospect' as type, responsavel as meta
        FROM prospects 
        WHERE nome_empresa LIKE ?1 OR contato_nome LIKE ?1 OR responsavel LIKE ?1
        LIMIT 8
      `).bind(pattern).all();
      if (prospects.results) {
        results.push(...prospects.results.map(r => ({ ...r, link: 'pages/gestao.html?tab=prospects' })));
      }
    } catch (e) { console.error('Busca Prospects falhou:', e.message); }

    return new Response(JSON.stringify(results), { status: 200, headers: getCorsHeaders(request) });

  } catch (err) {
    console.error('Busca Global Error:', err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: getCorsHeaders(request) });
  }
}
