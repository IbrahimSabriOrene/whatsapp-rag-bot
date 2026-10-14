const embeddingService = require('../services/embedding.service');
const vectorStore = require('../services/vectorStore.service');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../services/logger.service');
const TextProcessor = require('../utils/textProcessor');
const { getConversationId, resolveAuthorName, resolveMentionNames } = require('../utils/wa-utils');
const config = require('../config/config');
const state = require('../config/state');
const scraperService = require('../services/scraper.service');

// Safely react to a message without interrupting the flow if reactions fail
async function tryReact(msg, emoji) {
  if (!msg || typeof msg.react !== 'function') return;
  try {
    await msg.react(emoji);
  } catch (err) {
    logger.debug('Reaction failed', { emoji, error: err.message });
  }
}

class MessageHandler {
  async handleMessage(msg) {
    try {
      const triggerWord = state.getTriggerWord() || config.bot.triggerWord;

      const senderInfo = await (async () => {
        const client = await whatsappService.getClient();
        const chatId = getConversationId(msg);
        const isGroup = typeof chatId === 'string' && chatId.endsWith('@g.us');
        const authorId = isGroup && msg.author ? msg.author : (msg.fromMe ? (msg.from || '') : (msg.from || ''));
        const senderName = await resolveAuthorName(msg, client);
        const mentions = await resolveMentionNames(msg, client);
        return { isGroup, authorId, senderName, mentions, chatId };
      })();

      const cleanedText = TextProcessor.cleanText(msg.body || '');
      
      if (!cleanedText || cleanedText.length < 3) {
        logger.debug('Message too short, skipping');
        return;
      }

      const messageId = (msg.id && msg.id._serialized) ? msg.id._serialized : TextProcessor.generateMessageId(msg);

      const nowMs = Date.now();
      const msgTimeMs = (typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : nowMs);
      const maxAgeMs = (config.bot.replyMaxAgeSeconds || 60) * 1000;
      const isHistoryMsg = !!(msg._data && (msg._data.isMdHistoryMsg || (msg._data.isNewMsg === false)));
      const tooOldForReply = (nowMs - msgTimeMs) > maxAgeMs || isHistoryMsg;

      // Prefix Q&A trigger: "Hey chatbot, <question>" — works in ANY chat
      const lower = cleanedText.toLowerCase();
      const prefixLower = (state.getTriggerPrefix() || config.bot.triggerPrefix).toLowerCase();
      if (!tooOldForReply && lower.startsWith(prefixLower)) {
        const afterPrefix = cleanedText.substring(prefixLower.length).trim();
        const question = afterPrefix.replace(/^,\s*/, '').trim();

        if (!question) {
          await whatsappService.sendMessage(msg.from, `Please format your question as: "${prefixLower}, your question here"`);
          return;
        }

        const ragService = require('../services/rag.service');
        // Use current chat context; if DM, prefer the active scraped group when available
        let targetChatId = senderInfo.chatId;
        if (typeof targetChatId === 'string' && targetChatId.endsWith('@c.us')) {
          const active = scraperService.getActiveGroup();
          if (active && active.id) {
            targetChatId = active.id;
          }
        }

        logger.info('Prefix trigger detected', { from: msg.from, targetChatId, question });
        try {
          const exists = await vectorStore.hasPoint(messageId);
          if (!exists) {
            const emb = await embeddingService.generateEmbedding(cleanedText);
            await vectorStore.storeMessage({
              id: messageId,
              chatId: senderInfo.chatId,
              sender: senderInfo.senderName,
              text: cleanedText,
              timestamp: msg.timestamp * 1000,
              embedding: emb,
              author_id: senderInfo.authorId,
              mentions: senderInfo.mentions,
              from_me: !!msg.fromMe,
              message_type: msg.type,
              is_group: senderInfo.isGroup
            });
          }
        } catch (err) {
          logger.debug('Failed to store prefix-trigger message', { error: err.message });
        }
        await tryReact(msg, '🤔');
        const authorId = msg.author || msg.from;
        const sessionId = `wa:${targetChatId}:${authorId}`;
        const answer = await ragService.answerQuestion(targetChatId, question, { sessionId });
        await whatsappService.sendMessage(msg.from, answer);
        await tryReact(msg, '✅');
        return;
      }

      // Date summary intent: detect date plus summary keywords (e.g., "summarize 10/11/2025")
      const hasSummaryIntent = /(summarize|summary|talking about|discussing|what happened)/i.test(lower);
      const dateMatch = cleanedText.match(/\b(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\b/);
      if (!tooOldForReply && dateMatch && hasSummaryIntent) {
        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);
        const year = parseInt(dateMatch[3], 10);
        const ragService = require('../services/rag.service');
        const scraperService = require('../services/scraper.service');
        let targetChatId = msg.from;
        // If asked from a DM, use the active scraped group if available
        if (typeof targetChatId === 'string' && targetChatId.endsWith('@c.us')) {
          const active = scraperService.getActiveGroup();
          if (active && active.id) {
            targetChatId = active.id;
          }
        }
        await msg.react('📅');
        const summary = await ragService.summarizeChatByDate(targetChatId, day, month, year);
        await whatsappService.sendMessage(msg.from, summary);
        await msg.react('✅');
        return;
      }

      // Generate embedding
      logger.debug('Processing message for storage', { from: msg.from });
      const exists = await vectorStore.hasPoint(messageId);
      if (!exists) {
        const embedding = await embeddingService.generateEmbedding(cleanedText);

        // Store in vector database
        await vectorStore.storeMessage({
          id: messageId,
          chatId: senderInfo.chatId,
          sender: senderInfo.senderName,
          text: cleanedText,
          timestamp: msg.timestamp * 1000,
          embedding: embedding,
          author_id: senderInfo.authorId,
          mentions: senderInfo.mentions,
          from_me: !!msg.fromMe,
          message_type: msg.type,
          is_group: senderInfo.isGroup
        });
      }

      logger.info('Message stored successfully', { 
        chatId: msg.from, 
        sender: senderInfo.senderName 
      });

      // No acknowledgement message per user preference

    } catch (error) {
      logger.error('Failed to handle message', { 
        error: error.message,
        chatId: msg.from 
      });
    }
  }
}

module.exports = new MessageHandler();// Message processing
