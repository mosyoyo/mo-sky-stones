const COOKIE_NAME = 'mo_admin_auth';
const { appConfig, signAdminAuth, timingSafeEqual } = require('./_shared');

function isAdminPath(pathname) {
  return pathname.startsWith('/admin/') || pathname === '/admin' || pathname.startsWith('/src/admin/');
}

function isProtectedApi(pathname) {
  return pathname.startsWith('/api/approve')
    || pathname.startsWith('/api/feed-batch')
    || pathname.startsWith('/api/events')
    || pathname.startsWith('/api/feed')
    || pathname.startsWith('/api/settings')
    || pathname.startsWith('/api/spirits')
    || pathname.startsWith('/api/sync');
}

// 内部数据文件，不应作为静态资源公开访问
const PUBLIC_DATA_FILES = new Set(['/data/events.json', '/data/soul-spirits.json']);
function isProtectedData(pathname) {
  if (!pathname.startsWith('/data/')) return false;
  return !PUBLIC_DATA_FILES.has(pathname);
}

function getCookie(request) {
  const cookie = request.headers.get('cookie') || '';
  const part = cookie.split(';').map(item => item.trim()).find(item => item.startsWith(`${COOKIE_NAME}=`));
  return part ? part.slice(COOKIE_NAME.length + 1) : '';
}

async function hasAuth(request, env) {
  const secret = appConfig(env).adminPassword;
  if (!secret) return false;
  const token = getCookie(request);
  const [expiresAt, signature] = token.split('.');
  const expiresMs = Number(expiresAt);
  if (!expiresAt || !signature || !Number.isFinite(expiresMs) || Date.now() > expiresMs) return false;
  const expected = await signAdminAuth(`mo-sky-stones:${expiresAt}`, secret);
  return timingSafeEqual(signature, expected);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const { pathname } = url;

  if (!isAdminPath(pathname) && !isProtectedApi(pathname) && !isProtectedData(pathname)) {
    return context.next();
  }

  if (pathname === '/admin/login/' || pathname === '/admin/login' || pathname === '/api/admin-login') {
    return context.next();
  }

  if (await hasAuth(context.request, context.env)) {
    return context.next();
  }

  if (pathname.startsWith('/api/') || isProtectedData(pathname)) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return Response.redirect(new URL('/admin/login/', url), 302);
}
