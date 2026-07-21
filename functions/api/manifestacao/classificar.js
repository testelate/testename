// functions/api/manifestacao/classificar.js — HUB.nexus (Cloudflare Pages Functions)
// POST /api/manifestacao/classificar
// body: { texto: string, portaVozes: string[], model?: string }
//
// Porta a lógica de classificação do "Detector de Manifestação" (antes um
// backend Node/Express isolado com Gemini chamado direto do frontend) para
// dentro do HUB.nexus, seguindo o mesmo padrão dos outros proxies de IA do
// hub (ver functions/api/claude.js). Sem estado em memória: cada linha da
// planilha é classificada com uma chamada isolada — o upload, a revisão e a
// exportação ficam 100% no frontend (pages/manifestacao.html), igual ao
// resto do hub (XLSX é sempre lido/gerado no browser).

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = origin === 'https://hub-nexus.pages.dev'
    || origin.endsWith('.hub-nexus.pages.dev')
    || origin.endsWith('.pages.dev');
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

function buildPrompt(listaPortaVozes, texto) {
  const lista = listaPortaVozes.map((p) => `- ${p}`).join('\n');

  return `Você é analista de monitoramento de mídia. Dada uma notícia (texto impresso/online ou TRANSCRIÇÃO de TV/rádio), identifique se cada porta-voz SE MANIFESTA (tem fala própria atribuída a ele) ou apenas é MENCIONADO (citado sem voz). Os porta-vozes podem ser de qualquer marca, empresa ou instituição (pública ou privada): executivos, porta-vozes oficiais, autoridades, especialistas, etc.


MANIFESTAÇÃO = o porta-voz FALA. Discurso atribuído a ele.
- DIRETA: trecho entre aspas atribuído ao porta-voz.
- INDIRETA: fala reportada sem aspas, ligada por verbo de declaração (disse, afirmou, declarou, destacou, ressaltou, explicou, defendeu, garantiu, segundo [nome], de acordo com [nome], em entrevista, em nota).

MENÇÃO = aparece SEM voz própria: agente de ação ("o CEO inaugurou a fábrica"), anúncio sem fala ("o anúncio foi feito pela empresa"), referência, título ou legenda.

REGRA DE OURO: ação e anúncio NÃO são fala. Só MANIFESTAÇÃO se houver conteúdo de discurso atribuído à pessoa (o que ela disse, não o que fez).

TRANSCRIÇÕES DE TV/RÁDIO: o texto pode não ter aspas e misturar vozes. NÃO confunda o REPÓRTER/APRESENTADOR (que narra, costuma abrir a matéria) com o porta-voz. Marque MANIFESTAÇÃO só quando o discurso for claramente atribuído ao porta-voz. Na dúvida entre narrador e porta-voz → MENÇÃO.

CRITÉRIO (por porta-voz, em ordem):
1. Aspas atribuídas a ele? → MANIFESTAÇÃO (Direta).
2. Verbo de declaração ligando nome/cargo a conteúdo de fala? → MANIFESTAÇÃO (Indireta).
3. Só ação, anúncio, referência, título ou narração? → MENÇÃO.

Avalie SOMENTE os porta-vozes desta lista (não acrescente outros). Cada item pode vir como "Nome, cargo" — case o nome e/ou o cargo no texto:
${lista}

Texto:
"""
${texto}
"""

Responda APENAS com JSON, sem texto antes/depois e sem crases:
{
  "porta_vozes": [
    {"nome":"...","cargo":"...","manifesta":"Sim|Não","tipo":"Direta|Indireta|Menção apenas|Ausente","trecho_evidencia":"trecho literal"}
  ],
  "algum_porta_voz_se_manifesta": "Sim|Não",
  "porta_vozes_que_falaram": "nomes separados por ; ou vazio"
}`;
}

export async function onRequestPost({ request, env }) {
  const CORS = getCorsHeaders(request);

  if (!env.GEMINI_API_KEY) {
    return new Response(JSON.stringify({ error: 'GEMINI_API_KEY não configurada no ambiente do Cloudflare Pages.' }), { status: 500, headers: CORS });
  }

  let body;
  try { body = await request.json(); }
  catch { return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS }); }

  const { texto, portaVozes, model } = body || {};
  const lista = Array.isArray(portaVozes) ? portaVozes.filter(Boolean) : [];

  if (!texto || !String(texto).trim()) {
    return new Response(JSON.stringify({ error: 'texto é obrigatório' }), { status: 400, headers: CORS });
  }
  if (lista.length === 0) {
    return new Response(JSON.stringify({ error: 'portaVozes (array não vazio) é obrigatório' }), { status: 400, headers: CORS });
  }

  const GEMINI_MODEL = model || env.GEMINI_MODEL_MANIFESTACAO || 'gemini-2.0-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;

  const payload = {
    contents: [{ parts: [{ text: buildPrompt(lista, String(texto)) }] }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
    },
  };

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `Falha de rede ao chamar Gemini: ${e.message}` }), { status: 502, headers: CORS });
  }

  if (!resp.ok) {
    const errText = await resp.text();
    return new Response(JSON.stringify({ error: `Gemini HTTP ${resp.status}: ${errText.slice(0, 200)}` }), { status: 502, headers: CORS });
  }

  const data = await resp.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  const clean = raw.replace(/```json|```/g, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(clean);
  } catch (e) {
    return new Response(JSON.stringify({ error: `Resposta do Gemini não é JSON válido: ${e.message}` }), { status: 502, headers: CORS });
  }

  return new Response(JSON.stringify({ ok: true, ...parsed }), { status: 200, headers: CORS });
}
