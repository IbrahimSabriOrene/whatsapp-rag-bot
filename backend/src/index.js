const express = require('express');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws');
const whatsappService = require('./services/whatsapp.service');
const vectorStore = require('./services/vectorStore.service');
const ragService = require('./services/rag.service');
const messageHandler = require('./handlers/message.handler');
const questionHandler = require('./handlers/question.handler');
const scraperService = require('./services/scraper.service');
const logger = require('./services/logger.service');
const TextProcessor = require('./utils/textProcessor');
const config = require('./config/config');
const state = require('./config/state');
const fs = require('fs');
const path = require('path');
const mediaService = require('./services/media.service');
const syncService = require('./services/sync.service');
const { getConversationId, resolveAuthorName, resolveMentionNames } = require('./utils/wa-utils');

async function main() {
  try {
    console.log('\n' + '='.repeat(60));
    console.log('🤖 WhatsApp RAG Bot Starting...');
    console.log('='.repeat(60));
    
    logger.info('Configuration:', {
      llmProvider: config.llm.provider,
      embeddingProvider: config.embedding.provider,
      triggerWord: state.getTriggerWord() || config.bot.triggerWord,
      localAIUrl: config.localAI?.url,
      localAIModel: config.localAI?.model,
      localEmbeddingUrl: config.embedding?.local?.url,
      localEmbeddingModel: config.embedding?.local?.model
    });
    
    // Initialize vector store
    logger.info('Initializing vector store...');
    await vectorStore.initialize();
    
    const eventClients = new Set();
    const wsClients = new Set();
    const broadcast = (payload) => {
      const json = JSON.stringify(payload);
      const data = `data: ${json}\n\n`;
      for (const res of eventClients) {
        try { res.write(data); } catch (_) {}
      }
      for (const ws of wsClients) {
        try {
          if (ws.readyState === 1) ws.send(json);
        } catch (_) {}
      }
    };
    
    // Allow services to access the broadcast function
    global.broadcastEvent = broadcast;

    whatsappService.onMessage(async (msg) => {
      try {
        // Ignore status updates
        if (msg.isStatus) return;

        const triggerWord = state.getTriggerWord() || config.bot.triggerWord;
        const client = await whatsappService.getClient();
        const authorName = await resolveAuthorName(msg, client);
        const mentions = await resolveMentionNames(msg, client);
        const payload = {
          id: (msg.id && msg.id._serialized) ? msg.id._serialized : undefined,
          chatId: getConversationId(msg),
          type: msg.type,
          body: msg.body || '',
          hasMedia: !!msg.hasMedia,
          timestamp: (typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : Date.now()),
          fromMe: msg.fromMe,
          author: authorName,
          authorId: msg.author || msg.from,
          mentions
        };
        broadcast({ type: 'message', payload });

        // Check if it's a question (trigger word or natural question)
        if (TextProcessor.isQuestion(msg.body, triggerWord) || TextProcessor.isNaturalQuestion(msg.body)) {
          await questionHandler.handleQuestion(msg);
        } else if (config.bot.storeAllMessages) {
          // Store regular messages
          await messageHandler.handleMessage(msg);
        }
      } catch (error) {
        logger.error('Error in message handler', { error: error.message });
      }
    });

    // Minimal HTTP server for settings integration (start regardless of WhatsApp readiness)
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.use('/media', express.static(path.join(__dirname, '../../media')));

    app.get('/api/health', (_req, res) => {
      res.json({ ok: true });
    });

    app.get('/api/overview', async (_req, res) => {
      try {
        const vector = await vectorStore.getStats();
        const waStatus = whatsappService.getStatus();
        return res.json({
          ok: true,
          timestamp: Date.now(),
          whatsapp: { status: waStatus },
          vectorStore: vector,
          llm: {
            provider: config.llm.provider,
            model: config.llm.model,
            localUrl: config.localAI?.url,
            localEndpoint: config.localAI?.endpoint
          },
          embedding: {
            provider: config.embedding.provider,
            model: (config.embedding.provider === 'local' ? config.embedding.local.model
              : config.embedding.provider === 'ollama' ? config.embedding.ollama.model
              : config.embedding.provider === 'openai' ? config.embedding.openai.model
              : config.embedding.provider === 'huggingface' ? config.embedding.huggingface.model
              : undefined)
          }
        });
      } catch (err) {
        logger.warn('Failed to build overview', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to build overview' });
      }
    });

    app.get('/api/events', (req, res) => {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.write('retry: 2000\n\n');
      eventClients.add(res);
      req.on('close', () => {
        eventClients.delete(res);
        try { res.end(); } catch (_) {}
      });
    });

    app.get('/api/settings', (_req, res) => {
      res.json({
        targetGroupId: state.getTargetGroupId() || config.bot.targetGroupId,
        targetChatId: state.getTargetChatId() || state.getTargetGroupId() || config.bot.targetGroupId,
        triggerPrefix: state.getTriggerPrefix() || config.bot.triggerPrefix,
        triggerWord: state.getTriggerWord() || config.bot.triggerWord
      });
    });

    app.post('/api/settings', async (req, res) => {
      const { targetGroupId, targetChatId, triggerPrefix, triggerWord } = req.body || {};
      const prevTargetChatId = state.getTargetChatId() || state.getTargetGroupId() || config.bot.targetGroupId;

      // Prefer targetChatId, but accept legacy targetGroupId
      if (targetChatId !== undefined) {
        state.setTargetChatId(targetChatId);
      } else if (targetGroupId !== undefined) {
        state.setTargetGroupId(targetGroupId);
        state.setTargetChatId(targetGroupId);
      }

      if (triggerPrefix !== undefined) state.setTriggerPrefix(triggerPrefix);
      if (triggerWord !== undefined) state.setTriggerWord(triggerWord);

      const newTargetChatId = state.getTargetChatId() || state.getTargetGroupId() || config.bot.targetGroupId;

      // Do not send any WhatsApp message on save; persist only

      res.json({
        ok: true,
        settings: {
          targetGroupId: state.getTargetGroupId() || config.bot.targetGroupId,
          targetChatId: state.getTargetChatId() || state.getTargetGroupId() || config.bot.targetGroupId,
          triggerPrefix: state.getTriggerPrefix() || config.bot.triggerPrefix,
          triggerWord: state.getTriggerWord() || config.bot.triggerWord
        }
      });
    });

    app.get('/api/groups', async (_req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const groups = await scraperService.listGroupChats();
        const toMs = (ts) => {
          const n = typeof ts === 'number' ? ts : 0;
          if (!n) return 0;
          return n < 1e12 ? n * 1000 : n;
        };
        const list = groups.map(g => ({
          id: g?.id?._serialized || g?.id || '',
          name: g?.name || g?.formattedTitle || g?.contact?.pushname || g?.contact?.name || (g?.id?._serialized || '').split('@')[0] || 'Unnamed group',
          timestamp: toMs(g?.timestamp || g?.lastMessage?.timestamp)
        }));
        return res.json({ ok: true, groups: list });
      } catch (err) {
        logger.warn('Failed to list groups', { error: err.message });
        return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
      }
    });

    app.get('/api/contacts', async (_req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const contacts = await scraperService.listPersonalChats();
        const toMs = (ts) => {
          const n = typeof ts === 'number' ? ts : 0;
          if (!n) return 0;
          return n < 1e12 ? n * 1000 : n;
        };
        const list = contacts.map(c => ({
          id: c?.id?._serialized || c?.id || '',
          name: c?.name || c?.contact?.pushname || c?.contact?.name || c?.formattedTitle || (c?.id?._serialized || '').split('@')[0] || 'Unnamed contact',
          timestamp: toMs(c?.timestamp || c?.lastMessage?.timestamp)
        }));
        return res.json({ ok: true, contacts: list });
      } catch (err) {
        logger.warn('Failed to list contacts', { error: err.message });
        return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
      }
    });

    app.get('/api/chats', async (_req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const groups = await scraperService.listGroupChats();
        const contacts = await scraperService.listPersonalChats();
        const toMs = (ts) => {
          const n = typeof ts === 'number' ? ts : 0;
          if (!n) return 0;
          return n < 1e12 ? n * 1000 : n;
        };
        const list = [];
        for (const g of groups) {
          list.push({
            id: g?.id?._serialized || g?.id || '',
            name: g?.name || g?.formattedTitle || g?.contact?.pushname || g?.contact?.name || (g?.id?._serialized || '').split('@')[0] || 'Unnamed group',
            isGroup: true,
            timestamp: toMs(g?.timestamp || g?.lastMessage?.timestamp)
          });
        }
        for (const c of contacts) {
          list.push({
            id: c?.id?._serialized || c?.id || '',
            name: c?.name || c?.contact?.pushname || c?.contact?.name || c?.formattedTitle || (c?.id?._serialized || '').split('@')[0] || 'Unnamed contact',
            isGroup: false,
            timestamp: toMs(c?.timestamp || c?.lastMessage?.timestamp)
          });
        }
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        return res.json({ ok: true, chats: list });
      } catch (err) {
        logger.warn('Failed to list chats', { error: err.message });
        return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
      }
    });

    app.get('/api/chat/:id/messages', async (req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const chatId = req.params.id;
        const limit = Math.min(500, Math.max(1, parseInt(req.query.limit || '50', 10)));
        const beforeId = req.query.beforeId ? String(req.query.beforeId) : null;
        const includeMedia = String(req.query.includeMedia || 'false') === 'true';
        const client = await whatsappService.getClient();
        const chat = await client.getChatById(chatId);
        let opts = { limit };
        if (beforeId) {
          const beforeMsg = await client.getMessageById(beforeId);
          if (beforeMsg) opts = { ...opts, before: beforeMsg };
        }
        const batch = await chat.fetchMessages(opts);
        const out = [];
        for (const msg of batch) {
          const authorName = await resolveAuthorName(msg, client, chat);
          const mentions = await resolveMentionNames(msg, client);
          const base = {
            id: (msg.id && msg.id._serialized) ? msg.id._serialized : undefined,
            chatId: chatId,
            type: msg.type,
            body: msg.body || '',
            hasMedia: !!msg.hasMedia,
            timestamp: (typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : Date.now()),
            author: authorName,
            authorId: msg.author || msg.from,
            mentions,
            fromMe: !!msg.fromMe
          };
          if (includeMedia && msg.hasMedia) {
            const filePath = await mediaService.ensureOnDisk(chatId, base.id, async () => await msg.downloadMedia());
            if (filePath) {
              base.mediaUrl = `/api/media/${encodeURIComponent(chatId)}/${encodeURIComponent(base.id)}`;
            }
          }
          out.push(base);
        }
        return res.json({ ok: true, messages: out });
      } catch (err) {
        logger.error('Failed to list messages', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to list messages' });
      }
    });

    app.post('/api/chat/:id/sync', async (req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const chatId = req.params.id;
        const limit = Math.min(500, Math.max(50, parseInt(req.query.limit || '200', 10)));
        const result = await syncService.syncChat(chatId, { limit });
        return res.json(result);
      } catch (err) {
        logger.error('Failed to sync chat', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to sync chat' });
      }
    });

    app.post('/api/embeddings/sync', async (req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        if (syncService.isRunning()) {
          return res.status(409).json({ ok: false, busy: true, error: 'Embedding sync already running' });
        }

        const perChatLimit = Math.min(500, Math.max(50, parseInt(req.query.perChatLimit || '200', 10)));
        const maxPagesPerChat = Math.min(10_000, Math.max(1, parseInt(req.query.maxPagesPerChat || '2000', 10)));
        const force = String(req.query.force || 'false') === 'true';
        const jobId = `embsync:${Date.now()}`;

        broadcast({ type: 'embedding_sync', status: 'started', jobId, perChatLimit, maxPagesPerChat, force });

        setImmediate(async () => {
          try {
            const result = await syncService.syncAllFull({
              perChatLimit,
              maxPagesPerChat,
              force,
              onProgress: (p) => broadcast({ type: 'embedding_sync', status: 'progress', jobId, ...p })
            });
            broadcast({ type: 'embedding_sync', status: 'done', jobId, ...result });
          } catch (err) {
            broadcast({ type: 'embedding_sync', status: 'error', jobId, error: err.message || 'failed' });
          }
        });

        return res.json({ ok: true, started: true, jobId });
      } catch (err) {
        logger.error('Failed to start embeddings sync', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to start embeddings sync' });
      }
    });

    app.get('/api/media/:chatId/:messageId', async (req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const chatId = req.params.chatId;
        const messageId = req.params.messageId;
        const client = await whatsappService.getClient();
        const msg = await client.getMessageById(messageId);
        if (!msg) {
          return res.status(404).json({ ok: false, error: 'Message not found' });
        }
        const pathOnDisk = await mediaService.ensureOnDisk(chatId, messageId, async () => await msg.downloadMedia());
        if (!pathOnDisk) {
          return res.status(404).json({ ok: false, error: 'Media not available' });
        }
        const ext = pathOnDisk.split('.').pop().toLowerCase();
        const types = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', webm: 'audio/webm' };
        const mime = types[ext] || 'application/octet-stream';
        res.setHeader('Content-Type', mime);
        fs.createReadStream(pathOnDisk).pipe(res);
      } catch (err) {
        logger.error('Failed to serve media', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to serve media' });
      }
    });

    app.post('/api/chat/:id/send', async (req, res) => {
      try {
        const status = whatsappService.getStatus();
        if (status !== 'ready') {
          return res.status(503).json({ ok: false, error: 'WhatsApp not ready yet' });
        }
        const chatId = req.params.id;
        const type = String((req.body && req.body.type) || 'text');
        if (type === 'text') {
          const text = TextProcessor.cleanText(String(req.body.text || ''));
          if (!text) return res.status(400).json({ ok: false, error: 'Empty text' });
          await whatsappService.sendMessage(chatId, text);
          return res.json({ ok: true });
        }
        if (type === 'image' || type === 'audio') {
          const base64 = String(req.body.base64 || '');
          const mimetype = String(req.body.mimetype || '');
          const caption = String(req.body.caption || '');
          if (!base64 || !mimetype) return res.status(400).json({ ok: false, error: 'Missing media' });
          await whatsappService.sendMedia(chatId, base64, mimetype, caption);
          return res.json({ ok: true });
        }
        return res.status(400).json({ ok: false, error: 'Unsupported type' });
      } catch (err) {
        logger.error('Failed to send message', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to send message' });
      }
    });

    // WhatsApp auth status & QR endpoints
    app.get('/api/whatsapp/status', (_req, res) => {
      const status = whatsappService.getStatus();
      res.json({ ok: true, status });
    });

    // Optional: restart WhatsApp client if stuck in authenticated but not ready
    app.post('/api/whatsapp/reload', async (_req, res) => {
      try {
        await whatsappService.restart();
        const status = whatsappService.getStatus();
        return res.json({ ok: true, status });
      } catch (err) {
        logger.error('Failed to reload WhatsApp client', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to reload WhatsApp client' });
      }
    });

    app.post('/api/whatsapp/logout', async (_req, res) => {
      try {
        await whatsappService.logout();
        const status = whatsappService.getStatus();
        return res.json({ ok: true, status });
      } catch (err) {
        logger.error('Failed to logout WhatsApp client', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to logout WhatsApp client' });
      }
    });

    app.get('/api/whatsapp/qr', (_req, res) => {
      const qr = whatsappService.getLatestQr();
      if (!qr) {
        return res.status(404).json({ ok: false, error: 'QR not available' });
      }
      res.json({ ok: true, qr });
    });

    // Interactive Chat: ask a question against the vector database context
    app.post('/api/chat/ask', async (req, res) => {
      try {
        const { question, chatId, sessionId } = req.body || {};
        const cleaned = TextProcessor.cleanText(question || '');
        if (!cleaned) {
          return res.status(400).json({ ok: false, error: 'Empty question' });
        }

        // Default to configured target chat/group if none provided
        const targetChatId = (typeof chatId === 'string' && chatId) ||
          state.getTargetChatId() || state.getTargetGroupId() || config.bot.targetGroupId;

        const sid = (typeof sessionId === 'string' && sessionId.trim())
          ? sessionId.trim()
          : `web:${targetChatId}`;

        const answer = await ragService.answerQuestion(targetChatId, cleaned, { sessionId: sid });
        return res.json({ ok: true, chatId: targetChatId, sessionId: sid, answer });
      } catch (err) {
        logger.error('Ask endpoint failed', { error: err.message });
        return res.status(500).json({ ok: false, error: 'Failed to generate answer' });
      }
    });

    const PORT = process.env.BACKEND_PORT ? parseInt(process.env.BACKEND_PORT, 10) : 4000;
    const server = http.createServer(app);
    const wss = new WebSocketServer({ server, path: '/ws' });
    wss.on('connection', (ws) => {
      wsClients.add(ws);
      ws.on('close', () => wsClients.delete(ws));
      ws.on('error', () => wsClients.delete(ws));
      try { ws.send(JSON.stringify({ type: 'connected', ts: Date.now() })); } catch (_) {}
    });
    server.listen(PORT, () => {
      logger.info('Backend settings server listening', { port: PORT });
      console.log(`⚙️  Settings API: http://localhost:${PORT}`);
    });

    // Initialize WhatsApp client asynchronously
    logger.info('Initializing WhatsApp client...');
    whatsappService.initialize().catch((error) => {
      logger.error('WhatsApp init failed', { error: error.message });
    });

    syncService.start({ intervalMs: 60_000 * 2 });
    whatsappService.ensureReady(60_000 * 5)
      .then(() => syncService.syncOnce({ perChatLimit: 200 }))
      .catch(() => {});

    console.log('='.repeat(60));
    console.log('✓ Bot is running!');
    console.log(`✓ Send messages to build context`);
    console.log(`✓ Ask questions using: "${state.getTriggerWord() || config.bot.triggerWord} your question"`);
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    logger.error('Fatal error during startup', { error: error.message });
    console.error('\n❌ Failed to start bot:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('Shutting down gracefully...');
  console.log('\n\n👋 Bot shutting down...\n');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('Shutting down gracefully...');
  console.log('\n\n👋 Bot shutting down...\n');
  process.exit(0);
});

// Start the application
main().catch(error => {
  logger.error('Unhandled error', { error: error.message });
  console.error('\n❌ Fatal error:', error.message);
  process.exit(1);
});
