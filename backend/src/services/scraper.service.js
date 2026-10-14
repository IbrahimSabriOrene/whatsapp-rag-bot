const TextProcessor = require('../utils/textProcessor');
const embeddingService = require('./embedding.service');
const vectorStore = require('./vectorStore.service');
const whatsappService = require('./whatsapp.service');
const logger = require('./logger.service');
const { resolveAuthorName, resolveMentionNames } = require('../utils/wa-utils');

class ScraperService {
  constructor() {
    this.activeGroup = null; // { id: string, name: string }
  }

  async _getChats() {
    const client = await whatsappService.getClient();
    return client.getChats();
  }

  async _getChatsWithRetry() {
    const attempt = async () => {
      const chats = await this._getChats();
      if (!Array.isArray(chats)) throw new Error('Unexpected chats payload');
      return chats;
    };

    try {
      return await attempt();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const retryable =
        message.includes('Evaluation failed') ||
        message.includes('Execution context was destroyed') ||
        message.includes('Cannot read properties of undefined') ||
        message.includes('Target closed');
      if (!retryable) throw err;
    }

    await new Promise(r => setTimeout(r, 1200));
    try {
      return await attempt();
    } catch (err) {
      const status = whatsappService.getStatus();
      if (status === 'ready') {
        await whatsappService.restart();
        await new Promise(r => setTimeout(r, 1200));
        return await attempt();
      }
      throw err;
    }
  }

  async listGroupChats() {
    const chats = await this._getChatsWithRetry();
    return chats
      .filter(c => c.isGroup)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async listPersonalChats() {
    const chats = await this._getChatsWithRetry();
    // Direct chats typically end with '@c.us' and are not groups
    return chats
      .filter(c => !c.isGroup && c?.id?._serialized && c.id._serialized.endsWith('@c.us'))
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }

  async scrapeGroupChat(chat, options = {}) {
    const batchSize = options.batchSize || 200;
    const minLength = options.minLength || 3;
    let total = 0;
    let lastMessage = null;
    const seenIds = new Set();

    logger.info('Starting scrape of group chat', { chatName: chat.name, chatId: chat.id._serialized });

    while (true) {
      const batch = await chat.fetchMessages({
        limit: batchSize,
        ...(lastMessage ? { before: lastMessage } : {})
      });

      if (!batch || batch.length === 0) {
        break;
      }

      for (const msg of batch) {
        try {
          if (msg.type !== 'chat') continue;
          if (msg.hasMedia) continue;
          const serializedId = msg.id && msg.id._serialized ? msg.id._serialized : null;
          const messageId = serializedId || TextProcessor.generateMessageId(msg);
          if (serializedId && seenIds.has(serializedId)) continue;

          const exists = await vectorStore.hasPoint(messageId);
          if (exists) {
            if (serializedId) seenIds.add(serializedId);
            continue;
          }

          const cleanedText = TextProcessor.cleanText(msg.body || '');
          if (!cleanedText || cleanedText.length < minLength) continue;

          const embedding = await embeddingService.generateEmbedding(cleanedText);
          const client = await whatsappService.getClient();
          const senderName = await resolveAuthorName(msg, client, chat);
          const mentions = await resolveMentionNames(msg, client);

          await vectorStore.storeMessage({
            id: messageId,
            chatId: chat.id._serialized,
            sender: senderName,
            text: cleanedText,
            timestamp: (msg.timestamp || Math.floor(Date.now() / 1000)) * 1000,
            embedding,
            author_id: msg.author || msg.from,
            mentions,
            from_me: !!msg.fromMe,
            message_type: msg.type,
            is_group: true
          });

          if (serializedId) seenIds.add(serializedId);
          total++;
          if (total % 100 === 0) {
            logger.info('Scrape progress', { stored: total, unique: seenIds.size });
          }
        } catch (err) {
          logger.warn('Failed to store scraped message', { error: err.message });
        }
      }

      const nextLast = batch[batch.length - 1];
      if (
        lastMessage &&
        nextLast &&
        nextLast.id &&
        lastMessage.id &&
        nextLast.id._serialized === lastMessage.id._serialized
      ) {
        logger.warn('Pagination stalled on same last message, stopping scrape');
        break;
      }

      lastMessage = nextLast;
    }

    logger.info('Completed scrape of group chat', { chatName: chat.name, stored: total, unique: seenIds.size });
    return total;
  }

  setActiveGroup(chat) {
    this.activeGroup = chat ? { id: chat.id._serialized, name: chat.name } : null;
    if (this.activeGroup) {
      logger.info('Active group set', { chatName: this.activeGroup.name, chatId: this.activeGroup.id });
    }
  }

  getActiveGroup() {
    return this.activeGroup;
  }
}

module.exports = new ScraperService();
