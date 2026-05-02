import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Vector store provider configs
// ─────────────────────────────────────────────────────────────────────────────

export const VectorStoreProviderTypeSchema = z.enum([
  "pinecone",
  "qdrant",
  "pgvector",
  "weaviate",
  "opensearch",
  "in_memory",
]);
export type VectorStoreProviderType = z.infer<typeof VectorStoreProviderTypeSchema>;

/** Pinecone serverless / pod-based config */
export const PineconeConfigSchema = z.object({
  provider: z.literal("pinecone"),
  apiKey: z.string().describe("PINECONE_API_KEY"),
  environment: z.string().optional().describe("e.g. us-east-1-aws"),
  indexName: z.string().default("financeos-chunks"),
  namespace: z.string().default(""),
  /** Whether to use the serverless API (default) or pod-based. */
  serverless: z.boolean().default(true),
  cloud: z.enum(["aws", "gcp", "azure"]).default("aws"),
  region: z.string().default("us-east-1"),
  dimensions: z.number().int().default(1536),
  metric: z.enum(["cosine", "dotproduct", "euclidean"]).default("cosine"),
});
export type PineconeConfig = z.infer<typeof PineconeConfigSchema>;

/** Qdrant self-hosted or Qdrant Cloud config */
export const QdrantConfigSchema = z.object({
  provider: z.literal("qdrant"),
  url: z.string().url().default("http://localhost:6333"),
  apiKey: z.string().optional().describe("QDRANT_API_KEY (Qdrant Cloud only)"),
  collectionName: z.string().default("financeos_chunks"),
  dimensions: z.number().int().default(1536),
  distance: z.enum(["Cosine", "Dot", "Euclid", "Manhattan"]).default("Cosine"),
  /** HNSW index parameters */
  hnswConfig: z
    .object({
      m: z.number().int().default(16),
      efConstruct: z.number().int().default(100),
    })
    .optional(),
  /** Enable on-disk payload indexing for metadata filtering. */
  onDiskPayload: z.boolean().default(true),
});
export type QdrantConfig = z.infer<typeof QdrantConfigSchema>;

/** pgvector (PostgreSQL extension) config */
export const PgvectorConfigSchema = z.object({
  provider: z.literal("pgvector"),
  connectionString: z.string().describe("DATABASE_URL"),
  tableName: z.string().default("document_chunks"),
  dimensions: z.number().int().default(1536),
  /** Index type — ivfflat is recommended for > 100k vectors. */
  indexType: z.enum(["ivfflat", "hnsw"]).default("hnsw"),
  /** IVFFlat: number of inverted file lists. */
  ivfflatLists: z.number().int().optional(),
  /** HNSW: m parameter. */
  hnswM: z.number().int().default(16),
  /** HNSW: ef_construction. */
  hnswEfConstruction: z.number().int().default(64),
  /** Distance operator. */
  distanceOperator: z.enum(["<=>", "<#>", "<->"]).default("<=>"),
});
export type PgvectorConfig = z.infer<typeof PgvectorConfigSchema>;

/** Weaviate config */
export const WeaviateConfigSchema = z.object({
  provider: z.literal("weaviate"),
  url: z.string().url().default("http://localhost:8080"),
  apiKey: z.string().optional().describe("WEAVIATE_API_KEY"),
  className: z.string().default("FinanceOSChunk"),
  /** Whether to use Weaviate's built-in vectorizer (requires module config). */
  useBuiltinVectorizer: z.boolean().default(false),
  vectorizerModule: z.string().optional(),
  /** Weaviate tenant for multi-tenant collections. */
  tenantName: z.string().optional(),
});
export type WeaviateConfig = z.infer<typeof WeaviateConfigSchema>;

/** OpenSearch (dense retrieval via kNN) config */
export const OpenSearchConfigSchema = z.object({
  provider: z.literal("opensearch"),
  node: z.string().url().default("http://localhost:9200"),
  username: z.string().optional(),
  password: z.string().optional(),
  indexName: z.string().default("financeos-chunks"),
  dimensions: z.number().int().default(1536),
  /** kNN engine: faiss is recommended for production. */
  knnEngine: z.enum(["nmslib", "faiss", "lucene"]).default("faiss"),
  spaceType: z.enum(["l2", "cosinesimil", "innerproduct"]).default("cosinesimil"),
});
export type OpenSearchConfig = z.infer<typeof OpenSearchConfigSchema>;

/** In-memory mock vector store (development / testing only) */
export const InMemoryVectorStoreConfigSchema = z.object({
  provider: z.literal("in_memory"),
  maxVectors: z.number().int().default(100_000),
  /** Whether to serialise to disk on shutdown. */
  persistPath: z.string().optional(),
});
export type InMemoryVectorStoreConfig = z.infer<typeof InMemoryVectorStoreConfigSchema>;

export const VectorStoreConfigSchema = z.discriminatedUnion("provider", [
  PineconeConfigSchema,
  QdrantConfigSchema,
  PgvectorConfigSchema,
  WeaviateConfigSchema,
  OpenSearchConfigSchema,
  InMemoryVectorStoreConfigSchema,
]);
export type VectorStoreConfig = z.infer<typeof VectorStoreConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Embedding provider configs
// ─────────────────────────────────────────────────────────────────────────────

export const EmbeddingProviderTypeSchema = z.enum([
  "openai",
  "cohere",
  "anthropic",
  "bedrock",
  "huggingface",
  "mock",
]);
export type EmbeddingProviderType = z.infer<typeof EmbeddingProviderTypeSchema>;

