// functions/api/storydesk/[[path]].js — HUB.nexus · StoryDesk v3
//
// /api/storydesk/projetos
// /api/storydesk/dols        (influs)
// /api/storydesk/coletas     (coletas por influ/dia/drive)
// /api/storydesk/registros   (análises)

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};
const json = (d, s=200) => new Response(JSON.stringify(d), {status:s, headers:CORS});

export async function onRequestOptions() {
  return new Response(null, {status:204, headers:CORS});
}

export async function onRequest({request, env}) {
  const url      = new URL(request.url);
  const seg      = url.pathname.replace(/^\/api\/storydesk\/?/,'').split('/').filter(Boolean);
  const resource = seg[0];
  const method   = request.method.toUpperCase();
  try {
    if (resource==='projetos')  return handleProjetos(method, url, request, env);
    if (resource==='dols')      return handleDols(method, url, request, env);
    if (resource==='coletas')   return handleColetas(method, url, request, env);
    if (resource==='registros') return handleRegistros(method, url, request, env);
    return json({error:'Rota não encontrada'}, 404);
  } catch(e) {
    return json({error: e.message}, 500);
  }
}

/* ── PROJETOS ── */
async function handleProjetos(method, url, req, env) {
  const id = url.searchParams.get('id');
  if (method==='GET') {
    if (id) return json({projeto: await env.DB.prepare('SELECT * FROM sd_projetos WHERE id=?').bind(id).first()});
    const {results} = await env.DB.prepare('SELECT * FROM sd_projetos WHERE ativo=1 ORDER BY created_at DESC').all();
    return json({projetos: results});
  }
  if (method==='POST') {
    const b = await req.json();
    const r = await env.DB.prepare('INSERT INTO sd_projetos (nome,cliente,descricao) VALUES (?,?,?)').bind(b.nome, b.cliente||'', b.descricao||'').run();
    return json({id: r.meta.last_row_id, ok:true});
  }
  if (method==='PUT') {
    const b = await req.json();
    await env.DB.prepare("UPDATE sd_projetos SET nome=?,cliente=?,descricao=?,updated_at=datetime('now') WHERE id=?").bind(b.nome, b.cliente||'', b.descricao||'', b.id).run();
    return json({ok:true});
  }
  if (method==='DELETE') {
    await env.DB.prepare('UPDATE sd_projetos SET ativo=0 WHERE id=?').bind(id).run();
    return json({ok:true});
  }
  return json({error:'Método não suportado'}, 405);
}

/* ── DOLS (influs) ── */
async function handleDols(method, url, req, env) {
  const id = url.searchParams.get('id');
  const projeto_id = url.searchParams.get('projeto_id');
  if (method==='GET') {
    if (id) return json({dol: await env.DB.prepare('SELECT * FROM sd_dols WHERE id=?').bind(id).first()});
    if (projeto_id) {
      const {results} = await env.DB.prepare('SELECT * FROM sd_dols WHERE projeto_id=? AND ativo=1 ORDER BY nome ASC').bind(projeto_id).all();
      return json({dols: results});
    }
    const {results} = await env.DB.prepare('SELECT * FROM sd_dols WHERE ativo=1 ORDER BY nome ASC').all();
    return json({dols: results});
  }
  if (method==='POST') {
    const b = await req.json();
    const r = await env.DB.prepare('INSERT INTO sd_dols (projeto_id,nome,crm,instagram,grupo,especialidade,url_perfil,observacoes) VALUES (?,?,?,?,?,?,?,?)').bind(b.projeto_id,b.nome,b.crm||'',b.instagram||'',b.grupo||'',b.especialidade||'',b.url_perfil||'',b.observacoes||'').run();
    return json({id: r.meta.last_row_id, ok:true});
  }
  if (method==='PUT') {
    const b = await req.json();
    await env.DB.prepare('UPDATE sd_dols SET nome=?,crm=?,instagram=?,grupo=?,especialidade=?,url_perfil=?,observacoes=?,projeto_id=? WHERE id=?').bind(b.nome,b.crm||'',b.instagram||'',b.grupo||'',b.especialidade||'',b.url_perfil||'',b.observacoes||'',b.projeto_id,b.id).run();
    return json({ok:true});
  }
  if (method==='DELETE') {
    await env.DB.prepare('UPDATE sd_dols SET ativo=0 WHERE id=?').bind(id).run();
    return json({ok:true});
  }
  return json({error:'Método não suportado'}, 405);
}

