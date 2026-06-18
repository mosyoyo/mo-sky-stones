const { generateICS } = require('../ics-generator');
const { handleIcsRequest } = require('./_ics-response');

export async function onRequestGet() {
  const ics = generateICS('red', 60, '光遇·红石(最后一场)');

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="sky-red.ics"',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

export async function onRequest(context) {
  return handleIcsRequest(context, onRequestGet);
}
