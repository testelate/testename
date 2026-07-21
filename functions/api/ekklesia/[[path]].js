// functions/api/ekklesia/[[path]].js — HUB.nexus · Ekklesia Projects Backend
//
// GET    /api/ekklesia/projetos                  → lista projetos
// POST   /api/ekklesia/projetos                  → cria projeto
// PUT    /api/ekklesia/projetos                  → atualiza projeto (config + temas_ia)
// DELETE /api/ekklesia/projetos?id=N             → remove projeto
//
// GET    /api/ekklesia/classificacoes?projeto_id=N  → classificações IA de um projeto
// POST   /api/ekklesia/classificacoes              → salva lote de classificações
// DELETE /api/ekklesia/classificacoes?projeto_id=N → limpa todas do projeto
//
// POST   /api/ekklesia/share                     → salva snapshot público → { token }
// GET    /api/ekklesia/share?token=XXX           → recupera snapshot (sem auth)
//
// GET    /api/ekklesia/embratur-preview?url=XXX  → busca og:image/twitter:image da
//                                                    URL e devolve a foto em base64
//                                                    (Diário Embratur — completar foto
//                                                    automaticamente quando a BW não trouxe)
//
// POST   /api/ekklesia/secom-auth                → gate de senha do relatório SECOM
//                                                    (mesmo esquema do embratur-auth)
//
// ── NEXUS ELEIÇÕES 2026 / PRISMA ELEITORAL ──────────────────────────
// GET/POST/DELETE /api/ekklesia/eleicoes-base    → bases de redes sociais e
//                                                    imprensa (tipo: 'redes'|'imprensa'),
//                                                    mesmo padrão do embratur-base mas
//                                                    sem partição por país (dashboard único)
// GET/POST        /api/ekklesia/eleicoes-config  → config singleton: análise IA do dia,
//                                                    tema da semana, headline
// GET/POST        /api/ekklesia/eleicoes-share   → publica/recupera o snapshot público
//                                                    (sem senha — link único e permanente)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

const json  = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });
const tryP  = (s, fb = {})        => { try { return JSON.parse(s); } catch { return fb; } };

// ── Proteção contra D1_ERROR: string or blob too big (SQLITE_TOOBIG) ──
// D1 recusa gravações de coluna/linha acima de ~1MB. Os relatórios Embratur
// guardam JSON com imagens em base64 (prints manuais), então qualquer payload
// com poucas imagens grandes ou muitos países acumulados no mesmo token pode
// estourar esse limite. As duas funções abaixo são usadas por TODOS os
// endpoints de escrita do Embratur (diário, semanal, base) para remover
// imagens grandes demais antes de gravar, com uma segunda tentativa mais
// agressiva (remove todas as imagens) caso ainda passe do limite.
function _embStripImagensGrandes(obj, maxBytes = 350_000) {
  if (Array.isArray(obj)) return obj.map(v => _embStripImagensGrandes(v, maxBytes));
  if (!obj || typeof obj !== 'object') return obj;
  const out = { ...obj };
  for (const k of ['imagem', 'img']) {
    if (typeof out[k] === 'string' && out[k].startsWith('data:') && out[k].length > maxBytes) out[k] = '';
  }
  for (const k of Object.keys(out)) out[k] = _embStripImagensGrandes(out[k], maxBytes);
  return out;
}

function _embGarantirTamanho(dados, limite = 900_000) {
  const limpo = _embStripImagensGrandes(dados);
  let str = JSON.stringify(limpo);
  if (str.length <= limite) return { dados: limpo, str, imagensRemovidas: false };
  const semImagens = _embStripImagensGrandes(dados, 0); // 0 = remove qualquer data: URI restante
  str = JSON.stringify(semImagens);
  return { dados: semImagens, str, imagensRemovidas: true };
}

