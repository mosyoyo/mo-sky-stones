import { generateCalendar } from '../src/ics.js';

const headers = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="sky-black.ics"',
  'Cache-Control': 'no-store',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet() {
  const ics = generateCalendar('black', { name: '光遇·黑石(最后一场)' });

  return new Response(ics, {
    status: 200,
    headers,
  });
}

export async function onRequestHead() {
  const ics = generateCalendar('black', { name: '光遇·黑石(最后一场)' });
  return new Response(null, {
    status: 200,
    headers: {
      ...headers,
      'Content-Length': String(new TextEncoder().encode(ics).length),
    },
  });
}

export async function onRequest(context) {
  if (context.request.method === 'HEAD') {
    return onRequestHead(context);
  }
  if (context.request.method === 'GET') {
    return onRequestGet(context);
  }
  return new Response('Method Not Allowed', { status: 405 });
}
