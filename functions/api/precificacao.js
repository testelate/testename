// functions/api/precificacao.js — HUB.nexus
// Calculadora de Precificação Comercial (Cloudflare Pages + D1)

const CORS = {
  'Access-Control-Allow-Origin':  'https://hub-nexus.pages.dev',
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

// ── GET — Histórico de precificações salvas ───────────────────────────────
export async function onRequestGet({ env }) {
  try {
    const { results } = await env.DB
      .prepare(`SELECT * FROM precificacao ORDER BY data_calculo DESC`)
      .all();
    return json(results || []);
  } catch (e) {
    return json({ error: 'Falha ao buscar precificações', detalhe: e.message }, 500);
  }
}

// ── POST — Salva nova precificação ────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  try {
    const {
      projeto_id,
      tipo_modelo,
      receita_bruta,
      impostos,
      custo_pessoal,
      custo_pjs,
      despesas_gerais,
      receita_liquida,
      margem_contribuicao_pct,
      status_aprovacao,
    } = await request.json();

    if (!tipo_modelo) {
      return json({ error: 'Tipo de modelo é obrigatório.' }, 400);
    }

    const result = await env.DB
      .prepare(`
        INSERT INTO precificacao (
          projeto_id,
          tipo_modelo,
          receita_bruta,
          impostos,
          custo_pessoal,
          custo_pjs,
          despesas_gerais,
          receita_liquida,
          margem_contribuicao_pct,
          status_aprovacao,
          data_calculo
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      `)
      .bind(
        projeto_id              || null,
        tipo_modelo.trim(),
        parseFloat(receita_bruta)           || 0,
        parseFloat(impostos)                || 0,
        parseFloat(custo_pessoal)           || 0,
        parseFloat(custo_pjs)               || 0,
        parseFloat(despesas_gerais)         || 0,
        parseFloat(receita_liquida)         || 0,
        parseFloat(margem_contribuicao_pct) || 0,
        (status_aprovacao || 'pendente_diretoria').trim(),
      )
      .run();

    return json({ ok: true, id: result.meta?.last_row_id });
  } catch (e) {
    return json({ error: 'Falha ao salvar precificação', detalhe: e.message }, 500);
  }
}
