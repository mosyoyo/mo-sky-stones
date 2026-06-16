// /admin/feed — 公告审核后台
// 展示所有抓取到的公告，支持批准/忽略/重新解析

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

const STATUS_LABELS = {
  pending: '⏳ 待审核',
  approved: '✅ 已通过',
  ignored: '❌ 已忽略',
};

function renderHTML(feeds) {
  const rows = feeds.map(f => {
    const typeLabel = TYPE_LABELS[f.autoType] || f.autoType || '未知';
    const statusLabel = STATUS_LABELS[f.status] || f.status;
    const time = f.createTime ? new Date(f.createTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '';
    const parsedInfo = f.parsedEvent
      ? `<br><small>📅 ${new Date(f.parsedEvent.start).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })} → ${new Date(f.parsedEvent.end).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</small>`
      : '<br><small style="color:#999">无时间信息</small>';

    return `<tr>
      <td>${statusLabel}</td>
      <td><strong>${escHTML(f.title || f.content.slice(0, 30))}</strong></td>
      <td>${time}</td>
      <td>${typeLabel}${parsedInfo}</td>
      <td>
        <a href="/admin/feed/${f.id}" style="color:#0066cc">详情</a>
        ${f.status === 'pending' ? `
          <form method="POST" action="/admin/feed/approve" style="display:inline">
            <input type="hidden" name="id" value="${f.id}">
            <button type="submit" style="color:green;background:none;border:none;cursor:pointer;font-size:inherit">批准</button>
          </form>
          <form method="POST" action="/admin/feed/ignore" style="display:inline">
            <input type="hidden" name="id" value="${f.id}">
            <button type="submit" style="color:red;background:none;border:none;cursor:pointer;font-size:inherit">忽略</button>
          </form>
        ` : ''}
        ${f.status === 'ignored' ? `
          <form method="POST" action="/admin/feed/approve" style="display:inline">
            <input type="hidden" name="id" value="${f.id}">
            <button type="submit" style="color:green;background:none;border:none;cursor:pointer;font-size:inherit">恢复</button>
          </form>
        ` : ''}
      </td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
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
  <table>
    <thead>
      <tr><th>状态</th><th>标题</th><th>发布时间</th><th>类型</th><th>操作</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="stats">共 ${feeds.length} 条公告</div>
</body>
</html>`;
}

function renderDetailHTML(feed) {
  const typeLabel = TYPE_LABELS[feed.autoType] || feed.autoType || '未知';
  const statusLabel = STATUS_LABELS[feed.status] || feed.status;
  const time = feed.createTime ? new Date(feed.createTime).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '';
  const parsedInfo = feed.parsedEvent
    ? `<p><strong>开始时间:</strong> ${new Date(feed.parsedEvent.start).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>
       <p><strong>结束时间:</strong> ${new Date(feed.parsedEvent.end).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}</p>`
    : '<p style="color:#999">无时间信息</p>';

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mo-sky-stones · 公告详情</title>
  <style>
    body { font-family: -apple-system, sans-serif; background: #f5f5f5; padding: 20px; max-width: 800px; margin: 0 auto; }
    .card { background: white; border-radius: 8px; padding: 24px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    h1 { font-size: 20px; margin-bottom: 16px; }
    h2 { font-size: 16px; color: #666; margin-bottom: 8px; }
    p { margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
    .content { white-space: pre-wrap; word-break: break-word; background: #f9f9f9; padding: 12px; border-radius: 4px; font-size: 14px; }
    .actions { margin-top: 16px; }
    button, .btn { padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; margin-right: 8px; text-decoration: none; }
    .btn-approve { background: #4caf50; color: white; }
    .btn-ignore { background: #f44336; color: white; }
    .btn-back { background: #e0e0e0; color: #333; }
    nav a { margin-right: 16px; text-decoration: none; color: #0066cc; }
  </style>
</head>
<body>
  <nav>
    <a href="/admin/feed">← 返回列表</a>
    <a href="/admin/events">事件</a>
    <a href="/admin/sync">同步</a>
  </nav>
  <div class="card">
    <h1>${escHTML(feed.title || feed.content.slice(0, 30))}</h1>
    <p><strong>状态:</strong> ${statusLabel}</p>
    <p><strong>类型:</strong> ${typeLabel}</p>
    <p><strong>发布时间:</strong> ${time}</p>
    ${parsedInfo}
  </div>
  <div class="card">
    <h2>原始正文</h2>
    <div class="content">${escHTML(feed.content)}</div>
  </div>
  ${feed.media && feed.media.length > 0 ? `
  <div class="card">
    <h2>图片 (${feed.media.length})</h2>
    ${feed.media.filter(m => m.mimeType?.startsWith('image')).map(m => `<img src="${m.url}" style="max-width:100%;border-radius:4px;margin-bottom:8px">`).join('')}
  </div>` : ''}
  <div class="actions">
    ${feed.status !== 'approved' ? `<form method="POST" action="/admin/feed/approve" style="display:inline"><input type="hidden" name="id" value="${feed.id}"><button class="btn-approve" type="submit">✅ 批准进入日历</button></form>` : ''}
    ${feed.status !== 'ignored' ? `<form method="POST" action="/admin/feed/ignore" style="display:inline"><input type="hidden" name="id" value="${feed.id}"><button class="btn-ignore" type="submit">❌ 忽略</button></form>` : ''}
    <a href="/admin/feed" class="btn btn-back">返回</a>
  </div>
</body>
</html>`;
}

function escHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// === Cloudflare Pages Function ===

// GET /admin/feed — 列表
// GET /admin/feed/:id — 详情
export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const pathParts = url.pathname.replace('/admin/feed', '').split('/').filter(Boolean);

  const feeds = readJSON('feeds.json');

  if (pathParts.length > 0) {
    // 详情页
    const feedId = pathParts[0];
    const feed = feeds.find(f => f.id === feedId);
    if (!feed) return new Response('Feed not found', { status: 404 });
    return new Response(renderDetailHTML(feed), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // 列表页
  return new Response(renderHTML(feeds), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

// POST /admin/feed/approve — 批准
// POST /admin/feed/ignore — 忽略
export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const formData = await context.request.formData();
  const id = formData.get('id');

  if (!id) return new Response('Missing id', { status: 400 });

  const feeds = readJSON('feeds.json');
  const events = readJSON('events.json');
  const feed = feeds.find(f => f.id === id);
  if (!feed) return new Response('Feed not found', { status: 404 });

  if (url.pathname.endsWith('/approve')) {
    feed.status = 'approved';
    // 自动创建 event（如果有时间信息）
    const existingEvent = events.find(e => e.sourceFeedId === feed.id);
    if (!existingEvent && feed.parsedEvent) {
      events.push({
        id: `${feed.autoType}-${feed.id.slice(0, 8)}`,
        enabled: true,
        type: feed.autoType,
        title: feed.title || feed.content.slice(0, 20),
        start: feed.parsedEvent.start,
        end: feed.parsedEvent.end,
        sourceFeedId: feed.id,
      });
    }
    writeJSON('events.json', events);
  } else if (url.pathname.endsWith('/ignore')) {
    feed.status = 'ignored';
    // 禁用关联 event
    const ev = events.find(e => e.sourceFeedId === feed.id);
    if (ev) ev.enabled = false;
    writeJSON('events.json', events);
  }

  writeJSON('feeds.json', feeds);

  // 重定向回列表
  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/feed' },
  });
}
