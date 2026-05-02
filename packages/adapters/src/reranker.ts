/**
 * Reranker Adapter Interface
 *
 * Abstracts a cross-encoder reranker (Cohere Rerank, Jina Reranker,
 * BGE-Reranker, a locally hosted model, etc.) used to improve RAG
 * retrieval precision by re-scoring candidate chunks.
 *
 * TODO: Replace the stub with a real reranker connector.
 * See: docs/onboarding/04-reranker.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface RerankCandidate {
  id: string;
  content: string;
  /** Original retrieval score from the vector store (0-1). */
  retrievalScore: number;
  metadata?: Record<string, unknown>;
}

export interface RerankRequest {
  /** The original user query. */
  query: string;
  /** Candidate documents to rerank. */
  candidates: RerankCandidate[];
  /** How many top results to return after reranking. */
  topK?: number;
  /** Minimum rerank score to include (0-1). */
  minScore?: number;
  /** Model identifier — passed through to the reranker API. */
  model?: string;
  requestId?: string;
  traceId?: string;
}

export interface RerankResult {
  id: string;
  content: string;
  /** Reranker's relevance score (0-1). Higher is more relevant. */
  rerankScore: number;
  /** Original retrieval score for comparison. */
  retrievalScore: number;
  /** Rank position after reranking (0-indexed). */
  rank: number;
  metadata?: Record<string, unknown>;
}

export interface RerankResponse {
  results: RerankResult[];
  model: string;
  executionMs: number;
  inputCount: number;
  outputCount: number;
}

export interface RerankerHealthStatus {
  available: boolean;
  latencyMs?: number;
  modelId?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

export interface RerankerAdapter {
  readonly name: string;

  /**
   * Rerank a list of candidate documents against a user query.
   * Returns a subset sorted by relevance descending.
   */
  rerank(request: RerankRequest): Promise<RerankResponse>;

  /**
   * Health check — called by /healthz.
   */
  healthCheck(): Promise<RerankerHealthStatus>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub — replace with real connector in production
// TODO: Implement CohereRerankerAdapter, JinaRerankerAdapter, etc.
// ─────────────────────────────────────────────────────────────────────────────

export class StubRerankerAdapter implements RerankerAdapter {
  readonly name = "stub-reranker";

  async rerank(request: RerankRequest): Promise<RerankResponse> {
    // TODO: Connect to real reranker. See docs/onboarding/04-reranker.md
    // Passthrough: return candidates in original order as a fallback
    const results: RerankResult[] = request.candidates.map((c, i) => ({
      id: c.id,
      content: c.content,
      rerankScore: c.retrievalScore,
      retrievalScore: c.retrievalScore,
      rank: i,
      metadata: c.metadata,
    }));
    return {
      results: results.slice(0, request.topK ?? results.length),
      model: "stub-passthrough",
      executionMs: 0,
      inputCount: request.candidates.length,
      outputCount: results.length,
    };
  }

  async healthCheck(): Promise<RerankerHealthStatus> {
    return { available: false, error: "StubRerankerAdapter: no real reranker configured. See docs/onboarding/04-reranker.md" };
  }
}
