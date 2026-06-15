// Cloudflare Pages Functions 入口
// 路由：
//   /red.ics   - 红石订阅（仅最后一场）
//   /black.ics - 黑石订阅（仅最后一场）

const { generateICS } = require('../ics-generator');

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const pathname = url.pathname;

  let filterType = null;
  let calName = '';

  if (pathname.endsWith('/red.ics')) {
    filterType = 'red';
    calName = '光遇·红石(最后一场)';
  } else if (pathname.endsWith('/black.ics')) {
    filterType = 'black';
    calName = '光遇·黑石(最后一场)';
  } else {
    return new Response('Not Found. Use /red.ics or /black.ics', { status: 404 });
  }

  const ics = generateICS(filterType, 60, calName);

  return new Response(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `inline; filename="sky-${filterType}.ics"`,
      'Cache-Control': 'public, max-age=3600', // 缓存 1 小时
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
