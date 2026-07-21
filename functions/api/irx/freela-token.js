// functions/api/irx/freela-token.js — HUB.nexus · Pipeline IRX
// Gerenciamento de tokens de acesso para freelas.
//
// GET  /api/irx/freela-token?token=XXX        → valida token, retorna { projeto_id, nome_freela }
// GET  /api/irx/freela-token?projeto_id=N     → lista tokens de um projeto
// POST /api/irx/freela-token { projeto_id, nome_freela } → cria token, retorna { token }
// DELETE /api/irx/freela-token?token=XXX      → desativa token

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: CORS });

// Gera token aleatório de 24 caracteres alfanuméricos
function gerarToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 24 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

// ── GET ───────────────────────────────────────────────────────
export async function onRequestGet({ request, env }) {
  const url        = new URL(request.url);
  const token      = url.searchParams.get('token');
  const projeto_id = url.searchParams.get('projeto_id');

  try {
    // Validação de token (usado pela página freela)
    if (token) {
      const row = await env.DB
        .prepare('SELECT projeto_id, nome_freela, ativo FROM irx_freela_tokens WHERE token = ?')
        .bind(token).first();
      if (!row) return json({ error: 'Token inválido' }, 404);
      if (!row.ativo) return json({ error: 'Token desativado' }, 403);
      return json({ ok: true, projeto_id: row.projeto_id, nome_freela: row.nome_freela });
    }

    // Listar tokens de um projeto (painel interno)
    if (projeto_id) {
      const { results } = await env.DB
        .prepare('SELECT id, token, nome_freela, ativo, criado_em FROM irx_freela_tokens WHERE projeto_id = ? ORDER BY criado_em DESC')
        .bind(projeto_id).all();
      return json(results);
    }

    return json({ error: '"token" ou "projeto_id" obrigatório' }, 400);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── POST — cria novo token ────────────────────────────────────
export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'JSON inválido' }, 400); }

  const { projeto_id, nome_freela = '' } = body;
  if (!projeto_id) return json({ error: '"projeto_id" obrigatório' }, 400);

  try {
    const token = gerarToken();
    await env.DB
      .prepare('INSERT INTO irx_freela_tokens (token, projeto_id, nome_freela) VALUES (?,?,?)')
      .bind(token, projeto_id, nome_freela).run();
    return json({ ok: true, token }, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ── DELETE — desativa token ───────────────────────────────────
export async function onRequestDelete({ request, env }) {
  const url   = new URL(request.url);
  const token = url.searchParams.get('token');
  const id    = url.searchParams.get('id');

  if (!token && !id) return json({ error: '"token" ou "id" obrigatório' }, 400);

  try {
    if (id) {
      await env.DB.prepare('UPDATE irx_freela_tokens SET ativo = 0 WHERE id = ?').bind(id).run();
    } else {
      await env.DB.prepare('UPDATE irx_freela_tokens SET ativo = 0 WHERE token = ?').bind(token).run();
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}
