const logger = require('./logger.service');

class SessionService {
  constructor() {
    this._client = null;
    this._connectPromise = null;
    this._memory = new Map();
  }

  async _getClient() {
    const url = process.env.REDIS_URL ? String(process.env.REDIS_URL) : '';
    if (!url) return null;
    if (this._client) return this._client;
    if (this._connectPromise) return this._connectPromise;

    this._connectPromise = (async () => {
      const { createClient } = require('redis');
      const client = createClient({ url });
      client.on('error', (err) => {
        logger.warn('Redis client error', { error: err?.message || String(err) });
      });
      await client.connect();
      this._client = client;
      return client;
    })().catch((err) => {
      logger.warn('Redis connect failed; using in-memory sessions', { error: err?.message || String(err) });
      this._connectPromise = null;
      this._client = null;
      return null;
    });

    return this._connectPromise;
  }

  async getHistory(sessionId, limit = 20) {
    const key = String(sessionId || '').trim();
    if (!key) return [];

    const client = await this._getClient();
    if (!client) {
      const arr = this._memory.get(key) || [];
      return arr.slice(Math.max(0, arr.length - limit));
    }

    try {
      const items = await client.lRange(key, Math.max(0, -limit), -1);
      return items
        .map((x) => {
          try {
            return JSON.parse(x);
          } catch {
            return null;
          }
        })
        .filter(Boolean);
    } catch (err) {
      logger.warn('Redis getHistory failed; using in-memory sessions', { error: err?.message || String(err) });
      const arr = this._memory.get(key) || [];
      return arr.slice(Math.max(0, arr.length - limit));
    }
  }

  async append(sessionId, entry, limit = 20, ttlSeconds = 60 * 60 * 24 * 7) {
    const key = String(sessionId || '').trim();
    if (!key) return false;

    const safeEntry = entry && typeof entry === 'object' ? entry : { value: String(entry) };

    const client = await this._getClient();
    if (!client) {
      const arr = this._memory.get(key) || [];
      arr.push(safeEntry);
      const trimmed = arr.slice(Math.max(0, arr.length - limit));
      this._memory.set(key, trimmed);
      return true;
    }

    try {
      await client.rPush(key, JSON.stringify(safeEntry));
      await client.lTrim(key, Math.max(0, -limit), -1);
      await client.expire(key, ttlSeconds);
      return true;
    } catch (err) {
      logger.warn('Redis append failed; using in-memory sessions', { error: err?.message || String(err) });
      const arr = this._memory.get(key) || [];
      arr.push(safeEntry);
      const trimmed = arr.slice(Math.max(0, arr.length - limit));
      this._memory.set(key, trimmed);
      return true;
    }
  }

  async clear(sessionId) {
    const key = String(sessionId || '').trim();
    if (!key) return false;

    const client = await this._getClient();
    if (!client) {
      this._memory.delete(key);
      return true;
    }

    try {
      await client.del(key);
      return true;
    } catch (err) {
      logger.warn('Redis clear failed', { error: err?.message || String(err) });
      this._memory.delete(key);
      return true;
    }
  }
}

module.exports = new SessionService();

