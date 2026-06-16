// /admin/sync — 同步日志 + 手动触发同步

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

function escHTML(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function renderHTML(syncLogs) {
  const logRows = syncLogs.map(log => {
    const time = new Date(log.timestamp).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const details = log.details || '';
    return `<tr>
      <td>${time}</td>
      <td>${escHTML(log.action)}</td>
      <td>${escHTML(details)}</td>
    </tr>`;
  }).join('');

  return `<!DOCTYPE html>
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
    .actions { margin-bottom: 20px; }
    button { padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; background: #0066cc; color: white; }
    button:hover { background: #0052a3; }
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
  <div class="actions">
    <form method="POST" action="/admin/sync/run" style="display:inline">
      <button type="submit">📡 手动同步（抓取 + 解析 + 构建）</button>
    </form>
    <form method="POST" action="/admin/sync/build" style="display:inline">
      <button type="submit" style="background:#4caf50">🔧 仅重建 ICS</button>
    </form>
  </div>
  <table>
    <thead>
      <tr><th>时间</th><th>操作</th><th>详情</th></tr>
    </thead>
    <tbody>${logRows}</tbody>
  </table>
  <div class="stats">共 ${syncLogs.length} 条日志</div>
</body>
</html>`;
}

async function runSync() {
  const { main: fetchMain } = require('../../src/scripts/fetchFeeds');
  const { main: parseMain } = require('../../src/scripts/parseFeed');
  const { main: buildMain } = require('../../src/scripts/buildEvents');

  const syncLogs = readJSON('sync.json');

  try {
    const fetchResult = await fetchMain();
    syncLogs.unshift({
      timestamp: Date.now(),
      action: '抓取',
      details: `新增 ${fetchResult.newCount} 条，总计 ${fetchResult.total} 条`,
    });
  } catch (err) {
    syncLogs.unshift({
      timestamp: Date.now(),
      action: '抓取失败',
      details: err.message,
    });
  }

  try {
    const parseResult = parseMain();
    syncLogs.unshift({
      timestamp: Date.now(),
      action: '解析',
      details: `解析 ${parseResult.parsedCount} 条，跳过 ${parseResult.skippedCount} 条`,
    });
  } catch (err) {
    syncLogs.unshift({
      timestamp: Date.now(),
      action: '解析失败',
      details: err.message,
    });
  }

  try {
    const buildResult = buildMain();
    syncLogs.unshift({
      timestamp: Date.now(),
      action: '构建 ICS',
      details: `${buildResult.enabled} 个已启用事件`,
    });
  } catch (err) {
    syncLogs.unshift({
      timestamp: Date.now(),
      action: '构建失败',
      details: err.message,
    });
  }

  // 只保留最近 100 条日志
  if (syncLogs.length > 100) syncLogs.length = 100;
  writeJSON('sync.json', syncLogs);
}

export async function onRequestGet(context) {
  const syncLogs = readJSON('sync.json');
  return new Response(renderHTML(syncLogs), {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}

export async function onRequestPost(context) {
  const url = new URL(context.request.url);
  const syncLogs = readJSON('sync.json');

  if (url.pathname.endsWith('/run')) {
    await runSync();
  } else if (url.pathname.endsWith('/build')) {
    try {
      const { main: buildMain } = require('../../src/scripts/buildEvents');
      const result = buildMain();
      syncLogs.unshift({
        timestamp: Date.now(),
        action: '手动重建 ICS',
        details: `${result.enabled} 个已启用事件`,
      });
    } catch (err) {
      syncLogs.unshift({
        timestamp: Date.now(),
        action: '重建失败',
        details: err.message,
      });
    }
    if (syncLogs.length > 100) syncLogs.length = 100;
    writeJSON('sync.json', syncLogs);
  }

  return new Response(null, {
    status: 302,
    headers: { Location: '/admin/sync' },
  });
}
