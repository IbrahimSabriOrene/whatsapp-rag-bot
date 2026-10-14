# WhatsApp RAG Bot

Personal project by Ibrahim Sabri Örene: a WhatsApp knowledge assistant combining semantic retrieval, date-range retrieval and an MCP date resolver selected by the model.

## What is implemented

- WhatsApp Web integration, message ingestion and configurable triggers.
- Qdrant vector retrieval and date filters.
- Conversation sessions and bounded prompt context.
- Local or cloud LLM/embedding providers.
- MCP integration, including structured date-range resolution.
- A Next.js frontend under `frontend/whatsapp-rag-bot-frontene`.

This is a local-development source release, not a hosted service or production-readiness claim.

## Run locally

Use a current Node.js version compatible with the dependency lockfile, Docker and a local AI server or your own provider credentials.

```sh
npm install
docker compose up -d
# Copy .env.example to .env, choose your models and configure your own target chat.
npm start
```

Frontend, in a separate terminal:

```sh
cd frontend/whatsapp-rag-bot-frontene
npm install
npm run dev
```

Authenticate your own WhatsApp session using the QR flow. Configure a target chat through the application or your environment. The public export has no preselected personal chat.

## Source map

`backend/src/services/rag.service.js` coordinates retrieval and answers. `mcp.service.js` manages MCP tools. `vectorStore.service.js` handles Qdrant; `embedding.service.js` handles embedding providers. State and settings are local runtime data.

## Data and source scope

This is a fresh source-only import. Original history, databases, messages, media, browser sessions, auth files and personal chat identifiers are excluded. `.env.example` contains placeholders only. Use only conversations you have permission to process. Do not expose this local development API directly to the public internet.

Dependencies keep their own licenses. The project package declares MIT; see LICENSE.
