const { QdrantClient } = require("@qdrant/js-client-rest");
const { v5: uuidv5 } = require("uuid");
const config = require("../config/config");
const logger = require("./logger.service");
const embeddingService = require("./embedding.service");

class VectorStoreService {
  constructor() {
    this.client = new QdrantClient({ url: config.qdrant.url });
    this.collectionName = config.qdrant.collectionName;
    this.initialized = false;
    this.vectorSize = config.qdrant.vectorSize;
    this._existsCache = new Map();
  }

  // Ensure Qdrant-compatible point ID: unsigned int or UUID v5
  _toValidPointId(id) {
    if (typeof id === "number" && Number.isInteger(id) && id >= 0) {
      return id;
    }
    const str = String(id || "").trim();
    // UUID regex
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (uuidRegex.test(str)) {
      return str.toLowerCase();
    }
    // Deterministic UUID v5 derived from the original string
    return uuidv5(str, uuidv5.DNS);
  }

  async hasPoint(id) {
    const raw = id === undefined || id === null ? "" : String(id).trim();
    if (!raw) return false;
    if (!this.initialized) {
      await this.initialize();
    }

    const pointId = this._toValidPointId(raw);
    const cacheKey = String(pointId);
    if (this._existsCache.get(cacheKey) === true) {
      return true;
    }

    try {
      const res = await this.client.retrieve(this.collectionName, {
        ids: [pointId],
        with_payload: false,
        with_vector: false,
      });

      const exists = Array.isArray(res)
        ? res.length > 0
        : Array.isArray(res?.result)
          ? res.result.length > 0
          : Array.isArray(res?.points)
            ? res.points.length > 0
            : false;

      if (exists) {
        this._existsCache.set(cacheKey, true);
      }
      return exists;
    } catch (error) {
      logger.debug("Point existence check failed", { error: error.message });
      return false;
    }
  }

  async initialize() {
    try {
      logger.info("Initializing Qdrant vector store...");

      // Compute expected vector size (probe local embeddings when possible)
      let expectedSize = config.qdrant.vectorSize;
      try {
        expectedSize = await embeddingService.getActualDimensions();
      } catch (_) {
        // keep existing expectedSize
      }
      this.vectorSize = expectedSize;

      // Check if collection exists
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(
        (col) => col.name === this.collectionName,
      );

      if (!exists) {
        logger.info("Creating new collection", { name: this.collectionName });

        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: expectedSize,
            distance: config.qdrant.distance,
          },
        });

