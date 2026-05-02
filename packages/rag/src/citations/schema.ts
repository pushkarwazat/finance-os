import { z } from "zod";
import { SensitivityLevelSchema } from "../documents/schema.js";
import { ContentTypeSchema } from "../chunks/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Citation — a single sourced excerpt used as evidence in an answer
// ─────────────────────────────────────────────────────────────────────────────

export const CitationSchema = z.object({
  /** Unique citation identifier within the response. */
  citationId: z.string().uuid(),
  /** Ordinal reference number shown to the user, e.g. [1], [2]. */
  citationNumber: z.number().int().min(1),
  /** Source document UUID. */
  documentId: z.string().uuid(),
  /** Source chunk UUID. */
  chunkId: z.string().uuid(),
  /** Human-readable document title. */
  documentTitle: z.string(),
  /** Document type label (e.g. "Board Deck"). */
  documentType: z.string(),
  /** Fiscal year label (e.g. "FY2025"). */
  fiscalYear: z.number().int().optional(),
  /** Fiscal period label (e.g. "Q3"). */
  period: z.string().optional(),
  /** Section or heading the chunk belongs to. */
  sectionTitle: z.string().optional(),
  /** Breadcrumb path to the section. */
  sectionPath: z.array(z.string()).default([]),
  /** Page number where the excerpt appears. */
  pageNumber: z.number().int().min(1).optional(),
  /** The verbatim excerpt from the source document. */
  excerpt: z.string(),
  /** Truncated excerpt for inline display. */
  excerptShort: z.string().optional(),
  /** Whether this excerpt comes from a table. */
  isTable: z.boolean().default(false),
  /** Content type of the source chunk. */
  contentType: ContentTypeSchema.optional(),
  /** Dense retrieval score (cosine similarity, 0–1). */
  denseScore: z.number().min(0).max(1).optional(),
  /** Keyword (BM25) retrieval score. */
  keywordScore: z.number().min(0).max(1).optional(),
  /** Hybrid combined score. */
  hybridScore: z.number().min(0).max(1).optional(),
  /** Post-reranking relevance score (0–1). */
  rerankScore: z.number().min(0).max(1).optional(),
  /** Final relevance score used for ordering (rerankScore ?? hybridScore ?? denseScore). */
  finalScore: z.number().min(0).max(1),
  /** Sensitivity classification of the source. */
  sensitivityLevel: SensitivityLevelSchema,
  /** Sensitivity tags on the source chunk. */
  sensitivityTags: z.array(z.string()).default([]),
  /** Retrieval mode that surfaced this citation. */
  retrievalMode: z.enum(["dense", "keyword", "hybrid", "metadata_only"]),
  /** Timestamp when this citation was assembled. */
  assembledAt: z.string().datetime(),
});
export type Citation = z.infer<typeof CitationSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Document Answer — the top-level response with grounded evidence
// ─────────────────────────────────────────────────────────────────────────────

export const DocumentAnswerSchema = z.object({
  /** Unique response identifier. */
  answerId: z.string().uuid(),
  /** Session / trace identifier. */
  sessionId: z.string().optional(),
  /** The original question posed by the user. */
  question: z.string(),
  /** Normalised question after pre-processing. */
  normalisedQuestion: z.string(),
  /**
   * The generated answer text.
   * Will be null if the system abstained (insufficient evidence or policy block).
   */
  answerText: z.string().nullable(),
  /**
   * Whether the system declined to answer.
   * True when evidence quality is below threshold or a policy fires.
   */
  abstained: z.boolean(),
  /** Reason for abstention (populated when abstained is true). */
  abstentionReason: z
    .enum([
      "insufficient_evidence",
      "low_confidence",
      "policy_violation",
      "no_documents_found",
      "access_denied",
    ])
    .optional(),
  /** User-facing abstention message. */
  abstentionMessage: z.string().optional(),
  /** Overall confidence that the answer is grounded and correct (0–1). */
  confidence: z.number().min(0).max(1),
  /** Confidence tier for display. */
  confidenceTier: z.enum(["high", "medium", "low", "insufficient"]),
  /** Ordered list of source citations. */
  citations: z.array(CitationSchema),
  /** Number of documents searched during retrieval. */
  documentsSearched: z.number().int(),
  /** Number of chunks retrieved before reranking. */
  chunksRetrieved: z.number().int(),
  /** Number of chunks after reranking. */
  chunksReranked: z.number().int(),
  /** Retrieval mode used. */
  retrievalMode: z.enum(["dense", "keyword", "hybrid", "metadata_only"]),
  /** Embedding model used for the query vector. */
  embeddingModel: z.string().optional(),
  /** Reranker model used (if any). */
  rerankModel: z.string().optional(),
  /** Retrieval latency in milliseconds. */
  retrievalLatencyMs: z.number().int(),
  /** Total response latency in milliseconds. */
  totalLatencyMs: z.number().int(),
  /** ISO 8601 timestamp of the response. */
  createdAt: z.string().datetime(),
  /** Schema version. */
  schemaVersion: z.string().default("rag.financeos.io/v1"),
});
export type DocumentAnswer = z.infer<typeof DocumentAnswerSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Citation assembly config — controls how evidence is assembled into citations
// ─────────────────────────────────────────────────────────────────────────────

export const CitationAssemblyConfigSchema = z.object({
  /** Maximum number of citations to include in the final answer. */
  maxCitations: z.number().int().min(1).max(20).default(5),
  /** Minimum score a citation must achieve to be included. */
  minScore: z.number().min(0).max(1).default(0.4),
  /**
   * Maximum excerpt length in characters.
   * Longer chunks are truncated with a trailing ellipsis.
   */
  maxExcerptLength: z.number().int().min(50).default(500),
  /** Whether to deduplicate citations from the same page of the same document. */
  deduplicateSamePage: z.boolean().default(true),
  /** Whether to prefer table citations when the query involves numerical data. */
  preferTableCitationsForNumbers: z.boolean().default(true),
  /** Whether to include sensitivity metadata in the citation output. */
  includeSensitivityMeta: z.boolean().default(true),
});
export type CitationAssemblyConfig = z.infer<typeof CitationAssemblyConfigSchema>;