function genToken() {
  const chars = 'abcdefghijkmnpqrstuvwxyz23456789';
  let t = '';
  const arr = crypto.getRandomValues(new Uint8Array(12));
  arr.forEach(b => t += chars[b % chars.length]);
  return t;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequest({ request, env }) {
  const url      = new URL(request.url);
  const segments = url.pathname.replace(/^\/api\/ekklesia\/?/, '').split('/').filter(Boolean);
  const resource = segments[0];
  const method   = request.method.toUpperCase();

  try {
    if (resource === 'projetos')       return await handleProjetos(method, url, request, env);
    if (resource === 'classificacoes') return await handleClassificacoes(method, url, request, env);
    if (resource === 'share')          return await handleShare(method, url, request, env);
    if (resource === 'embratur-share') return await handleEmbraturShare(method, url, request, env);
    if (resource === 'embratur-auth')  return await handleEmbraturAuth(method, request, env);
    if (resource === 'secom-auth')     return await handleSecomAuth(method, request, env);
    if (resource === 'embratur-preview') return await handleEmbraturPreview(method, url, env);
    if (resource === 'embratur-base')    return await handleEmbraturBase(method, url, request, env);
    if (resource === 'embratur-config')  return await handleEmbraturConfig(method, url, request, env);
    if (resource === 'embratur-diario')         return await handleEmbraturDiario(method, url, request, env);
    if (resource === 'embratur-semanal-share')  return await handleEmbraturSemanalShare(method, url, request, env);
    if (resource === 'embratur-semanal')        return await handleEmbraturSemanal(method, url, request, env);
    if (resource === 'embratur-controle')       return await handleEmbraturControle(method, url, request, env);
    if (resource === 'eleicoes-base')           return await handleEleicoesBase(method, url, request, env);
    if (resource === 'eleicoes-config')         return await handleEleicoesConfig(method, request, env);
    if (resource === 'eleicoes-share')          return await handleEleicoesShare(method, request, env);
    if (resource === 'eleicoes-pesquisa')       return await handleEleicoesPesquisa(method, url, request, env);
    return json({ error: 'Rota não encontrada' }, 404);
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}

// ════════════════════════════════════════════════════════════════
// PROJETOS
// ════════════════════════════════════════════════════════════════
async function handleProjetos(method, url, request, env) {
  const id = url.searchParams.get('id');

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ekklesia_projetos (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT    DEFAULT (datetime('now')),
      updated_at  TEXT    DEFAULT (datetime('now')),
      nome        TEXT    NOT NULL,
      cliente     TEXT    DEFAULT '',
      temas_ia    TEXT    DEFAULT '[]',
      premissa_ia TEXT    DEFAULT '',
      macro_rows  TEXT    DEFAULT '[]',
      config      TEXT    DEFAULT '{}'
    )
  `).run();

  if (method === 'GET') {
    if (id) {
      const row = await env.DB.prepare('SELECT * FROM ekklesia_projetos WHERE id = ?').bind(id).first();
      if (!row) return json({ error: 'Projeto não encontrado' }, 404);
      return json({ ...row, temas_ia: tryP(row.temas_ia, []), macro_rows: tryP(row.macro_rows, []), config: tryP(row.config, {}) });
    }
    const { results } = await env.DB.prepare('SELECT * FROM ekklesia_projetos ORDER BY updated_at DESC LIMIT 200').all();
    return json(results.map(r => ({ ...r, temas_ia: tryP(r.temas_ia, []), macro_rows: tryP(r.macro_rows, []), config: tryP(r.config, {}) })));
  }

  if (method === 'POST') {
    const body = await request.json();
    const { nome, cliente, temas_ia, premissa_ia, macro_rows, config } = body;
    if (!nome) return json({ error: 'nome obrigatório' }, 400);
    const { meta } = await env.DB.prepare(`
      INSERT INTO ekklesia_projetos (nome, cliente, temas_ia, premissa_ia, macro_rows, config) VALUES (?,?,?,?,?,?)
    `).bind(nome.trim(), cliente||'', JSON.stringify(temas_ia||[]), premissa_ia||'', JSON.stringify(macro_rows||[]), JSON.stringify(config||{})).run();
    return json({ ok: true, id: meta.last_row_id }, 201);
  }

  if (method === 'PUT') {
    const body = await request.json();
    const { id: bid, nome, cliente, temas_ia, premissa_ia, macro_rows, config } = body;
    if (!bid) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare(`
      UPDATE ekklesia_projetos SET nome=?, cliente=?, temas_ia=?, premissa_ia=?, macro_rows=?, config=?, updated_at=datetime('now') WHERE id=?
    `).bind(nome||'', cliente||'', JSON.stringify(temas_ia||[]), premissa_ia||'', JSON.stringify(macro_rows||[]), JSON.stringify(config||{}), bid).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (!id) return json({ error: 'id obrigatório' }, 400);
    await env.DB.prepare('DELETE FROM ekklesia_projetos WHERE id = ?').bind(id).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS ekklesia_classificacoes (id INTEGER PRIMARY KEY AUTOINCREMENT, projeto_id INTEGER NOT NULL, post_hash TEXT NOT NULL, tema_ia TEXT DEFAULT '', sent_ia TEXT DEFAULT 'neutro', updated_at TEXT DEFAULT (datetime('now')), UNIQUE(projeto_id, post_hash))`).run();
    await env.DB.prepare('DELETE FROM ekklesia_classificacoes WHERE projeto_id = ?').bind(id).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// CLASSIFICAÇÕES IA
// ════════════════════════════════════════════════════════════════
async function handleClassificacoes(method, url, request, env) {
  const projetoId = url.searchParams.get('projeto_id');

  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ekklesia_classificacoes (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      projeto_id  INTEGER NOT NULL,
      post_hash   TEXT    NOT NULL,
      tema_ia     TEXT    DEFAULT '',
      sent_ia     TEXT    DEFAULT 'neutro',
      updated_at  TEXT    DEFAULT (datetime('now')),
      UNIQUE(projeto_id, post_hash)
    )
  `).run();

  if (method === 'GET') {
    if (!projetoId) return json({ error: 'projeto_id obrigatório' }, 400);
    const { results } = await env.DB.prepare('SELECT * FROM ekklesia_classificacoes WHERE projeto_id = ? ORDER BY id').bind(projetoId).all();
    return json(results);
  }

  if (method === 'POST') {
    const body = await request.json();
    const entries = Array.isArray(body) ? body : [body];
    let saved = 0;
    for (const e of entries) {
      const { projeto_id, post_hash, tema_ia, sent_ia } = e;
      if (!projeto_id || !post_hash) continue;
      await env.DB.prepare(`
        INSERT INTO ekklesia_classificacoes (projeto_id, post_hash, tema_ia, sent_ia) VALUES (?,?,?,?)
        ON CONFLICT(projeto_id, post_hash) DO UPDATE SET tema_ia=excluded.tema_ia, sent_ia=excluded.sent_ia, updated_at=datetime('now')
      `).bind(projeto_id, post_hash, tema_ia||'', sent_ia||'neutro').run();
      saved++;
    }
    return json({ ok: true, saved }, 201);
  }

  if (method === 'DELETE') {
    if (!projetoId) return json({ error: 'projeto_id obrigatório' }, 400);
    await env.DB.prepare('DELETE FROM ekklesia_classificacoes WHERE projeto_id = ?').bind(projetoId).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// SHARE — snapshot particionado em colunas para evitar limite D1
//
// Tabela ekklesia_shares:
//   token       TEXT PK
//   meta        TEXT  — projeto, cliente, periodo, fontes, totais, cena, kpis, redes
//   publicacoes TEXT  — array de posts (até 1000, truncado)
//   ir2         TEXT  — ranking IR² serializado
//   nuvens      TEXT  — SVGs das nuvens por rede
//   graf        TEXT  — frames Plotly (pode ser null)
//   created_at  TEXT
// ════════════════════════════════════════════════════════════════
async function handleShare(method, url, request, env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS ekklesia_shares (
      token       TEXT PRIMARY KEY,
      meta        TEXT NOT NULL DEFAULT '{}',
      publicacoes TEXT NOT NULL DEFAULT '[]',
      ir2         TEXT NOT NULL DEFAULT '[]',
      nuvens      TEXT NOT NULL DEFAULT '[]',
      graf        TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `).run();

  // GET /api/ekklesia/share?token=XXX — público
  if (method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'token obrigatório' }, 400);
    const row = await env.DB.prepare(
      'SELECT meta, publicacoes, ir2, nuvens, graf, created_at FROM ekklesia_shares WHERE token = ?'
    ).bind(token).first();
    if (!row) return json({ error: 'Relatório não encontrado ou expirado' }, 404);

    // Remonta o snapshot a partir das colunas
    const snapshot = {
      ...tryP(row.meta, {}),
      publicacoes: tryP(row.publicacoes, []),
      ir2:         tryP(row.ir2, []),
      nuvens:      tryP(row.nuvens, []),
      grafFrames:  row.graf ? tryP(row.graf, null) : null,
    };
    return json({ ok: true, snapshot, created_at: row.created_at });
  }

  // POST /api/ekklesia/share — salva snapshot
  if (method === 'POST') {
    const body = await request.json();
    if (!body || !body.projeto) return json({ error: 'snapshot inválido' }, 400);

    // Separa em colunas
    const { publicacoes, ir2, nuvens, grafFrames, ...rest } = body;

    // Limita publicações a 1000 (ordenadas por interação — já vêm ordenadas do client)
    const pubsLimited = (publicacoes || []).slice(0, 1000);

    // Limita IR2 a 300 autores, remove pubs internas se payload grande
    let ir2Data = (ir2 || []).slice(0, 300);

    // Serializa cada coluna e verifica tamanho
    const metaStr  = JSON.stringify(rest);
    const pubsStr  = JSON.stringify(pubsLimited);
    const ir2Str   = JSON.stringify(ir2Data);
    const nuvensStr= JSON.stringify(nuvens || []);
    const grafStr  = grafFrames ? JSON.stringify(grafFrames) : null;

    // Se ir2 ainda muito grande, remove pubs internas dos autores
    let ir2StrFinal = ir2Str;
    if (ir2Str.length > 900_000) {
      ir2Data = ir2Data.map(({ pubs: _pubs, ...rest }) => rest);
      ir2StrFinal = JSON.stringify(ir2Data);
    }

    // Se grafo muito grande, descarta
    const grafFinal = grafStr && grafStr.length > 900_000 ? null : grafStr;

    const token = genToken();
    await env.DB.prepare(`
      INSERT INTO ekklesia_shares (token, meta, publicacoes, ir2, nuvens, graf)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(token, metaStr, pubsStr, ir2StrFinal, nuvensStr, grafFinal).run();

    // Limpeza assíncrona de shares > 90 dias
    env.DB.prepare(`DELETE FROM ekklesia_shares WHERE created_at < datetime('now', '-90 days')`).run().catch(() => {});

    return json({ ok: true, token }, 201);
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR SHARE — relatório diário público por token (multi-país)
//
// Um token guarda o relatório de TODOS os países publicados até agora:
//   dados = { paises: { eua: {...campos do país...}, esp: {...}, ... } }
//
// POST /api/ekklesia/embratur-share
//   body: { pais, token? , ...campos do país }
//   - sem token        → cria um novo relatório (novo token)
//   - com token válido → atualiza/adiciona aquele país dentro do MESMO token
//   → { ok:true, token }
//
// GET  /api/ekklesia/embratur-share?token=XX
//   → { ok:true, dados:{ paises:{...} }, created_at }
// ════════════════════════════════════════════════════════════════
async function handleEmbraturShare(method, url, request, env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS embratur_shares (
      token      TEXT PRIMARY KEY,
      dados      TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();

  if (method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'token obrigatório' }, 400);
    const row = await env.DB.prepare(
      'SELECT dados, created_at FROM embratur_shares WHERE token = ?'
    ).bind(token).first();
    if (!row) return json({ error: 'Relatório não encontrado ou expirado' }, 404);
    let dados = tryP(row.dados, {});
    // Compat: relatórios antigos guardavam os campos do país direto na raiz
    if (!dados.paises && dados.pais) dados = { paises: { [dados.pais]: dados } };
    return json({ ok: true, dados, created_at: row.created_at });
  }

  if (method === 'POST') {
    const body = await request.json();
    if (!body || !body.pais) return json({ error: 'dados inválidos — campo pais obrigatório' }, 400);
    const { token: tokenExistente, ...campos } = body;

    if (tokenExistente) {
      const row = await env.DB.prepare(
        'SELECT dados FROM embratur_shares WHERE token = ?'
      ).bind(tokenExistente).first();
      if (row) {
        let dados = tryP(row.dados, {});
        if (!dados.paises && dados.pais) dados = { paises: { [dados.pais]: dados } };
        if (!dados.paises) dados.paises = {};
        dados.paises[campos.pais] = campos;
        const { str, imagensRemovidas } = _embGarantirTamanho(dados);
        if (str.length > 900_000) {
          return json({ error: 'Relatório grande demais para publicar mesmo após remover imagens. Reduza a quantidade de prints/imagens manuais.' }, 413);
        }
        try {
          await env.DB.prepare('UPDATE embratur_shares SET dados = ? WHERE token = ?')
            .bind(str, tokenExistente).run();
        } catch (e) {
          return json({ error: 'Erro ao salvar relatório: ' + String(e?.message || e) }, 500);
        }
        return json({ ok: true, token: tokenExistente, imagensRemovidas: imagensRemovidas || undefined }, 200);
      }
      // token informado não existe mais (expirado/inválido) → cria um novo abaixo
    }

    const token = genToken();
    const dados = { paises: { [campos.pais]: campos } };
    const { str, imagensRemovidas } = _embGarantirTamanho(dados);
    if (str.length > 900_000) {
      return json({ error: 'Relatório grande demais para publicar mesmo após remover imagens. Reduza a quantidade de prints/imagens manuais.' }, 413);
    }
    try {
      await env.DB.prepare(
        'INSERT INTO embratur_shares (token, dados) VALUES (?, ?)'
      ).bind(token, str).run();
    } catch (e) {
      return json({ error: 'Erro ao salvar relatório: ' + String(e?.message || e) }, 500);
    }
    // Limpeza de shares > 180 dias
    env.DB.prepare(`DELETE FROM embratur_shares WHERE created_at < datetime('now', '-180 days')`).run().catch(() => {});
    return json({ ok: true, token, imagensRemovidas: imagensRemovidas || undefined }, 201);
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR AUTH
// POST /api/ekklesia/embratur-auth
//   body: { senha: "..." }
//   env:  EMBRATUR_SENHA        — senha que os clientes digitam
//         EMBRATUR_AUTH_SECRET  — segredo HMAC (32+ chars aleatórios, nunca exposto)
//   → 200 { ok:true, session_token }   válido por 8h
//   → 401 { error: "Código incorreto" }
// ════════════════════════════════════════════════════════════════
async function handleEmbraturAuth(method, request, env) {
  if (method !== 'POST') return json({ error: 'Método não suportado' }, 405);

  const senha  = env.EMBRATUR_SENHA;
  const secret = env.EMBRATUR_AUTH_SECRET;
  if (!senha || !secret) return json({ error: 'Servidor não configurado' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body?.senha) return json({ error: 'Campo senha obrigatório' }, 400);

  // Comparação em tempo constante (evita timing attack)
  const enc  = new TextEncoder();
  const a    = enc.encode(body.senha);
  const b    = enc.encode(senha);
  let diff   = a.length ^ b.length;
  const len  = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return json({ error: 'Código incorreto' }, 401);

  // Assina payload com HMAC-SHA256 → session_token = base64(payload) + "." + base64(assinatura)
  const payload    = JSON.stringify({ ts: Date.now(), ttl: 8 * 3600 * 1000 });
  const payloadB64 = btoa(payload);
  const keyMat     = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig        = await crypto.subtle.sign('HMAC', keyMat, enc.encode(payloadB64));
  const sigB64     = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return json({ ok: true, session_token: payloadB64 + '.' + sigB64 });
}

// ════════════════════════════════════════════════════════════════
// SECOM AUTH
// POST /api/ekklesia/secom-auth
//   body: { senha: "..." }
//   env:  SECOM_SENHA        — senha que os clientes digitam
//         SECOM_AUTH_SECRET  — segredo HMAC (32+ chars aleatórios, nunca exposto)
//   → 200 { ok:true, session_token }   válido por 8h
async function handleSecomAuth(method, request, env) {
  if (method !== 'POST') return json({ error: 'Método não suportado' }, 405);

  const senha  = env.SECOM_SENHA;
  const secret = env.SECOM_AUTH_SECRET;
  if (!senha || !secret) return json({ error: 'Servidor não configurado' }, 500);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
  if (!body?.senha) return json({ error: 'Campo senha obrigatório' }, 400);

  // Comparação em tempo constante (evita timing attack)
  const enc  = new TextEncoder();
  const a    = enc.encode(body.senha);
  const b    = enc.encode(senha);
  let diff   = a.length ^ b.length;
  const len  = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return json({ error: 'Código incorreto' }, 401);

  // Assina payload com HMAC-SHA256 → session_token = base64(payload) + "." + base64(assinatura)
  const payload    = JSON.stringify({ ts: Date.now(), ttl: 8 * 3600 * 1000 });
  const payloadB64 = btoa(payload);
  const keyMat     = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig        = await crypto.subtle.sign('HMAC', keyMat, enc.encode(payloadB64));
  const sigB64     = btoa(String.fromCharCode(...new Uint8Array(sig)));

  return json({ ok: true, session_token: payloadB64 + '.' + sigB64 });
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR PREVIEW
// GET /api/ekklesia/embratur-preview?url=XXX
//   Busca a página da publicação, extrai a imagem de capa (og:image, com
//   fallback pra twitter:image) e devolve já em base64 — não devolve o
//   link da CDN porque ele costuma expirar em horas (Instagram/Facebook
//   assinam a URL com prazo de validade), e a imagem "morreria" depois de
//   publicado o relatório.
//   Cobertura é parcial de propósito: X/Twitter e Instagram, pra quem não
//   está logado, frequentemente não expõem og:image real do post — nesses
//   casos a resposta é ok:false e o time completa a foto manualmente.
//   → 200 { ok:true,  imagem: "data:image/...;base64,..." }
//   → 200 { ok:false, error: "..." }   (não é erro de servidor, é "não achou")
// ════════════════════════════════════════════════════════════════
async function handleEmbraturPreview(method, url, env) {
  if (method !== 'GET') return json({ error: 'Método não suportado' }, 405);
  const target = url.searchParams.get('url');
  if (!target) return json({ error: 'parâmetro url obrigatório' }, 400);

  let targetUrl;
  try { targetUrl = new URL(target); } catch { return json({ ok: false, error: 'URL inválida' }, 200); }
  if (!/^https?:$/.test(targetUrl.protocol)) return json({ ok: false, error: 'Protocolo não suportado' }, 200);

  const UA = 'Mozilla/5.0 (compatible; HUBnexusEmbraturBot/1.0; +https://hub.nexus)';
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), 7000);

  try {
    const pageRes = await fetch(targetUrl.toString(), {
      headers: { 'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml' },
      redirect: 'follow', signal: ctrl.signal,
    });
    if (!pageRes.ok) return json({ ok: false, error: `Site respondeu ${pageRes.status}` }, 200);

    const html   = await pageRes.text();
    const imgUrl = _embExtrairImagemOG(html, targetUrl);
    if (!imgUrl) return json({ ok: false, error: 'Sem og:image/twitter:image na página' }, 200);

    const imgRes = await fetch(imgUrl, { headers: { 'User-Agent': UA }, signal: ctrl.signal });
    if (!imgRes.ok) return json({ ok: false, error: `Imagem respondeu ${imgRes.status}` }, 200);

    const contentType = (imgRes.headers.get('content-type') || 'image/jpeg').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return json({ ok: false, error: 'Conteúdo retornado não é imagem' }, 200);

    const buf = await imgRes.arrayBuffer();
    if (buf.byteLength > 4 * 1024 * 1024) return json({ ok: false, error: 'Imagem grande demais (>4MB)' }, 200);

    const base64 = _embArrayBufferToBase64(buf);
    return json({ ok: true, imagem: `data:${contentType};base64,${base64}` });
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Tempo esgotado buscando a página' : e.message;
    return json({ ok: false, error: msg }, 200);
  } finally {
    clearTimeout(timeoutId);
  }
}

// Extrai og:image (fallback: og:image:secure_url, twitter:image) de um HTML —
// regex tolerante à ordem dos atributos (content antes ou depois de property/name).
function _embExtrairImagemOG(html, baseUrl) {
  const tags = ['og:image:secure_url', 'og:image', 'twitter:image'];
  for (const tag of tags) {
    const padroes = [
      new RegExp(`<meta[^>]+property=["']${tag}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${tag}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${tag}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${tag}["']`, 'i'),
    ];
    for (const re of padroes) {
      const m = html.match(re);
      if (m && m[1]) {
        try { return new URL(m[1], baseUrl).toString(); } catch { return m[1]; }
      }
    }
  }
  return null;
}

