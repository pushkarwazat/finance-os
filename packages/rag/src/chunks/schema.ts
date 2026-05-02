import { z } from "zod";
import { SensitivityLevelSchema } from "../documents/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Content type — distinguishes how a chunk should be processed and rendered
// ─────────────────────────────────────────────────────────────────────────────

export const ContentTypeSchema = z.enum([
  "narrative",
  "table",
  "list",
  "header",
  "footer",
  "caption",
  "footnote",
  "title_page",
  "signature_block",
]);
export type ContentType = z.infer<typeof ContentTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Table reference — present only when contentType === "table"
// ─────────────────────────────────────────────────────────────────────────────

export const TableReferenceSchema = z.object({
  /** Table label as it appears in the document (e.g. "Table 3"). */
  tableLabel: z.string().optional(),
  /** Extracted column headers. */
  headers: z.array(z.string()).default([]),
  /** Extracted row count (excluding header). */
  rowCount: z.number().int().min(0).default(0),
  /** Serialised Markdown representation of the table for LLM consumption. */
  markdownTable: z.string().optional(),
  /** Source page if the table spans a single page. */
  sourcePage: z.number().int().optional(),
  /** Pages spanned if the table crosses page boundaries. */
  sourcePages: z.array(z.number().int()).optional(),
  /** Whether the table contains numeric financial data. */
  hasFinancialData: z.boolean().default(false),
  /** Detected currency codes found in the table. */
  currencies: z.array(z.string()).default([]),
});
export type TableReference = z.infer<typeof TableReferenceSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Named entity — graph-ready metadata extracted from the chunk
// ─────────────────────────────────────────────────────────────────────────────

export const NamedEntitySchema = z.object({
  text: z.string(),
  type: z.enum([
    "organization",
    "person",
    "date",
    "amount",
    "metric",
    "account",
    "contract_ref",
    "regulation",
    "location",
    "other",
  ]),
  /** Confidence from the NER model (0–1). */
  confidence: z.number().min(0).max(1),
  /** Link to a canonical entity ID in the knowledge graph (optional). */
  entityId: z.string().optional(),
});
export type NamedEntity = z.infer<typeof NamedEntitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Chunk schema — the fundamental retrieval unit
// ─────────────────────────────────────────────────────────────────────────────

export const ChunkSchema = z.object({
  /** Globally unique chunk identifier (UUID). */
  chunkId: z.string().uuid(),
  /** The source document UUID. */
  documentId: z.string().uuid(),
  /** Tenant namespace. */
  tenantId: z.string(),
  /** Zero-based sequential position within the document. */
  chunkIndex: z.number().int().min(0),
  /**
   * Content type — drives different retrieval scoring and display logic.
   * Tables are scored differently from narrative prose.
   */
  contentType: ContentTypeSchema,
  /** Section or heading this chunk belongs to (extracted from structure). */
  sectionTitle: z.string().optional(),
  /** Sub-section path, e.g. ["2. Revenue Recognition", "2.1 SaaS Products"]. */
  sectionPath: z.array(z.string()).default([]),
  /** The full text content of the chunk. */
  chunkText: z.string(),
  /** Approximate token count using the ingestion model's tokeniser. */
  tokenCount: z.number().int().min(1),
  /**
   * Starting page number (1-indexed).
   * Null if the document format does not have page boundaries.
   */
  pageNumber: z.number().int().min(1).optional(),
  /** Table metadata — populated only when contentType is "table". */
  tableReference: TableReferenceSchema.optional(),
  /**
   * Free-form metadata tags (e.g. "revenue", "Q3-2025", "reconciliation").
   * Used for metadata-only and hybrid retrieval filtering.
   */
  metadataTags: z.array(z.string()).default([]),
  /** Sensitivity classification inherited or overridden at chunk level. */
  sensitivityLevel: SensitivityLevelSchema.default("internal"),
  /**
   * Structured sensitivity tags.
   * Common values: "PII", "NDA", "MNPI", "PERSONAL_DATA", "BOARD_ONLY".
   */
  sensitivityTags: z.array(z.string()).default([]),
  /**
   * Named entities extracted from this chunk.
   * Graph-ready: includes entity type and optional graph link.
   */
  entities: z.array(NamedEntitySchema).default([]),
  /**
   * Graph-ready relationship stubs.
   * E.g. [{ subject: "contract-001", predicate: "references", object: "vendor-abc" }]
   */
  relationships: z
    .array(
      z.object({
        subject: z.string(),
        predicate: z.string(),
        object: z.string(),
        confidence: z.number().min(0).max(1).optional(),
      })
    )
    .default([]),
  /**
   * Dense embedding vector. Not persisted in the primary DB;
   * stored in the configured vector store. Included in-memory only.
   */
  embedding: z.array(z.number()).optional(),
  /** Embedding model used to produce this chunk's vector. */
  embeddingModel: z.string().optional(),
  /** Embedding dimensions (e.g. 1536 for text-embedding-3-small). */
  embeddingDimensions: z.number().int().optional(),
  /** ISO 8601 timestamp of when this chunk was created. */
  createdAt: z.string().datetime(),
  /** ISO 8601 timestamp of last update (e.g. re-embedding). */
  updatedAt: z.string().datetime(),
  /** Schema version tag. */
  schemaVersion: z.string().default("rag.financeos.io/v1"),
});
export type Chunk = z.infer<typeof ChunkSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Chunk list schema
// ─────────────────────────────────────────────────────────────────────────────

export const ChunkListSchema = z.object({
  documentId: z.string().uuid(),
  chunks: z.array(ChunkSchema),
  totalChunks: z.number().int(),
  tableChunks: z.number().int(),
  narrativeChunks: z.number().int(),
  avgTokenCount: z.number(),
});
export type ChunkList = z.infer<typeof ChunkListSchema>;
