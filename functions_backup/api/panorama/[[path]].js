// functions/api/panorama/[[path]].js — HUB.nexus Gerador de Panoramas com Gemini (Modelo: 2.5-flash-lite)
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestGet({ request, env }) {
  const cliente = new URL(request.url).searchParams.get('cliente');
  try {
    const stmt = cliente
      ? env.DB.prepare('SELECT * FROM panoramas WHERE cliente = ? ORDER BY created_at DESC LIMIT 20').bind(cliente)
      : env.DB.prepare('SELECT * FROM panoramas ORDER BY created_at DESC LIMIT 50');
    const { results } = await stmt.all();
    return json(results.map(r => ({
      ...r,
      narrativas: tryParse(r.narrativas, []),
      top_posts:  tryParse(r.top_posts,  []),
    })));
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

function tryParse(str, fallback) {
  try { return JSON.parse(str); } catch { return fallback; }
}

export async function onRequestPost({ request, env }) {
  const url  = new URL(request.url);
  const path = url.pathname;

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }

  if (path.endsWith('/salvar')) {
    const { cliente, periodo, mencoes, alcance, interacoes, narrativas, top_posts, texto_gerado, gerado_por } = body;
    if (!cliente) return json({ error: 'cliente obrigatório' }, 400);
    try {
      const { meta } = await env.DB.prepare(`
        INSERT INTO panoramas (cliente, periodo, mencoes, alcance, interacoes, narrativas, top_posts, texto_gerado, gerado_por)
        VALUES (?,?,?,?,?,?,?,?,?)
      `).bind(
        cliente, periodo || '', mencoes || 0, alcance || 0, interacoes || 0,
        JSON.stringify(narrativas || []), JSON.stringify(top_posts || []),
        texto_gerado || '', gerado_por || ''
      ).run();
      return json({ ok: true, id: meta.last_row_id }, 201);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  }

  if (path.endsWith('/gerar')) {
    const { dados, cliente, panorama_anterior } = body;
    if (!dados) return json({ error: 'dados obrigatório' }, 400);

    const KEY = env.GEMINI_API_KEY;
    if (!KEY) return json({ error: 'GEMINI_API_KEY não configurada' }, 500);

    let panAnterior = panorama_anterior;
    if (!panAnterior && cliente) {
      const ant = await env.DB.prepare('SELECT * FROM panoramas WHERE cliente = ? ORDER BY created_at DESC LIMIT 1').bind(cliente).first();
      if (ant) panAnterior = { mencoes: ant.mencoes, alcance: ant.alcance, interacoes: ant.interacoes, texto: ant.texto_gerado };
    }

    const comparacaoPrompt = panAnterior ? `
DADOS DO RECORTE ANTERIOR (Para cálculo de variação %):
- Menções: ${panAnterior.mencoes}
- Alcance: ${panAnterior.alcance}
- Interações: ${panAnterior.interacoes}` : '';

    const prompt = `Você é o Ekklesia, assistente de inteligência da Nexus. Gere um Panorama de Redes PROFISSIONAL e ESTRATÉGICO seguindo EXATAMENTE o modelo abaixo.

MODELO DE RESPOSTA (Siga rigorosamente):
📲 *PANORAMA DE REDES* (Título focado no tema principal)
*Subtítulo resumindo o sentimento ou desdobramento principal em uma frase.*
_Recorte: ${body.periodo || 'Não informado'}_

📊 *Números gerais*
* O tema acumula *[TOTAL_MENÇÕES]* publicações, com *alcance potencial de [TOTAL_ALCANCE]*.
* Neste recorte, houve *[NOVAS_MENÇÕES]* novas menções, que atingiram *[ALCANCE_RECORTE]* perfis em potencial.
* As publicações somam *[CURTIDAS]* reações, *[COMENTÁRIOS]* comentários e *[SHARES]* compartilhamentos.
* [VARIAÇÃO em % em relação ao recorte anterior (Crescimento/Queda de X%) - Só se houver dados anteriores]

🤳 *Redes*
[Lista de Redes e % de participação, ex: * X (74%)]

🗓 *Principais narrativas*
[Mínimo 5 bullet points detalhados e analíticos sobre o que foi dito, citando veículos ou perfis se houver nos dados]

⚠ *Trending Topics*
* [Status sobre TTs (Assunto não aparece/Aparece em X posição)]

🛜 *Publicadores Maior Alcance*
[Lista 1 a 10 com Nome e Link]

🔁 *Publicadores Maior Engajamento*
[Lista 1 a 10 com Nome e Link]

---
DADOS PARA ANÁLISE:
${typeof dados === 'string' ? dados : JSON.stringify(dados)}
${comparacaoPrompt}
CLIENTE: ${cliente || 'N/D'}

REGRAS ADICIONAIS:
1. Use separadores de milhar como ponto (11.939) e decimais como vírgula (2,5).
2. Converta números grandes (bilhões, milhões) por extenso.
3. Se não houver link para um publicador, ignore-o na lista.
4. O tom deve ser corporativo, direto e sem introduções ou conclusões (apenas o panorama).`;

    try {
      // Usando o ID exato que está no seu arquivo claude.js
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${KEY}`;
      
      const aiRes = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { 
            temperature: 0.2, 
            maxOutputTokens: 2048 
          }
        }),
      });

      if (!aiRes.ok) {
        const fullErr = await aiRes.json().catch(() => ({}));
        return json({ error: `Erro na API Gemini: ${JSON.stringify(fullErr.error || aiRes.status)}` }, 500);
      }

      const aiData = await aiRes.json();
      const texto  = aiData.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      return json({ ok: true, texto });

    } catch (e) {
      return json({ error: `Erro no Worker: ${e.message}` }, 500);
    }
  }

  return json({ error: 'Rota não encontrada' }, 404);
}
