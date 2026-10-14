require("dotenv").config({ override: true });

const config = {
  // LLM Provider Configuration
  llm: {
    provider: process.env.LLM_PROVIDER || "anthropic", // 'anthropic', 'openai', 'openrouter', 'local'
    model: process.env.LLM_MODEL || "claude-sonnet-4-20250514",
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS) || 1024,
    temperature: parseFloat(process.env.LLM_TEMPERATURE) || 0.7,
  },

  // Anthropic Configuration
  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: "https://api.anthropic.com/v1",
  },

  // OpenAI Configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: "https://api.openai.com/v1",
  },

  // OpenRouter Configuration
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY,
    model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
    baseURL: "https://openrouter.ai/api/v1",
  },

  // Local AI Configuration (Ollama, LM Studio, etc.)
  localAI: {
    url: process.env.LOCAL_AI_URL || "http://localhost:1234",
    model: process.env.LOCAL_AI_MODEL || "llama3.1",
    // Endpoint selection for local AI: 'responses' | 'chat_completions' | 'completions'
    endpoint: process.env.LOCAL_AI_ENDPOINT || "chat_completions",
  },

  // Embedding Configuration
  embedding: {
    provider: process.env.EMBEDDING_PROVIDER || "openai", // 'openai', 'local', 'huggingface', 'ollama'

    // OpenAI Embeddings
    openai: {
      model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
      dimensions: 768,
    },

    // Ollama Embeddings
    ollama: {
      url: process.env.OLLAMA_EMBEDDING_URL || "http://localhost:1234",
      model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
      dimensions: 768,
    },

    // Local Embeddings (LM Studio or other OpenAI-compatible local servers)
    local: {
      url:
        process.env.LOCAL_EMBEDDING_URL ||
        process.env.LOCAL_AI_URL ||
        "http://localhost:1234",
      model:
        process.env.LOCAL_EMBEDDING_MODEL ||
        process.env.LOCAL_AI_MODEL ||
        "nomic-embed-text",
      dimensions: parseInt(process.env.LOCAL_EMBEDDING_DIMENSIONS) || 768,
    },

    // HuggingFace Embeddings
    huggingface: {
      apiKey: process.env.HUGGINGFACE_API_KEY,
      model:
        process.env.HUGGINGFACE_EMBEDDING_MODEL ||
        "sentence-transformers/all-MiniLM-L6-v2",
      dimensions: 384,
    },
  },

  // Vector Database Configuration
  qdrant: {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    collectionName: process.env.QDRANT_COLLECTION_NAME || "whatsapp_chats",
    distance: "Cosine",
    vectorSize: 768,
  },

  // Bot Behavior Configuration
  bot: {
    triggerWord: process.env.TRIGGER_WORD || "ask",
    maxContextMessages: parseInt(process.env.MAX_CONTEXT_MESSAGES) || 5,
    storeAllMessages: process.env.STORE_ALL_MESSAGES !== "false",
    // Target group to respond to "Hey chatbot, ..." prompts
    targetGroupId: process.env.TARGET_GROUP_ID || "",
    triggerPrefix: (process.env.TRIGGER_PREFIX || "Hey chatbot").toLowerCase(),
    replyMaxAgeSeconds:
      parseInt(process.env.REPLY_MAX_AGE_SECONDS || "", 10) || 60,
  },

  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || "info",
    enableFileLogging: process.env.ENABLE_FILE_LOGGING === "true",
  },
};

// Get vector size based on embedding provider
function getVectorSize() {
  const provider = config.embedding.provider;
  switch (provider) {
    case "openai":
      return config.embedding.openai.dimensions;
    case "ollama":
      return config.embedding.ollama.dimensions;
    case "huggingface":
      return config.embedding.huggingface.dimensions;
    case "local":
      return config.embedding.local.dimensions;
    default:
      return 768; // Default to OpenAI size
  }
}

config.qdrant.vectorSize = getVectorSize();

// Validation
function validateConfig() {
  const provider = config.llm.provider;

  // Validate LLM provider
  if (provider === "anthropic" && !config.anthropic.apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is required when LLM_PROVIDER is "anthropic"',
    );
  }

  if (provider === "openai" && !config.openai.apiKey) {
    throw new Error('OPENAI_API_KEY is required when LLM_PROVIDER is "openai"');
  }

  if (provider === "openrouter" && !config.openrouter.apiKey) {
    throw new Error(
      'OPENROUTER_API_KEY is required when LLM_PROVIDER is "openrouter"',
    );
  }

  if (provider === "local" && !config.localAI.url) {
    throw new Error('LOCAL_AI_URL is required when LLM_PROVIDER is "local"');
  }

  // Validate embedding provider
  const embProvider = config.embedding.provider;

  if (embProvider === "openai" && !config.openai.apiKey) {
    throw new Error(
      'OPENAI_API_KEY is required when EMBEDDING_PROVIDER is "openai"',
    );
  }

  if (embProvider === "huggingface" && !config.embedding.huggingface.apiKey) {
    throw new Error(
      'HUGGINGFACE_API_KEY is required when EMBEDDING_PROVIDER is "huggingface"',
    );
  }

  if (embProvider === "local" && !config.embedding.local.url) {
    throw new Error(
      'LOCAL_EMBEDDING_URL (or LOCAL_AI_URL) is required when EMBEDDING_PROVIDER is "local"',
    );
  }

  if (!config.qdrant.url) {
    throw new Error("QDRANT_URL is required");
  }
}

validateConfig();

module.exports = config;