export const OpenAIEmbeddingConfigSchema = z.object({
  provider: z.literal("openai"),
  apiKey: z.string().describe("OPENAI_API_KEY"),
  model: z
    .enum(["text-embedding-3-small", "text-embedding-3-large", "text-embedding-ada-002"])
    .default("text-embedding-3-small"),
  dimensions: z.number().int().default(1536),
  batchSize: z.number().int().default(100),
  maxRetries: z.number().int().default(3),
  timeout: z.number().int().default(30_000),
});

export const CohereEmbeddingConfigSchema = z.object({
  provider: z.literal("cohere"),
  apiKey: z.string().describe("COHERE_API_KEY"),
  model: z
    .enum(["embed-english-v3.0", "embed-multilingual-v3.0", "embed-english-light-v3.0"])
    .default("embed-english-v3.0"),
  dimensions: z.number().int().default(1024),
  inputType: z.enum(["search_document", "search_query"]).default("search_document"),
  batchSize: z.number().int().default(96),
});

export const MockEmbeddingConfigSchema = z.object({
  provider: z.literal("mock"),
  dimensions: z.number().int().default(1536),
  model: z.string().default("mock-embedding-v1"),
  /** Simulated latency per batch in ms. */
  latencyMs: z.number().int().default(20),
});

export const EmbeddingProviderConfigSchema = z.discriminatedUnion("provider", [
  OpenAIEmbeddingConfigSchema,
  CohereEmbeddingConfigSchema,
  MockEmbeddingConfigSchema,
]);
export type EmbeddingProviderConfig = z.infer<typeof EmbeddingProviderConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Reranker provider configs
// ─────────────────────────────────────────────────────────────────────────────

export const RerankProviderTypeSchema = z.enum(["cohere", "bge", "cross_encoder", "mock"]);
export type RerankProviderType = z.infer<typeof RerankProviderTypeSchema>;

export const CohereRerankConfigSchema = z.object({
  provider: z.literal("cohere"),
  apiKey: z.string().describe("COHERE_API_KEY"),
  model: z
    .enum(["rerank-english-v3.0", "rerank-multilingual-v3.0", "rerank-english-v2.0"])
    .default("rerank-english-v3.0"),
  maxDocumentsPerRequest: z.number().int().default(100),
});

export const MockRerankConfigSchema = z.object({
  provider: z.literal("mock"),
  model: z.string().default("mock-rerank-v1"),
  latencyMs: z.number().int().default(15),
});

export const RerankProviderConfigSchema = z.discriminatedUnion("provider", [
  CohereRerankConfigSchema,
  MockRerankConfigSchema,
]);
export type RerankProviderConfig = z.infer<typeof RerankProviderConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Parser provider configs
// ─────────────────────────────────────────────────────────────────────────────

export const ParserProviderTypeSchema = z.enum([
  "unstructured",
  "tika",
  "pdfplumber",
  "llamaparse",
  "mock",
]);
export type ParserProviderType = z.infer<typeof ParserProviderTypeSchema>;

export const UnstructuredParserConfigSchema = z.object({
  provider: z.literal("unstructured"),
  apiUrl: z.string().url().default("https://api.unstructuredapp.io/general/v0/general"),
  apiKey: z.string().describe("UNSTRUCTURED_API_KEY"),
  strategy: z.enum(["auto", "fast", "hi_res", "ocr_only"]).default("auto"),
  /** Enable OCR for scanned PDFs. */
  ocr: z.boolean().default(false),
  /** Supported MIME types. */
  mimeTypes: z.array(z.string()).default(["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"]),
});

export const MockParserConfigSchema = z.object({
  provider: z.literal("mock"),
  latencyMs: z.number().int().default(50),
  /** Number of mock pages to simulate. */
  simulatedPages: z.number().int().default(10),
  /** Number of mock tables to simulate. */
  simulatedTables: z.number().int().default(2),
});

export const ParserProviderConfigSchema = z.discriminatedUnion("provider", [
  UnstructuredParserConfigSchema,
  MockParserConfigSchema,
]);
export type ParserProviderConfig = z.infer<typeof ParserProviderConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Full provider config bundle — combine all provider selections
// ─────────────────────────────────────────────────────────────────────────────

export const RAGProviderConfigSchema = z.object({
  /** Human-readable environment label (e.g. "development", "production"). */
  environment: z.string().default("development"),
  vectorStore: VectorStoreConfigSchema,
  embedding: EmbeddingProviderConfigSchema,
  reranker: RerankProviderConfigSchema.optional(),
  parser: ParserProviderConfigSchema,
  /** Whether to enable keyword/BM25 index alongside the vector store. */
  enableHybridRetrieval: z.boolean().default(true),
  /** Whether to enable the reranker step. */
  enableReranking: z.boolean().default(true),
  /** Whether to enable NER enrichment during ingestion. */
  enableNER: z.boolean().default(true),
});
export type RAGProviderConfig = z.infer<typeof RAGProviderConfigSchema>;

/** Default mock provider config — safe for development without any API keys. */
export const DEFAULT_MOCK_PROVIDER_CONFIG: RAGProviderConfig = {
  environment: "development",
  vectorStore: { provider: "in_memory", maxVectors: 100_000 },
  embedding: { provider: "mock", dimensions: 1536, model: "mock-embedding-v1", latencyMs: 20 },
  reranker: { provider: "mock", model: "mock-rerank-v1", latencyMs: 15 },
  parser: { provider: "mock", latencyMs: 50, simulatedPages: 10, simulatedTables: 2 },
  enableHybridRetrieval: true,
  enableReranking: true,
  enableNER: true,
};
