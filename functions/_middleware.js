// functions/_middleware.js — HUB.nexus
// Aplica cabeçalhos de segurança em todas as respostas das Functions.
// Ekklesia Social e Press podem ser embutidos em iframe same-origin (pelo Reputaition).
// NOTA: para assets estáticos o _headers já define os valores corretos por rota.
// Este middleware só cobre rotas de Functions (/api/*).

// Cloudflare Pages redireciona /pages/x.html -> /pages/x (clean URL), então
// as duas formas do caminho precisam estar cobertas aqui.
const IFRAMEABLE = ['/pages/ekklesia.html', '/pages/ekklesia', '/pages/ekklesia-press.html', '/pages/ekklesia-press', '/pages/linkly.html', '/pages/linkly'];

export async function onRequest(context) {
  const response = await context.next();
  const url = new URL(context.request.url);
  const isIframeable = IFRAMEABLE.some(p => url.pathname === p || url.pathname.endsWith(p));

  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Não sobrescrever se o _headers já definiu SAMEORIGIN para esta rota
  const existingXFO = headers.get('X-Frame-Options') || '';
  if (existingXFO.toUpperCase() !== 'SAMEORIGIN') {
    headers.set('X-Frame-Options', isIframeable ? 'SAMEORIGIN' : 'DENY');
  }

  // Para rotas iframeable, garantir frame-ancestors 'self' no CSP
  if (isIframeable) {
    const csp = headers.get('Content-Security-Policy') || '';
    if (csp.includes("frame-ancestors 'none'") || !csp.includes('frame-ancestors')) {
      headers.set('Content-Security-Policy',
        csp
          .replace(/frame-ancestors\s+'none'/g, "frame-ancestors 'self'")
          .replace(/frame-ancestors\s+none/g,   "frame-ancestors 'self'")
      );
    }
  }

  return new Response(response.body, {
    status:     response.status,
    statusText: response.statusText,
    headers,
  });
}
