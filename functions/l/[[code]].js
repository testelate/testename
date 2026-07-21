// functions/l/[[code]].js — HUB.nexus Linkly Redirect Worker
// Intercepts traffic at /l/{code} and redirects to original_url with 301.

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  
  // Extract code from path `/l/code`
  const match = url.pathname.match(/^\/l\/([a-zA-Z0-9]+)/);
  const code = match ? match[1] : null;

  if (!code) {
    // Redireciona para a home se o código não for informado
    return Response.redirect(url.origin + '/index.html', 302);
  }

  try {
    const row = await env.DB.prepare('SELECT original_url FROM linkly_urls WHERE short_code = ? LIMIT 1')
      .bind(code)
      .first();

    if (!row) {
      // Redireciona para a home se o código não for encontrado no banco
      return Response.redirect(url.origin + '/index.html', 302);
    }

    // Incrementa cliques de forma assíncrona usando waitUntil
    context.waitUntil(
      env.DB.prepare('UPDATE linkly_urls SET clicks = clicks + 1 WHERE short_code = ?').bind(code).run()
    );

    let destination = row.original_url.trim();
    if (!destination.startsWith('http://') && !destination.startsWith('https://')) {
      destination = 'https://' + destination;
    }

    // Retorna redirecionamento 301 conforme especificação
    return Response.redirect(destination, 301);
  } catch (e) {
    return new Response('Erro interno: ' + e.message, { status: 500 });
  }
}
