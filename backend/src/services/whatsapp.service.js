const { Client, LocalAuth, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');
const logger = require('./logger.service');

class WhatsAppService {
  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });

    // Track latest QR and auth status for frontend consumption
    this._latestQr = null;
    this._status = 'initial'; // initial | qr | authenticated | ready | disconnected | auth_failure
    this._readyWaiters = [];
    this._messageHandlers = [];

    this._setupEventHandlers();
  }

  _createClient() {
    return new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      }
    });
  }

  _setupEventHandlers() {
    this.client.on('qr', qr => {
      // Store QR for the frontend QR component
      this._latestQr = qr;
      this._status = 'qr';
      logger.info('QR Code received, awaiting scan...');
    });

    this.client.on('ready', () => {
      logger.info('WhatsApp client is ready!');
      console.log('\n✓ WhatsApp Bot is now active and listening for messages!\n');
      this._status = 'ready';
      // Clear QR once ready
      this._latestQr = null;

      // Resolve any pending readiness waiters
      const waiters = this._readyWaiters.splice(0);
      waiters.forEach(fn => {
        try { fn(); } catch (_) {}
      });
    });

    this.client.on('authenticated', () => {
      logger.info('WhatsApp authenticated successfully');
      this._status = 'authenticated';
    });

    this.client.on('auth_failure', msg => {
      logger.error('Authentication failed', { message: msg });
      this._status = 'auth_failure';
    });

    this.client.on('disconnected', reason => {
      logger.warn('WhatsApp client disconnected', { reason });
      this._status = 'disconnected';
    });
  }

  _reattachMessageHandlers() {
    if (!Array.isArray(this._messageHandlers) || !this._messageHandlers.length) return;
    for (const handler of this._messageHandlers) {
      try {
        this.client.on('message', handler);
        this.client.on('message_create', (msg) => {
          if (msg.fromMe) handler(msg);
        });
      } catch (_) {}
    }
  }

  async initialize() {
    try {
      logger.info('Initializing WhatsApp client...');
      await this.client.initialize();
    } catch (error) {
      logger.error('Failed to initialize WhatsApp client', { error: error.message });
      throw error;
    }
  }

  async restart() {
    try {
      logger.warn('Restarting WhatsApp client...');
      // Attempt graceful teardown
      if (this.client) {
        try {
          await this.client.destroy();
        } catch (err) {
          logger.warn('Client destroy failed', { error: err.message });
        }
      }
      this.client = this._createClient();
      this._latestQr = null;
      this._status = 'initial';
      this._setupEventHandlers();
      this._reattachMessageHandlers();
      await this.initialize();
      logger.info('WhatsApp client restarted successfully');
    } catch (error) {
      logger.error('Failed to restart WhatsApp client', { error: error.message });
      throw error;
    }
  }

  async logout() {
    try {
      logger.warn('Logging out WhatsApp client...');

      try {
        await this.client.logout();
      } catch (err) {
        logger.warn('Client logout failed', { error: err.message });
      }

      try {
        await this.client.destroy();
      } catch (err) {
        logger.warn('Client destroy failed', { error: err.message });
      }

      const sessionDir = path.join(process.cwd(), '.wwebjs_auth', 'session');
      try {
        await fs.promises.rm(sessionDir, { recursive: true, force: true });
      } catch (err) {
        logger.warn('Failed to remove auth session directory', { error: err.message });
      }

      this.client = this._createClient();
      this._latestQr = null;
      this._status = 'initial';
      this._setupEventHandlers();
      this._reattachMessageHandlers();
      await this.initialize();

      logger.info('WhatsApp client logged out successfully');
      return true;
    } catch (error) {
      logger.error('Failed to logout WhatsApp client', { error: error.message });
      throw error;
    }
  }

  async ensureReady(timeoutMs = 8000) {
    if (this._status === 'ready') return true;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('WhatsApp not ready within timeout'));
      }, Math.max(1, timeoutMs));
      const onReady = () => {
        cleanup();
        resolve(true);
      };
      const cleanup = () => {
        clearTimeout(timer);
      };
      // store waiter to be called when ready fires
      this._readyWaiters.push(onReady);
    });
  }

  onMessage(handler) {
    this._messageHandlers.push(handler);
    this.client.on('message', handler);
    this.client.on('message_create', (msg) => {
      if (msg.fromMe) handler(msg);
    });
  }

  async sendMessage(chatId, message) {
    // Normalize chatId if object provided
    const id = typeof chatId === 'object' && chatId?._serialized ? chatId._serialized : chatId;
    try {
      // Try to ensure readiness (non-fatal if it times out)
      try { await this.ensureReady(3000); } catch (_) {}

      // Prefer sending via Chat object when available
      try {
        const chat = await this.client.getChatById(id);
        await chat.sendMessage(message);
        logger.info('Message sent', { chatId: id });
        return true;
      } catch (inner) {
        logger.debug('getChatById send failed, falling back', { chatId: id, error: inner.message });
      }

      // Fallback to direct client send
      await this.client.sendMessage(id, message);
      logger.info('Message sent (fallback)', { chatId: id });
      return true;
    } catch (error) {
      logger.error('Failed to send message', { error: error.message, chatId: id });
      throw error;
    }
  }

  async sendMedia(chatId, base64, mimetype, caption = '') {
    const id = typeof chatId === 'object' && chatId?._serialized ? chatId._serialized : chatId;
    try {
      try { await this.ensureReady(3000); } catch (_) {}
      const media = new MessageMedia(mimetype, base64);
      try {
        const chat = await this.client.getChatById(id);
        await chat.sendMessage(media, caption ? { caption } : undefined);
        logger.info('Media sent', { chatId: id, mimetype });
        return true;
      } catch (inner) {
        logger.debug('getChatById media send failed, falling back', { chatId: id, error: inner.message });
      }
      await this.client.sendMessage(id, media, caption ? { caption } : undefined);
      logger.info('Media sent (fallback)', { chatId: id, mimetype });
      return true;
    } catch (error) {
      logger.error('Failed to send media', { error: error.message, chatId: id });
      throw error;
    }
  }

  async getClient() {
    return this.client;
  }

  getLatestQr() {
    return this._latestQr;
  }

  getStatus() {
    return this._status;
  }
}

module.exports = new WhatsAppService();
