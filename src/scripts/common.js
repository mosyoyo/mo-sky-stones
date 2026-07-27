const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

function readJSON(name, fallback) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(file)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse ${file}: ${err.message}`);
  }
}

function writeJSON(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function writeRoot(name, data) {
  fs.writeFileSync(path.join(ROOT, name), data, 'utf8');
}

function appendSyncLog(entry) {
  const logs = readJSON('sync.json', []);
  logs.unshift({ time: new Date().toISOString(), ...entry });
  writeJSON('sync.json', logs.slice(0, 100));
}

module.exports = {
  ROOT,
  DATA_DIR,
  appendSyncLog,
  readJSON,
  writeJSON,
  writeRoot,
};
