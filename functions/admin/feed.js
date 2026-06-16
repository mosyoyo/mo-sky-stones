// /admin/feed — 公告审核后台（纯静态 HTML，客户端 fetch JSON 渲染）

export async function onRequestGet(context) {
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mo-sky-stones · 公告审核</title>
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
    .badge-pending { background: #fff3e0; color: #e65100; }
    .badge-approved { background: #e8f5e9; color: #2e7d32; }
    .badge-ignored { background: #ffebee; color: #c62828; }
    .detail-content { white-space: pre-wrap; word-break: break-word; background: #f9f9f9; padding: 12px; border-radius: 4px; font-size: 14px; line-height: 1.6; }
    .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .actions { margin-top: 16px; }
    button, .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 8px; }
    .btn-approve { background: #4caf50; color: white; }
    .btn-ignore { background: #f44336; color: white; }
    .btn-back { background: #e0e0e0; color: #333; }
    #detail { display: none; }
    #list { display: block; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📋 公告审核</h1>
    <nav>
      <a href="/admin/feed">公告</a>
      <a href="/admin/events">事件</a>
      <a href="/admin/sync">同步</a>
    </nav>
  </div>

  <div id="list">
    <table>
      <thead>
        <tr><th>状态</th><th>标题</th><th>发布时间</th><th>类型</th><th>操作</th></tr>
      </thead>
      <tbody id="feed-list"></tbody>
    </table>
    <div class="stats" id="stats"></div>
  </div>

  <div id="detail">
    <a href="#" onclick="showList(); return false;" style="text-decoration:none;color:#0066cc">← 返回列表</a>
    <div class="card" id="detail-card"></div>
  </div>

  <script>
    const TYPE_LABELS = {
      traveling_spirit: '🧳 旅行先祖',
      season: '🌸 季节',
      activity: '🎉 活动',
      bonus: '✨ 双倍活动',
      maintenance: '🔧 维护更新',
      other: '📌 其他',
    };
    const STATUS_LABELS = {
      pending: '⏳ 待审核',
      approved: '✅ 已通过',
      ignored: '❌ 已忽略',
    };
    const STATUS_CLASS = {
      pending: 'badge-pending',
      approved: 'badge-approved',
      ignored: 'badge-ignored',
    };

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
    function fmtTime(ts) { return ts ? new Date(ts).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''; }
    function fmtISO(iso) { return iso ? new Date(iso).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''; }

    let feeds = [];

    async function loadFeeds() {
      try {
        const res = await fetch('/data/feeds.json');
        feeds = await res.json();
      } catch(e) {
        feeds = [];
      }
      renderList();
    }

    function renderList() {
      const tbody = document.getElementById('feed-list');
      tbody.innerHTML = feeds.map(f => {
        const typeLabel = TYPE_LABELS[f.autoType] || f.autoType || '未知';
        const statusLabel = STATUS_LABELS[f.status] || f.status;
        const statusClass = STATUS_CLASS[f.status] || '';
        const parsedInfo = f.parsedEvent
          ? '<br><small>📅 ' + fmtISO(f.parsedEvent.start) + ' → ' + fmtISO(f.parsedEvent.end) + '</small>'
          : '<br><small style="color:#999">无时间信息</small>';
        return '<tr>' +
          '<td><span class="badge ' + statusClass + '">' + esc(statusLabel) + '</span></td>' +
          '<td><strong>' + esc(f.title || f.content.slice(0, 30)) + '</strong></td>' +
          '<td>' + fmtTime(f.createTime) + '</td>' +
          '<td>' + esc(typeLabel) + parsedInfo + '</td>' +
          '<td><a href="#" onclick="showDetail(\\'' + f.id + '\\'); return false;" style="color:#0066cc">详情</a></td>' +
        '</tr>';
      }).join('');
      document.getElementById('stats').textContent = '共 ' + feeds.length + ' 条公告';
    }

    function showDetail(id) {
      const f = feeds.find(x => x.id === id);
      if (!f) return;
      document.getElementById('list').style.display = 'none';
      document.getElementById('detail').style.display = 'block';
      const typeLabel = TYPE_LABELS[f.autoType] || f.autoType || '未知';
      const statusLabel = STATUS_LABELS[f.status] || f.status;
      const parsedInfo = f.parsedEvent
        ? '<p><strong>开始时间:</strong> ' + fmtISO(f.parsedEvent.start) + '</p><p><strong>结束时间:</strong> ' + fmtISO(f.parsedEvent.end) + '</p>'
        : '<p style="color:#999">无时间信息</p>';
      let mediaHTML = '';
      if (f.media && f.media.length > 0) {
        mediaHTML = '<div class="card"><h2>图片 (' + f.media.length + ')</h2>' +
          f.media.filter(m => m.mimeType && m.mimeType.startsWith('image')).map(m =>
            '<img src="' + esc(m.url) + '" style="max-width:100%;border-radius:4px;margin-bottom:8px">'
          ).join('') + '</div>';
      }
      document.getElementById('detail-card').innerHTML =
        '<h1 style="font-size:20px;margin-bottom:16px">' + esc(f.title || f.content.slice(0, 30)) + '</h1>' +
        '<p><strong>状态:</strong> ' + esc(statusLabel) + '</p>' +
        '<p><strong>类型:</strong> ' + esc(typeLabel) + '</p>' +
        '<p><strong>发布时间:</strong> ' + fmtTime(f.createTime) + '</p>' +
        parsedInfo +
        '<h2 style="font-size:16px;color:#666;margin:16px 0 8px">原始正文</h2>' +
        '<div class="detail-content">' + esc(f.content) + '</div>' +
        mediaHTML +
        '<div class="actions"><p style="color:#999;font-size:13px;margin-top:12px">💡 审核操作请在本地运行: npm run approve</p></div>';
    }

    function showList() {
      document.getElementById('list').style.display = 'block';
      document.getElementById('detail').style.display = 'none';
    }

    loadFeeds();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
