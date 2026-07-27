const { appConfig, json, signAdminAuth, timingSafeEqual } = require('../_shared');

const COOKIE_NAME = 'mo_admin_auth';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
// 固定延迟：每次密码错误都等待 500ms，防止简单时序测量
// 注意：跨边缘节点的速率限制需在 Cloudflare Dashboard 的 Rate Limiting 规则中配置
const WRONG_PASSWORD_DELAY_MS = 500;

export async function onRequestPost(context) {
  try {
    const { password } = await context.request.json();
    const secret = appConfig(context.env).adminPassword;
    if (!secret) return json({ error: 'APP_CONFIG or ADMIN_PASSWORD is not configured' }, 500);
    if (!password || !timingSafeEqual(password, secret)) {
      await new Promise(resolve => setTimeout(resolve, WRONG_PASSWORD_DELAY_MS));
      return json({ error: '密码不对' }, 401);
    }

    const expiresAt = Date.now() + COOKIE_MAX_AGE * 1000;
    const signature = await signAdminAuth(`mo-sky-stones:${expiresAt}`, secret);
    const token = `${expiresAt}.${signature}`;
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`,
      },
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}

export async function onRequestOptions() {
  return json({});
}
