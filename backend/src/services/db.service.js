const fs = require('fs');
const path = require('path');

let Database;
try {
  // Prefer better-sqlite3 for simplicity and performance
  Database = require('better-sqlite3');
} catch (e) {
  throw new Error('Dependency missing: better-sqlite3. Please install it with "npm install better-sqlite3".');
}

class DBService {
  constructor() {
    const defaultPath = path.join(__dirname, '../../data/app.db');
    this.dbPath = process.env.APP_DB_PATH || defaultPath;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this._migrate();
  }

  _migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT,
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);
  }

  get(key) {
    const row = this.db.prepare('SELECT value FROM app_settings WHERE key = ?').get(key);
    return row ? row.value : null;
  }

  set(key, value) {
    this.db
      .prepare(`
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, datetime('now'))
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
      `)
      .run(key, value);
    return true;
  }

  getMany(keys) {
    if (!Array.isArray(keys) || keys.length === 0) return {};
    const placeholders = keys.map(() => '?').join(',');
    const rows = this.db.prepare(`SELECT key, value FROM app_settings WHERE key IN (${placeholders})`).all(keys);
    const map = {};
    keys.forEach((k) => (map[k] = null));
    rows.forEach((r) => (map[r.key] = r.value));
    return map;
  }
}

module.exports = new DBService();