        // Create payload index for faster filtering
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: "chat_id",
          field_schema: "keyword",
        });

        await this.client.createPayloadIndex(this.collectionName, {
          field_name: "timestamp",
          field_schema: "integer",
        });
      } else {
        // Validate existing collection vector size matches expected size
        try {
          const details = await this.client.getCollection(this.collectionName);
          const currentSize = details?.result?.config?.params?.vectors?.size;
          if (currentSize && expectedSize && currentSize !== expectedSize) {
            logger.warn(
              "Vector size mismatch detected. Recreating collection",
              {
                currentSize,
                expectedSize,
                collection: this.collectionName,
              },
            );

            await this.client.deleteCollection(this.collectionName);
            await this.client.createCollection(this.collectionName, {
              vectors: {
                size: expectedSize,
                distance: config.qdrant.distance,
              },
            });

            await this.client.createPayloadIndex(this.collectionName, {
              field_name: "chat_id",
              field_schema: "keyword",
            });

            await this.client.createPayloadIndex(this.collectionName, {
              field_name: "timestamp",
              field_schema: "integer",
            });
          }
        } catch (error) {
          logger.warn("Unable to validate existing collection size", {
            error: error.message,
          });
        }
      }

      this.initialized = true;
      logger.info("Vector store initialized successfully", {
        vectorSize: this.vectorSize,
      });
    } catch (error) {
      logger.error("Failed to initialize vector store", {
        error: error.message,
      });
      throw error;
    }
  }

  async storeMessage(messageData) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const {
        id,
        chatId,
        sender,
        text,
        timestamp,
        embedding,
        ...extraPayload
      } = messageData;
      const pointId = this._toValidPointId(id);

      // Validate embedding vector size and attempt auto-recovery
      const vec = Array.isArray(embedding)
        ? embedding
        : embedding?.vector || embedding;
      const len = Array.isArray(vec) ? vec.length : 0;
      if (!len) {
        throw new Error("Embedding vector is empty or invalid");
      }

      if (this.vectorSize && len !== this.vectorSize) {
        logger.warn("Embedding dimension mismatch; adjusting collection", {
          currentVectorSize: this.vectorSize,
          embeddingLength: len,
        });

        // Recreate collection with new size
        await this.client.deleteCollection(this.collectionName);
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: len,
            distance: config.qdrant.distance,
          },
        });
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: "chat_id",
          field_schema: "keyword",
        });
        await this.client.createPayloadIndex(this.collectionName, {
          field_name: "timestamp",
          field_schema: "integer",
        });
        this.vectorSize = len;
        logger.info("Collection recreated with new vector size", {
          vectorSize: this.vectorSize,
        });
      }

      const point = {
        id: pointId,
        vector: vec,
        payload: {
          chat_id: chatId,
          sender: sender,
          text: text,
          timestamp: timestamp,
          ...extraPayload,
        },
      };

      try {
        await this.client.upsert(this.collectionName, {
          wait: true,
          points: [point],
        });
      } catch (error) {
        // Detect Qdrant dimension mismatch and auto-correct
        const msg =
          error?.response?.data?.status?.error || error?.message || "";
        const dimMismatch =
          /Vector dimension error: expected dim: (\d+), got (\d+)/i.exec(msg);
        if (dimMismatch) {
          const expected = parseInt(dimMismatch[1], 10);
          const got = parseInt(dimMismatch[2], 10);
          logger.warn(
            "Qdrant dimension mismatch detected on upsert, recreating collection",
            {
              expected,
              got,
              currentVectorSize: this.vectorSize,
            },
          );

          // Recreate collection with the dimension of the provided vector
          await this.client.deleteCollection(this.collectionName);
          await this.client.createCollection(this.collectionName, {
            vectors: {
              size: got,
              distance: config.qdrant.distance,
            },
          });
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: "chat_id",
            field_schema: "keyword",
          });
          await this.client.createPayloadIndex(this.collectionName, {
            field_name: "timestamp",
            field_schema: "integer",
          });
          this.vectorSize = got;

          // Retry the upsert once
          await this.client.upsert(this.collectionName, {
            wait: true,
            points: [point],
          });
        } else {
          throw error;
        }
      }

      logger.debug("Message stored in vector DB", {
        id,
        chatId,
        vectorSize: this.vectorSize,
      });
      try {
        this._existsCache.set(String(pointId), true);
      } catch (_) {}
      return true;
    } catch (error) {
      const details = error?.response?.data || error?.data || {};
      logger.error("Failed to store message", {
        error: error.message,
        details,
      });
      throw error;
    }
  }

  async searchSimilar(queryEmbedding, chatId = null, limit = 5) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      const searchParams = {
        vector: queryEmbedding,
        limit: limit,
        with_payload: true,
      };

      // Filter by chat_id if provided
      if (chatId) {
        searchParams.filter = {
          must: [
            {
              key: "chat_id",
              match: { value: chatId },
            },
          ],
        };
      }

      const results = await this.client.search(
        this.collectionName,
        searchParams,
      );

      logger.debug("Vector search completed", {
        resultsCount: results.length,
        chatId,
      });

      return results.map((result) => ({
        id: result.id,
        score: result.score,
        sender: result.payload.sender,
        text: result.payload.text,
        timestamp: result.payload.timestamp,
      }));
    } catch (error) {
      logger.error("Vector search failed", { error: error.message });
      throw error;
    }
  }

  async getRecentMessages(chatId, limit = 50) {
    try {
      const results = await this.client.scroll(this.collectionName, {
        filter: {
          must: [
            {
              key: "chat_id",
              match: { value: chatId },
            },
          ],
        },
        limit: limit,
        with_payload: true,
      });

      return results.points
        .map((point) => ({
          id: point.id,
          sender: point.payload.sender,
          text: point.payload.text,
          timestamp: point.payload.timestamp,
        }))
        .sort((a, b) => b.timestamp - a.timestamp);
    } catch (error) {
      logger.error("Failed to get recent messages", { error: error.message });
      return [];
    }
  }

  async getStats() {
    try {
      if (!this.initialized) {
        await this.initialize();
      }
      const info = await this.client.getCollection(this.collectionName);
      const countRes = await this.client.count(this.collectionName, {
        exact: true,
      });
      return {
        collectionName: this.collectionName,
        vectorSize: this.vectorSize,
        pointsCount: countRes?.count || 0,
        status: info?.result?.status || "unknown",
      };
    } catch (error) {
      logger.warn("Failed to get vector store stats", { error: error.message });
      return {
        collectionName: this.collectionName,
        vectorSize: this.vectorSize,
        pointsCount: 0,
        status: "unknown",
      };
    }
  }

  async deleteChat(chatId) {
    try {
      await this.client.delete(this.collectionName, {
        filter: {
          must: [
            {
              key: "chat_id",
              match: { value: chatId },
            },
          ],
        },
      });
      logger.info("Chat deleted from vector store", { chatId });
    } catch (error) {
      logger.error("Failed to delete chat", { error: error.message });
    }
  }
  async getMessagesByDateRange(chatId, startMs, endMs, pageLimit = 1000) {
    try {
      if (!this.initialized) {
        await this.initialize();
      }

      // [Professional Fix] Sayısal güvenliği sağla
      const gte = parseInt(startMs, 10);
      const lte = parseInt(endMs, 10);

      const results = [];
      let offset = null;

      while (true) {
        const page = await this.client.scroll(this.collectionName, {
          filter: {
            must: [
              { key: "chat_id", match: { value: chatId } },
              {
                key: "timestamp",
                range: {
                  gte: gte,
                  lte: lte,
                },
              },
            ],
          },
          limit: pageLimit,
          with_payload: true,
          offset,
        });

        const points = page.points || [];
        if (!points.length) break;

        results.push(
          ...points.map((p) => ({
            id: p.id,
            sender: p.payload.sender,
            text: p.payload.text,
            timestamp: p.payload.timestamp,
          })),
        );

        if (!page.next_page_offset) break;
        offset = page.next_page_offset;
      }

      // Mesajları eskiden yeniye sırala
      return results.sort((a, b) => a.timestamp - b.timestamp);
    } catch (error) {
      logger.error("Failed to get messages by date range", {
        error: error.message,
      });
      return [];
    }
  }

  async resetCollection() {
    try {
      logger.warn("Resetting Qdrant collection", {
        collection: this.collectionName,
      });
      // Determine expected vector size
      let expectedSize = config.qdrant.vectorSize;
      try {
        expectedSize = await embeddingService.getActualDimensions();
      } catch (_) {}
      this.vectorSize = expectedSize;

      // Delete if exists, then recreate
      try {
        await this.client.deleteCollection(this.collectionName);
      } catch (_) {}

      await this.client.createCollection(this.collectionName, {
        vectors: {
          size: expectedSize,
          distance: config.qdrant.distance,
        },
      });

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "chat_id",
        field_schema: "keyword",
      });

      await this.client.createPayloadIndex(this.collectionName, {
        field_name: "timestamp",
        field_schema: "integer",
      });

      this.initialized = true;
      logger.info("Qdrant collection reset complete", {
        vectorSize: this.vectorSize,
      });
    } catch (error) {
      logger.error("Failed to reset Qdrant collection", {
        error: error.message,
      });
      throw error;
    }
  }
}

module.exports = new VectorStoreService();
