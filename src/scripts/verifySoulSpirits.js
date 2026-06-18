const { readJSON } = require('./common');

function verifySoulSpirits(data) {
  const errors = [];
  const spirits = Array.isArray(data?.spirits) ? data.spirits : [];
  if (spirits.length < 50) errors.push(`先祖数量过少：${spirits.length}`);

  const names = new Set();
  const ids = new Set();
  for (const item of spirits) {
    if (!item.id) errors.push(`缺少 id：${item.spiritName || '(unknown)'}`);
    if (!item.spiritName) errors.push(`缺少 spiritName：${item.id || '(unknown)'}`);
    if (!item.lastRevisit || !/^\d{4}-\d{2}-\d{2}$/.test(item.lastRevisit)) {
      errors.push(`lastRevisit 格式错误：${item.spiritName || item.id}`);
    }
    if (!item.wikiUrl || !item.wikiUrl.startsWith('https://wiki.biligame.com/sky/')) {
      errors.push(`wikiUrl 错误：${item.spiritName || item.id}`);
    }
    if (names.has(item.spiritName)) errors.push(`重复 spiritName：${item.spiritName}`);
    if (ids.has(item.id)) errors.push(`重复 id：${item.id}`);
    names.add(item.spiritName);
    ids.add(item.id);
  }

  return errors;
}

function main() {
  const data = readJSON('soul-spirits.json', null);
  const errors = verifySoulSpirits(data);
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`soul-spirits.json verified: ${data.spirits.length} spirits`);
}

if (require.main === module) main();

module.exports = { verifySoulSpirits };