function _embArrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR BASE — persistência de rows brutas por país + data
//
// GET    /api/ekklesia/embratur-base?pais=eua[&dias=7][&tipo=diario|semanal]
//          → { ok, rows: [...] }  (últimos N dias, padrão 7; tipo padrão diario)
//
// POST   /api/ekklesia/embratur-base
//   body: { pais, rows: [{id, data_rel, dados, manual?}, ...], tipo? }
//          → { ok, inseridas, ignoradas }  (upsert por id; tipo padrão diario)
//
// DELETE /api/ekklesia/embratur-base?pais=eua&id=XXX[&tipo=diario|semanal]
//          → { ok }  (remove uma row)
// DELETE /api/ekklesia/embratur-base?pais=eua&data_rel=2026-06-22[&tipo=diario|semanal]
//          → { ok, removidas }  (limpa um dia inteiro)
// ════════════════════════════════════════════════════════════════
// Diário e Semanal usavam a MESMA base (sem distinção), o que fazia o que
// era subido num acabar contando no outro. Migra a tabela pra ganhar uma
// coluna "tipo" — e como o PRIMARY KEY precisa virar (pais, tipo, id) pra um
// mesmo post poder existir independente nos dois lados, isso exige recriar a
// tabela (SQLite/D1 não altera PK com ALTER TABLE). Roda uma única vez —
// checa PRAGMA table_info antes de tentar de novo. Tabela antiga fica
// renomeada como backup (não é apagada) pra permitir rollback manual.
async function _embMigrarBaseParaTipo(env) {
  const cols = await env.DB.prepare('PRAGMA table_info(embratur_base)').all().catch(() => null);
  const jaTemTipo = (cols?.results || []).some(c => c.name === 'tipo');
  if (jaTemTipo) return;
  const existe = await env.DB.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name='embratur_base'`
  ).first().catch(() => null);
  if (!existe) return; // tabela ainda não existe — o CREATE abaixo já cria com o schema novo
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS embratur_base_v2 (
       id TEXT NOT NULL, pais TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT 'diario',
       data_rel TEXT NOT NULL, dados TEXT NOT NULL,
       criado_em TEXT DEFAULT (datetime('now')), manual INTEGER DEFAULT 0,
       PRIMARY KEY (pais, tipo, id))`
  ).run();
  await env.DB.prepare(
    `INSERT INTO embratur_base_v2 (id, pais, tipo, data_rel, dados, criado_em, manual)
     SELECT id, pais, 'diario', data_rel, dados, criado_em, manual FROM embratur_base`
  ).run();
  await env.DB.prepare('ALTER TABLE embratur_base RENAME TO embratur_base_old_backup').run();
  await env.DB.prepare('ALTER TABLE embratur_base_v2 RENAME TO embratur_base').run();
}

