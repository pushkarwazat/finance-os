import { z } from "zod";
import { DocumentTypeSchema, SensitivityLevelSchema } from "../documents/schema.js";
import { CitationAssemblyConfigSchema, type Citation, type CitationAssemblyConfig, type DocumentAnswer } from "../citations/schema.js";
import type { Chunk } from "../chunks/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval mode
// ─────────────────────────────────────────────────────────────────────────────

export const RetrievalModeSchema = z.enum([
  /** Dense vector search only (cosine similarity). */
  "dense",
  /** BM25 keyword / TF-IDF search only. */
  "keyword",
  /**
   * Reciprocal Rank Fusion (RRF) of dense + keyword results.
   * Recommended default — better recall across short and long queries.
   */
  "hybrid",
  /**
   * Filter by document metadata only — no semantic search.
   * Use when the user needs a specific document by ID, type, or period.
   */
  "metadata_only",
]);
export type RetrievalMode = z.infer<typeof RetrievalModeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Metadata filter DSL
// ─────────────────────────────────────────────────────────────────────────────

export const MetadataFilterSchema = z.object({
  /** Restrict to specific document UUIDs. */
  documentIds: z.array(z.string().uuid()).optional(),
  /** Restrict to specific document types. */
  documentTypes: z.array(DocumentTypeSchema).optional(),
  /** Restrict to specific fiscal years. */
  fiscalYears: z.array(z.number().int()).optional(),
  /** Restrict to specific fiscal periods (e.g. ["Q3", "Q4"]). */
  periods: z.array(z.string()).optional(),
  /** Restrict to chunks whose tags include ALL of these values. */
  requiredTags: z.array(z.string()).optional(),
  /** Restrict to chunks whose tags include ANY of these values. */
  anyTags: z.array(z.string()).optional(),
  /** Exclude chunks that carry these sensitivity tags. */
  excludeSensitivityTags: z.array(z.string()).optional(),
  /** Maximum sensitivity level allowed. */
  maxSensitivityLevel: SensitivityLevelSchema.optional(),
  /** Tenant identifier — always enforced at the retriever level. */
  tenantId: z.string(),
  /** Restrict to chunks from a specific named section. */
  sectionTitle: z.string().optional(),
  /** Include only table chunks. */
  tablesOnly: z.boolean().optional(),
  /** Exclude table chunks (narrative only). */
  excludeTables: z.boolean().optional(),
});
export type MetadataFilter = z.infer<typeof MetadataFilterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Dense retrieval config
// ─────────────────────────────────────────────────────────────────────────────

export const DenseRetrievalConfigSchema = z.object({
  /** Number of candidates to retrieve from the vector store before reranking. */
  topK: z.number().int().min(1).max(200).default(20),
  /** Minimum cosine similarity score (0–1). */
  minScore: z.number().min(0).max(1).default(0.3),
  /** Embedding provider ID. */
  embeddingProviderId: z.string().default("mock"),
  /** Similarity metric. */
  metric: z.enum(["cosine", "dot_product", "euclidean"]).default("cosine"),
});
export type DenseRetrievalConfig = z.infer<typeof DenseRetrievalConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Keyword retrieval config
// ─────────────────────────────────────────────────────────────────────────────

export const KeywordRetrievalConfigSchema = z.object({
  /** Number of keyword results to retrieve. */
  topK: z.number().int().min(1).max(200).default(20),
  /**
   * Algorithm for keyword scoring.
   * bm25 is recommended; tf_idf as fallback.
   */
  algorithm: z.enum(["bm25", "tf_idf"]).default("bm25"),
  /** BM25 k1 parameter (term frequency saturation). */
  bm25K1: z.number().min(0).max(5).default(1.2),
  /** BM25 b parameter (document length normalisation). */
  bm25B: z.number().min(0).max(1).default(0.75),
  /** If true, apply query expansion (synonyms, acronyms). */
  queryExpansion: z.boolean().default(true),
});
export type KeywordRetrievalConfig = z.infer<typeof KeywordRetrievalConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Hybrid retrieval config
// ─────────────────────────────────────────────────────────────────────────────

