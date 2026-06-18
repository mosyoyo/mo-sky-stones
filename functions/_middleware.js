const COOKIE_NAME = 'mo_admin_auth';
const { signAdminAuth } = require('./_shared');

function appConfig(env) {
  let merged = {};
  if (env.APP_CONFIG) {
    try {
      merged = JSON.parse(env.APP_CONFIG);
    } catch (_) {
      merged = {};
    }
  }
  return {
    adminPassword: merged.adminPassword || env.ADMIN_PASSWORD,
  };
}

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
  return signature === await signAdminAuth(`mo-sky-stones:${expiresAt}`, secret);
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const { pathname } = url;

  if (!isAdminPath(pathname) && !isProtectedApi(pathname)) {
    return context.next();
  }

  if (pathname === '/admin/login/' || pathname === '/admin/login' || pathname === '/api/admin-login') {
    return context.next();
  }

  if (await hasAuth(context.request, context.env)) {
    return context.next();
  }

  if (pathname.startsWith('/api/')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    });
  }

  return Response.redirect(new URL('/admin/login/', url), 302);
}