async function handleEmbraturBase(method, url, request, env) {
  await _embMigrarBaseParaTipo(env);
  // Garante tabela (schema novo — cobre instalação do zero)
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS embratur_base (' +
    'id TEXT NOT NULL, pais TEXT NOT NULL, tipo TEXT NOT NULL DEFAULT \'diario\', data_rel TEXT NOT NULL, ' +
    'dados TEXT NOT NULL, criado_em TEXT DEFAULT (datetime(\'now\')), ' +
    'manual INTEGER DEFAULT 0, PRIMARY KEY (pais, tipo, id))'
  ).run();

  if (method === 'GET') {
    const pais = url.searchParams.get('pais');
    if (!pais) return json({ error: 'pais obrigatório' }, 400);
    const tipo = url.searchParams.get('tipo') || 'diario';
    const dias = Math.min(parseInt(url.searchParams.get('dias') || '7', 10), 90);
    const corte = new Date();
    corte.setUTCDate(corte.getUTCDate() - dias);
    const corteISO = corte.toISOString().substring(0, 10);
    const { results } = await env.DB.prepare(
      `SELECT id, data_rel, dados, manual, criado_em
       FROM embratur_base
       WHERE pais = ? AND tipo = ? AND data_rel >= ?
       ORDER BY data_rel DESC, criado_em DESC
       LIMIT 5000`
    ).bind(pais, tipo, corteISO).all();
    const rows = (results || []).map(r => ({
      ...JSON.parse(r.dados || '{}'),
      _id:      r.id,
      _dataRel: r.data_rel,
      _manual:  !!r.manual,
    }));
    return json({ ok: true, rows });
  }

  if (method === 'POST') {
    const body = await request.json();
    const { pais, rows, force } = body || {};
    const tipo = body?.tipo || 'diario';
    if (!pais || !Array.isArray(rows)) return json({ error: 'pais e rows obrigatórios' }, 400);
    let inseridas = 0, ignoradas = 0;
    let imagensRemovidas = 0;
    const erros = [];
    // force=true → INSERT OR REPLACE (re-upsert para corrigir dados antigos contaminados,
    // ex: datas com T07:00:00 artificial que não seriam sobrescritas pelo OR IGNORE normal)
    const stmt = env.DB.prepare(
      force
        ? `INSERT OR REPLACE INTO embratur_base (id, pais, tipo, data_rel, dados, manual) VALUES (?, ?, ?, ?, ?, ?)`
        : `INSERT OR IGNORE  INTO embratur_base (id, pais, tipo, data_rel, dados, manual) VALUES (?, ?, ?, ?, ?, ?)`
    );
    // Lote de até 100 por vez (limite D1)
    const CHUNK = 100;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK).map(r => {
        const { _id, _dataRel, _manual, ...dados } = r;
        const id      = r.id || r.link_publicacao || (_id || '');
        const dataRel = r.data_rel || _dataRel || '';
        const manual  = r._manual || _manual ? 1 : 0;
        if (!id || !dataRel) { ignoradas++; return null; }
        const { str: dadosStr, imagensRemovidas: removeu } = _embGarantirTamanho(dados);
        if (removeu) imagensRemovidas++;
        return stmt.bind(id, pais, tipo, dataRel, dadosStr, manual);
      }).filter(Boolean);
      if (batch.length) {
        try {
          const res = await env.DB.batch(batch);
          res.forEach(r => { inseridas += r.meta?.changes || 0; });
          ignoradas += batch.length - res.length;
        } catch (e) {
          ignoradas += batch.length;
          erros.push(String(e?.message || e));
        }
      }
    }
    // Limpeza automática: remove rows com mais de 90 dias
    env.DB.prepare(
      `DELETE FROM embratur_base WHERE pais = ? AND tipo = ? AND data_rel < date('now', '-90 days')`
    ).bind(pais, tipo).run().catch(() => {});
    return json({ ok: true, inseridas, ignoradas, imagensRemovidas: imagensRemovidas || undefined, erros: erros.length ? erros : undefined });
  }

  if (method === 'DELETE') {
    const pais     = url.searchParams.get('pais');
    const id       = url.searchParams.get('id');
    const dataRel  = url.searchParams.get('data_rel');
    const tipo     = url.searchParams.get('tipo') || 'diario';
    if (!pais) return json({ error: 'pais obrigatório' }, 400);
    if (id) {
      await env.DB.prepare('DELETE FROM embratur_base WHERE pais = ? AND tipo = ? AND id = ?')
        .bind(pais, tipo, id).run();
      return json({ ok: true });
    }
    if (dataRel) {
      const res = await env.DB.prepare(
        'DELETE FROM embratur_base WHERE pais = ? AND tipo = ? AND data_rel = ?'
      ).bind(pais, tipo, dataRel).run();
      return json({ ok: true, removidas: res.meta?.changes || 0 });
    }
    return json({ error: 'id ou data_rel obrigatório' }, 400);
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// GET    /api/ekklesia/embratur-config?pais=eua
//          → { ok, config: { textos, horaInicio, horaFim, imagensManuais } }
// POST   /api/ekklesia/embratur-config
//   body: { pais, textos?, horaInicio?, horaFim?, imagensManuais? }
//          → { ok }
// ════════════════════════════════════════════════════════════════
async function handleEmbraturConfig(method, url, request, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS embratur_config (
       pais TEXT PRIMARY KEY,
       dados TEXT NOT NULL DEFAULT '{}',
       updated_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();

  if (method === 'GET') {
    const pais = url.searchParams.get('pais');
    if (!pais) return json({ error: 'pais obrigatório' }, 400);
    const row = await env.DB.prepare(
      'SELECT dados FROM embratur_config WHERE pais = ?'
    ).bind(pais).first();
    const config = row ? JSON.parse(row.dados || '{}') : {};
    return json({ ok: true, config });
  }

  if (method === 'POST') {
    const body = await request.json();
    const { pais, ...campos } = body || {};
    if (!pais) return json({ error: 'pais obrigatório' }, 400);
    // Funde com o que já existe (não sobrescreve campos não enviados)
    const existing = await env.DB.prepare(
      'SELECT dados FROM embratur_config WHERE pais = ?'
    ).bind(pais).first();
    const atual = existing ? JSON.parse(existing.dados || '{}') : {};
    const novo  = { ...atual, ...campos };
    await env.DB.prepare(
      `INSERT INTO embratur_config (pais, dados, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(pais) DO UPDATE SET dados = excluded.dados, updated_at = excluded.updated_at`
    ).bind(pais, JSON.stringify(novo)).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// GET /api/ekklesia/embratur-diario?pais=esp&data_rel=2026-06-24
//   Link fixo por dia — retorna objeto d pronto para renderPage(),
//   sem token de share. Auth via Bearer session_token (mesmo gate de senha).
// ════════════════════════════════════════════════════════════════
async function handleEmbraturDiario(method, url, request, env) {
  if (method !== 'GET') return json({ error: 'Método não suportado' }, 405);

  // Valida sessão HMAC
  const authHeader = request.headers.get('Authorization') || '';
  const token  = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secret = env.EMBRATUR_AUTH_SECRET;
  if (!secret) return json({ error: 'Servidor não configurado' }, 500);

  let autorizado = false;
  if (token && token.includes('.')) {
    try {
      const [payloadB64, sigB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64));
      if ((Date.now() - payload.ts) < (payload.ttl || 8 * 3600 * 1000)) {
        const enc    = new TextEncoder();
        const keyMat = await crypto.subtle.importKey(
          'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
        autorizado = await crypto.subtle.verify('HMAC', keyMat, sigBytes, enc.encode(payloadB64));
      }
    } catch { autorizado = false; }
  }
  if (!autorizado) return json({ error: 'Não autorizado' }, 401);

  const pais     = url.searchParams.get('pais');
  const data_rel = url.searchParams.get('data_rel');
  if (!pais || !data_rel) return json({ error: 'pais e data_rel obrigatórios' }, 400);

  // Busca rows do dia + config em paralelo
  const [resRows, resConfig] = await Promise.all([
    env.DB.prepare(
      `SELECT dados, manual FROM embratur_base
       WHERE pais = ? AND tipo = 'diario' AND data_rel = ? ORDER BY criado_em DESC LIMIT 5000`
    ).bind(pais, data_rel).all(),
    env.DB.prepare('SELECT dados FROM embratur_config WHERE pais = ?').bind(pais).first(),
  ]);

  const rows   = (resRows.results || []).map(r => ({ ...JSON.parse(r.dados || '{}'), _manual: !!r.manual }));
  const config = resConfig ? JSON.parse(resConfig.dados || '{}') : {};

  // Calcula KPIs server-side (espelha _embCalcKPIs do frontend)
  const fmtNum = n => n >= 1000 ? (n/1000).toFixed(1).replace(/\.0$/,'')+'k' : String(n||0);
  const tot = rows.length || 1;

  const interacoes = rows.reduce((s,r) => s+(r.interacoes||0), 0);
  const segsUnicosPub = {};
  rows.forEach(r => {
    const pub = r.nome_publicador || '__'+r.canal+(r.link_publicacao||'');
    const seg = r.seguidores||0;
    if (seg > (segsUnicosPub[pub]||0)) segsUnicosPub[pub] = seg;
  });
  const alcanceCalc = Math.round(Object.values(segsUnicosPub).reduce((s,v)=>s+v,0) * 0.2);
  const engMedio    = rows.length > 0 ? Math.round(interacoes / rows.length) : 0;

  const comSent    = rows.filter(r => r.sentimento);
  const sentTot    = comSent.length || 1;
  const cnt = v => comSent.filter(r => r.sentimento === v).length;
  const sentPos    = Math.round(cnt('positivo')    / sentTot * 100);
  const sentFav    = Math.round(cnt('favoravel')   / sentTot * 100);
  const sentNeg    = Math.round(cnt('negativo')    / sentTot * 100);
  const sentDesfav = Math.round(cnt('desfavoravel')/ sentTot * 100);

  const canalCount = {};
  rows.forEach(r => { const c=r.canal||'?'; canalCount[c]=(canalCount[c]||0)+1; });
  const topCanalArr = Object.entries(canalCount).sort((a,b)=>b[1]-a[1]);
  const topCanal    = topCanalArr[0]?.[0] || '—';
  const topCanalPct = topCanalArr[0] ? Math.round(topCanalArr[0][1]/rows.length*100) : 0;

  const d = {
    data: data_rel,
    mencoes: String(rows.length),
    mencoesDelta: '',
    interacoes: fmtNum(interacoes),
    interacoesDelta: '',
    alcance: fmtNum(alcanceCalc),
    engMedio: String(engMedio),
    sentPos: String(sentPos),
    sentFav: String(sentFav),
    sentNeg: String(sentNeg),
    sentDesfav: String(sentDesfav),
    topCanal, topCanalPct: String(topCanalPct),
    vol: [0,0,0,0,0,0,rows.length], // simplificado — dia único
    top3alcance: [],
    top3interacao: [],
    destaque:      config.textos?.destaque      || '',
    atencao:       config.textos?.atencao       || '',
    analise:       config.textos?.analise       || '',
    desafios:      config.textos?.desafios      || '',
    oportunidades: config.textos?.oportunidades || '',
    tendencias:    config.textos?.tendencias    || '',
    periodoInicio: config.dataInicio || data_rel,
    periodoFim:    config.dataFim    || data_rel,
    horaInicio:    config.horaInicio || '06:01',
    horaFim:       config.horaFim    || '06:00',
  };

  // Top 3 alcance e interação
  const byPub = {};
  rows.forEach(r => {
    const n = r.nome_publicador||'—';
    if (!byPub[n]) byPub[n] = { inter:0, alcance:r.seguidores||0, canal:r.canal||'', conteudo:r.conteudo||'', link:r.link_publicacao||'', imagem:r.imagem||'' };
    byPub[n].inter   += (r.interacoes||0);
    byPub[n].alcance  = Math.max(byPub[n].alcance, r.seguidores||0);
    if (!byPub[n].imagem && r.imagem) byPub[n].imagem = r.imagem;
    if (!byPub[n].link   && r.link_publicacao) byPub[n].link = r.link_publicacao;
  });
  const pubArr = Object.entries(byPub);
  const mkPost = ([n,v], val) => ({ handle:'@'+n, texto:v.conteudo.substring(0,80), val, link:v.link, imagem:v.imagem });
  d.top3alcance   = pubArr.sort((a,b)=>b[1].alcance-a[1].alcance).slice(0,3)
    .map(p => mkPost(p, p[1].alcance>0 ? fmtNum(Math.round(p[1].alcance*0.2)) : '—'));
  d.top3interacao = pubArr.sort((a,b)=>b[1].inter-a[1].inter).slice(0,3)
    .map(p => mkPost(p, p[1].inter>0 ? fmtNum(p[1].inter) : '—'));

  return json({ ok: true, dados: d });
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR SEMANAL SHARE
// Armazena/recupera relatórios semanais via token (sem auth obrigatória
// na leitura — o token é o segredo de acesso).
//
// POST /api/ekklesia/embratur-semanal-share
//   body: { pais, periodo, token?, ...campos do JSON semanal }
//   - sem token → cria um novo relatório (novo token)
//   - com token → atualiza/adiciona aquele país no mesmo token
//   → { ok, token }
//
// GET  /api/ekklesia/embratur-semanal-share?token=XX
//   → { ok, dados:{ paises:{...} }, created_at }
// ════════════════════════════════════════════════════════════════
async function handleEmbraturSemanalShare(method, url, request, env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS embratur_semanal_shares (
      token      TEXT PRIMARY KEY,
      dados      TEXT NOT NULL DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now'))
    )`).run();

  if (method === 'GET') {
    const token = url.searchParams.get('token');
    if (!token) return json({ error: 'token obrigatório' }, 400);
    const row = await env.DB.prepare(
      'SELECT dados, created_at FROM embratur_semanal_shares WHERE token = ?'
    ).bind(token).first();
    if (!row) return json({ error: 'Relatório não encontrado ou expirado' }, 404);
    return json({ ok: true, dados: tryP(row.dados, {}), created_at: row.created_at });
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const { token: tokenExistente, ...campos } = body;
    if (!campos.pais) return json({ error: 'pais obrigatório' }, 400);

    if (tokenExistente) {
      const row = await env.DB.prepare(
        'SELECT dados FROM embratur_semanal_shares WHERE token = ?'
      ).bind(tokenExistente).first();
      if (row) {
        let dados = tryP(row.dados, {});
        if (!dados.paises) dados.paises = {};
        dados.paises[campos.pais] = campos;
        const { str, imagensRemovidas } = _embGarantirTamanho(dados);
        if (str.length > 900_000) {
          return json({ error: 'Relatório grande demais para publicar mesmo após remover imagens. Reduza a quantidade de prints/imagens manuais.' }, 413);
        }
        try {
          await env.DB.prepare('UPDATE embratur_semanal_shares SET dados = ? WHERE token = ?')
            .bind(str, tokenExistente).run();
        } catch (e) {
          return json({ error: 'Erro ao salvar relatório: ' + String(e?.message || e) }, 500);
        }
        return json({ ok: true, token: tokenExistente, imagensRemovidas: imagensRemovidas || undefined }, 200);
      }
    }

    const token = genToken();
    const dados = { paises: { [campos.pais]: campos } };
    const { str, imagensRemovidas } = _embGarantirTamanho(dados);
    if (str.length > 900_000) {
      return json({ error: 'Relatório grande demais para publicar mesmo após remover imagens. Reduza a quantidade de prints/imagens manuais.' }, 413);
    }
    try {
      await env.DB.prepare(
        'INSERT INTO embratur_semanal_shares (token, dados) VALUES (?, ?)'
      ).bind(token, str).run();
    } catch (e) {
      return json({ error: 'Erro ao salvar relatório: ' + String(e?.message || e) }, 500);
    }
    env.DB.prepare(`DELETE FROM embratur_semanal_shares WHERE created_at < datetime('now', '-180 days')`).run().catch(() => {});
    return json({ ok: true, token, imagensRemovidas: imagensRemovidas || undefined }, 201);
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR SEMANAL — persistência e recuperação por país + período
//
// POST /api/ekklesia/embratur-semanal
//   body: JSON semanal completo (campos do prompt: pais, periodo, ...)
//   Auth: Bearer session_token (mesmo gate do diário)
//   → { ok }
//
// GET  /api/ekklesia/embratur-semanal?pais=esp&periodo=2026-06-16
//   Auth: Bearer session_token
//   → { ok, dados: {...} }
// ════════════════════════════════════════════════════════════════
async function handleEmbraturSemanal(method, url, request, env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS embratur_semanal (
      pais        TEXT NOT NULL,
      periodo     TEXT NOT NULL,
      dados       TEXT NOT NULL DEFAULT '{}',
      published_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (pais, periodo)
    )`).run();

  // Auth HMAC (mesma lógica do embratur-diario)
  const authHeader = request.headers.get('Authorization') || '';
  const token  = authHeader.replace(/^Bearer\s+/i, '').trim();
  const secret = env.EMBRATUR_AUTH_SECRET;
  if (!secret) return json({ error: 'Servidor não configurado' }, 500);

  let autorizado = false;
  if (token && token.includes('.')) {
    try {
      const [payloadB64, sigB64] = token.split('.');
      const payload = JSON.parse(atob(payloadB64));
      if ((Date.now() - payload.ts) < (payload.ttl || 8 * 3600 * 1000)) {
        const enc    = new TextEncoder();
        const keyMat = await crypto.subtle.importKey(
          'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
        );
        const sigBytes = Uint8Array.from(atob(sigB64), c => c.charCodeAt(0));
        autorizado = await crypto.subtle.verify('HMAC', keyMat, sigBytes, enc.encode(payloadB64));
      }
    } catch { autorizado = false; }
  }
  if (!autorizado) return json({ error: 'Não autorizado' }, 401);

  if (method === 'GET') {
    const pais    = url.searchParams.get('pais');
    const periodo = url.searchParams.get('periodo');
    if (!pais || !periodo) return json({ error: 'pais e periodo obrigatórios' }, 400);
    const row = await env.DB.prepare(
      'SELECT dados FROM embratur_semanal WHERE pais = ? AND periodo = ?'
    ).bind(pais, periodo).first();
    if (!row) return json({ error: 'Relatório não encontrado' }, 404);
    return json({ ok: true, dados: tryP(row.dados, {}) });
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const { pais, periodo } = body;
    if (!pais || !periodo) return json({ error: 'pais e periodo obrigatórios' }, 400);
    const { str, imagensRemovidas } = _embGarantirTamanho(body);
    if (str.length > 900_000) {
      return json({ error: 'Relatório grande demais para salvar mesmo após remover imagens. Reduza a quantidade de prints/imagens manuais.' }, 413);
    }
    try {
      await env.DB.prepare(
        `INSERT INTO embratur_semanal (pais, periodo, dados, published_at)
         VALUES (?, ?, ?, datetime('now'))
         ON CONFLICT(pais, periodo) DO UPDATE SET dados = excluded.dados, published_at = excluded.published_at`
      ).bind(pais, periodo, str).run();
    } catch (e) {
      return json({ error: 'Erro ao salvar relatório: ' + String(e?.message || e) }, 500);
    }
    return json({ ok: true, imagensRemovidas: imagensRemovidas || undefined });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// EMBRATUR — CONTROLE DE PRODUÇÃO
// ════════════════════════════════════════════════════════════════
async function handleEmbraturControle(method, url, request, env) {
  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS embratur_controle_status (
      id             TEXT PRIMARY KEY,
      tipo_relatorio TEXT NOT NULL,
      data_ref       TEXT NOT NULL,
      pais           TEXT NOT NULL,
      status         TEXT DEFAULT 'pendente',
      responsavel    TEXT DEFAULT '',
      updated_at     TEXT DEFAULT (datetime('now'))
    )
  `).run();

  if (method === 'GET') {
    const data = url.searchParams.get('data');
    const tipo = url.searchParams.get('tipo');
    if (!data || !tipo) return json({ error: 'data e tipo obrigatórios' }, 400);
    const rows = await env.DB.prepare(
      `SELECT pais, status, responsavel FROM embratur_controle_status WHERE tipo_relatorio = ? AND data_ref = ?`
    ).bind(tipo, data).all();
    return json(rows.results || []);
  }

  if (method === 'POST') {
    let body;
    try { body = await request.json(); } catch { return json({ error: 'JSON inválido' }, 400); }
    const { tipo_relatorio, data_ref, pais, status, responsavel } = body;
    if (!tipo_relatorio || !data_ref || !pais) return json({ error: 'tipo_relatorio, data_ref e pais obrigatórios' }, 400);
    const id = `${tipo_relatorio}_${data_ref}_${pais}`;
    await env.DB.prepare(
      `INSERT INTO embratur_controle_status (id, tipo_relatorio, data_ref, pais, status, responsavel, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET status = excluded.status, responsavel = excluded.responsavel, updated_at = excluded.updated_at`
    ).bind(id, tipo_relatorio, data_ref, pais, status || 'pendente', responsavel || '').run();

    // Notifica o responsável via Web Push quando status → disponivel
    if (status === 'disponivel' && responsavel) {
      const PAISES = { eua:'Estados Unidos', esp:'Espanha', fra:'França', uk:'Reino Unido', deu:'Alemanha', chn:'China' };
      const paisNome = PAISES[pais] || pais;
      const tipoLabel = tipo_relatorio === 'diario' ? 'Diário' : 'Semanal';
      try {
        const usuario = await env.DB.prepare(
          `SELECT email FROM usuarios WHERE LOWER(TRIM(nome)) = LOWER(TRIM(?)) LIMIT 1`
        ).bind(responsavel).first();
        if (usuario?.email) {
          const origin = new URL(request.url).origin;
          fetch(`${origin}/api/notificar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email_responsavel: usuario.email,
              titulo: `📋 Disponível para revisão — ${paisNome}`,
              mensagem: `O relatório ${tipoLabel} de ${paisNome} está aguardando sua revisão.`,
              url: '/pages/ekklesia-embratur.html',
            }),
          }).catch(() => {});
        }
      } catch(_) {}
    }

    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// NEXUS ELEIÇÕES 2026 / PRISMA ELEITORAL
// ════════════════════════════════════════════════════════════════
//
// GET    /api/ekklesia/eleicoes-base?tipo=redes|imprensa&dias=30
//          → { ok, rows }
// POST   /api/ekklesia/eleicoes-base   body: { tipo, rows, force? }
//          → { ok, inseridas, ignoradas }
// DELETE /api/ekklesia/eleicoes-base?tipo=X&id=Y   ou   ?tipo=X&data_rel=Y
//          → { ok }
//
// Sem partição por país/candidato — é um único dashboard nacional.
// tipo = 'redes' (Brandwatch) | 'imprensa' (Knewin)
// ════════════════════════════════════════════════════════════════
async function handleEleicoesBase(method, url, request, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS eleicoes_base (
       id         TEXT NOT NULL,
       tipo       TEXT NOT NULL,
       data_rel   TEXT NOT NULL,
       dados      TEXT NOT NULL,
       criado_em  TEXT DEFAULT (datetime('now')),
       manual     INTEGER DEFAULT 0,
       PRIMARY KEY (tipo, id)
     )`
  ).run();

  if (method === 'GET') {
    const tipo = url.searchParams.get('tipo');
    if (!tipo) return json({ error: 'tipo obrigatório (redes|imprensa)' }, 400);
    const dias = Math.min(parseInt(url.searchParams.get('dias') || '30', 10), 120);
    const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') || '5000', 10), 1), 5000);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    const corte = new Date();
    corte.setUTCDate(corte.getUTCDate() - dias);
    const corteISO = corte.toISOString().substring(0, 10);
    // KPI "Menções (30d)"/"Hoje" — sempre uma janela fixa de 30 dias,
    // independente do `dias` pedido pra listagem (que pode ser 120). E
    // via COUNT separado do LIMIT abaixo, que existe só pra não devolver
    // uma lista gigante — base grande (ex.: export de campanha inteira)
    // pode ter mais de 8000 linhas nos últimos 30 dias.
    const corte30 = new Date();
    corte30.setUTCDate(corte30.getUTCDate() - 30);
    const corte30ISO = corte30.toISOString().substring(0, 10);
    const { results: countRows } = await env.DB.prepare(
      `SELECT COUNT(*) AS n, SUM(data_rel = date('now')) AS hoje
       FROM eleicoes_base WHERE tipo = ? AND data_rel >= ?`
    ).bind(tipo, corte30ISO).all();
    const total = countRows?.[0]?.n || 0;
    const hoje = countRows?.[0]?.hoje || 0;
    const { results } = await env.DB.prepare(
      `SELECT id, data_rel, dados, manual, criado_em
       FROM eleicoes_base
       WHERE tipo = ? AND data_rel >= ?
       ORDER BY data_rel DESC, criado_em DESC
       LIMIT ? OFFSET ?`
    ).bind(tipo, corteISO, limit, offset).all();
    const rows = (results || []).map(r => ({
      ...JSON.parse(r.dados || '{}'),
      _id:      r.id,
      _dataRel: r.data_rel,
      _manual:  !!r.manual,
    }));
    return json({ ok: true, rows, total, hoje, limit, offset, hasMore: rows.length === limit, nextOffset: offset + rows.length });
  }

  if (method === 'POST') {
    const body = await request.json();
    const { tipo, rows, force } = body || {};
    if (!tipo || !Array.isArray(rows)) return json({ error: 'tipo e rows obrigatórios' }, 400);

    // Trava de segurança: bases muito grandes (ex: export bruto de um mês inteiro)
    // podem estourar o limite de subrequests do Worker se mandadas de uma vez só.
    // O cliente já pagina por dia/base — isso aqui é só um cinto de segurança.
    const MAX_ROWS = 4000;
    if (rows.length > MAX_ROWS) {
      return json({ error: `Envie no maximo ${MAX_ROWS} registros por chamada. Total recebido: ${rows.length}.` }, 413);
    }

    let inseridas = 0, ignoradas = 0;
    const erros = [];
    const stmt = env.DB.prepare(
      force
        ? `INSERT OR REPLACE INTO eleicoes_base (id, tipo, data_rel, dados, manual) VALUES (?, ?, ?, ?, ?)`
        : `INSERT OR IGNORE  INTO eleicoes_base (id, tipo, data_rel, dados, manual) VALUES (?, ?, ?, ?, ?)`
    );
    // Integras de imprensa deixam cada registro maior; nesses casos, usa batches
    // menores no D1 sem penalizar bases leves.
    const temTextoLongo = rows.some(r => typeof r?.conteudo === 'string' && r.conteudo.length > 1000);
    const CHUNK = temTextoLongo ? 10 : 300;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const batch = rows.slice(i, i + CHUNK).map(r => {
        const { _id, _dataRel, _manual, ...dados } = r || {};
        const id      = String(r?.id || r?.link_publicacao || _id || '');
        const dataRel = String(r?.data_rel || _dataRel || '');
        const manual  = (r?._manual || _manual) ? 1 : 0;
        if (!id || !dataRel) { ignoradas++; return null; }
        let dadosStr;
        try { dadosStr = JSON.stringify(dados); } catch { ignoradas++; return null; }
        return stmt.bind(id, tipo, dataRel, dadosStr, manual);
      }).filter(Boolean);
      if (!batch.length) continue;
      // Isola erro por lote — um lote ruim não derruba a chamada inteira nem
      // faz a equipe perder tudo que já tinha subido nos lotes anteriores.
      try {
        const res = await env.DB.batch(batch);
        res.forEach(r => {
          const changes = r.meta?.changes || 0;
          if (changes > 0) inseridas += changes; else ignoradas++;
        });
      } catch (e) {
        erros.push(String(e?.message || e));
        ignoradas += batch.length;
      }
    }
    // Limpeza automática: mantém só 120 dias de histórico
    env.DB.prepare(
      `DELETE FROM eleicoes_base WHERE tipo = ? AND data_rel < date('now', '-120 days')`
    ).bind(tipo).run().catch(() => {});
    return json({
      ok: true, inseridas, ignoradas,
      erros: erros.length ? erros.slice(0, 5) : undefined,
    });
  }

  if (method === 'DELETE') {
    const tipo    = url.searchParams.get('tipo');
    const id      = url.searchParams.get('id');
    const dataRel = url.searchParams.get('data_rel');
    const all     = url.searchParams.get('all');
    if (all === '1') {
      const res = tipo
        ? await env.DB.prepare('DELETE FROM eleicoes_base WHERE tipo = ?').bind(tipo).run()
        : await env.DB.prepare('DELETE FROM eleicoes_base').run();
      return json({ ok: true, removidas: res.meta?.changes || 0 });
    }
    if (!tipo) return json({ error: 'tipo obrigatório' }, 400);
    if (id) {
      await env.DB.prepare('DELETE FROM eleicoes_base WHERE tipo = ? AND id = ?').bind(tipo, id).run();
      return json({ ok: true });
    }
    if (dataRel) {
      const res = await env.DB.prepare('DELETE FROM eleicoes_base WHERE tipo = ? AND data_rel = ?')
        .bind(tipo, dataRel).run();
      return json({ ok: true, removidas: res.meta?.changes || 0 });
    }
    return json({ error: 'id ou data_rel obrigatório' }, 400);
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// GET/POST /api/ekklesia/eleicoes-config
//   Singleton (chave fixa 'geral') com a análise editorial do dia,
//   colada manualmente pela equipe depois de rodar na IA — mesmo
//   fluxo manual usado hoje no Embratur.
//   body: { analise?, temaSemana?, headline? } → funde com o que existe
// ════════════════════════════════════════════════════════════════
async function handleEleicoesConfig(method, request, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS eleicoes_config (
       chave      TEXT PRIMARY KEY DEFAULT 'geral',
       dados      TEXT NOT NULL DEFAULT '{}',
       updated_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();

  if (method === 'GET') {
    const row = await env.DB.prepare('SELECT dados, updated_at FROM eleicoes_config WHERE chave = ?')
      .bind('geral').first();
    const config = row ? JSON.parse(row.dados || '{}') : {};
    return json({ ok: true, config, updated_at: row?.updated_at || null });
  }

  if (method === 'POST') {
    const body = await request.json();
    if (!body) return json({ error: 'corpo obrigatório' }, 400);
    const existing = await env.DB.prepare('SELECT dados FROM eleicoes_config WHERE chave = ?')
      .bind('geral').first();
    const atual = existing ? JSON.parse(existing.dados || '{}') : {};
    const novo  = { ...atual, ...body };
    await env.DB.prepare(
      `INSERT INTO eleicoes_config (chave, dados, updated_at)
       VALUES ('geral', ?, datetime('now'))
       ON CONFLICT(chave) DO UPDATE SET dados = excluded.dados, updated_at = excluded.updated_at`
    ).bind(JSON.stringify(novo)).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM eleicoes_config WHERE chave = ?').bind('geral').run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// GET/POST /api/ekklesia/eleicoes-share
//   Link público único e permanente (sem senha, sem token na URL).
//   POST sobrescreve sempre o mesmo registro 'atual' — é um dashboard
//   vivo, não um relatório histórico por dia como o Embratur.
//   body: { kpis, analise, temaSemana, destaques, headline }
// ════════════════════════════════════════════════════════════════
async function handleEleicoesShare(method, request, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS eleicoes_shares (
       id         TEXT PRIMARY KEY DEFAULT 'atual',
       dados      TEXT NOT NULL DEFAULT '{}',
       updated_at TEXT DEFAULT (datetime('now'))
     )`
  ).run();

  if (method === 'GET') {
    const row = await env.DB.prepare('SELECT dados, updated_at FROM eleicoes_shares WHERE id = ?')
      .bind('atual').first();
    if (!row) return json({ error: 'Nenhum snapshot publicado ainda' }, 404);
    return json({ ok: true, snapshot: JSON.parse(row.dados || '{}'), updated_at: row.updated_at });
  }

  if (method === 'POST') {
    const body = await request.json();
    if (!body) return json({ error: 'corpo obrigatório' }, 400);
    await env.DB.prepare(
      `INSERT INTO eleicoes_shares (id, dados, updated_at)
       VALUES ('atual', ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET dados = excluded.dados, updated_at = excluded.updated_at`
    ).bind(JSON.stringify(body)).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    await env.DB.prepare('DELETE FROM eleicoes_shares WHERE id = ?').bind('atual').run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}

// ════════════════════════════════════════════════════════════════
// GET/POST/DELETE /api/ekklesia/eleicoes-pesquisa
//   Cada rodada da pesquisa Nexus (BTG-Nexus) vira um registro.
//   Extração do PDF é feita no cliente (texto colado + parser JS) —
//   aqui só persiste o que a equipe já revisou e confirmou.
//
// GET    ?rodada=5              → uma rodada específica
// GET    (sem params)           → lista todas, mais recente primeiro
// POST   body: { rodada, dataCampo, dataDivulgacao, turno1, turno2 }
//          → upsert por rodada
// DELETE ?rodada=5              → remove uma rodada
// ════════════════════════════════════════════════════════════════
async function handleEleicoesPesquisa(method, url, request, env) {
  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS eleicoes_pesquisa (
       rodada          TEXT PRIMARY KEY,
       data_campo      TEXT,
       data_divulgacao TEXT,
       dados           TEXT NOT NULL DEFAULT '{}',
       updated_at      TEXT DEFAULT (datetime('now'))
     )`
  ).run();

  if (method === 'GET') {
    const rodada = url.searchParams.get('rodada');
    if (rodada) {
      const row = await env.DB.prepare('SELECT * FROM eleicoes_pesquisa WHERE rodada = ?').bind(rodada).first();
      if (!row) return json({ error: 'Rodada não encontrada' }, 404);
      return json({ ok: true, rodada: { ...row, dados: JSON.parse(row.dados || '{}') } });
    }
    const { results } = await env.DB.prepare(
      'SELECT rodada, data_campo, data_divulgacao, dados, updated_at FROM eleicoes_pesquisa ORDER BY data_divulgacao DESC'
    ).all();
    const rodadas = (results || []).map(r => ({ ...r, dados: JSON.parse(r.dados || '{}') }));
    return json({ ok: true, rodadas });
  }

  if (method === 'POST') {
    const body = await request.json();
    const { rodada, dataCampo, dataDivulgacao, ...dados } = body || {};
    if (!rodada) return json({ error: 'rodada obrigatória' }, 400);
    await env.DB.prepare(
      `INSERT INTO eleicoes_pesquisa (rodada, data_campo, data_divulgacao, dados, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(rodada) DO UPDATE SET
         data_campo = excluded.data_campo, data_divulgacao = excluded.data_divulgacao,
         dados = excluded.dados, updated_at = excluded.updated_at`
    ).bind(rodada, dataCampo || '', dataDivulgacao || '', JSON.stringify(dados)).run();
    return json({ ok: true });
  }

  if (method === 'DELETE') {
    if (url.searchParams.get('all') === '1') {
      await env.DB.prepare('DELETE FROM eleicoes_pesquisa').run();
      return json({ ok: true });
    }
    const rodada = url.searchParams.get('rodada');
    if (!rodada) return json({ error: 'rodada obrigatória' }, 400);
    await env.DB.prepare('DELETE FROM eleicoes_pesquisa WHERE rodada = ?').bind(rodada).run();
    return json({ ok: true });
  }

  return json({ error: 'Método não suportado' }, 405);
}