/* ── COLETAS ── */
async function handleColetas(method, url, req, env) {
  const id = url.searchParams.get('id');
  const projeto_id = url.searchParams.get('projeto_id');
  const influ_id = url.searchParams.get('influ_id');
  if (method==='GET') {
    if (id) return json({coleta: await env.DB.prepare('SELECT * FROM sd_coletas WHERE id=?').bind(id).first()});
    if (projeto_id) {
      const {results} = await env.DB.prepare('SELECT * FROM sd_coletas WHERE projeto_id=? ORDER BY data DESC, created_at DESC').bind(projeto_id).all();
      return json({coletas: results});
    }
    if (influ_id) {
      const {results} = await env.DB.prepare('SELECT * FROM sd_coletas WHERE influ_id=? ORDER BY data DESC').bind(influ_id).all();
      return json({coletas: results});
    }
    return json({coletas:[]});
  }
  if (method==='POST') {
    const b = await req.json();
    const r = await env.DB.prepare('INSERT INTO sd_coletas (influ_id,projeto_id,data,drive_link,num_stories,status,observacoes) VALUES (?,?,?,?,?,?,?)').bind(b.influ_id,b.projeto_id,b.data||'',b.drive_link||'',b.num_stories||0,b.status||'pendente',b.observacoes||'').run();
    return json({id: r.meta.last_row_id, ok:true});
  }
  if (method==='PUT') {
    const b = await req.json();
    await env.DB.prepare("UPDATE sd_coletas SET influ_id=?,projeto_id=?,data=?,drive_link=?,num_stories=?,status=?,observacoes=?,updated_at=datetime('now') WHERE id=?").bind(b.influ_id,b.projeto_id,b.data||'',b.drive_link||'',b.num_stories||0,b.status||'pendente',b.observacoes||'',b.id).run();
    return json({ok:true});
  }
  if (method==='DELETE') {
    await env.DB.prepare('DELETE FROM sd_coletas WHERE id=?').bind(id).run();
    return json({ok:true});
  }
  return json({error:'Método não suportado'}, 405);
}

/* ── REGISTROS ── */
async function handleRegistros(method, url, req, env) {
  const id = url.searchParams.get('id');
  const projeto_id = url.searchParams.get('projeto_id');
  const dol_id = url.searchParams.get('dol_id');
  if (method==='GET') {
    if (id) return json({registro: await env.DB.prepare('SELECT * FROM sd_registros WHERE id=?').bind(id).first()});
    if (projeto_id) {
      const {results} = await env.DB.prepare('SELECT * FROM sd_registros WHERE projeto_id=? ORDER BY data DESC, created_at DESC').bind(projeto_id).all();
      return json({registros: results});
    }
    if (dol_id) {
      const {results} = await env.DB.prepare('SELECT * FROM sd_registros WHERE dol_id=? ORDER BY data DESC').bind(dol_id).all();
      return json({registros: results});
    }
    return json({registros:[]});
  }
  if (method==='POST') {
    const b = await req.json();
    const r = await env.DB.prepare(`INSERT INTO sd_registros
      (dol_id,projeto_id,coleta_id,data,tema_principal,microtema,sentimento,mensagem_marca,novo_nordisk,
       produtos_nn,sema_brands,sema_composto,produtos_competidor,tirze_brands,tirze_composto,
       seguidores,interacoes,views,minutagem,impacto,feed,stories,reels,link,transcricao)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(b.dol_id,b.projeto_id,b.coleta_id||0,b.data||'',b.tema_principal||'',b.microtema||'',
            b.sentimento||'Neutro',b.mensagem_marca||'',b.novo_nordisk||'Não',
            b.produtos_nn||'',b.sema_brands||'',b.sema_composto||'Não',
            b.produtos_competidor||'',b.tirze_brands||'',b.tirze_composto||'Não',
            b.seguidores||0,b.interacoes||0,b.views||0,b.minutagem||'',b.impacto||0,
            b.feed||'Não',b.stories||'Não',b.reels||'Não',b.link||'',b.transcricao||'').run();
    return json({id: r.meta.last_row_id, ok:true});
  }
  if (method==='PUT') {
    const b = await req.json();
    await env.DB.prepare(`UPDATE sd_registros SET
      dol_id=?,projeto_id=?,coleta_id=?,data=?,tema_principal=?,microtema=?,sentimento=?,mensagem_marca=?,novo_nordisk=?,
      produtos_nn=?,sema_brands=?,sema_composto=?,produtos_competidor=?,tirze_brands=?,tirze_composto=?,
      seguidores=?,interacoes=?,views=?,minutagem=?,impacto=?,feed=?,stories=?,reels=?,link=?,transcricao=?,
      updated_at=datetime('now') WHERE id=?`)
      .bind(b.dol_id,b.projeto_id,b.coleta_id||0,b.data||'',b.tema_principal||'',b.microtema||'',
            b.sentimento||'Neutro',b.mensagem_marca||'',b.novo_nordisk||'Não',
            b.produtos_nn||'',b.sema_brands||'',b.sema_composto||'Não',
            b.produtos_competidor||'',b.tirze_brands||'',b.tirze_composto||'Não',
            b.seguidores||0,b.interacoes||0,b.views||0,b.minutagem||'',b.impacto||0,
            b.feed||'Não',b.stories||'Não',b.reels||'Não',b.link||'',b.transcricao||'',b.id).run();
    return json({ok:true});
  }
  if (method==='DELETE') {
    await env.DB.prepare('DELETE FROM sd_registros WHERE id=?').bind(id).run();
    return json({ok:true});
  }
  return json({error:'Método não suportado'}, 405);
}
