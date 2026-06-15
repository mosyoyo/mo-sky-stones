import { generateCalendar } from '../src/ics.js';

const headers = {
  'Content-Type': 'text/calendar; charset=utf-8',
  'Content-Disposition': 'inline; filename="sky-black.ics"',
  'Cache-Control': 'public, max-age=300',
  'Access-Control-Allow-Origin': '*',
};

export async function onRequestGet() {
  const ics = generateCalendar('black', { name: '光遇黑石最后一场' });

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
