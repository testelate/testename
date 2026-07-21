// api/otp.js — HUB.nexus Autenticação Simples
// Substitui o sistema de OTP por senha estática
// ⚠️ SEGURANÇA: a senha agora vem da variável de ambiente ACCESS_PASSWORD
// Configure em: Cloudflare Pages → Settings → Environment Variables → ACCESS_PASSWORD

const ORIGIN = 'https://hub-nexus.pages.dev';

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': ORIGIN,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': ORIGIN,
    'Content-Type': 'application/json'
  };

  try {
    const body = await request.json();
    const { email, senha } = body || {};

    // 1. Validação básica de preenchimento
    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'E-mail inválido' }), { status: 400, headers: corsHeaders });
    }

    // 2. Validação da senha — lida do ambiente, nunca hardcoded
    const senhaCorreta = env.ACCESS_PASSWORD;
    if (!senhaCorreta) {
      return new Response(JSON.stringify({ error: 'Serviço indisponível' }), { status: 503, headers: corsHeaders });
    }

    // Senha separada para a aba de gestão
    const isGestao = email.toLowerCase().trim() === 'gestao@hubnexus.app';
    if (isGestao) {
      const senhaGestao = env.GESTAO_PASSWORD;
      if (!senhaGestao) {
        return new Response(JSON.stringify({ error: 'Acesso de gestão não configurado' }), { status: 503, headers: corsHeaders });
      }
      if (senha === senhaGestao) {
        return new Response(JSON.stringify({ ok: true, message: 'Acesso de gestão liberado!', user: { email: email.toLowerCase().trim(), role: 'admin' } }), { status: 200, headers: corsHeaders });
      } else {
        return new Response(JSON.stringify({ error: 'Senha de gestão incorreta' }), { status: 401, headers: corsHeaders });
      }
    }

    if (senha === senhaCorreta) {
      return new Response(JSON.stringify({ 
        ok: true, 
        message: 'Acesso liberado!',
        user: {
          email: email.toLowerCase().trim(),
          role: 'user'
        }
      }), { status: 200, headers: corsHeaders });
    } else {
      return new Response(JSON.stringify({ error: 'Senha incorreta' }), { status: 401, headers: corsHeaders });
    }

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Erro ao processar login' }), { status: 500, headers: corsHeaders });
  }
}
