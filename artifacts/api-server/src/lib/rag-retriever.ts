/**
 * RAG retriever — shared helper used by both /ask and /rag/search routes.
 *
 * 1. Embeds the question with Bedrock Titan Embeddings v2
 * 2. Searches pgvector via cosine similarity
 * 3. Returns ranked citations ready to inject into a Claude prompt
 *
 * Falls back gracefully when either adapter is unavailable (stub).
 */

import { randomUUID } from "node:crypto";
import { container } from "@financeos/container";
import { BedrockLlmAdapter } from "@financeos/adapters";

const EMBEDDING_MODEL =
  process.env["BEDROCK_EMBEDDING_MODEL_ID"] ?? "amazon.titan-embed-text-v2:0";

const USE_BEDROCK =
  process.env["LLM_PROVIDER"] === "bedrock" && !!process.env["AWS_REGION"];

// Module-level singleton so each route import reuses the same connection pool
const embedder = USE_BEDROCK ? new BedrockLlmAdapter() : null;

export interface RetrievedPassage {
  id: string;
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  pageNumber: number | null;
  excerpt: string;
  relevanceScore: number;
  queryId: string;
  sensitivityLevel: string;
}

export interface RagRetrievalResult {
  passages: RetrievedPassage[];
  embeddingLatencyMs: number;
  searchLatencyMs: number;
  embeddingModel: string;
  vectorCount: number;
}

export interface RagRetrievalOptions {
  topK?: number;
  minScore?: number;
  tenantId?: string;
  tablesOnly?: boolean;
  requestId?: string;
}

/**
 * Retrieve the top-K passages most relevant to `question`.
 * Returns an empty passages array when adapters are not live.
 */
export async function retrievePassages(
  question: string,
  opts: RagRetrievalOptions = {},
): Promise<RagRetrievalResult> {
  const {
    topK = 5,
    minScore = 0.1,
    tenantId = "tenant-demo-001",
    requestId,
  } = opts;

  const empty: RagRetrievalResult = {
    passages: [],
    embeddingLatencyMs: 0,
    searchLatencyMs: 0,
    embeddingModel: EMBEDDING_MODEL,
    vectorCount: 0,
  };

  // Need both live adapters
  if (!embedder || container.isStub("vectorStore")) return empty;

  // ── 1. Embed the question ───────────────────────────────────────────────
  const embedStart = Date.now();
  const embResult = await embedder.embed({
    model: EMBEDDING_MODEL,
    input: question,
    dimensions: 1024,
    requestId,
  });
  const queryEmbedding = embResult.embeddings[0];
  const embeddingLatencyMs = Date.now() - embedStart;

  if (!queryEmbedding) return empty;

  // ── 2. Search pgvector ──────────────────────────────────────────────────
  const vectorStore = container.get("vectorStore");
  const searchStart = Date.now();
  const results = await vectorStore.search({
    queryEmbedding,
    topK,
    minScore,
    filter: { tenantId },
    requestId,
  });
  const searchLatencyMs = Date.now() - searchStart;

  const queryId = randomUUID();
  const passages: RetrievedPassage[] = results.map((r) => ({
    id: randomUUID(),
    documentId: r.document.metadata.documentId,
    documentTitle: String(r.document.metadata.documentTitle ?? r.document.metadata.documentId),
    chunkIndex: Number(r.document.metadata.chunkIndex ?? 0),
    pageNumber: r.document.metadata.pageNumber != null ? Number(r.document.metadata.pageNumber) : null,
    excerpt: r.document.content.slice(0, 800),
    relevanceScore: r.score,
    queryId,
    sensitivityLevel: String(r.document.metadata.sensitivityLevel ?? "internal"),
  }));

  return {
    passages,
    embeddingLatencyMs,
    searchLatencyMs,
    embeddingModel: embResult.model,
    vectorCount: results.length,
  };
}

/**
 * Format retrieved passages into a <documents> XML block for injection
 * into Claude's system prompt. Each passage is tagged with its source
 * document, page, and relevance score so Claude can cite them precisely.
 */
export function formatPassagesForPrompt(passages: RetrievedPassage[]): string {
  if (passages.length === 0) return "";

  const docs = passages
    .map(
      (p, i) => `<document index="${i + 1}" relevance="${p.relevanceScore.toFixed(3)}">
  <source>${p.documentTitle}${p.pageNumber != null ? ` (p. ${p.pageNumber})` : ""}</source>
  <content>${p.excerpt}</content>
</document>`,
    )
    .join("\n");

  return `\n\n<retrieved_documents>\n${docs}\n</retrieved_documents>`;
}
