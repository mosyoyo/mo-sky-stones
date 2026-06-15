const { generateICS } = require('../ics-generator');

export async function onRequestGet() {
  const ics = generateICS('black', 60, '光遇·黑石(最后一场)');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="sky-black.ics"',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return new Response('Method Not Allowed', { status: 405 });
}
