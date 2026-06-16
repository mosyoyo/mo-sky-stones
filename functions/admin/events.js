// /admin/events — 事件管理后台
// 展示所有事件，支持编辑/启用/禁用/删除

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');

function readJSON(filename) {
  const fp = path.join(DATA_DIR, filename);
  if (!fs.existsSync(fp)) return [];
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeJSON(filename, data) {
  const fp = path.join(DATA_DIR, filename);
  fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf-8');
}

const TYPE_LABELS = {
  traveling_spirit: '🧳 旅行先祖',
  season: '🌸 季节',
  activity: '🎉 活动',
  bonus: '✨ 双倍活动',
  maintenance: '🔧 维护更新',
  other: '📌 其他',
};

function escHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHTML(events) {
  const rows = events.map(ev => {
    const typeLabel = TYPE_LABELS[ev.type] || ev.type;
    const startStr = new Date(ev.start).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const endStr = new Date(ev.end).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const enabledLabel = ev.enabled ? '✅ 启用' : '⏸️ 禁用';
    const toggleAction = ev.enabled ? 'disable' : 'enable';

    return `<tr>
      <td>${enabledLabel}</td>
      <td>${escHTML(ev.title)}</td>
      <td>${typeLabel}</td>
      <td><small>${startStr}<br>→ ${endStr}</small></td>
      <td>
        <form method="POST" action="/admin/events/${toggleAction}" style="display:inline">
          <input type="hidden" name="id" value="${ev.id}">
          <button type="submit" style="color:${ev.enabled ? 'orange' : 'green'};background:none;border:none;cursor:pointer;font-size:inherit">${ev.enabled ? '禁用' : '启用'}</button>
        </form>
        <form method="POST" action="/admin/events/delete" style="display:inline">
          <input type="hidden" name="id" value="${ev.id}">
          <button type="submit" style="color:red;background:none;border:none;cursor:pointer;font-size:inherit" onclick="return confirm('确定删除?')">删除</button>
        </form>
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mo-sky-stones · 事件管理</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 24px; color: #333; }
    nav a { margin-left: 16px; text-decoration: none; color: #0066cc; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    th { background: #fafafa; font-weight: 600; color: #666; }
    tr:hover { background: #f9f9f9; }
    .stats { margin-top: 16px; color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📅 事件管理</h1>
    <nav>
      <a href="/admin/feed">公告</a>
      <a href="/admin/events">事件</a>
      <a href="/admin/sync">同步</a>
    </nav>
  </div>
  <table>
    <thead>
      <tr><th>状态</th><th>标题</th><th>类型</th><th>时间</th><th>操作</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="stats">共 ${events.length} 个事件，${events.filter(e => e.enabled).length} 个已启用</div>
</body>
</html>`;
}

export async function onRequestGet(context) {
  const events = readJSON('events.json');
  return new Response(renderHTML(events), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const formData = await context.request.formData();
  const id = formData.get('id');

  if (!id) return new Response('Missing id', { status: 400 });

  const events = readJSON('events.json');
  const ev = events.find(e => e.id === id);

  if (url.pathname.endsWith('/enable')) {
    if (ev) ev.enabled = true;
  } else if (url.pathname.endsWith('/disable')) {
    if (ev) ev.enabled = false;
  } else if (url.pathname.endsWith('/delete')) {
    const idx = events.findIndex(e => e.id === id);
    if (idx !== -1) events.splice(idx, 1);
  }

  writeJSON('events.json', events);

  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/events' },
  });
}
