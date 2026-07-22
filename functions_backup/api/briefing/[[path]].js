// functions/api/briefing/[[path]].js — HUB.nexus Briefings via Cloudflare D1
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// Auxiliar para parsing de JSON do banco
function parseBriefing(b) {
  if (!b) return null;
  return {
    ...b,
    respostas: JSON.parse(b.respostas || '{}'),
    errata: JSON.parse(b.errata || '{}'),
    historico: JSON.parse(b.historico || '[]'),
    lido: b.lido === 1,
  };
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[2]; // /api/briefing/:id -> index 2

  try {
    if (id && !isNaN(parseInt(id))) {
      const result = await env.DB
        .prepare('SELECT * FROM briefings WHERE id = ?')
        .bind(id)
        .first();
      
      if (!result) return json({ error: 'Briefing não encontrado' }, 404);
      return json(parseBriefing(result));
    }

    // Caso contrário, lista todos
    const { results } = await env.DB
      .prepare('SELECT * FROM briefings ORDER BY created_at DESC')
      .all();

    return json(results.map(parseBriefing));
  } catch (e) {
    console.error('D1 GET Error:', e);
    return json({ error: 'Database GET fail: ' + e.message, code: 'D1_ERROR' }, 500);
  }
}

// ── POST ──────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { nome, email, recomendacao, respostas } = body;

  if (!email || !email.includes('@')) {
    return json({ error: 'E-mail inválido' }, 400);
  }

  try {
    const { meta } = await env.DB
      .prepare(`
        INSERT INTO briefings (nome, email, recomendacao, respostas, errata, lido)
        VALUES (?, ?, ?, ?, '{}', 0)
      `)
      .bind(
        nome || email.split('@')[0],
        email.toLowerCase().trim(),
        recomendacao || '',
        JSON.stringify(respostas || {}),
      )
      .run();

    return json({ ok: true, id: meta.last_row_id }, 201);
  } catch (e) {
    console.error('D1 POST Error:', e);
    return json({ error: 'Database POST fail: ' + e.message, code: 'D1_ERROR' }, 500);
  }
}

// ── PUT ───────────────────────────────────────────────────────
export async function onRequestPut({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[2];

  if (!id) return json({ error: 'ID obrigatório para atualização' }, 400);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  // _errata_save: client is finishing an errata correction and sending updated respostas.
  // campos_corrigidos: list of field keys the client corrected (sent explicitly by client).
  const isErrataSave = body._errata_save === true;

  const allowed = ['nome', 'email', 'recomendacao', 'respostas', 'errata', 'lido', 'transcricao', 'documento', 'historico'];
  const fields = Object.keys(body).filter(k => allowed.includes(k));

  if (!fields.length) return json({ error: 'Nenhum campo válido para atualizar' }, 400);

  try {
    if (isErrataSave) {
      const atual = await env.DB
        .prepare('SELECT respostas, errata, historico FROM briefings WHERE id = ?')
        .bind(id)
        .first();

      if (atual) {
        const historicoAtual       = JSON.parse(atual.historico || '[]');
        const errataAnterior       = JSON.parse(atual.errata    || '{}');
        // Prefer campos sent explicitly by client; fallback to what was stored in errata
        const camposPedidos = (body._campos_corrigidos && body._campos_corrigidos.length > 0)
          ? body._campos_corrigidos
          : Object.keys(errataAnterior);

        const novoSnap = {
          data:                  new Date().toISOString(),
          versao:                historicoAtual.length + 1,
          campos_corrigidos:     camposPedidos,
          respostas_anteriores:  JSON.parse(atual.respostas || '{}'),
        };
        historicoAtual.unshift(novoSnap);
        body.historico = historicoAtual;
        if (!fields.includes('historico')) fields.push('historico');
      }
    }

    const sets = fields.map(f => `${f} = ?`).join(', ');
    const values = fields.map(f => {
      if (['respostas', 'errata', 'historico'].includes(f)) return JSON.stringify(body[f]);
      if (f === 'lido') return body[f] ? 1 : 0;
      return body[f];
    });

    await env.DB
      .prepare(`UPDATE briefings SET ${sets} WHERE id = ?`)
      .bind(...values, id)
      .run();

    return json({ ok: true });
  } catch (e) {
    console.error('D1 PUT Error:', id, e);
    return json({ error: 'Database PUT fail: ' + e.message, code: 'D1_ERROR' }, 500);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split('/').filter(Boolean);
  const id = pathParts[2];

  if (!id) return json({ error: 'ID obrigatório para deleção' }, 400);

  try {
    await env.DB.prepare('DELETE FROM briefings WHERE id = ?').bind(id).run();
    return json({ ok: true });
  } catch (e) {
    console.error('D1 DELETE Error:', id, e);
    return json({ error: 'Database DELETE fail: ' + e.message, code: 'D1_ERROR' }, 500);
  }
}
