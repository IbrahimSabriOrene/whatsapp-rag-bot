const ragService = require('../services/rag.service');
const scraperService = require('../services/scraper.service');
const whatsappService = require('../services/whatsapp.service');
const logger = require('../services/logger.service');
const TextProcessor = require('../utils/textProcessor');
const embeddingService = require('../services/embedding.service');
const vectorStore = require('../services/vectorStore.service');
const { getConversationId, resolveAuthorName } = require('../utils/wa-utils');
const config = require('../config/config');
const state = require('../config/state');

// Safely react to a message without throwing if reaction fails
async function tryReact(msg, emoji) {
  if (!msg || typeof msg.react !== 'function') return;
  try {
    await msg.react(emoji);
  } catch (err) {
    logger.debug('Reaction failed', { emoji, error: err.message });
  }
}

class QuestionHandler {
  async handleQuestion(msg) {
    try {
      const nowMs = Date.now();
      const msgTimeMs = (typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : nowMs);
      const maxAgeMs = (config.bot.replyMaxAgeSeconds || 60) * 1000;
      const isHistoryMsg = !!(msg._data && (msg._data.isMdHistoryMsg || (msg._data.isNewMsg === false)));
      if ((nowMs - msgTimeMs) > maxAgeMs || isHistoryMsg) {
        return;
      }

      const triggerWord = state.getTriggerWord() || config.bot.triggerWord;
      let question = TextProcessor.extractQuestion(
        msg.body,
        triggerWord
      );

      // Allow natural questions without the trigger word
      if (!question && TextProcessor.isNaturalQuestion(msg.body)) {
        question = TextProcessor.cleanText(msg.body);
      }

      if (!question) {
        await whatsappService.sendMessage(
          msg.from,
          `Please format your question as: "${triggerWord} your question here"`
        );
        return;
      }

      // Determine target chat: use active group if asked from a DM
      let targetChatId = getConversationId(msg);
      if (typeof targetChatId === 'string' && targetChatId.endsWith('@c.us')) {
        const active = scraperService.getActiveGroup();
        if (active && active.id) {
          targetChatId = active.id;
        }
      }

      const isGroup = typeof targetChatId === 'string' && targetChatId.endsWith('@g.us');
      const authorId = isGroup && msg.author ? msg.author : msg.from;
      let senderName = msg._data?.notifyName || msg.from;
      try {
        const client = await whatsappService.getClient();
        senderName = await resolveAuthorName(msg, client);
      } catch (_) {}

      const sessionId = `wa:${targetChatId}:${authorId}`;

      logger.info('Processing question', {
        question,
        chatId: targetChatId,
        sender: senderName
      });

      try {
        if (!msg.hasMedia) {
          const cleanedBody = TextProcessor.cleanText(msg.body || '');
          if (cleanedBody && cleanedBody.length >= 3) {
            const messageId = (msg.id && msg.id._serialized) ? msg.id._serialized : TextProcessor.generateMessageId(msg);
            const exists = await vectorStore.hasPoint(messageId);
            if (!exists) {
              const embedding = await embeddingService.generateEmbedding(cleanedBody);
              await vectorStore.storeMessage({
                id: messageId,
                chatId: getConversationId(msg),
                sender: senderName,
                text: cleanedBody,
                timestamp: msg.timestamp * 1000,
                embedding,
                author_id: authorId,
                from_me: !!msg.fromMe,
                message_type: msg.type,
                is_group: !!(msg.from && msg.from.endsWith('@g.us'))
              });
            }
          }
        }
      } catch (err) {
        logger.debug('Failed to store question message', { error: err.message });
      }

      // Send "typing" indicator by reacting to message
      await tryReact(msg, '🤔');

      // Get answer from RAG system (hybrid retrieval)
      const answer = await ragService.answerQuestion(targetChatId, question, { sessionId });

      // Send answer
      await whatsappService.sendMessage(msg.from, answer);
      
      // React with checkmark
      await tryReact(msg, '✅');

      logger.info('Question answered successfully', { chatId: msg.from });

    } catch (error) {
      logger.error('Failed to handle question', { 
        error: error.message,
        chatId: msg.from 
      });
      
      await whatsappService.sendMessage(
        msg.from,
        "Sorry, I encountered an error processing your question. Please try again."
      );
    }
  }
}

module.exports = new QuestionHandler();
