const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const {
  StdioClientTransport,
} = require("@modelcontextprotocol/sdk/client/stdio.js");
const path = require("path");
const logger = require("./logger.service");

/**
 * MCP Service - Manages connections to local MCP servers (Memory, Reasoning, etc.)
 * This acts as an "MCP Host" running inside our Node backend.
 */
class MCPService {
  constructor() {
    this.clients = new Map(); // serverName -> Client
    this.transports = new Map(); // serverName -> Transport
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      logger.info("Initializing MCP Service...");

      // 1. Initialize Memory Server (Knowledge Graph)
      await this._connectLocalServer(
        "memory",
        "@modelcontextprotocol/server-memory/dist/index.js",
      );

      // 2. Initialize Sequential Thinking Server (Reasoning)
      await this._connectLocalServer(
        "reasoning",
        "@modelcontextprotocol/server-sequential-thinking/dist/index.js",
      );

      // 3. Time Server (Internal Implementation since official package is missing)
      // We'll implement a simple internal tool handler for time instead of a full server process
      this._registerInternalTimeTools();

      this.initialized = true;
      logger.info("MCP Service initialized successfully");
    } catch (err) {
      logger.error("Failed to initialize MCP Service", { error: err.message });
    }
  }

  _registerInternalTimeTools() {
    const timeTools = [
      {
        name: "get_current_time",
        description: "Get the current time in UTC and local timezone",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "resolve_date_range",
        description:
          'Resolve natural language date queries (e.g. "yesterday", "last week", "2 days ago", "10 Kasim") into UTC timestamps.',
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Natural language date string",
            },
          },
          required: ["query"],
        },
      },
    ];

    this.clients.set("time", {
      listTools: async () => ({ tools: timeTools }),
      callTool: async ({ name, arguments: args }) => {
        if (name === "get_current_time") {
          return {
            content: [{ type: "text", text: new Date().toISOString() }],
          };
        }

        if (name === "resolve_date_range") {
          const now = new Date();
          let query = (args.query || "").toLowerCase().trim();

          let startMs = 0,
            endMs = 0;
          const oneDay = 86400000;

          // --- Gelişmiş Tarih Mantığı ---

          // 1. "X gün önce" / "X days ago" yakalama
          const daysAgoMatch = query.match(/(\d+)\s*(gün|day)/);

          if (daysAgoMatch) {
            const days = parseInt(daysAgoMatch[1], 10);
            const targetDate = new Date(now.getTime() - days * oneDay);

            // O günün başlangıcı (00:00) ve bitişi (23:59)
            startMs = new Date(
              targetDate.getFullYear(),
              targetDate.getMonth(),
              targetDate.getDate(),
            ).getTime();
            endMs = startMs + oneDay - 1;

            // Eğer "son 3 gün" ("last 3 days") deniyorsa, başlangıç o gün, bitiş bugündür.
            if (query.includes("son") || query.includes("last")) {
              endMs = now.getTime();
            }
          } else if (query.includes("dün") || query.includes("yesterday")) {
            const d = new Date(now.getTime() - oneDay);
            startMs = new Date(
              d.getFullYear(),
              d.getMonth(),
              d.getDate(),
            ).getTime();
            endMs = startMs + oneDay - 1;
          } else if (query.includes("bugün") || query.includes("today")) {
            startMs = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            ).getTime();
            endMs = startMs + oneDay - 1;
          } else if (
            query.includes("geçen hafta") ||
            query.includes("last week")
          ) {
            // Geçen haftanın Pazartesisi ile Pazarı arasını bul
            const day = now.getDay() || 7; // Pazar 0 ise 7 yapalım (ISO mantığına yakın)
            if (day !== 1) now.setHours(-24 * (day - 1)); // Bu haftanın pazartesisi

            const lastMonday = new Date(now.getTime() - 7 * oneDay);
            startMs = new Date(
              lastMonday.getFullYear(),
              lastMonday.getMonth(),
              lastMonday.getDate(),
            ).getTime();
            endMs = startMs + 7 * oneDay - 1;
          } else {
            // Varsayılan: Son 24 saat
            endMs = now.getTime();
            startMs = endMs - oneDay;
          }

          const result = {
            query,
            resolvedStart: new Date(startMs).toISOString(),
            resolvedEnd: new Date(endMs).toISOString(),
            startMs,
            endMs,
          };

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result),
              },
            ],
          };
        }
        throw new Error("Unknown tool");
      },
      close: async () => {},
    });

    logger.info("Registered internal Time MCP tools (Enhanced)");
  }

  async _connectLocalServer(name, modulePath) {
    try {
      // Resolve the actual path to the module executable
      // We assume it's a node script we can run with `node path/to/index.js`
      const resolvedPath = require.resolve(modulePath);

      const transport = new StdioClientTransport({
        command: "node",
        args: [resolvedPath],
      });

      const client = new Client(
        {
          name: "whatsapp-rag-bot-host",
          version: "1.0.0",
        },
        {
          capabilities: {
            sampling: {},
          },
        },
      );

      await client.connect(transport);

      this.clients.set(name, client);
      this.transports.set(name, transport);

      logger.info(`Connected to MCP server: ${name}`);
    } catch (err) {
      logger.error(`Failed to connect to MCP server ${name}`, {
        error: err.message,
      });
    }
  }

  /**
   * Get available tools from all connected servers
   */
  async getTools() {
    const allTools = [];
    for (const [name, client] of this.clients.entries()) {
      try {
        const result = await client.listTools();
        if (result && result.tools) {
          // Tag tools with their server origin for easier debugging/routing
          const tools = result.tools.map((t) => ({
            ...t,
            server: name,
            // Prefix tool name to avoid collisions if needed, e.g. "memory_create_entities"
            // But standard MCP tools usually have unique names.
          }));
          allTools.push(...tools);
        }
      } catch (err) {
        logger.warn(`Failed to list tools for ${name}`, { error: err.message });
      }
    }
    return allTools;
  }

  /**
   * Call a specific tool on the appropriate server
   */
  async callTool(serverName, toolName, args) {
    const client = this.clients.get(serverName);
    if (!client) {
      throw new Error(`MCP server not found: ${serverName}`);
    }
    try {
      const result = await client.callTool({
        name: toolName,
        arguments: args,
      });
      return result;
    } catch (err) {
      logger.error(`Tool call failed: ${toolName}`, { error: err.message });
      throw err;
    }
  }

  /**
   * Cleanup connections
   */
  async close() {
    for (const [name, client] of this.clients.entries()) {
      try {
        await client.close();
      } catch (_) {}
    }
    this.clients.clear();
    this.transports.clear();
    this.initialized = false;
  }
}

module.exports = new MCPService();
