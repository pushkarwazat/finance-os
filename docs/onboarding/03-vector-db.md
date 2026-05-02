# Onboarding: Vector Database Adapter

**Interface:** `VectorStoreAdapter` (`packages/adapters/src/vector-store.ts`)  
**DI key:** `vectorStore`  
**Current stub:** `StubVectorStoreAdapter` — returns empty search results

---

## What this adapter does

The vector store adapter powers RAG (Retrieval-Augmented Generation) for
document Q&A. When a user asks a question about a contract, policy, or
financial memo, the RAG pipeline:

1. Encodes the query via `LlmProviderAdapter.embed()`
2. Searches the vector store via `VectorStoreAdapter.search()`
3. Reranks candidates via `RerankerAdapter.rerank()`
4. Synthesises an answer via `LlmProviderAdapter.complete()`

The vector store holds pre-ingested document chunks with their embeddings
and metadata (documentId, tenantId, fiscalPeriod, sensitivityLevel).

---

## Supported vector databases

| Database | Notes |
|---|---|
| Pinecone | Fully managed, namespace per tenant |
| Qdrant | Self-hosted or cloud, rich filtering |
| Weaviate | Schema-enforced, good for finance metadata |
| pgvector | PostgreSQL extension — good if already using Postgres |
| Milvus | High-throughput, hybrid search support |
| Chroma | Lightweight, good for development |

---

## Implementation steps (Pinecone)

### 1. Install the Pinecone client

```bash
pnpm --filter @workspace/api-server add @pinecone-database/pinecone
```

### 2. Create your adapter

```typescript
import { Pinecone } from "@pinecone-database/pinecone";
import { VectorStoreAdapter, VectorSearchQuery, VectorSearchResult } from "@financeos/adapters";

export class PineconeVectorStoreAdapter implements VectorStoreAdapter {
  readonly name = "pinecone";
  private client: Pinecone;
  private indexName: string;

  constructor(opts: { apiKey: string; indexName: string }) {
    this.client = new Pinecone({ apiKey: opts.apiKey });
    this.indexName = opts.indexName;
  }

  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const index = this.client.index(this.indexName);
    const ns = query.namespace ? index.namespace(query.namespace) : index;

    const result = await ns.query({
      vector: query.queryEmbedding,
      topK: query.topK,
      filter: query.filter,
      includeMetadata: true,
      includeValues: false,
    });

    return (result.matches ?? [])
      .filter(m => (m.score ?? 0) >= (query.minScore ?? 0))
      .map(m => ({
        id: m.id,
        score: m.score ?? 0,
        document: {
          id: m.id,
          content: String(m.metadata?.content ?? ""),
          metadata: m.metadata as VectorSearchResult["document"]["metadata"],
        },
      }));
  }

  async upsert(request) {
    const index = this.client.index(this.indexName);
    const ns = request.namespace ? index.namespace(request.namespace) : index;
    const vectors = request.documents.map(d => ({
      id: d.id,
      values: d.embedding!,
      metadata: { content: d.content, ...d.metadata },
    }));
    await ns.upsert(vectors);
    return { upsertedCount: vectors.length };
  }

  async delete(request) {
    const index = this.client.index(this.indexName);
    await index.deleteMany(request.ids);
    return { deletedCount: request.ids.length };
  }

  async fetch(ids, namespace) {
    const index = this.client.index(this.indexName);
    const ns = namespace ? index.namespace(namespace) : index;
    const result = await ns.fetch(ids);
    return Object.values(result.records).map(r => ({
      id: r.id, content: String(r.metadata?.content ?? ""), metadata: r.metadata as any,
    }));
  }

  async stats(namespace) {
    const index = this.client.index(this.indexName);
    const stats = await index.describeIndexStats();
    const ns = namespace ? stats.namespaces?.[namespace] : undefined;
    return {
      vectorCount: ns?.recordCount ?? stats.totalRecordCount ?? 0,
      dimension: stats.dimension ?? 1536,
      indexFullness: stats.indexFullness,
    };
  }

  async healthCheck() {
    const t = Date.now();
    try {
      await this.stats();
      return { connected: true, latencyMs: Date.now() - t };
    } catch (err) {
      return { connected: false, error: String(err) };
    }
  }
}
```

### 3. Register in the DI container

```typescript
container.register("vectorStore", new PineconeVectorStoreAdapter({
  apiKey: process.env.PINECONE_API_KEY!,
  indexName: process.env.PINECONE_INDEX_NAME ?? "financeos-docs",
}));
```

---

## Tenant isolation strategy

Use Pinecone **namespaces** (one per `tenantId`) to guarantee data isolation:

```typescript
// Ingestion
await adapter.upsert({ documents, namespace: tenantId });

// Retrieval
await adapter.search({ queryEmbedding, topK: 10, namespace: tenantId });
```

For shared indexes (cost optimisation), add `tenantId` as a metadata filter:
```typescript
filter: { tenantId: { $eq: tenantId } }
```

---

## Document ingestion pipeline

The ingestion pipeline lives in `packages/rag/src/ingestion/`. Wire the
vector store by registering the adapter and calling:

```typescript
const ingester = new MockIngester(); // TODO: replace with RealIngester
await ingester.ingest(documents, container.get("vectorStore"), container.get("llmProvider"));
```

---

## Production checklist

- [ ] One Pinecone namespace per tenant (`tenantId`)
- [ ] `sensitivityLevel: "restricted"` chunks excluded from general search
- [ ] Chunk size: 512 tokens with 64-token overlap (optimal for finance docs)
- [ ] Re-embed and re-index when embedding model version changes
- [ ] Monitor index fullness — Pinecone starter has 1M vector limit
- [ ] Enable deletion on document archive/expiry for GDPR compliance
