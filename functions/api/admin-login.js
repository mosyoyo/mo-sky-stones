const { json } = require('../_shared');

const COOKIE_NAME = 'mo_admin_auth';

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
    const secret = context.env.ADMIN_PASSWORD;
    if (!secret) return json({ error: 'ADMIN_PASSWORD is not configured' }, 500);
    if (!password || password !== secret) return json({ error: '密码不对' }, 401);

    const token = await sign('mo-sky-stones', secret);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
      },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
