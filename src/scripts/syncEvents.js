// 双数据源抓取主流程
// 1) fetchFeeds 抓网易大神 → feeds.json
// 2) fetchWikiEvents 抓 wiki 首页「光遇日历」 → events-wiki.json
// 3) parseFeed 解析网易大神 feeds → events-netease.json
// 4) mergeEvents 按 source-config.json 合并两边 → events.json
// 5) fetchSoulSpirits 更新完整复刻先祖列表 → soul-spirits.json
// （老的 buildEvents 已废弃，mergeEvents 直接产出 events.json）

const { main: fetchFeeds } = require('./fetchFeeds');
const { main: parseFeed } = require('./parseFeed');
const { main: fetchWikiEvents } = require('./fetchWikiEvents');
const { main: mergeEvents } = require('./mergeEvents');
const { main: fetchSoulSpirits } = require('./fetchSoulSpirits');

async function runSafely(label, fn) {
  try {
    await fn();
  } catch (err) {
    console.error(`⚠️ ${label} 失败（继续跑）:`, err.message);
  }
}

async function main() {
  // 1) 抓网易大神公告 → feeds.json
  await runSafely('fetchFeeds', fetchFeeds);

  // 2) 抓 wiki 首页「光遇日历」 → events-wiki.json
  await runSafely('fetchWikiEvents', fetchWikiEvents);

  // 3) 解析网易大神 feeds → events-netease.json
  await runSafely('parseFeed', parseFeed);

  // 4) 合并双数据源 → events.json
  // 这一步是最终输出，失败要让整体失败
  await mergeEvents();

  // 5) 更新完整复刻先祖列表，供公开指定先祖订阅页使用
  await runSafely('fetchSoulSpirits', fetchSoulSpirits);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { main };
