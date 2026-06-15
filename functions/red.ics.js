import { generateCalendar } from '../src/ics.js';

const headers = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="sky-red.ics"',
  'Cache-Control': 'public, max-age=300',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet() {
  const ics = generateCalendar('red', { name: '光遇红石最后一场' });

  return new Response(ics, {
    status: 200,
    headers,
  });
}

export async function onRequestHead() {
  return new Response(null, { status: 200, headers });
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
