import { z } from "zod";
import type { FinanceDocument } from "../documents/schema.js";
import type { Chunk } from "../chunks/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Chunking strategy
// ─────────────────────────────────────────────────────────────────────────────

export const ChunkingStrategySchema = z.enum([
  /**
   * Split on fixed token window with optional overlap.
   * Fast and predictable — good for uniform prose documents.
   */
  "fixed_tokens",
  /**
   * Split at sentence boundaries to avoid cutting mid-thought.
   * Better recall for narrative documents (memos, SOPs, policies).
   */
  "sentence_aware",
  /**
   * Split at semantically meaningful boundaries detected by a small model.
   * Higher latency — use for board decks and audit workpapers.
   */
  "semantic_boundary",
  /**
   * Split tables as a single chunk; split surrounding prose separately.
   * Use when the document contains financial tables (close memos, invoices).
   */
  "table_aware",
]);
export type ChunkingStrategy = z.infer<typeof ChunkingStrategySchema>;

export const ChunkingConfigSchema = z.object({
  strategy: ChunkingStrategySchema.default("sentence_aware"),
  /** Target token count per chunk. */
  targetTokens: z.number().int().min(64).max(2048).default(512),
  /** Token overlap between adjacent chunks. */
  overlapTokens: z.number().int().min(0).default(64),
  /** If true, keep heading/section title as a prefix on each chunk. */
  prependSectionTitle: z.boolean().default(true),
  /** If true, create a separate chunk for each table in the document. */
  isolateTables: z.boolean().default(true),
  /** Minimum token count for a chunk — discard shorter fragments. */
  minTokens: z.number().int().min(1).default(20),
});
export type ChunkingConfig = z.infer<typeof ChunkingConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Embedding config
// ─────────────────────────────────────────────────────────────────────────────

export const EmbeddingConfigSchema = z.object({
  /** Provider identifier — maps to a configured EmbeddingProvider. */
  providerId: z.string().default("mock"),
  /** Model name (e.g. "text-embedding-3-small"). */
  model: z.string().default("mock-embedding-v1"),
  /** Output dimensions. */
  dimensions: z.number().int().min(128).max(4096).default(1536),
  /** Maximum texts per API call (for batch efficiency). */
  batchSize: z.number().int().min(1).max(2048).default(100),
});
export type EmbeddingConfig = z.infer<typeof EmbeddingConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Index config
// ─────────────────────────────────────────────────────────────────────────────

export const IndexConfigSchema = z.object({
  /** Vector store provider ID. */
  vectorStoreProviderId: z.string().default("mock"),
  /** Collection / index name in the vector store. */
  collectionName: z.string().default("financeos-chunks"),
  /**
   * If true, also index in a BM25/keyword index for hybrid retrieval.
   */
  enableKeywordIndex: z.boolean().default(true),
  /** Keyword index provider ID. */
  keywordIndexProviderId: z.string().optional(),
  /** Upsert batch size for the vector store. */
  upsertBatchSize: z.number().int().min(1).max(1000).default(100),
});
export type IndexConfig = z.infer<typeof IndexConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Enrichment config — metadata enrichment step
// ─────────────────────────────────────────────────────────────────────────────

export const EnrichmentConfigSchema = z.object({
  /** If true, run named entity recognition over each chunk. */
  enableNER: z.boolean().default(true),
  /** NER model identifier. */
  nerModel: z.string().default("mock-ner-v1"),
  /** If true, attempt to extract tables from structured PDFs. */
  enableTableExtraction: z.boolean().default(true),
  /** If true, classify each chunk's sensitivity level. */
  enableSensitivityClassification: z.boolean().default(true),
  /** If true, generate a short summary for the whole document. */
  enableDocumentSummary: z.boolean().default(false),
  /** If true, extract graph-ready entity relationships. */
  enableGraphExtraction: z.boolean().default(false),
});
export type EnrichmentConfig = z.infer<typeof EnrichmentConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline step status
// ─────────────────────────────────────────────────────────────────────────────

export type PipelineStepName =
  | "parse"
  | "normalize"
  | "classify"
  | "chunk"
  | "embed"
  | "index"
  | "enrich";

export const PipelineStepResultSchema = z.object({
  step: z.enum(["parse", "normalize", "classify", "chunk", "embed", "index", "enrich"]),
  status: z.enum(["pending", "running", "ok", "warn", "error"]),
  detail: z.string().optional(),
  /** Items produced by this step (e.g. number of chunks). */
  outputCount: z.number().int().optional(),
  elapsedMs: z.number().int().min(0),
  warnings: z.array(z.string()).default([]),
  errors: z.array(z.string()).default([]),
});
export type PipelineStepResult = z.infer<typeof PipelineStepResultSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Ingestion job
// ─────────────────────────────────────────────────────────────────────────────

