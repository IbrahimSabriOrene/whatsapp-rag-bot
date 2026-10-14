const axios = require("axios");
const config = require("../config/config");
const logger = require("./logger.service");

class EmbeddingService {
  constructor() {
    this.provider = config.embedding.provider;
    this._localModelVerified = false;
    logger.info(`Embedding provider initialized: ${this.provider}`);
  }

  async generateEmbedding(text) {
    try {
      if (!text || text.trim().length === 0) {
        throw new Error("Text cannot be empty");
      }

      logger.debug("Generating embedding", {
        textLength: text.length,
        provider: this.provider,
      });

      switch (this.provider) {
        case "openai":
          return await this._generateOpenAIEmbedding(text);
        case "ollama":
          return await this._generateOllamaEmbedding(text);
        case "huggingface":
          return await this._generateHuggingFaceEmbedding(text);
        case "local":
          return await this._generateLocalEmbedding(text);
        default:
          throw new Error(`Unknown embedding provider: ${this.provider}`);
      }
    } catch (error) {
      logger.error("Failed to generate embedding", { error: error.message });
      throw error;
    }
  }

  async _generateOpenAIEmbedding(text) {
    const response = await axios.post(
      `${config.openai.baseURL}/embeddings`,
      {
        input: text,
        model: config.embedding.openai.model,
      },
      {
        headers: {
          Authorization: `Bearer ${config.openai.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    return response.data.data[0].embedding;
  }

  async _generateOllamaEmbedding(text) {
    try {
      const response = await axios.post(
        `${config.embedding.ollama.url}/api/embeddings`,
        {
          model: config.embedding.ollama.model,
          prompt: text,
        },
      );

      return response.data.embedding;
    } catch (error) {
      logger.error("Ollama embedding failed", { error: error.message });
      throw new Error(
        `Ollama error: ${error.message}. Make sure Ollama is running and the model is pulled.`,
      );
    }
  }

  async _generateHuggingFaceEmbedding(text) {
    const response = await axios.post(
      `https://api-inference.huggingface.co/pipeline/feature-extraction/${config.embedding.huggingface.model}`,
      {
        inputs: text,
        options: { wait_for_model: true },
      },
      {
        headers: {
          Authorization: `Bearer ${config.embedding.huggingface.apiKey}`,
          "Content-Type": "application/json",
        },
      },
    );

    // HuggingFace returns a 2D array, flatten it
    const embedding = Array.isArray(response.data[0])
      ? response.data[0]
      : response.data;

    return embedding;
  }

  async _generateLocalEmbedding(text) {
    try {
      if (!this._localModelVerified) {
        await this._verifyLocalEmbeddingModel();
        this._localModelVerified = true;
      }

      // Append [SEP] token if not present, as required by some GGUF configurations
      const finalText = text.trim().endsWith("[SEP]") ? text : `${text} [SEP]`;

      const response = await axios.post(
        `${config.embedding.local.url}/v1/embeddings`,
        {
          input: finalText,
          model: config.embedding.local.model,
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      return response.data.data[0].embedding;
    } catch (error) {
      logger.error("Local embedding failed", { error: error.message });
      throw new Error(
        `Local embedding error: ${error.message}. Ensure LM Studio is running at ${config.embedding.local.url}.`,
      );
    }
  }

  /**
   * Get the dimensions of the embedding vector for the current provider
   */
  getDimensions() {
    switch (this.provider) {
      case "openai":
        return config.embedding.openai.dimensions;
      case "ollama":
        return config.embedding.ollama.dimensions;
      case "huggingface":
        return config.embedding.huggingface.dimensions;
      default:
        return 768;
    }
  }

  async _verifyLocalEmbeddingModel() {
    try {
      const res = await axios.get(`${config.embedding.local.url}/v1/models`);
      const models = Array.isArray(res.data.data)
        ? res.data.data.map((m) => m.id)
        : [];
      if (!models.includes(config.embedding.local.model)) {
        logger.warn("Local embedding model not found", {
          model: config.embedding.local.model,
          available: models,
        });
      }
    } catch (error) {
      logger.warn("Failed to verify local embedding models", {
        error: error.message,
      });
    }
  }

  /**
   * Try to determine the actual embedding vector dimensions at runtime.
   * For non-local providers, falls back to configured dimensions.
   */
  async getActualDimensions() {
    try {
      switch (this.provider) {
        case "local": {
          // Probe local embeddings endpoint with a short text
          const res = await axios.post(
            `${config.embedding.local.url}/v1/embeddings`,
            {
              input: "dimension probe",
              model: config.embedding.local.model,
            },
            { headers: { "Content-Type": "application/json" } },
          );
          const vec = res?.data?.data?.[0]?.embedding;
          if (Array.isArray(vec)) return vec.length;
          return config.embedding.local.dimensions || 768;
        }
        case "openai":
          return config.embedding.openai.dimensions;
        case "ollama":
          return config.embedding.ollama.dimensions;
        case "huggingface":
          return config.embedding.huggingface.dimensions;
        default:
          return 768;
      }
    } catch (error) {
      logger.warn(
        "Failed to probe embedding dimensions; using configured size",
        { error: error.message },
      );
      return this.getDimensions();
    }
  }
}

module.exports = new EmbeddingService();
