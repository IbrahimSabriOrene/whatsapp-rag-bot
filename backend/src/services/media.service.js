const fs = require('fs');
const path = require('path');
const logger = require('./logger.service');
class MediaService {
  constructor() {
    this.baseDir = path.join(__dirname, '../../media');
    fs.mkdirSync(this.baseDir, { recursive: true });
  }
  _extFromMime(mime) {
    const map = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/mpeg': '.mp3',
      'audio/ogg': '.ogg',
      'audio/wav': '.wav',
      'audio/webm': '.webm'
    };
    return map[mime] || '';
  }
  _chatDir(chatId) {
    const safe = String(chatId || '').replace(/[^a-zA-Z0-9@._-]/g, '_');
    const dir = path.join(this.baseDir, safe);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  buildPath(chatId, messageId, mime) {
    const dir = this._chatDir(chatId);
    const ext = this._extFromMime(mime);
    const safeId = String(messageId || '').replace(/[^a-zA-Z0-9@._-]/g, '_');
    return path.join(dir, safeId + ext);
  }
  async saveBase64(chatId, messageId, base64, mime) {
    try {
      const filePath = this.buildPath(chatId, messageId, mime);
      const data = Buffer.from(base64, 'base64');
      await fs.promises.writeFile(filePath, data);
      return filePath;
    } catch (err) {
      logger.error('Failed to save media', { error: err.message });
      throw err;
    }
  }
  async ensureOnDisk(chatId, messageId, downloader) {
    try {
      const filePath = this.buildPath(chatId, messageId, '');
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const candidates = await fs.promises.readdir(dir);
      const match = candidates.find(f => f.startsWith(String(messageId)));
      if (match) {
        return path.join(dir, match);
      }
      const media = await downloader();
      if (!media || !media.data || !media.mimetype) {
        return null;
      }
      const finalPath = this.buildPath(chatId, messageId, media.mimetype);
      await fs.promises.writeFile(finalPath, Buffer.from(media.data, 'base64'));
      return finalPath;
    } catch (err) {
      logger.warn('ensureOnDisk failed', { error: err.message });
      return null;
    }
  }
}
module.exports = new MediaService();