export const IngestionJobSchema = z.object({
  jobId: z.string().uuid(),
  documentId: z.string().uuid(),
  tenantId: z.string(),
  status: z.enum([
    "queued",
    "parsing",
    "normalising",
    "classifying",
    "chunking",
    "embedding",
    "indexing",
    "enriching",
    "done",
    "failed",
    "cancelled",
  ]),
  pipeline: z.object({
    chunkingConfig: ChunkingConfigSchema,
    embeddingConfig: EmbeddingConfigSchema,
    indexConfig: IndexConfigSchema,
    enrichmentConfig: EnrichmentConfigSchema,
  }),
  steps: z.array(PipelineStepResultSchema),
  totalChunks: z.number().int().min(0).optional(),
  tableChunks: z.number().int().min(0).optional(),
  narrativeChunks: z.number().int().min(0).optional(),
  errorMessage: z.string().optional(),
  queuedAt: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  retryCount: z.number().int().default(0),
});
export type IngestionJob = z.infer<typeof IngestionJobSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Full ingestion pipeline config
// ─────────────────────────────────────────────────────────────────────────────

export const IngestionPipelineConfigSchema = z.object({
  chunking: ChunkingConfigSchema,
  embedding: EmbeddingConfigSchema,
  index: IndexConfigSchema,
  enrichment: EnrichmentConfigSchema,
});
export type IngestionPipelineConfig = z.infer<typeof IngestionPipelineConfigSchema>;

export const DEFAULT_INGESTION_CONFIG: IngestionPipelineConfig = {
  chunking: {
    strategy: "table_aware",
    targetTokens: 512,
    overlapTokens: 64,
    prependSectionTitle: true,
    isolateTables: true,
    minTokens: 20,
  },
  embedding: {
    providerId: "mock",
    model: "mock-embedding-v1",
    dimensions: 1536,
    batchSize: 100,
  },
  index: {
    vectorStoreProviderId: "mock",
    collectionName: "financeos-chunks",
    enableKeywordIndex: true,
    upsertBatchSize: 100,
  },
  enrichment: {
    enableNER: true,
    nerModel: "mock-ner-v1",
    enableTableExtraction: true,
    enableSensitivityClassification: true,
    enableDocumentSummary: false,
    enableGraphExtraction: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Ingestion pipeline interface
// ─────────────────────────────────────────────────────────────────────────────

/** Result of parsing a raw document into extractable text + tables. */
export interface ParseResult {
  /** Extracted full text. */
  text: string;
  /** Total page count. */
  pageCount: number;
  /** MIME type confirmed after parsing. */
  mimeType: string;
  /** Warnings from the parser (e.g. encrypted sections, password-protected pages). */
  warnings: string[];
  /** Extracted tables in Markdown format, keyed by table label or index. */
  tables: Record<string, string>;
}

/** Result after normalisation (encoding fix, whitespace collapse, etc.). */
export interface NormaliseResult {
  normalisedText: string;
  /** Removed character count (noise from parser artefacts). */
  removedChars: number;
  /** Detected document language (ISO 639-1). */
  language: string;
}

/** Result of document-level classification. */
export interface ClassifyResult {
  /** Inferred document type. */
  inferredType: string;
  /** Confidence in the inferred type (0–1). */
  typeConfidence: number;
  /** Inferred sensitivity level. */
  inferredSensitivity: string;
  /** Whether MNPI indicators were detected. */
  mnpiDetected: boolean;
  /** Whether PII indicators were detected. */
  piiDetected: boolean;
}

/**
 * DocumentIngestionPipeline — pluggable 7-step ingestion contract.
 * Implementations must provide all steps; each returns a typed result
 * that is passed to the next step.
 */
export interface DocumentIngestionPipeline {
  /**
   * Step 1 — PARSE
   * Extract raw text, page structure, and tables from a binary document.
   */
  parse(documentId: string, content: Buffer, mimeType: string): Promise<ParseResult>;

  /**
   * Step 2 — NORMALISE
   * Standardise encoding, remove noise, fix unicode artefacts.
   */
  normalize(parseResult: ParseResult): Promise<NormaliseResult>;

  /**
   * Step 3 — CLASSIFY
   * Infer document type, sensitivity level, and policy flags.
   */
  classify(document: FinanceDocument, normalised: NormaliseResult): Promise<ClassifyResult>;

  /**
   * Step 4 — CHUNK
   * Split the document text and tables into retrieval units (Chunks).
   */
  chunk(
    document: FinanceDocument,
    normalised: NormaliseResult,
    config: ChunkingConfig
  ): Promise<Chunk[]>;

  /**
   * Step 5 — EMBED
   * Generate dense embedding vectors for each chunk.
   */
  embed(chunks: Chunk[], config: EmbeddingConfig): Promise<Chunk[]>;

  /**
   * Step 6 — INDEX
   * Upsert chunks and their vectors into the configured vector store and keyword index.
   */
  index(chunks: Chunk[], config: IndexConfig): Promise<{ indexedCount: number }>;

  /**
   * Step 7 — ENRICH
   * Overlay NER, sensitivity classification, table metadata, and graph edges.
   */
  enrich(chunks: Chunk[], config: EnrichmentConfig): Promise<Chunk[]>;

  /** Run the full pipeline end-to-end and track an IngestionJob. */
  run(
    document: FinanceDocument,
    content: Buffer,
    config?: Partial<IngestionPipelineConfig>
  ): Promise<IngestionJob>;
}