export const HybridRetrievalConfigSchema = z.object({
  dense: DenseRetrievalConfigSchema,
  keyword: KeywordRetrievalConfigSchema,
  /**
   * Alpha weight for the dense component in the RRF fusion.
   * alpha=1.0 → pure dense; alpha=0.0 → pure keyword.
   * Default 0.6 gives a slight edge to dense retrieval.
   */
  alpha: z.number().min(0).max(1).default(0.6),
  /**
   * RRF rank constant (k in 1/(k + rank)).
   * Higher values reduce the impact of very high-ranked documents.
   */
  rrfK: z.number().int().min(1).default(60),
});
export type HybridRetrievalConfig = z.infer<typeof HybridRetrievalConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Rerank config
// ─────────────────────────────────────────────────────────────────────────────

export const RerankConfigSchema = z.object({
  /** Whether to apply a reranker after retrieval. */
  enabled: z.boolean().default(true),
  /** Reranker provider ID (e.g. "cohere", "bge", "mock"). */
  providerId: z.string().default("mock"),
  /** Model name for the reranker. */
  model: z.string().default("mock-rerank-v1"),
  /** Top-K to keep after reranking. */
  topK: z.number().int().min(1).max(50).default(5),
  /** Minimum rerank score to include in the final set. */
  minScore: z.number().min(0).max(1).default(0.2),
});
export type RerankConfig = z.infer<typeof RerankConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Retrieval request — full specification for a retrieval operation
// ─────────────────────────────────────────────────────────────────────────────

export const RetrievalRequestSchema = z.object({
  /** Request trace ID. */
  requestId: z.string().uuid(),
  /** Session ID for multi-turn tracking. */
  sessionId: z.string().optional(),
  /** The user's natural-language question. */
  question: z.string().min(1).max(4000),
  /** Retrieval mode to use. */
  mode: RetrievalModeSchema.default("hybrid"),
  /** Metadata filters — always includes tenantId enforcement. */
  filters: MetadataFilterSchema,
  /** Dense retrieval configuration. */
  dense: DenseRetrievalConfigSchema.optional(),
  /** Keyword retrieval configuration. */
  keyword: KeywordRetrievalConfigSchema.optional(),
  /** Hybrid retrieval configuration (overrides dense+keyword when mode=hybrid). */
  hybrid: HybridRetrievalConfigSchema.optional(),
  /** Reranking configuration. */
  rerank: RerankConfigSchema.optional(),
  /** Citation assembly configuration. */
  citation: CitationAssemblyConfigSchema.optional(),
});
export type RetrievalRequest = z.infer<typeof RetrievalRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Intermediate retrieval result (before citation assembly)
// ─────────────────────────────────────────────────────────────────────────────

export const ScoredChunkSchema = z.object({
  chunk: z.any(),
  denseScore: z.number().min(0).max(1).optional(),
  keywordScore: z.number().min(0).max(1).optional(),
  hybridScore: z.number().min(0).max(1).optional(),
  rerankScore: z.number().min(0).max(1).optional(),
  finalScore: z.number().min(0).max(1),
});
export type ScoredChunk = z.infer<typeof ScoredChunkSchema>;

export const RetrievalResultSchema = z.object({
  requestId: z.string().uuid(),
  mode: RetrievalModeSchema,
  scoredChunks: z.array(ScoredChunkSchema),
  totalCandidates: z.number().int(),
  retrievalLatencyMs: z.number().int(),
  rerankLatencyMs: z.number().int().optional(),
});
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Retriever interface — pluggable retrieval backend
// ─────────────────────────────────────────────────────────────────────────────

export interface VectorRetriever {
  retrieve(
    queryVector: number[],
    filters: MetadataFilter,
    config: DenseRetrievalConfig
  ): Promise<ScoredChunk[]>;
}

export interface KeywordRetriever {
  retrieve(
    queryText: string,
    filters: MetadataFilter,
    config: KeywordRetrievalConfig
  ): Promise<ScoredChunk[]>;
}

export interface HybridRetriever {
  retrieve(
    queryText: string,
    queryVector: number[],
    filters: MetadataFilter,
    config: HybridRetrievalConfig
  ): Promise<ScoredChunk[]>;
}

export interface Reranker {
  rerank(
    query: string,
    chunks: ScoredChunk[],
    config: RerankConfig
  ): Promise<ScoredChunk[]>;
}

export interface CitationAssembler {
  assemble(
    question: string,
    scoredChunks: ScoredChunk[],
    config: import("../citations/schema.js").CitationAssemblyConfig
  ): Promise<Citation[]>;
}

/** The top-level retrieval pipeline orchestrator. */
export interface RetrievalPipeline {
  retrieve(request: RetrievalRequest): Promise<DocumentAnswer>;
}
