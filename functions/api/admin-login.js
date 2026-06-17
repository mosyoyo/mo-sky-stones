const { appConfig, json } = require('../_shared');

const COOKIE_NAME = 'mo_admin_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
let failCount = 0;

function sign(value, secret) {
  const input = new TextEncoder().encode(`${value}.${secret}`);
  return crypto.subtle.digest('SHA-256', input).then(buf => {
    const bytes = [...new Uint8Array(buf)];
    return bytes.map(b => b.toString(16).padStart(2, '0')).join('');
  });
}

export async function onRequestPost(context) {
  try {
    const { password } = await context.request.json();
    const secret = appConfig(context.env).adminPassword;
    if (!secret) return json({ error: 'APP_CONFIG or ADMIN_PASSWORD is not configured' }, 500);
    if (!password || password !== secret) {
      failCount += 1;
      if (failCount > 5) await new Promise(resolve => setTimeout(resolve, 2000));
      return json({ error: '密码不对' }, 401);
    }

    failCount = 0;
    const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
    const signature = await sign(`mo-sky-stones:${expiresAt}`, secret);
    const token = `${expiresAt}.${signature}`;
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
