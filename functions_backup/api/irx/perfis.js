// functions/api/irx/perfis.js — HUB.nexus · Pipeline IRX
// Gerencia os perfis que passaram pelo pipeline de seleção.
//
// GET    /api/irx/perfis                  → lista perfis (filtros via query)
// GET    /api/irx/perfis?id=123           → perfil específico
// POST   /api/irx/perfis                  → cria / upsert em lote
// PUT    /api/irx/perfis                  → atualiza campos de um perfil
// DELETE /api/irx/perfis?id=123           → remove perfil

function cors(request) {
  const origin  = request.headers.get('Origin') || '';
  const allowed = origin.includes('hub-nexus') || origin.includes('pages.dev') || origin.includes('localhost');
  return {
    'Access-Control-Allow-Origin':  allowed ? origin : 'https://hub-nexus.pages.dev',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

const json = (data, status = 200, req) =>
  new Response(JSON.stringify(data), { status, headers: cors(req) });

export async function onRequestOptions({ request }) {
  return new Response(null, { status: 204, headers: cors(request) });
}

// ── Deserializar campos JSON armazenados como TEXT ────────────
function deserialize(row) {
  if (!row) return row;
  return {
    ...row,
    flag_cv_alto: Boolean(row.flag_cv_alto),
    flag_inativo: Boolean(row.flag_inativo),
  };
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url    = new URL(request.url);
  const id     = url.searchParams.get('id');
  const seg    = url.searchParams.get('segmento');
  const etapa  = url.searchParams.get('etapa');
  const runId  = url.searchParams.get('run_id');
  const limit  = parseInt(url.searchParams.get('limit') || '500');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    // Perfil único
    if (id) {
      const row = await env.DB
        .prepare('SELECT * FROM irx_perfis WHERE id = ?')
        .bind(id).first();
      if (!row) return json({ error: 'Perfil não encontrado' }, 404, request);
      return json(deserialize(row), 200, request);
    }

    // Lista com filtros opcionais
    let q     = 'SELECT * FROM irx_perfis WHERE 1=1';
    const params = [];

    if (seg)   { q += ' AND segmento = ?';        params.push(seg); }
    if (etapa) { q += ' AND etapa = ?';            params.push(etapa); }
    if (runId) { q += ' AND pipeline_run_id = ?';  params.push(runId); }

    q += ' ORDER BY score_bw DESC, created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results } = await env.DB.prepare(q).bind(...params).all();

    // Contar total para paginação
    let qCount = 'SELECT COUNT(*) as total FROM irx_perfis WHERE 1=1';
    const countParams = params.slice(0, -2); // remove limit/offset
    if (seg)   qCount += ' AND segmento = ?';
    if (etapa) qCount += ' AND etapa = ?';
    if (runId) qCount += ' AND pipeline_run_id = ?';
    const { total } = await env.DB.prepare(qCount).bind(...countParams).first();

    return json({
      results: results.map(deserialize),
      total,
      limit,
      offset,
    }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── POST — upsert em lote ─────────────────────────────────────
// Body: { perfis: [...], run_id: "uuid", segmento: "..." }
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { perfis, run_id = '', segmento = '' } = body;
  if (!Array.isArray(perfis) || !perfis.length)
    return json({ error: '"perfis" deve ser array não-vazio' }, 400, request);

  const UPSERT = `
    INSERT INTO irx_perfis (
      username, nome, plataforma, segmento, fonte,
      username_instagram, url_instagram, username_tiktok, url_tiktok,
      n_posts_bw, total_interacoes_bw, media_interacoes_bw, seguidores_bw,
      score_bw, cv_engajamento, flag_cv_alto, flag_inativo, titulos_amostra,
      seguidores_ig, te_ig, seguidores_tiktok, te_tiktok, localizacao, bio,
      ia_qualidade, ia_tipo_perfil, ia_ipn_estimado, ia_recomendacao, ia_justificativa,
      etapa, obs, tea, ipn, credibilidade, sas_score, pipeline_run_id, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(username, segmento) DO UPDATE SET
      nome               = excluded.nome,
      plataforma         = excluded.plataforma,
      fonte              = excluded.fonte,
      username_instagram = excluded.username_instagram,
      url_instagram      = excluded.url_instagram,
      username_tiktok    = excluded.username_tiktok,
      url_tiktok         = excluded.url_tiktok,
      n_posts_bw         = excluded.n_posts_bw,
      total_interacoes_bw= excluded.total_interacoes_bw,
      media_interacoes_bw= excluded.media_interacoes_bw,
      seguidores_bw      = excluded.seguidores_bw,
      score_bw           = excluded.score_bw,
      cv_engajamento     = excluded.cv_engajamento,
      flag_cv_alto       = excluded.flag_cv_alto,
      flag_inativo       = excluded.flag_inativo,
      titulos_amostra    = excluded.titulos_amostra,
      seguidores_ig      = excluded.seguidores_ig,
      te_ig              = excluded.te_ig,
      seguidores_tiktok  = excluded.seguidores_tiktok,
      te_tiktok          = excluded.te_tiktok,
      localizacao        = excluded.localizacao,
      bio                = excluded.bio,
      ia_qualidade       = excluded.ia_qualidade,
      ia_tipo_perfil     = excluded.ia_tipo_perfil,
      ia_ipn_estimado    = excluded.ia_ipn_estimado,
      ia_recomendacao    = excluded.ia_recomendacao,
      ia_justificativa   = excluded.ia_justificativa,
      pipeline_run_id    = excluded.pipeline_run_id,
      updated_at         = datetime('now')
  `;

  try {
    const stmts = perfis.map(p =>
      env.DB.prepare(UPSERT).bind(
        String(p.username           || ''),
        String(p.nome               || ''),
        String(p.plataforma         || ''),
        String(p.segmento           || segmento),
        String(p.fonte              || ''),
        String(p.username_instagram || ''),
        String(p.url_instagram      || ''),
        String(p.username_tiktok    || ''),
        String(p.url_tiktok         || ''),
        Number(p.n_posts_bw         || 0),
        Number(p.total_interacoes_bw|| 0),
        Number(p.media_interacoes_bw|| 0),
        Number(p.seguidores_bw      || 0),
        Number(p.score_bw           || 0),
        Number(p.cv_engajamento     || 0),
        p.flag_cv_alto ? 1 : 0,
        p.flag_inativo ? 1 : 0,
        String(p.titulos_amostra    || ''),
        Number(p.seguidores_ig      || 0),
        Number(p.te_ig              || 0),
        Number(p.seguidores_tiktok  || 0),
        Number(p.te_tiktok          || 0),
        String(p.localizacao        || ''),
        String(p.bio                || ''),
        Number(p.ia_qualidade       || 0),
        String(p.ia_tipo_perfil     || ''),
        String(p.ia_ipn_estimado    || ''),
        String(p.ia_recomendacao    || ''),
        String(p.ia_justificativa   || ''),
        String(p.etapa              || 'etapa1'),
        String(p.obs                || ''),
        Number(p.tea                || 0),
        Number(p.ipn                || 0),
        Number(p.credibilidade      || 0),
        Number(p.sas_score          || 0),
        String(run_id),
      )
    );

    // D1 batch (até 100 statements por vez)
    const CHUNK = 100;
    let salvos = 0;
    for (let i = 0; i < stmts.length; i += CHUNK) {
      await env.DB.batch(stmts.slice(i, i + CHUNK));
      salvos += Math.min(CHUNK, stmts.length - i);
    }

    return json({ ok: true, salvos }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── PUT — atualizar campos de um perfil ───────────────────────
// Body: { id, ...campos }
export async function onRequestPut({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400, request); }

  const { id, ...campos } = body;
  if (!id) return json({ error: '"id" obrigatório' }, 400, request);

  // Campos permitidos para atualização manual
  const ALLOWED = new Set([
    'etapa', 'obs', 'tea', 'ipn', 'credibilidade', 'sas_score',
    'ia_qualidade', 'ia_tipo_perfil', 'ia_ipn_estimado',
    'ia_recomendacao', 'ia_justificativa',
    'nome', 'plataforma', 'segmento', 'bio', 'localizacao',
  ]);

  const sets   = [];
  const values = [];
  for (const [k, v] of Object.entries(campos)) {
    if (ALLOWED.has(k)) {
      sets.push(`${k} = ?`);
      values.push(v);
    }
  }

  if (!sets.length) return json({ error: 'Nenhum campo válido para atualizar' }, 400, request);

  sets.push("updated_at = datetime('now')");
  values.push(id);

  try {
    const { meta } = await env.DB
      .prepare(`UPDATE irx_perfis SET ${sets.join(', ')} WHERE id = ?`)
      .bind(...values)
      .run();

    if (meta.changes === 0) return json({ error: 'Perfil não encontrado' }, 404, request);
    return json({ ok: true }, 200, request);

  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const id  = url.searchParams.get('id');
  if (!id) return json({ error: '"id" obrigatório' }, 400, request);

  try {
    await env.DB.prepare('DELETE FROM irx_perfis WHERE id = ?').bind(id).run();
    return json({ ok: true }, 200, request);
  } catch (e) {
    return json({ error: e.message }, 500, request);
  }
}
