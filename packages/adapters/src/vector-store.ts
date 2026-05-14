/**
 * Vector Store Adapter Interface
 *
 * Abstracts the vector database (Pinecone, Weaviate, Qdrant, pgvector,
 * Milvus, Chroma, etc.) used for RAG document retrieval.
 *
 * TODO: Replace the stub with a real vector store connector.
 * See: docs/onboarding/03-vector-db.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type Embedding = number[];

export interface VectorDocument {
  id: string;
  /** The text content of this chunk. */
  content: string;
  /** The embedding vector. */
  embedding?: Embedding;
  /** Arbitrary metadata stored alongside the vector. */
  metadata: {
    documentId: string;
    documentTitle: string;
    chunkIndex: number;
    pageNumber?: number;
    fiscalPeriod?: string;
    documentType?: string;
    tenantId: string;
    sensitivityLevel?: "public" | "internal" | "confidential" | "restricted";
    [key: string]: unknown;
  };
}

export interface VectorSearchQuery {
  /** Pre-computed embedding of the query. */
  queryEmbedding: Embedding;
  /** Number of results to return. */
  topK: number;
  /** Minimum similarity score (0-1). Documents below this are excluded. */
  minScore?: number;
  /** Metadata filters — e.g. restrict to a specific tenant or document type. */
  filter?: Record<string, unknown>;
  /** Namespace / collection to search in. */
  namespace?: string;
  requestId?: string;
  traceId?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  document: VectorDocument;
}

export interface VectorUpsertRequest {
  documents: VectorDocument[];
  namespace?: string;
  batchSize?: number;
}

export interface VectorDeleteRequest {
  ids: string[];
  namespace?: string;
}

export interface VectorStoreHealthStatus {
  connected: boolean;
  indexCount?: number;
  vectorCount?: number;
  latencyMs?: number;
  error?: string;
}

export interface VectorStoreStats {
  namespace?: string;
  vectorCount: number;
  dimension: number;
  indexFullness?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Document catalog types (rag_documents table)
// ─────────────────────────────────────────────────────────────────────────────

export interface DocumentRecord {
  id: string;
  tenantId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  status: string;
  chunkCount: number | null;
  pageCount: number | null;
  sensitivityLevel: string | null;
  sensitivityTags: string[] | null;
  tags: string[] | null;
  fiscalYear: number | null;
  period: string | null;
  uploadedBy: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentListOpts {
  type?: string;
  status?: string;
  search?: string;
  limit: number;
  offset: number;
}

export interface DocumentListResult {
  data: DocumentRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface DocumentStatsResult {
  total: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  totalSizeBytes: number;
  totalChunks: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

export interface VectorStoreAdapter {
  readonly name: string;

  /**
   * Search for semantically similar documents given a query embedding.
   */
  search(query: VectorSearchQuery): Promise<VectorSearchResult[]>;

  /**
   * Upsert document chunks with their embeddings.
   */
  upsert(request: VectorUpsertRequest): Promise<{ upsertedCount: number }>;

  /**
   * Delete document chunks by ID.
   */
  delete(request: VectorDeleteRequest): Promise<{ deletedCount: number }>;

  /**
   * Fetch specific documents by ID.
   */
  fetch(ids: string[], namespace?: string): Promise<VectorDocument[]>;

  /**
   * Return index statistics (vector count, dimension, etc.).
   */
  stats(namespace?: string): Promise<VectorStoreStats>;

  /**
   * Health check — called by /healthz.
   */
  healthCheck(): Promise<VectorStoreHealthStatus>;

  /**
   * List documents from the catalog with optional filters and pagination.
   */
  listDocuments(opts: DocumentListOpts): Promise<DocumentListResult>;

  /**
   * Fetch a single document record by ID. Returns null if not found.
   */
  getDocumentById(id: string): Promise<DocumentRecord | null>;

  /**
   * Aggregate document statistics (counts by type/status, total size/chunks).
   */
  getDocumentStats(): Promise<DocumentStatsResult>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub — replace with real connector in production
// TODO: Implement PineconeAdapter, QdrantAdapter, PgVectorAdapter, etc.
// ─────────────────────────────────────────────────────────────────────────────

export class StubVectorStoreAdapter implements VectorStoreAdapter {
  readonly name = "stub-vector-store";

  async search(_query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    // TODO: Connect to real vector store. See docs/onboarding/03-vector-db.md
    return [];
  }

  async upsert(_request: VectorUpsertRequest): Promise<{ upsertedCount: number }> {
    return { upsertedCount: 0 };
  }

  async delete(_request: VectorDeleteRequest): Promise<{ deletedCount: number }> {
    return { deletedCount: 0 };
  }

  async fetch(_ids: string[]): Promise<VectorDocument[]> {
    return [];
  }

  async stats(): Promise<VectorStoreStats> {
    return { vectorCount: 0, dimension: 1536 };
  }

  async healthCheck(): Promise<VectorStoreHealthStatus> {
    return { connected: false, error: "StubVectorStoreAdapter: no real vector store configured. See docs/onboarding/03-vector-db.md" };
  }

  async listDocuments(opts: DocumentListOpts): Promise<DocumentListResult> {
    return { data: [], total: 0, limit: opts.limit, offset: opts.offset };
  }

  async getDocumentById(_id: string): Promise<DocumentRecord | null> {
    return null;
  }

  async getDocumentStats(): Promise<DocumentStatsResult> {
    return { total: 0, byType: {}, byStatus: {}, totalSizeBytes: 0, totalChunks: 0 };
  }
}
