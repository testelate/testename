// api/claude.js — HUB.nexus Gemini API proxy (Cloudflare Pages)
// POST /api/claude  { prompt, maxTokens?, system? }

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = origin === 'https://hub-nexus.pages.dev'
    || origin.endsWith('.hub-nexus.pages.dev')
    || origin.endsWith('.pages.dev');  // preview deploys do Cloudflare
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://hub-nexus.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
}
export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: getCorsHeaders(request) });
}
export async function onRequestPost({ request, env }) {
  const CORS = getCorsHeaders(request);
  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS }); }
  const { prompt, maxTokens, system, model = 'gemini-1.5-flash' } = body || {};
  if (!prompt) return new Response(JSON.stringify({ error: 'prompt obrigatório' }), { status: 400, headers: CORS });
  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada' }), { status: 500, headers: CORS });
  }
  const textoCompleto = system ? `${system}\n\n${prompt}` : prompt;
  const payload = {
    contents: [{ parts: [{ text: textoCompleto }] }],
    generationConfig: { maxOutputTokens: maxTokens || 4000 },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = typeof data.error === 'object' ? JSON.stringify(data.error) : (data.error || 'Erro na API');
    return new Response(JSON.stringify({ error: msg }), { status: res.status, headers: CORS });
  }
  const content = data.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  return new Response(JSON.stringify({ ok: true, content }), { status: 200, headers: CORS });
}
