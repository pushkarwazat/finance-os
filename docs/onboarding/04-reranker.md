# Onboarding: Reranker Adapter

**Interface:** `RerankerAdapter` (`packages/adapters/src/reranker.ts`)  
**DI key:** `reranker`  
**Current stub:** `StubRerankerAdapter` — passthrough (no re-scoring)

---

## What this adapter does

After the vector store returns the top-K candidates by embedding similarity,
the reranker applies a cross-encoder model to re-score each candidate
against the original query. This significantly improves RAG answer quality
for financial documents where lexical precision matters (e.g. "Q3 FY2025
gross margin" vs "Q3 FY2024 gross margin").

The stub is safe to run — it simply passes candidates through in original
order without reranking. You will see reduced answer accuracy but no errors.

---

## Supported rerankers

| Service | Notes |
|---|---|
| Cohere Rerank | Best accuracy, easy API |
| Jina Reranker | Open-weight, can self-host |
| BGE-Reranker | Strong open-weight, HuggingFace |
| Voyage Rerank | Good for finance/legal |
| Local cross-encoder | Via `transformers.js` or a sidecar container |

---

## Implementation steps (Cohere)

### 1. Install the Cohere client

```bash
pnpm --filter @workspace/api-server add cohere-ai
```

### 2. Create your adapter

```typescript
import { CohereClientV2 } from "cohere-ai";
import { RerankerAdapter, RerankRequest, RerankResponse } from "@financeos/adapters";

export class CohereRerankerAdapter implements RerankerAdapter {
  readonly name = "cohere-reranker";
  private client: CohereClientV2;

  constructor(opts: { apiKey: string }) {
    this.client = new CohereClientV2({ token: opts.apiKey });
  }

  async rerank(request: RerankRequest): Promise<RerankResponse> {
    const t = Date.now();
    const model = request.model ?? "rerank-v3.5";

    const response = await this.client.rerank({
      model,
      query: request.query,
      documents: request.candidates.map(c => c.content),
      topN: request.topK ?? request.candidates.length,
      returnDocuments: false,
    });

    const results = (response.results ?? []).map(r => ({
      id: request.candidates[r.index].id,
      content: request.candidates[r.index].content,
      rerankScore: r.relevanceScore,
      retrievalScore: request.candidates[r.index].retrievalScore,
      rank: r.index,
      metadata: request.candidates[r.index].metadata,
    }));

    return {
      results: results.filter(r => r.rerankScore >= (request.minScore ?? 0)),
      model,
      executionMs: Date.now() - t,
      inputCount: request.candidates.length,
      outputCount: results.length,
    };
  }

  async healthCheck() {
    // Cohere doesn't have a free ping — use a minimal embed call
    return { available: true, modelId: "rerank-v3.5" };
  }
}
```

### 3. Register in the DI container

```typescript
container.register("reranker", new CohereRerankerAdapter({
  apiKey: process.env.COHERE_API_KEY!,
}));
```

---

## When to skip reranking

If you're operating on very small document sets (< 10 chunks) or need
to minimise latency at the cost of quality, you can bypass reranking
by leaving the stub in place. The stub returns candidates in original
vector-similarity order.

---

## Production checklist

- [ ] Set `topK` on vector search to ~20, then rerank down to top 5
- [ ] Set `minScore: 0.3` to filter irrelevant chunks
- [ ] Log `rerankScore` alongside `retrievalScore` for RAG quality monitoring
- [ ] Add Cohere API key to secrets manager, never to `.env` in production
- [ ] Monitor reranker latency — Cohere p95 is ~200ms for 20 candidates
