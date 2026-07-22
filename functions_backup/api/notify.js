// api/notify.js — HUB.nexus Notificações de Prazo (Cloudflare Pages)
// GET/POST /api/notify  — envia alertas de prazo via Resend + Slack

const CORS = {
  'Access-Control-Allow-Origin':  'https://hub-nexus.pages.dev',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type':                 'application/json',
};

async function sendEmail(apiKey, from, to, demanda) {
  const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f0e0cc;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="480" cellpadding="0" cellspacing="0"
             style="background:#140a02;border-radius:16px;overflow:hidden;">
        <tr><td style="padding:32px 40px;">
          <p style="font-size:20px;font-weight:700;color:#fff;margin:0 0 6px;">
            HUB<span style="color:#ff6500;">.</span>nexus
          </p>
          <p style="color:rgba(255,160,100,0.6);font-size:12px;margin:0 0 28px;">Alerta de prazo</p>
          <div style="background:rgba(255,101,0,0.12);border:1px solid rgba(255,101,0,0.3);border-radius:12px;padding:20px;margin-bottom:20px;">
            <p style="color:#ff8040;font-size:11px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase;margin:0 0 8px;">⏰ Prazo em 2 dias</p>
            <p style="color:rgba(255,220,190,0.92);font-size:16px;font-weight:600;margin:0 0 6px;">${demanda.titulo}</p>
            <p style="color:rgba(255,160,100,0.6);font-size:13px;margin:0;">
              Prazo: <strong style="color:rgba(255,160,100,0.9);">${demanda.prazo}</strong>
              &nbsp;·&nbsp; Status: ${demanda.status}
            </p>
          </div>
          <a href="${demanda.url || 'https://hub-nexus.pages.dev/pages/kanban.html'}"
             style="display:inline-block;background:#ff6500;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:13px;font-weight:600;">
            Ver demanda →
          </a>
          <hr style="border:none;border-top:1px solid rgba(255,255,255,0.07);margin:24px 0;"/>
          <p style="color:rgba(255,160,100,0.3);font-size:11px;margin:0;">Enviado automaticamente pelo HUB.nexus</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      from: `HUB.nexus <${from}>`,
      to: Array.isArray(to) ? to : [to],
      subject: `⏰ Prazo em 2 dias — ${demanda.titulo}`,
      text: `Alerta HUB.nexus: a demanda "${demanda.titulo}" vence em 2 dias (${demanda.prazo}).`,
      html,
    }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.message || `Resend ${res.status}`); }
  return true;
}

async function sendSlack(token, channel, demanda) {
  const res = await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      channel,
      text: `⏰ Prazo em 2 dias — ${demanda.titulo}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `⏰ *Prazo em 2 dias* — <${demanda.url || '#'}|Ver demanda>` } },
        { type: 'section', fields: [
          { type: 'mrkdwn', text: `*Demanda*\n${demanda.titulo}` },
          { type: 'mrkdwn', text: `*Prazo*\n${demanda.prazo}` },
          { type: 'mrkdwn', text: `*Status*\n${demanda.status}` },
          { type: 'mrkdwn', text: `*Responsável*\n${demanda.responsavel || 'Não definido'}` },
        ]},
        { type: 'divider' },
      ],
    }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack: ${data.error}`);
  return true;
}

function getDemandas2Dias(demandas) {
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const em2 = new Date(hoje); em2.setDate(em2.getDate() + 2);
  return demandas.filter(d => {
    if (!d.prazo || d.status === 'Concluído') return false;
    const p = new Date(d.prazo); p.setHours(0,0,0,0);
    return p.getTime() === em2.getTime();
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS });
}

async function handle(env, demandas) {
  const alvo = getDemandas2Dias(demandas);
  if (!alvo.length) return new Response(JSON.stringify({ ok: true, enviados: 0, msg: 'Nenhuma demanda vence em 2 dias.' }), { status: 200, headers: CORS });

  const RESEND_KEY   = env.RESEND_API_KEY;
  const FROM_EMAIL   = env.FROM_EMAIL || 'onboarding@resend.dev';
  const SLACK_TOKEN  = env.SLACK_BOT_TOKEN;
  const SLACK_CHAN   = env.SLACK_CHANNEL || '#demandas';

  const resultados = [];
  for (const d of alvo) {
    const r = { titulo: d.titulo, email: false, slack: false, erros: [] };
    if (d.responsavelEmail && RESEND_KEY) {
      try { await sendEmail(RESEND_KEY, FROM_EMAIL, d.responsavelEmail, d); r.email = true; }
      catch (e) { r.erros.push(`Email: ${e.message}`); }
    }
    if (SLACK_TOKEN) {
      try { await sendSlack(SLACK_TOKEN, SLACK_CHAN, d); r.slack = true; }
      catch (e) { r.erros.push(`Slack: ${e.message}`); }
    }
    resultados.push(r);
  }

  return new Response(JSON.stringify({ ok: true, enviados: resultados.filter(r => r.email || r.slack).length, total: alvo.length, resultados }), { status: 200, headers: CORS });
}

export async function onRequestGet({ env }) {
  return handle(env, []);
}

export async function onRequestPost({ request, env }) {
  let demandas = [];
  try {
    const body = await request.json();
    demandas = body.demandas || [];
  } catch { /* body vazio ou inválido — demandas permanece [] */ }
  return handle(env, demandas);
}
