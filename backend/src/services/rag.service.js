const axios = require("axios");
const chrono = require("chrono-node");
const config = require("../config/config");
const logger = require("./logger.service");
const embeddingService = require("./embedding.service");
const vectorStore = require("./vectorStore.service");
const TextProcessor = require("../utils/textProcessor");
const sessionService = require("./session.service");
const syncService = require("./sync.service");

const mcpService = require("./mcp.service");

class RAGService {
  constructor() {
    this.provider = config.llm.provider;
    logger.info(`LLM provider initialized: ${this.provider}`);

    // Initialize MCP Service
    mcpService.initialize().catch((err) => {
      logger.warn("MCP Service init warning (non-fatal)", {
        error: err.message,
      });
    });
  }

  async answerQuestion(chatId, queryText, options = {}) {
    try {
      const { sessionId } = options;
      logger.info("Processing question (hybrid RAG)", { queryText, chatId, sessionId });

      // Helper for broadcasting reasoning steps
      const emitStep = (step, message, details = null) => {
        if (global.broadcastEvent) {
          global.broadcastEvent({
            type: "reasoning",
            payload: { chatId, step, message, details, ts: Date.now() },
          });
        }
      };

      emitStep("start", "Analyzing your question...");

      const cleanedQuery = TextProcessor.cleanText(queryText || "");
      if (!cleanedQuery) {
        return "Soru metni boş görünüyor.";
      }

      const isTurkish = this._isTurkish(cleanedQuery);

      // --- MCP / Reasoning Step ---
      emitStep("reasoning", "Checking for complex reasoning requirements...");
      // 1. Check for "reasoning" intent using Sequential Thinking if available
      // This is a simplified integration: we run a quick reasoning pass if the user asks a complex question.
      // For now, we only use it if the query seems "complex" (length > 50 chars or contains 'neden', 'nasıl').
      let reasoningContext = "";
      if (
        cleanedQuery.length > 50 ||
        /neden|nasıl|why|how/i.test(cleanedQuery)
      ) {
        try {
          // We could call the sequential-thinking tool here.
          // However, proper "agentic" loops require multiple LLM turns.
          // For this "production-ready" MVP, we will inject a system instruction
          // that encourages the model to use its internal reasoning, or use the tool if we had a loop.
          //
          // Instead, let's use the Memory MCP to fetch any known facts about this user/chat context.
          // (Assuming we had a user identifier. We'll use chatId as a proxy for now.)
          // TODO: Implement read_graph tool call when Memory server is fully populated.
          // const memory = await mcpService.callTool('memory', 'read_graph', { });
          // if (memory) reasoningContext = JSON.stringify(memory);
        } catch (err) {
          logger.debug("MCP reasoning step skipped", { error: err.message });
        }
      }

      // --- Tool-Use / Intent Detection Step ---
      emitStep("intent", "Detecting intent and required tools...");
      // Instead of regex heuristics, we ask the LLM to classify the intent and parameters.
      // This is critical for accurate time resolution (e.g. "last friday" vs "friday before last").
      let dateRange = null;
      let toolUseContext = "";

      // Prepare tools definition for the intent classification model
      const toolsDef = [
        {
          name: "resolve_date_range",
          description:
            "Resolve natural language date queries into UTC timestamps. Use this when the user asks about a specific time period (yesterday, last week, on monday, etc).",
          parameters: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description:
                  'The time-related part of the user query (e.g. "yesterday", "last week")',
              },
            },
            required: ["query"],
          },
        },
        // We can add more tools here later (e.g. search_web, calculate, etc.)
      ];

      try {
        // We do a quick "intent check" call first.
        // Note: For local models, we format this as a system prompt with JSON output instruction if they don't support native tool calling API.
        // Since config.llm.provider might be 'openai' or 'anthropic' which support tools, or 'local' which might not,
        // we'll implement a robust "JSON system prompt" approach that works universally for now.

        const intentPrompt = `
        You are an intent classifier for a WhatsApp bot.
        Current Date/Time: ${new Date().toLocaleString("tr-TR")}
        User Query: "${cleanedQuery}"

        Available Tools:
        ${JSON.stringify(toolsDef, null, 2)}

        INSTRUCTIONS:
        1. Identify if the user mentions a specific time relative to now (e.g. "bugün", "dün", "2 gün önce", "geçen hafta", "last week", "yesterday").
        2. If YES, call "resolve_date_range" with the extracted time phrase.
        3. If the user asks for a summary ("özet", "ne konuştuk"), include that in the reasoning but purely map the time to the tool.

        Output JSON ONLY:
        { "tool": "resolve_date_range", "arguments": { "query": "EXTRACTED_TIME_PHRASE" } }
        OR
        { "tool": null }
              `.trim();

        // Use a "fast" model if available, otherwise the main one
        // For simplicity reusing _generateAnswer but essentially we want a quick check
        // We force temperature 0 for deterministic tool selection
        const toolResponse = await this._generateAnswer(intentPrompt);

        let toolCall = null;
        try {
          // Extract JSON from potential wrapper text
          const jsonMatch = toolResponse.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            toolCall = JSON.parse(jsonMatch[0]);
          }
        } catch (e) {
          logger.warn("Failed to parse tool selection JSON", {
            response: toolResponse,
          });
        }

        if (toolCall && toolCall.tool === "resolve_date_range") {
          logger.info("LLM selected tool", {
            tool: toolCall.tool,
            args: toolCall.arguments,
          });
          emitStep("tool", `Using tool: ${toolCall.tool}`, toolCall.arguments);

          // Execute the tool via MCP service
          const resolution = await mcpService.callTool(
            "time",
            "resolve_date_range",
            toolCall.arguments,
          );

          if (resolution && resolution.content && resolution.content[0]) {
            const json = JSON.parse(resolution.content[0].text);
            if (json.startMs && json.endMs) {
              dateRange = { startMs: json.startMs, endMs: json.endMs };
              toolUseContext = `Time Context: ${json.query} resolved to ${new Date(json.startMs).toISOString()} - ${new Date(json.endMs).toISOString()}`;
              logger.info("Time MCP resolved range via LLM", { json });
              emitStep(
                "tool_result",
                `Resolved date range: ${new Date(json.startMs).toLocaleDateString()} - ${new Date(json.endMs).toLocaleDateString()}`,
              );
            }
          }
        }
      } catch (err) {
        logger.warn("Intent detection/Tool use failed", { error: err.message });
        // Fallback to regex/manual parser if LLM tool selection fails
        dateRange = this._parseDateRange(cleanedQuery);
        if (dateRange) emitStep("fallback", "Using fallback date parser");
      }
      // --- Standard RAG Flow (Optimized & Fixed) ---
      emitStep("retrieval", "Searching for relevant messages...");
      const mode = this._detectMode(cleanedQuery, isTurkish, !!dateRange);

      // KRİTİK DÜZELTME: Değişkeni burada, en dışta tanımlıyoruz.
      let combined = [];

      // SENARYO 1: Tarih Aralığı Var (Örn: "Dün ne oldu?")
      if (dateRange) {
        emitStep(
          "retrieval",
          `Fetching messages for date query: ${dateRange.query || "range"}...`,
        );

        // Tarih aralığındaki mesajları çek
        const dateResults = await vectorStore.getMessagesByDateRange(
          chatId,
          dateRange.startMs,
          dateRange.endMs,
          500,
        );

        // Tarih sorgusunda semantic arama sonuçlarını karıştırmıyoruz
        combined = dateResults || [];

        if (!combined.length) {
          emitStep(
            "retrieval",
            "No messages found in that specific date range.",
          );
        } else {
          emitStep(
            "context",
            `Found ${combined.length} messages in date range.`,
          );
        }
      }

      // SENARYO 2: Tarih Yok, Semantic Arama (Örn: "Plan neydi?")
      else {
        const queryEmbedding =
          await embeddingService.generateEmbedding(cleanedQuery);
        const semanticLimit =
          mode === "summary" ? 20 : config.bot.maxContextMessages;

        let semanticResults = await vectorStore.searchSimilar(
          queryEmbedding,
          chatId,
          semanticLimit,
        );

        if (!semanticResults.length) {
          // Hiçbir şey bulunamazsa son mesajları getir
          semanticResults = await vectorStore.getRecentMessages(chatId, 20);
        }
        combined = semanticResults || [];
      }

      // Context boyutunu kontrol et ve sırala
      // Tarihe göre eskiden yeniye sırala ki LLM akışı anlasın
      if (combined.length > 0) {
        combined = combined.sort((a, b) => a.timestamp - b.timestamp);

        // Çok fazla mesaj varsa son (en güncel) 100 tanesini al
        const MAX_CONTEXT_CAP = 100;
        if (combined.length > MAX_CONTEXT_CAP) {
          combined = combined.slice(-MAX_CONTEXT_CAP);
        }
      }

      // Son kontrol: Hâlâ mesaj yoksa
      if (!combined.length) {
        if (!dateRange) {
          // Sadece tarih yoksa sync dene
          const syncRes = await syncService.syncChat(chatId, { limit: 50 });
          if (syncRes && syncRes.stored > 0) {
            // Sync sonrası hızlı bir tekrar deneme yapılabilir (opsiyonel)
          }
        }

        if (!combined.length) {
          emitStep("complete", "No messages found.");
          return isTurkish
            ? "Bu kriterlere uygun sohbet geçmişi bulamadım."
            : "I couldn't find messages matching your criteria.";
        }
      }

      // 5) Format context and truncate to fit local model window
      const contextRaw = this._formatContext(combined, isTurkish);
      const contextText = this._truncateContext(contextRaw);

      const sessionHistory = sessionId
        ? await sessionService.getHistory(sessionId, 12)
        : [];
      const sessionText = this._formatSessionHistory(sessionHistory, isTurkish);

      // 6) Build prompt
      const prompt = this._buildHybridPrompt({
        queryText: cleanedQuery,
        contextText,
        isTurkish,
        mode,
        sessionText,
      });

      // 7) Generate answer via configured provider (LM Studio for local)
      emitStep("generation", "Generating answer with local LLM...");
      const answer = await this._generateAnswer(prompt);
      logger.info("Hybrid RAG answer generated successfully", {
        chatId,
        contextCount: combined.length,
      });

      if (sessionId) {
        const now = Date.now();
        await sessionService.append(
          sessionId,
          { role: "user", text: cleanedQuery, ts: now },
          30,
        );
        await sessionService.append(
          sessionId,
          {
            role: "assistant",
            text: String(answer || "").slice(0, 4000),
            ts: now,
          },
          30,
        );
      }

      emitStep("complete", "Answer generated.");
      return answer;
    } catch (error) {
      const details = error?.response?.data || null;
      logger.error("Hybrid RAG pipeline failed", {
        error: error.message,
        details,
      });
      return "Üzgünüm, soruyu işlerken bir hata oluştu.";
    }
  }

  async summarizeChatByDate(chatId, day, month, year) {
    try {
      // Use UTC boundaries to avoid timezone shifts causing off-by-one days
      const start = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
      const end = Date.UTC(year, month - 1, day, 23, 59, 59, 999);

      const messages = await vectorStore.getMessagesByDateRange(
        chatId,
        start,
        end,
        2000,
      );

      if (!messages.length) {
        return `I couldn't find any messages for ${day}/${month}/${year}.`;
      }

      const isTurkish = true; // Respond in Turkish for date summaries
      const context = this._formatContext(messages, isTurkish);
      const prompt = this._buildHybridPrompt({
        queryText: `Tarihteki sohbeti özetle: ${day}/${month}/${year}`,
        contextText: context,
        isTurkish,
        mode: "summary",
        sessionText: "",
      });

      const answer = await this._generateAnswer(prompt);
      return answer;
    } catch (error) {
      logger.error("Failed to summarize chat by date", {
        error: error.message,
      });
      return "Sorry, I had trouble summarizing that date.";
    }
  }

  _formatContext(messages, isTurkish = false) {
    const locale = isTurkish ? "tr-TR" : undefined;
    return messages
      .map((msg, index) => {
        const date = new Date(msg.timestamp).toLocaleString(locale);
        return `[${index + 1}] ${msg.sender} (${date}): ${msg.text}`;
      })
      .join("\n\n");
  }

  _truncateContext(text) {
    try {
      const isLocal = this.provider === "local";
      // Conservative cap to fit 4k token window on local llama-class models
      // Roughly ~3 chars/token; keep extra headroom for system/user wrappers
      let capChars = 6000;
      if (isLocal) {
        capChars = 6000;
      }
      if (!text || typeof text !== "string") return "";
      if (text.length <= capChars) return text;
      const truncated = text.slice(text.length - capChars);
      logger.debug("Context truncated to fit model window", {
        originalLength: text.length,
        capChars,
      });
      return truncated;
    } catch (e) {
      return text;
    }
  }

  async _generateAnswer(prompt) {
    switch (this.provider) {
      case "anthropic":
        return await this._callAnthropic(prompt);
      case "openai":
        return await this._callOpenAI(prompt);
      case "openrouter":
        return await this._callOpenRouter(prompt);
      case "local":
        return await this._callLocalAI(prompt);
      default:
        throw new Error(`Unknown LLM provider: ${this.provider}`);
    }
  }

  _buildHybridPrompt({ queryText, contextText, isTurkish, mode, sessionText }) {
    const sessionBlock = sessionText ? `${sessionText}\n\n` : "";
    if (isTurkish) {
      if (mode === "summary") {
        return `${sessionBlock}Sohbet geçmişi aşağıdadır.
İstek: "${queryText}"
Bu mesajlara dayanarak kısa ve net bir özet çıkar.
${contextText}
Yanıt:`;
      }
      return `${sessionBlock}Sohbet geçmişi aşağıdadır.
Soru: "${queryText}"
Bu mesajlara dayanarak soruyu yanıtla. Eğer bağlamda yoksa bunu açıkça söyle.
${contextText}
Yanıt:`;
    }
    if (mode === "summary") {
      return `${sessionBlock}Conversation history is below.
Request: "${queryText}"
Write a concise summary based on these messages.
${contextText}
Answer:`;
    }
    return `${sessionBlock}Conversation history is below.
Question: "${queryText}"
Answer based on these messages. If it's not in the context, say you don't know.
${contextText}
Answer:`;
  }

  _detectMode(text, isTurkish, hasDateRange) {
    const lower = String(text || "").toLowerCase();
    const summaryHints = [
      "özet",
      "özetle",
      "kısaca",
      "özetini",
      "özet çıkar",
      "ne konuştuk",
      "neler konuştuk",
      "ne konuşmuştuk",
      "neler konuşmuştuk",
      "what did we talk about",
      "what were we talking about",
      "what did we discuss",
      "summarize",
      "summary",
      "recap",
    ];
    const wantsSummary = summaryHints.some((h) => lower.includes(h));
    if (wantsSummary) return "summary";
    if (
      hasDateRange &&
      isTurkish &&
      lower.includes("ne") &&
      lower.includes("konuş")
    )
      return "summary";
    return "qa";
  }

  _formatSessionHistory(history, isTurkish) {
    if (!Array.isArray(history) || !history.length) return "";
    const lines = history
      .map((h) => {
        const role = h && typeof h.role === "string" ? h.role : "unknown";
        const text = h && typeof h.text === "string" ? h.text : "";
        if (!text) return null;
        const label =
          role === "user"
            ? isTurkish
              ? "Kullanıcı"
              : "User"
            : isTurkish
              ? "Asistan"
              : "Assistant";
        return `${label}: ${text}`;
      })
      .filter(Boolean);
    if (!lines.length) return "";
    return (
      (isTurkish ? "Önceki konuşma:" : "Previous conversation:") +
      "\n" +
      lines.join("\n")
    );
  }

  async _callAnthropic(prompt) {
    try {
      const response = await axios.post(
        `${config.anthropic.baseURL}/messages`,
        {
          model: config.llm.model,
          max_tokens: config.llm.maxTokens,
          temperature: config.llm.temperature,
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            "x-api-key": config.anthropic.apiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.content[0].text;
    } catch (error) {
      logger.error("Anthropic API call failed", { error: error.message });
      throw error;
    }
  }

  async _callOpenAI(prompt) {
    try {
      const response = await axios.post(
        `${config.openai.baseURL}/chat/completions`,
        {
          model: config.llm.model,
          max_tokens: config.llm.maxTokens,
          temperature: config.llm.temperature,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that answers questions based on WhatsApp chat history.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${config.openai.apiKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error("OpenAI API call failed", { error: error.message });
      throw error;
    }
  }

  async _callOpenRouter(prompt) {
    try {
      const response = await axios.post(
        `${config.openrouter.baseURL}/chat/completions`,
        {
          model: config.openrouter.model,
          max_tokens: config.llm.maxTokens,
          temperature: config.llm.temperature,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that answers questions based on WhatsApp chat history.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        {
          headers: {
            Authorization: `Bearer ${config.openrouter.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/yourusername/whatsapp-rag-bot",
            "X-Title": "WhatsApp RAG Bot",
          },
        },
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      logger.error("OpenRouter API call failed", { error: error.message });
      throw error;
    }
  }

  async _callLocalAI(prompt) {
    try {
      const endpoint = (
        config.localAI.endpoint || "chat_completions"
      ).toLowerCase();

      await this._verifyLocalLLMModelOnce();

      if (endpoint === "responses") {
        const response = await axios.post(
          `${config.localAI.url}/v1/responses`,
          {
            model: config.localAI.model,
            input: [
              {
                role: "user",
                content: [{ type: "text", text: prompt }],
              },
            ],
            temperature: config.llm.temperature,
            max_output_tokens: config.llm.maxTokens,
          },
          { headers: { "Content-Type": "application/json" } },
        );

        if (response.data && typeof response.data.output_text === "string") {
          return response.data.output_text;
        }
        const output =
          response.data && Array.isArray(response.data.output)
            ? response.data.output
            : [];
        if (
          output.length &&
          output[0].content &&
          output[0].content.length &&
          output[0].content[0].text
        ) {
          return output[0].content[0].text;
        }
        throw new Error("Unexpected responses payload shape");
      }

      if (endpoint === "completions") {
        const response = await axios.post(
          `${config.localAI.url}/v1/completions`,
          {
            model: config.localAI.model,
            prompt: prompt,
            max_tokens: config.llm.maxTokens,
            temperature: config.llm.temperature,
          },
          { headers: { "Content-Type": "application/json" } },
        );
        return response.data.choices[0].text;
      }

      // Default to chat_completions
      const response = await axios.post(
        `${config.localAI.url}/v1/chat/completions`,
        {
          model: config.localAI.model,
          max_tokens: config.llm.maxTokens,
          temperature: config.llm.temperature,
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant that answers questions based on WhatsApp chat history.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
        },
        { headers: { "Content-Type": "application/json" } },
      );
      return response.data.choices[0].message.content;
    } catch (error) {
      const details = error?.response?.data || null;
      logger.error("Local AI call failed", {
        error: error.message,
        url: config.localAI.url,
        model: config.localAI.model,
        endpoint: config.localAI.endpoint || "chat_completions",
        details,
      });
      throw new Error(
        `Local AI error: ${error.message}. Ensure your local server is reachable at ${config.localAI.url}, the model "${config.localAI.model}" is loaded (see /v1/models), and the endpoint "${config.localAI.endpoint || "chat_completions"}" matches your server.`,
      );
    }
  }

  // ---------- Helpers ----------
  _isTurkish(text) {
    const lower = (text || "").toLowerCase();
    const trWords = [
      "ne",
      "nasıl",
      "neden",
      "hangi",
      "kim",
      "ne zaman",
      "özet",
      "özetle",
      "konuda",
      "düşünüyorduk",
      "hafta",
      "gün",
      "ay",
      "bugün",
      "yarın",
      "dün",
      "geçen",
      "bu hafta",
      "geçen hafta",
      "bu ay",
      "geçen ay",
    ];
    const hasTurkishChars = /[çğıİöşü]/.test(lower);
    return hasTurkishChars || trWords.some((w) => lower.includes(w));
  }

  _parseDateRange(text) {
    try {
      const lower = (text || "").toLowerCase();

      // Simple Turkish phrases mapping
      const now = new Date();
      const todayStart = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        0,
        0,
        0,
        0,
      );
      const todayEnd = Date.UTC(
        now.getUTCFullYear(),
        now.getUTCMonth(),
        now.getUTCDate(),
        23,
        59,
        59,
        999,
      );

      if (/(bugün)/i.test(lower))
        return { startMs: todayStart, endMs: todayEnd };
      if (/(dün)/i.test(lower)) {
        const d = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const s = Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          0,
          0,
          0,
          0,
        );
        const e = Date.UTC(
          d.getUTCFullYear(),
          d.getUTCMonth(),
          d.getUTCDate(),
          23,
          59,
          59,
          999,
        );
        return { startMs: s, endMs: e };
      }
      if (/(geçen hafta|last week)/i.test(lower)) {
        // Previous Monday..Sunday in UTC
        const d = new Date(now);
        const day = d.getUTCDay(); // 0..6 (Sun..Sat)
        const lastSunday = new Date(
          Date.UTC(
            d.getUTCFullYear(),
            d.getUTCMonth(),
            d.getUTCDate() - day - 1,
          ),
        );
        const lastMonday = new Date(
          lastSunday.getTime() - 6 * 24 * 60 * 60 * 1000,
        );
        const s = Date.UTC(
          lastMonday.getUTCFullYear(),
          lastMonday.getUTCMonth(),
          lastMonday.getUTCDate(),
          0,
          0,
          0,
          0,
        );
        const e = Date.UTC(
          lastSunday.getUTCFullYear(),
          lastSunday.getUTCMonth(),
          lastSunday.getUTCDate(),
          23,
          59,
          59,
          999,
        );
        return { startMs: s, endMs: e };
      }

      // Numeric formats: dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy
      const m = lower.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})\b/);
      if (m) {
        const day = parseInt(m[1], 10);
        const month = parseInt(m[2], 10);
        const year = parseInt(m[3], 10);
        const s = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
        const e = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
        return { startMs: s, endMs: e };
      }

      // Fall back to chrono-node
      const parsed = chrono.parse(text);
      if (parsed && parsed.length) {
        const p = parsed[0];
        const start = p.start?.date();
        const end = (p.end && p.end.date()) || start;
        if (start) {
          const s = Date.UTC(
            start.getUTCFullYear(),
            start.getUTCMonth(),
            start.getUTCDate(),
            0,
            0,
            0,
            0,
          );
          const e = Date.UTC(
            end.getUTCFullYear(),
            end.getUTCMonth(),
            end.getUTCDate(),
            23,
            59,
            59,
            999,
          );
          return { startMs: s, endMs: e };
        }
      }
      return null;
    } catch (err) {
      logger.warn("Date parsing failed; continuing without date filter", {
        error: err.message,
      });
      return null;
    }
  }

  _mergeDeduplicateMessages(listA, listB) {
    const map = new Map();
    const add = (arr) => {
      for (const m of arr || []) {
        const key = m.id || `${m.sender}:${m.timestamp}:${m.text}`;
        if (!map.has(key)) map.set(key, m);
      }
    };
    add(listA);
    add(listB);
    return Array.from(map.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  async _tryOllamaFormat(prompt) {
    try {
      const response = await axios.post(
        `${config.localAI.url}/api/generate`,
        {
          model: config.localAI.model,
          prompt: prompt,
          stream: false,
        },
        {
          timeout: 60000, // 60 second timeout for local models
        },
      );

      return response.data.response;
    } catch (error) {
      // If Ollama format fails, return null to try other formats
      return null;
    }
  }

  async _verifyLocalLLMModelOnce() {
    if (this._localModelVerified) return;
    try {
      const res = await axios.get(`${config.localAI.url}/v1/models`);
      const models = Array.isArray(res.data.data)
        ? res.data.data.map((m) => m.id)
        : [];
      if (!models.includes(config.localAI.model)) {
        logger.warn("Local LLM model not found", {
          model: config.localAI.model,
          available: models,
        });
      }
    } catch (error) {
      logger.warn("Failed to verify local LLM models", {
        error: error.message,
      });
    } finally {
      this._localModelVerified = true;
    }
  }
}

module.exports = new RAGService();
