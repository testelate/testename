// ══════════════════════════════════════════════════════════════
//  /api/guruquest-parse
//  Recebe texto extraído de TXT/DOCX/PDF e retorna JSON
//  estruturado do questionário via Gemini.
//  Cloudflare Pages Functions · env.GEMINI_API_KEY
// ══════════════════════════════════════════════════════════════

function cors(request) {
  const origin = request?.headers?.get('Origin') || '';
  const allowed =
    origin === 'https://hub-nexus.pages.dev' ||
    origin.endsWith('.hub-nexus.pages.dev') ||
    origin.endsWith('.pages.dev') ||
    origin.startsWith('http://localhost');
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://hub-nexus.pages.dev',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type':                 'application/json',
  };
}

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request) });
}

export async function onRequestPost({ request, env }) {
  const CORS = cors(request);

  // ── Valida corpo ──────────────────────────────────────────
  let body;
  try { body = await request.json(); }
  catch { return resp({ error: 'JSON inválido' }, 400, CORS); }

  const { text, filename = 'arquivo' } = body || {};
  if (!text?.trim()) return resp({ error: 'Campo text obrigatório' }, 400, CORS);

  if (!env.GEMINI_API_KEY)
    return resp({ error: 'GEMINI_API_KEY não configurada' }, 500, CORS);

  // ── Prompt de parse ───────────────────────────────────────
  const prompt = `Você é um especialista em pesquisa de opinião e questionários.
Analise o texto abaixo (extraído do arquivo "${filename}") e retorne um JSON com EXATAMENTE esta estrutura — sem texto fora do JSON, sem markdown, sem blocos de código:

{
  "titulo": "Título do questionário",
  "tag": "Tracking de Marca | Eleitoral | Pós-teste | B2B | Mapa | Outro",
  "cliente": "Nome do cliente ou empresa contratante",
  "metodo": "Ex: Quantitativa · CATI, Qualitativa · Entrevistas, Quantitativa · Online/CAWI",
  "duracao": "Ex: ~15 min",
  "descricao": "Objetivo e escopo da pesquisa em 1-2 frases",
  "ano": 2024,
  "blocos": [
    {
      "titulo": "Nome do bloco ou seção (ex: I — Filtros, II — Perfil)",
      "questoes": [
        {
          "num": "P1",
          "texto": "Texto completo da pergunta",
          "tipo": "ru | rm | esp | esc | ab",
          "opcoes": ["Opção 1", "Opção 2"],
          "instrucao": "INSTRUÇÃO EM CAIXA ALTA (omitir se não houver)"
        }
      ]
    }
  ]
}

Tipos de questão:
- ru  = resposta única (escolhe 1 opção)
- rm  = resposta múltipla (pode escolher várias)
- esp = espontânea (resposta livre, sem lista de opções)
- esc = escala (numérica ou likert)
- ab  = aberta (dissertativa)

Regras:
- Preserve numeração original das perguntas (P1, PF1, E1, QB1, etc.)
- Inclua todas as opções de resposta que existirem no texto
- Agrupe as questões nos blocos/seções tal como aparecem no documento
- Se o ano não estiver explícito, use ${new Date().getFullYear()}
- Se não houver título claro, crie um a partir do tema/cliente identificado
- Retorne SOMENTE o JSON, sem nenhum texto antes ou depois

Texto do arquivo:
${text.slice(0, 18000)}`;

  // ── Chama Gemini ──────────────────────────────────────────
  const geminiUrl =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${env.GEMINI_API_KEY}`;

  let geminiResp;
  try {
    geminiResp = await fetch(geminiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 8192,
          temperature:     0.1,   // baixo para parse determinístico
        },
      }),
    });
  } catch (e) {
    return resp({ error: 'Falha ao contactar Gemini: ' + e.message }, 502, CORS);
  }

  const geminiData = await geminiResp.json();

  if (!geminiResp.ok) {
    const msg = geminiData?.error?.message || JSON.stringify(geminiData.error) || 'Erro Gemini';
    return resp({ error: msg }, geminiResp.status, CORS);
  }

  const raw = geminiData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';

  // ── Extrai e valida JSON ──────────────────────────────────
  let parsed = null;
  // Tenta direto, depois procura bloco JSON na resposta
  for (const src of [raw, raw.match(/```(?:json)?\s*([\s\S]*?)```/)?.[1], raw.match(/\{[\s\S]*\}/)?.[0]]) {
    if (!src) continue;
    try { parsed = JSON.parse(src.trim()); break; } catch {}
  }

  if (!parsed?.titulo || !Array.isArray(parsed?.blocos)) {
    return resp({ error: 'Gemini não retornou JSON válido de questionário', raw: raw.slice(0, 500) }, 422, CORS);
  }

  // Calcula nQuestoes
  parsed.nQuestoes = (parsed.blocos || []).reduce((a, b) => a + (b.questoes?.length || 0), 0);

  return resp({ ok: true, data: parsed }, 200, CORS);
}

function resp(data, status, headers) {
  return new Response(JSON.stringify(data), { status, headers });
}
