const { QdrantClient } = require('@qdrant/js-client-rest');
const config = require('../src/config/config');
const embeddingService = require('../src/services/embedding.service');

async function reset() {
  const client = new QdrantClient({ url: config.qdrant.url });
  const name = config.qdrant.collectionName;
  let size = config.qdrant.vectorSize;
  try {
    size = await embeddingService.getActualDimensions();
  } catch (_) {}

  console.log(`[reset-qdrant] Resetting collection: ${name} (size=${size})`);
  try { await client.deleteCollection(name); } catch (_) {}
  await client.createCollection(name, {
    vectors: { size, distance: config.qdrant.distance }
  });
  await client.createPayloadIndex(name, { field_name: 'chat_id', field_schema: 'keyword' });
  await client.createPayloadIndex(name, { field_name: 'timestamp', field_schema: 'integer' });
  console.log('[reset-qdrant] Done.');
}

reset().catch(err => {
  console.error('[reset-qdrant] Failed:', err.message);
  process.exit(1);
});