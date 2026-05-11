/**
 * pgvector Vector Store Adapter
 *
 * Implements VectorStoreAdapter using PostgreSQL + pgvector extension.
 * Connects via DATABASE_URL (set automatically by Replit's managed Postgres).
 *
 * Table: rag_chunks
 *   chunk_id TEXT PRIMARY KEY
 *   document_id TEXT
 *   tenant_id TEXT
 *   chunk_index INTEGER
 *   content_type TEXT
 *   section_title TEXT
 *   chunk_text TEXT
 *   token_count INTEGER
 *   page_number INTEGER
 *   metadata_tags TEXT[]
 *   sensitivity_level TEXT
 *   embedding vector(1024)       ← pgvector column
 *   metadata_json JSONB
 *
 * Similarity metric: cosine distance via <=> operator.
 * Index: HNSW (m=16, ef_construction=64).
 *
 * Required env vars: DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)
 */

import { Pool, type PoolConfig } from "pg";
import type {
  VectorStoreAdapter,
  VectorDocument,
  VectorSearchQuery,
  VectorSearchResult,
  VectorUpsertRequest,
  VectorDeleteRequest,
  VectorStoreHealthStatus,
  VectorStoreStats,
} from "./vector-store.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Serialize a float[] to the pgvector wire format: '[0.1,0.2,...]' */
function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}

/** Parse a pgvector response string back to number[] */
function fromVectorLiteral(s: string | null): number[] {
  if (!s) return [];
  return s
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .split(",")
    .map(Number);
}

// ─────────────────────────────────────────────────────────────────────────────
// Row → VectorDocument mapping
// ─────────────────────────────────────────────────────────────────────────────

interface ChunkRow {
  chunk_id: string;
  document_id: string;
  tenant_id: string;
  chunk_index: number;
  content_type: string;
  section_title: string | null;
  chunk_text: string;
  token_count: number | null;
  page_number: number | null;
  metadata_tags: string[] | null;
  sensitivity_level: string | null;
  embedding: string | null;
  metadata_json: Record<string, unknown> | null;
  similarity?: number;
}

