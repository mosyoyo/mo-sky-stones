// 本地测试脚本：验证推算引擎和 .ics 生成器
// 红石、黑石分开生成

const { generateICS } = require('./ics-generator');
const fs = require('fs');
const path = require('path');

// 生成红石
const redICS = generateICS('red', 30);
const redPath = path.join(__dirname, 'preview-red.ics');
fs.writeFileSync(redPath, redICS);
const redCount = (redICS.match(/BEGIN:VEVENT/g) || []).length;

// 生成黑石
const blackICS = generateICS('black', 30);
const blackPath = path.join(__dirname, 'preview-black.ics');
fs.writeFileSync(blackPath, blackICS);
const blackCount = (blackICS.match(/BEGIN:VEVENT/g) || []).length;

console.log('=== 生成成功 ===');
console.log(`红石文件: preview-red.ics (${redICS.length} 字节, ${redCount} 个事件)`);
console.log(`黑石文件: preview-black.ics (${blackICS.length} 字节, ${blackCount} 个事件)`);
console.log('');

// 打印红石预览
console.log('=== 红石事件预览（前 5 个）===');
const redEvents = redICS.split('BEGIN:VEVENT').slice(1, 6);
for (const e of redEvents) {
  const summary = e.match(/SUMMARY:(.+)/)?.[1];
  const dtstart = e.match(/DTSTART[^:]*:(.+)/)?.[1];
  console.log(`- ${summary} @ ${dtstart}`);
}
console.log('');

// 打印黑石预览
console.log('=== 黑石事件预览（前 5 个）===');
const blackEvents = blackICS.split('BEGIN:VEVENT').slice(1, 6);
for (const e of blackEvents) {
  const summary = e.match(/SUMMARY:(.+)/)?.[1];
  const dtstart = e.match(/DTSTART[^:]*:(.+)/)?.[1];
  console.log(`- ${summary} @ ${dtstart}`);
}

// 验证每日只 1 个事件
console.log('');
console.log('=== 每日事件数验证 ===');
const dayRegex = /UID:(\d{8})T/;
const allEvents = redICS.split('BEGIN:VEVENT').slice(1);
const dayCount = {};
for (const e of allEvents) {
  const m = e.match(dayRegex);
  if (m) dayCount[m[1]] = (dayCount[m[1]] || 0) + 1;
}
const days = Object.keys(dayCount);
const maxPerDay = Math.max(0, ...Object.values(dayCount));
console.log(`共 ${days.length} 个红石日，每日最多 ${maxPerDay} 场（期望 1 场）`);
if (maxPerDay === 1) {
  console.log('✅ 验证通过');
} else {
  console.log('❌ 验证失败');
  process.exitCode = 1;
}
