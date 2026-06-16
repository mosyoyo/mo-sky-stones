// /admin/sync — 同步日志（纯静态 HTML，客户端 fetch JSON 渲染）

export async function onRequestGet(context) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mo-sky-stones · 同步日志</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; padding: 20px; }
    .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
    h1 { font-size: 24px; color: #333; }
    nav a { margin-left: 16px; text-decoration: none; color: #0066cc; }
    table { width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
    th { background: #fafafa; font-weight: 600; color: #666; }
    .info { background: #e3f2fd; padding: 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; color: #1565c0; }
    .stats { color: #888; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔄 同步日志</h1>
    <nav>
      <a href="/admin/feed">公告</a>
      <a href="/admin/events">事件</a>
      <a href="/admin/sync">同步</a>
    </nav>
  </div>
  <div class="info">
    📡 同步由 GitHub Actions 每 6 小时自动执行。手动同步请在本地运行: <code>npm run sync</code>
  </div>
  <table>
    <thead>
      <tr><th>时间</th><th>操作</th><th>详情</th></tr>
    </thead>
    <tbody id="log-list"></tbody>
  </table>
  <div class="stats" id="stats"></div>

  <script>
    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function fmtTime(ts) { return ts ? new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''; }

    async function loadLogs() {
      let logs = [];
      try {
        const res = await fetch('/data/sync.json');
        logs = await res.json();
      } catch(e) {}
      const tbody = document.getElementById('log-list');
      tbody.innerHTML = logs.map(log =>
        '<tr><td>' + fmtTime(log.timestamp) + '</td><td>' + esc(log.action) + '</td><td>' + esc(log.details || '') + '</td></tr>'
      ).join('');
      document.getElementById('stats').textContent = '共 ' + logs.length + ' 条日志';
    }
    loadLogs();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
