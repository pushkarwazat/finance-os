/**
 * Vector store seeder
 *
 * On server startup, checks whether the pgvector rag_chunks table is empty.
 * If it is, embeds all 17 mock chunks using Bedrock Titan Embeddings v2
 * and upserts them so the RAG search route can do real cosine similarity.
 *
 * This runs once in the background after the HTTP server starts — it does
 * not block request handling.  Subsequent restarts are no-ops (ON CONFLICT
 * DO UPDATE only touches rows with changed embeddings).
 */

import { container } from "@financeos/container";
import { BedrockLlmAdapter, type VectorDocument } from "@financeos/adapters";
import { MOCK_CHUNKS } from "@financeos/rag";
import { logger } from "./logger.js";

const EMBEDDING_MODEL =
  process.env["BEDROCK_EMBEDDING_MODEL_ID"] ?? "amazon.titan-embed-text-v2:0";

export async function seedVectorStore(): Promise<void> {
  // Skip if either adapter slot is a stub
  if (container.isStub("vectorStore")) {
    logger.info({}, "Vector seed: no real vector store registered — skipping");
    return;
  }

  const vectorStore = container.get("vectorStore");

  // Check how many chunks are already indexed
  const stats = await vectorStore.stats();
  if (stats.vectorCount > 0) {
    logger.info({ vectorCount: stats.vectorCount }, "Vector seed: already seeded — skipping");
    return;
  }

  // We need Bedrock embeddings for seeding
  if (!process.env["LLM_PROVIDER"] || process.env["LLM_PROVIDER"] !== "bedrock") {
    logger.warn({}, "Vector seed: LLM_PROVIDER is not bedrock — cannot embed chunks. Set LLM_PROVIDER=bedrock to seed.");
    return;
  }

  const embedder = new BedrockLlmAdapter();
  logger.info({ chunkCount: MOCK_CHUNKS.length, model: EMBEDDING_MODEL }, "Vector seed: embedding mock chunks via Bedrock Titan");

  // Embed in batches of 5 to stay within Bedrock rate limits
  const BATCH = 5;
  const documents: VectorDocument[] = [];

  for (let i = 0; i < MOCK_CHUNKS.length; i += BATCH) {
    const slice = MOCK_CHUNKS.slice(i, i + BATCH);
    const texts = slice.map((c) => c.chunkText);

    const embResult = await embedder.embed({
      model: EMBEDDING_MODEL,
      input: texts,
      dimensions: 1024,
    });

    for (let j = 0; j < slice.length; j++) {
      const chunk = slice[j]!;
      documents.push({
        id: chunk.chunkId,
        content: chunk.chunkText,
        embedding: embResult.embeddings[j],
        metadata: {
          documentId: chunk.documentId,
          documentTitle: chunk.documentId,
          chunkIndex: chunk.chunkIndex,
          pageNumber: chunk.pageNumber,
          contentType: chunk.contentType,
          sectionTitle: chunk.sectionTitle,
          metadataTags: chunk.metadataTags,
          sensitivityLevel: chunk.sensitivityLevel as VectorDocument["metadata"]["sensitivityLevel"],
          tenantId: chunk.tenantId,
        },
      });
    }

    logger.info({ batch: Math.floor(i / BATCH) + 1, embedded: documents.length }, "Vector seed: batch embedded");
  }

  const { upsertedCount } = await vectorStore.upsert({ documents });
  logger.info({ upsertedCount, model: EMBEDDING_MODEL }, "Vector seed: complete — chunks indexed in pgvector");
}
