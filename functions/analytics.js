const { appConfig } = require('./_shared');

function analyticsToken(env) {
  const cfg = appConfig(env);
  return cfg.webAnalyticsToken || env.CF_WEB_ANALYTICS_TOKEN || env.CLOUDFLARE_WEB_ANALYTICS_TOKEN || '';
}

export async function onRequestGet(context) {
  const token = analyticsToken(context.env);
  const body = token
    ? `(() => {
  const script = document.createElement('script');
  script.defer = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.setAttribute('data-cf-beacon', ${JSON.stringify(JSON.stringify({ token }))});
  document.head.appendChild(script);
})();`
    : '';
  return new Response(body, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') return onRequestGet(context);
  return new Response('Method Not Allowed', { status: 405 });
}
