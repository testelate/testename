// Helpers de resposta
const json = (data, status = 200, request = null) => {
  const origin = request?.headers?.get('Origin') || 'https://hub-nexus.pages.dev';
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};

const parse = (row) => {
  if (!row) return null;
  return { ...row };
};

// ── GET — lista ou busca único ─────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const email = url.searchParams.get('email');
  const promptSlug = url.searchParams.get('prompt');

  try {
    // ── Prompt editável (conversacional) ──
    if (promptSlug) {
      const row = await env.DB.prepare('SELECT slug, titulo, conteudo, atualizado_por, updated_at FROM voxia_prompts WHERE slug = ?').bind(promptSlug).first();
      return json(row || null, 200, request);
    }
    if (token) {
      const row = await env.DB.prepare('SELECT * FROM voxia_reports WHERE token = ?').bind(token).first();
      if (!row) return json({ error: 'Não encontrado' }, 404, request);
      return json(parse(row), 200, request);
    }
    if (email) {
      const { results } = await env.DB
        .prepare('SELECT id, token, cliente, titulo, status, total_slides, total_respostas, created_at, updated_at FROM voxia_reports WHERE criado_por = ? ORDER BY updated_at DESC LIMIT 50')
        .bind(email).all();
      return json(results, 200, request);
    }
    return json({ error: 'Parâmetro email ou token obrigatório' }, 400, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — cria ou atualiza ────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { type } = body || {};

  // ── SAVE PROMPT — prompt conversacional editável (upsert por slug) ──
  if (type === 'save_prompt') {
    const { slug, titulo, conteudo, atualizado_por } = body;
    if (!slug) return json({ error: 'slug obrigatório' }, 400, request);
    try {
      const agora = new Date().toISOString();
      await env.DB.prepare(`
        INSERT INTO voxia_prompts (slug, titulo, conteudo, atualizado_por, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(slug) DO UPDATE SET
          titulo=excluded.titulo, conteudo=excluded.conteudo,
          atualizado_por=excluded.atualizado_por, updated_at=excluded.updated_at
      `).bind(slug, titulo || '', conteudo || '', atualizado_por || null, agora).run();
      return json({ ok: true, slug, updated_at: agora }, 200, request);
    } catch (e) {
      return json({ error: e.message }, 500, request);
    }
  }

  // ── AI CLASSIFY — Proxy para Gemini (Google) ──
  if (type === 'ai_classify') {
    const { prompt, maxTokens, system, model = 'gemini-2.5-flash' } = body;
    if (!prompt) return json({ error: 'prompt obrigatório' }, 400, request);
    if (!env.GEMINI_API_KEY) return json({ error: 'GEMINI_API_KEY não configurada' }, 500, request);

    const textoCompleto = system ? `${system}\n\n${prompt}` : prompt;

    // Sempre v1beta — suporta todos os modelos incluindo preview e gemma
    const cleanModel = model.replace(/^models\//, '');
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent?key=${env.GEMINI_API_KEY}`;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: textoCompleto }] }],
          generationConfig: {
            maxOutputTokens: maxTokens || 4000,
            temperature: 0.1,        // baixo = mais determinístico para classificação
            responseMimeType: 'text/plain',
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.error?.message || `Erro Gemini ${res.status}`;
        return json({ error: errMsg }, res.status, request);
      }
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return json({ ok: true, content: text }, 200, request);
    } catch (e) {
      return json({ error: e.message }, 500, request);
    }
  }

  // ── SAVE/UPDATE PROJECT ──
  const { 
    token, cliente, titulo, status, criado_por,
    booleans, temas, stats, attrs, attr_results, attr_rows, slides,
    total_slides, total_respostas 
  } = body;
  
  if (!criado_por) return json({ error: 'criado_por obrigatório' }, 400, request);

  try {
    const agora = new Date().toISOString();
    let existing = null;
    if (token) {
      existing = await env.DB.prepare('SELECT id FROM voxia_reports WHERE token = ?').bind(token).first();
    }

    if (existing) {
      await env.DB.prepare(`
        UPDATE voxia_reports 
        SET cliente=?, titulo=?, status=?, booleans=?, temas=?, stats=?, attrs=?, attr_results=?, attr_rows=?, slides=?, total_slides=?, total_respostas=?, updated_at=?
        WHERE token=?
      `).bind(
        cliente, titulo, status, 
        booleans, temas, stats, attrs, attr_results, attr_rows || '[]', slides, 
        total_slides, total_respostas, 
        agora, token
      ).run();
      return json({ ok: true, token, updated: true }, 200, request);
    } else {
      const newToken = token || Math.random().toString(36).substring(2, 15);
      await env.DB.prepare(`
        INSERT INTO voxia_reports (
          token, cliente, titulo, status, booleans, temas, stats, attrs, attr_results, attr_rows, slides, total_slides, total_respostas, criado_por, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        newToken, cliente, titulo, status, 
        booleans, temas, stats, attrs, attr_results, attr_rows || '[]', slides, 
        total_slides, total_respostas, 
        criado_por, agora, agora
      ).run();
      return json({ ok: true, token: newToken, created: true }, 201, request);
    }
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE ───────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return json({ error: 'token obrigatório' }, 400, request);
  try {
    await env.DB.prepare('DELETE FROM voxia_reports WHERE token = ?').bind(token).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