function rowToDocument(row: ChunkRow): VectorDocument {
  return {
    id: row.chunk_id,
    content: row.chunk_text,
    embedding: row.embedding ? fromVectorLiteral(row.embedding) : undefined,
    metadata: {
      documentId: row.document_id,
      documentTitle: (row.metadata_json?.["documentTitle"] as string) ?? row.document_id,
      chunkIndex: row.chunk_index,
      pageNumber: row.page_number ?? undefined,
      contentType: row.content_type,
      sectionTitle: row.section_title ?? undefined,
      metadataTags: row.metadata_tags ?? [],
      sensitivityLevel: (row.sensitivity_level as VectorDocument["metadata"]["sensitivityLevel"]) ?? "internal",
      tenantId: row.tenant_id,
      ...((row.metadata_json ?? {}) as Record<string, unknown>),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter
// ─────────────────────────────────────────────────────────────────────────────

export class PgVectorStoreAdapter implements VectorStoreAdapter {
  readonly name = "pgvector";

  private readonly pool: Pool;

  constructor(config?: PoolConfig) {
    this.pool = new Pool(
      config ?? {
        connectionString: process.env["DATABASE_URL"],
        max: 10,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      },
    );
  }

  // ───────────────────────────────────────────────────────────────────────────
  // search — cosine similarity via pgvector <=> operator
  // ───────────────────────────────────────────────────────────────────────────

  async search(query: VectorSearchQuery): Promise<VectorSearchResult[]> {
    const { queryEmbedding, topK, minScore = 0, filter } = query;
    const vectorLiteral = toVectorLiteral(queryEmbedding);

    // Build WHERE clause from filter
    const conditions: string[] = [];
    const params: unknown[] = [vectorLiteral, topK];

    if (filter?.["tenantId"]) {
      params.push(filter["tenantId"]);
      conditions.push(`tenant_id = $${params.length}`);
    }
    if (filter?.["documentId"]) {
      params.push(filter["documentId"]);
      conditions.push(`document_id = $${params.length}`);
    }
    if (Array.isArray(filter?.["documentIds"]) && (filter["documentIds"] as string[]).length > 0) {
      params.push(filter["documentIds"]);
      conditions.push(`document_id = ANY($${params.length}::text[])`);
    }
    if (filter?.["contentType"]) {
      params.push(filter["contentType"]);
      conditions.push(`content_type = $${params.length}`);
    }
    if (filter?.["tablesOnly"]) {
      conditions.push(`content_type = 'table'`);
    }
    if (Array.isArray(filter?.["requiredTags"]) && (filter["requiredTags"] as string[]).length > 0) {
      params.push(filter["requiredTags"]);
      conditions.push(`metadata_tags @> $${params.length}::text[]`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT *,
             1 - (embedding <=> $1::vector) AS similarity
      FROM   rag_chunks
      ${where}
      ORDER  BY embedding <=> $1::vector
      LIMIT  $2
    `;

    const { rows } = await this.pool.query<ChunkRow & { similarity: number }>(sql, params);

    return rows
      .filter((r) => (r.similarity ?? 0) >= minScore)
      .map((r) => ({
        id: r.chunk_id,
        score: r.similarity ?? 0,
        document: rowToDocument(r),
      }));
  }

  // ───────────────────────────────────────────────────────────────────────────
  // upsert
  // ───────────────────────────────────────────────────────────────────────────

  async upsert(request: VectorUpsertRequest): Promise<{ upsertedCount: number }> {
    const { documents, batchSize = 50 } = request;

    let upsertedCount = 0;

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      for (const doc of batch) {
        const embeddingVal = doc.embedding ? toVectorLiteral(doc.embedding) : null;
        const { documentTitle, chunkIndex, pageNumber, contentType, sectionTitle, metadataTags, sensitivityLevel, tenantId, ...rest } =
          doc.metadata;

        await this.pool.query(
          `
          INSERT INTO rag_chunks (
            chunk_id, document_id, tenant_id, chunk_index, content_type,
            section_title, chunk_text, token_count, page_number,
            metadata_tags, sensitivity_level, embedding, metadata_json
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::vector,$13)
          ON CONFLICT (chunk_id) DO UPDATE SET
            embedding        = EXCLUDED.embedding,
            chunk_text       = EXCLUDED.chunk_text,
            metadata_json    = EXCLUDED.metadata_json,
            updated_at       = NOW()
          `,
          [
            doc.id,
            doc.metadata.documentId,
            tenantId,
            chunkIndex ?? 0,
            contentType ?? "narrative",
            sectionTitle ?? null,
            doc.content,
            null,
            pageNumber ?? null,
            Array.isArray(metadataTags) ? metadataTags : [],
            sensitivityLevel ?? "internal",
            embeddingVal,
            JSON.stringify({ documentTitle, ...rest }),
          ],
        );
        upsertedCount++;
      }
    }

    return { upsertedCount };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // delete
  // ───────────────────────────────────────────────────────────────────────────

  async delete(request: VectorDeleteRequest): Promise<{ deletedCount: number }> {
    const { ids } = request;
    if (ids.length === 0) return { deletedCount: 0 };

    const result = await this.pool.query(
      `DELETE FROM rag_chunks WHERE chunk_id = ANY($1::text[])`,
      [ids],
    );
    return { deletedCount: result.rowCount ?? 0 };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // fetch
  // ───────────────────────────────────────────────────────────────────────────

  async fetch(ids: string[], _namespace?: string): Promise<VectorDocument[]> {
    if (ids.length === 0) return [];
    const { rows } = await this.pool.query<ChunkRow>(
      `SELECT * FROM rag_chunks WHERE chunk_id = ANY($1::text[])`,
      [ids],
    );
    return rows.map(rowToDocument);
  }

  // ───────────────────────────────────────────────────────────────────────────
  // stats
  // ───────────────────────────────────────────────────────────────────────────

  async stats(_namespace?: string): Promise<VectorStoreStats> {
    const { rows } = await this.pool.query<{ count: string; indexed: string }>(
      `SELECT
         COUNT(*)                                    AS count,
         COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS indexed
       FROM rag_chunks`,
    );
    const row = rows[0];
    return {
      vectorCount: parseInt(row?.indexed ?? "0", 10),
      dimension: 1024,
    };
  }

  // ───────────────────────────────────────────────────────────────────────────
  // healthCheck
  // ───────────────────────────────────────────────────────────────────────────

  async healthCheck(): Promise<VectorStoreHealthStatus> {
    const start = Date.now();
    try {
      const { rows } = await this.pool.query<{ count: string; indexed: string }>(
        `SELECT
           COUNT(*)                                      AS count,
           COUNT(*) FILTER (WHERE embedding IS NOT NULL) AS indexed
         FROM rag_chunks`,
      );
      const row = rows[0];
      return {
        connected: true,
        vectorCount: parseInt(row?.indexed ?? "0", 10),
        latencyMs: Date.now() - start,
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
