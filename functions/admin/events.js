// /admin/events — 事件管理后台（纯静态 HTML，客户端 fetch JSON 渲染）

export async function onRequestGet(context) {
  const html = `<!DOCTYPE html>
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
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
    .badge-on { background: #e8f5e9; color: #2e7d32; }
    .badge-off { background: #fff3e0; color: #e65100; }
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
      <tr><th>状态</th><th>标题</th><th>类型</th><th>时间</th></tr>
    </thead>
    <tbody id="event-list"></tbody>
  </table>
  <div class="stats" id="stats"></div>

  <script>
    const TYPE_LABELS = {
      traveling_spirit: '🧳 旅行先祖',
      season: '🌸 季节',
      activity: '🎉 活动',
      bonus: '✨ 双倍活动',
      maintenance: '🔧 维护更新',
      other: '📌 其他',
    };
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function fmtISO(iso) { return iso ? new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''; }

    async function loadEvents() {
      let events = [];
      try {
        const res = await fetch('/data/events.json');
        events = await res.json();
      } catch(e) {}
      const tbody = document.getElementById('event-list');
      tbody.innerHTML = events.map(ev => {
        const typeLabel = TYPE_LABELS[ev.type] || ev.type;
        const enabledLabel = ev.enabled ? '✅ 启用' : '⏸️ 禁用';
        const enabledClass = ev.enabled ? 'badge-on' : 'badge-off';
        return '<tr>' +
          '<td><span class="badge ' + enabledClass + '">' + esc(enabledLabel) + '</span></td>' +
          '<td>' + esc(ev.title) + '</td>' +
          '<td>' + esc(typeLabel) + '</td>' +
          '<td><small>' + fmtISO(ev.start) + '<br>→ ' + fmtISO(ev.end) + '</small></td>' +
        '</tr>';
      }).join('');
      const enabled = events.filter(e => e.enabled).length;
      document.getElementById('stats').textContent = '共 ' + events.length + ' 个事件，' + enabled + ' 个已启用（💡 启用/禁用操作请在本地运行: npm run approve）';
    }
    loadEvents();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
