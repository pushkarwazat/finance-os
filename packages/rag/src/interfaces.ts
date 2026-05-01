import { z } from "zod";

export const ChunkSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  index: z.number().int(),
  content: z.string(),
  tokenCount: z.number().int(),
  pageNumber: z.number().int().optional(),
  sectionHeading: z.string().optional(),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Chunk = z.infer<typeof ChunkSchema>;

export const RetrievalQuerySchema = z.object({
  id: z.string().uuid(),
  text: z.string(),
  filters: z
    .object({
      documentIds: z.array(z.string().uuid()).optional(),
      documentTypes: z.array(z.string()).optional(),
      fiscalYear: z.number().int().optional(),
      tags: z.array(z.string()).optional(),
    })
    .optional(),
  topK: z.number().int().min(1).max(50).default(10),
  rerankTopK: z.number().int().min(1).max(20).default(5),
  minScore: z.number().min(0).max(1).default(0.5),
});
export type RetrievalQuery = z.infer<typeof RetrievalQuerySchema>;

export const RetrievalResultSchema = z.object({
  queryId: z.string().uuid(),
  chunks: z.array(
    z.object({
      chunk: ChunkSchema,
      score: z.number(),
      rerankScore: z.number().optional(),
    })
  ),
  latencyMs: z.number().int(),
  model: z.string(),
  rerankModel: z.string().optional(),
});
export type RetrievalResult = z.infer<typeof RetrievalResultSchema>;

export const IngestionJobSchema = z.object({
  id: z.string().uuid(),
  documentId: z.string().uuid(),
  status: z.enum(["queued", "extracting", "chunking", "embedding", "indexing", "done", "failed"]),
  totalChunks: z.number().int().optional(),
  processedChunks: z.number().int().default(0),
  errorMessage: z.string().optional(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  model: z.string(),
});
export type IngestionJob = z.infer<typeof IngestionJobSchema>;

export interface DocumentIngester {
  ingest(documentId: string, content: Buffer, mimeType: string): Promise<IngestionJob>;
  getJobStatus(jobId: string): Promise<IngestionJob>;
}

export interface VectorRetriever {
  retrieve(query: RetrievalQuery): Promise<RetrievalResult>;
}

export interface Reranker {
  rerank(query: string, chunks: Chunk[], topK: number): Promise<Chunk[]>;
}

export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
  model: string;
}
