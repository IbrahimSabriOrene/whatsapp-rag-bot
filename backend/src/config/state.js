const fs = require('fs');
const path = require('path');
const db = require('../services/db.service');

const STATE_PATH = path.join(__dirname, 'state.json');
let migrated = false;

function migrateFromFileOnce() {
  if (migrated) return;
  migrated = true;
  try {
    if (fs.existsSync(STATE_PATH)) {
      const raw = fs.readFileSync(STATE_PATH, 'utf-8');
      const s = JSON.parse(raw || '{}');
      const keys = ['targetChatId', 'targetGroupId', 'triggerPrefix', 'triggerWord'];
      keys.forEach((k) => {
        const current = db.get(k);
        if (current == null && s[k] != null) {
          db.set(k, String(s[k]));
        }
      });
    }
  } catch (_err) {
    // Ignore migration errors; DB will start empty
  }
}

function getTargetGroupId() {
  migrateFromFileOnce();
  return db.get('targetGroupId') || null;
}

function setTargetGroupId(id) {
  migrateFromFileOnce();
  const value = typeof id === 'string' ? id : null;
  if (value === null) {
    // Clearing value
    db.set('targetGroupId', '');
    return null;
  }
  db.set('targetGroupId', value);
  return value;
}

function getTargetChatId() {
  migrateFromFileOnce();
  const chat = db.get('targetChatId');
  const group = db.get('targetGroupId');
  return chat || group || null;
}

function setTargetChatId(id) {
  migrateFromFileOnce();
  const value = typeof id === 'string' ? id : null;
  if (value === null) {
    db.set('targetChatId', '');
    return null;
  }
  db.set('targetChatId', value);
  return value;
}

function getTriggerPrefix() {
  migrateFromFileOnce();
  const v = db.get('triggerPrefix');
  return v ? String(v).toLowerCase() : null;
}

function setTriggerPrefix(prefix) {
  migrateFromFileOnce();
  const value = typeof prefix === 'string' ? prefix : null;
  db.set('triggerPrefix', value || '');
  return value;
}

function getTriggerWord() {
  migrateFromFileOnce();
  const v = db.get('triggerWord');
  return v ? String(v).toLowerCase() : null;
}

function setTriggerWord(word) {
  migrateFromFileOnce();
  const value = typeof word === 'string' ? word : null;
  db.set('triggerWord', value || '');
  return value;
}

module.exports = {
  getTargetGroupId,
  setTargetGroupId,
  getTargetChatId,
  setTargetChatId,
  getTriggerPrefix,
  setTriggerPrefix,
  getTriggerWord,
  setTriggerWord
};
