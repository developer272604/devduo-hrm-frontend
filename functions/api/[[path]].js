// Cloudflare Pages Function: forwards /api/* to the Laravel backend so the browser stays same-origin
// (session cookies and CSRF keep working, no CORS needed).
// Configure in Cloudflare Pages -> Settings -> Variables: API_ORIGIN = https://your-backend.example.com
export async function onRequest({ request, env }) {
  const origin = (env.API_ORIGIN || '').replace(/\/+$/, '');
  if (!origin) {
    return Response.json(
      { message: 'API_ORIGIN is not configured for this deployment.' },
      { status: 503 },
    );
  }
  const url = new URL(request.url);
  const upstream = new Request(origin + url.pathname + url.search, request);
  upstream.headers.set('X-Forwarded-Host', url.host);
  upstream.headers.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  const response = await fetch(upstream, { redirect: 'manual' });
  const out = new Response(response.body, response);
  out.headers.set('Cache-Control', 'no-store');
  return out;
}
