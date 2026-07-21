// functions/api/perfil.js — HUB.nexus
const CORS = {
  'Access-Control-Allow-Origin':  'https://hub-nexus.pages.dev',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: CORS });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function onRequestPost({ request, env }) {
  try {
    const dados = await request.json();
    const { emailUsuario, nomePersonalizado } = dados;

    if (!emailUsuario) return json({ error: 'E-mail não fornecido' }, 400);

    // A tabela usuarios tem a coluna "nome" — é ela que armazena o nome de exibição
    await env.DB
      .prepare(`UPDATE usuarios SET nome = ? WHERE email = ?`)
      .bind((nomePersonalizado || '').trim(), emailUsuario.toLowerCase().trim())
      .run();

    return json({ sucesso: true, mensagem: 'Perfil atualizado!' });
  } catch (e) {
    return json({ error: 'Falha interna ao salvar dados', detalhe: e.message }, 500);
  }
}
