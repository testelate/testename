// functions/api/irx/classificacao.js — HUB.nexus · Pipeline IRX
// GET  /api/irx/classificacao?projeto_id=N            → lista resumida (sidebar)
// GET  /api/irx/classificacao?id=N                    → registro completo
// GET  /api/irx/classificacao?projeto_id=N&action=export → todos os campos
// POST /api/irx/classificacao  { batch:true, projeto_id, rows:[] } → import em lote
// POST /api/irx/classificacao  { id, projeto_id, nome, ... }       → upsert individual
// DELETE /api/irx/classificacao?projeto_id=N          → limpa projeto

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};
const json = (d, s=200) => new Response(JSON.stringify(d), { status: s, headers: CORS });

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url        = new URL(request.url);
  const projeto_id = url.searchParams.get('projeto_id');
  const id         = url.searchParams.get('id');
  const action     = url.searchParams.get('action');

  try {
    if (id) {
      const row = await env.DB
        .prepare('SELECT * FROM irx_classificacao WHERE id = ?')
        .bind(id).first();
      return json(row ?? null);
    }
    if (!projeto_id) return json({ error: '"projeto_id" obrigatório' }, 400);

    if (action === 'export') {
      const { results } = await env.DB
        .prepare('SELECT * FROM irx_classificacao WHERE projeto_id = ? ORDER BY recomendacao_irx, nome')
        .bind(projeto_id).all();
      return json(results);
    }

    // Lista resumida para sidebar
    const { results } = await env.DB
      .prepare(`SELECT id, projeto_id, nome, username, plataforma, seguidores, tematica, bloco,
                       recomendacao_irx, score_bw, status
                FROM irx_classificacao WHERE projeto_id = ?
                ORDER BY score_bw DESC, nome`)
      .bind(projeto_id).all();
    return json(results);

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── POST ─────────────────────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  try {
    // ── Import em lote ────────────────────────────────────────
    if (body.batch && Array.isArray(body.rows)) {
      const { projeto_id, rows } = body;
      if (!projeto_id) return json({ error: '"projeto_id" obrigatório' }, 400);

      const stmt = env.DB.prepare(`
        INSERT INTO irx_classificacao (
          projeto_id, username, nome, fonte, plataforma, score_bw,
          username_instagram, username_tiktok, username_linkedin,
          bio, localizacao, seguidores, seguidores_ig, seguidores_tiktok, seguidores_linkedin,
          te_ig, te_tiktok, n_posts_bw, total_interacoes_bw, titulos_amostra_bw,
          qualidade, tipo_perfil, ipn_estimado, recomendacao_irx, justificativa,
          redes, url_perfil, bloco, tematica
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(projeto_id, nome) DO UPDATE SET
          plataforma         = COALESCE(NULLIF(excluded.plataforma,''),         irx_classificacao.plataforma),
          score_bw           = COALESCE(NULLIF(excluded.score_bw,0),            irx_classificacao.score_bw),
          bio                = COALESCE(NULLIF(excluded.bio,''),                irx_classificacao.bio),
          seguidores         = COALESCE(NULLIF(excluded.seguidores,0),          irx_classificacao.seguidores),
          seguidores_ig      = COALESCE(NULLIF(excluded.seguidores_ig,0),       irx_classificacao.seguidores_ig),
          seguidores_tiktok  = COALESCE(NULLIF(excluded.seguidores_tiktok,0),   irx_classificacao.seguidores_tiktok),
          titulos_amostra_bw = COALESCE(NULLIF(excluded.titulos_amostra_bw,''), irx_classificacao.titulos_amostra_bw),
          tipo_perfil        = COALESCE(NULLIF(excluded.tipo_perfil,''),        irx_classificacao.tipo_perfil),
          recomendacao_irx   = COALESCE(NULLIF(excluded.recomendacao_irx,''),   irx_classificacao.recomendacao_irx),
          justificativa      = COALESCE(NULLIF(excluded.justificativa,''),      irx_classificacao.justificativa),
          redes              = COALESCE(NULLIF(excluded.redes,''),              irx_classificacao.redes),
          url_perfil         = COALESCE(NULLIF(excluded.url_perfil,''),         irx_classificacao.url_perfil),
          bloco              = excluded.bloco,
          tematica           = excluded.tematica
      `);

      let count = 0;
      for (const r of rows) {
        if (!r.nome && !r.username) continue;
        await stmt.bind(
          projeto_id,
          r.username           || r.nome || '',
          r.nome               || r.username || '',
          r.fonte              || '',
          r.plataforma         || '',
          r.score_bw           || 0,
          r.username_instagram || '',
          r.username_tiktok    || '',
          r.username_linkedin  || '',
          r.bio                || '',
          r.localizacao        || '',
          r.seguidores         || 0,
          r.seguidores_ig      || 0,
          r.seguidores_tiktok  || 0,
          r.seguidores_linkedin|| 0,
          r.te_ig              || 0,
          r.te_tiktok          || 0,
          r.n_posts_bw         || 0,
          r.total_interacoes_bw|| 0,
          r.titulos_amostra_bw || '',
          r.qualidade          || 0,
          r.tipo_perfil        || '',
          r.ipn_estimado       || '',
          r.recomendacao_irx   || '',
          r.justificativa      || '',
          r.redes              || '',
          r.url_perfil         || '',
          r.bloco              || '',
          r.tematica           || '',
        ).run();
        count++;
      }
      return json({ ok: true, imported: count }, 201);
    }

    // ── Upsert individual (salvar ficha) ──────────────────────
    const r = body;
    // Aceitar projeto_id como string ou número; nome pode vir de username
    r.projeto_id = r.projeto_id ? String(r.projeto_id) : null;
    r.nome = r.nome || r.username || '';
    if (!r.projeto_id || !r.nome)
      return json({ error: '"projeto_id" e "nome" obrigatórios — recebido: '+JSON.stringify({pid:r.projeto_id,nome:r.nome}) }, 400);

    if (r.id) {
      // Update por id (mais seguro)
      await env.DB.prepare(`
        UPDATE irx_classificacao SET
          status                 = ?,
          regiao                 = ?,
          uf                     = ?,
          tier                   = ?,
          tipo_perfil            = ?,
          abordagem              = ?,
          bio                    = ?,
          posicionamento_redes   = ?,
          validacao_ideologica   = ?,
          historico_profissional = ?,
          recomendacoes          = ?,
          assuntos_sensiveis     = ?,
          outros_links           = ?,
          justificativa_exclusao = ?,
          foto_url               = ?,
          tematica               = ?,
          bloco                  = ?,
          atualizado_em          = datetime('now')
        WHERE id = ?
      `).bind(
        r.status                 || 'pendente',
        r.regiao                 || '',
        r.uf                     || '',
        r.tier                   || '',
        r.tipo_perfil            || '',
        r.abordagem              || '',
        r.bio                    || '',
        r.posicionamento_redes   || '',
        r.validacao_ideologica   || '',
        r.historico_profissional || '',
        r.recomendacoes          || '',
        r.assuntos_sensiveis     || '',
        r.outros_links           || '',
        r.justificativa_exclusao || '',
        r.foto_url               || '',
        r.tematica               || '',
        r.bloco                  || '',
        r.id,
      ).run();
    } else {
      // Upsert por nome
      await env.DB.prepare(`
        INSERT INTO irx_classificacao (projeto_id, nome, status, regiao, uf, tier,
          tipo_perfil, abordagem, validacao_ideologica, historico_profissional,
          posicionamento_redes, recomendacoes, assuntos_sensiveis, outros_links)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON CONFLICT(projeto_id, nome) DO UPDATE SET
          status                 = excluded.status,
          regiao                 = excluded.regiao,
          uf                     = excluded.uf,
          tier                   = excluded.tier,
          tipo_perfil            = excluded.tipo_perfil,
          abordagem              = excluded.abordagem,
          validacao_ideologica   = excluded.validacao_ideologica,
          historico_profissional = excluded.historico_profissional,
          posicionamento_redes   = excluded.posicionamento_redes,
          recomendacoes          = excluded.recomendacoes,
          assuntos_sensiveis     = excluded.assuntos_sensiveis,
          outros_links           = excluded.outros_links,
          atualizado_em          = datetime('now')
      `).bind(
        r.projeto_id, r.nome,
        r.status || 'pendente', r.regiao || '', r.uf || '', r.tier || '',
        r.tipo_perfil || '', r.abordagem || '',
        r.validacao_ideologica || '', r.historico_profissional || '',
        r.posicionamento_redes || '', r.recomendacoes || '',
        r.assuntos_sensiveis || '', r.outros_links || '',
      ).run();
    }

    return json({ ok: true });

  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── DELETE ────────────────────────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url = new URL(request.url);
  const projeto_id = url.searchParams.get('projeto_id');
  const id = url.searchParams.get('id');
  if (!projeto_id && !id) return json({ error: 'projeto_id ou id obrigatório' }, 400);
  try {
    if (id) await env.DB.prepare('DELETE FROM irx_classificacao WHERE id = ?').bind(id).run();
    else     await env.DB.prepare('DELETE FROM irx_classificacao WHERE projeto_id = ?').bind(projeto_id).run();
    return json({ ok: true });
  } catch (e) { return json({ error: e.message }, 500); }
}
