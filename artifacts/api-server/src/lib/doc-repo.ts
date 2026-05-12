/**
 * doc-repo — PostgreSQL repository for rag_documents and rag_chunks tables.
 *
 * Uses a raw pg Pool so it works independently of the Drizzle schema,
 * matching the same rag_chunks table already managed by PgVectorStoreAdapter.
 */

import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env["DATABASE_URL"],
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

// ─────────────────────────────────────────────────────────────────────────────
// StoredDocument
// ─────────────────────────────────────────────────────────────────────────────

export interface StoredDocument {
  id: string;
  tenantId: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  status: string;
  chunkCount: number;
  pageCount: number | null;
  sensitivityLevel: string;
  sensitivityTags: string[];
  tags: string[];
  fiscalYear: number | null;
  period: string | null;
  uploadedBy: string;
  summary: string | null;
  uploadedAt: string;
}

interface DocRow {
  id: string;
  tenant_id: string;
  title: string;
  filename: string;
  mime_type: string;
  size_bytes: number;
  type: string;
  status: string;
  chunk_count: number;
  page_count: number | null;
  sensitivity_level: string;
  sensitivity_tags: string[];
  tags: string[];
  fiscal_year: number | null;
  period: string | null;
  uploaded_by: string;
  summary: string | null;
  created_at: Date;
}

function rowToDoc(row: DocRow): StoredDocument {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    filename: row.filename,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    type: row.type,
    status: row.status,
    chunkCount: row.chunk_count,
    pageCount: row.page_count,
    sensitivityLevel: row.sensitivity_level,
    sensitivityTags: row.sensitivity_tags ?? [],
    tags: row.tags ?? [],
    fiscalYear: row.fiscal_year,
    period: row.period,
    uploadedBy: row.uploaded_by,
    summary: row.summary,
    uploadedAt: row.created_at.toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertDocumentParams {
  id: string;
  tenantId?: string;
  title: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  type: string;
  sensitivityLevel?: string;
  sensitivityTags?: string[];
  tags?: string[];
  fiscalYear?: number;
  period?: string;
  uploadedBy?: string;
  summary?: string;
}

export async function insertDocument(
  params: InsertDocumentParams,
): Promise<StoredDocument> {
  const { rows } = await pool.query<DocRow>(
    `INSERT INTO rag_documents
       (id, tenant_id, title, filename, mime_type, size_bytes, type, status,
        sensitivity_level, sensitivity_tags, tags, fiscal_year, period, uploaded_by, summary)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'processing',$8,$9,$10,$11,$12,$13,$14)
     RETURNING *`,
    [
      params.id,
      params.tenantId ?? "tenant-demo-001",
      params.title,
      params.filename,
      params.mimeType,
      params.sizeBytes,
      params.type,
      params.sensitivityLevel ?? "internal",
      params.sensitivityTags ?? [],
      params.tags ?? [],
      params.fiscalYear ?? null,
      params.period ?? null,
      params.uploadedBy ?? "system",
      params.summary ?? null,
    ],
  );
  return rowToDoc(rows[0]!);
}

// ─────────────────────────────────────────────────────────────────────────────
// Update status
// ─────────────────────────────────────────────────────────────────────────────

export async function updateDocumentStatus(
  id: string,
  status: string,
  extra?: { chunkCount?: number; pageCount?: number; summary?: string },
): Promise<StoredDocument | null> {
  const { rows } = await pool.query<DocRow>(
    `UPDATE rag_documents
     SET status      = $2,
         chunk_count = COALESCE($3, chunk_count),
         page_count  = COALESCE($4, page_count),
         summary     = COALESCE($5, summary),
         updated_at  = NOW()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      status,
      extra?.chunkCount ?? null,
      extra?.pageCount ?? null,
      extra?.summary ?? null,
    ],
  );
  return rows[0] ? rowToDoc(rows[0]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch by ID
// ─────────────────────────────────────────────────────────────────────────────

export async function findDocumentById(
  id: string,
): Promise<StoredDocument | null> {
  const { rows } = await pool.query<DocRow>(
    `SELECT * FROM rag_documents WHERE id = $1`,
    [id],
  );
  return rows[0] ? rowToDoc(rows[0]) : null;
}

// ─────────────────────────────────────────────────────────────────────────────
// List with filters
// ─────────────────────────────────────────────────────────────────────────────

export interface ListDocumentsFilter {
  type?: string;
  sensitivity?: string;
  search?: string;
  fiscalYear?: number;
  tenantId?: string;
  limit?: number;
  offset?: number;
}

export async function listDocuments(
  filter: ListDocumentsFilter = {},
): Promise<{ data: StoredDocument[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.tenantId) {
    params.push(filter.tenantId);
    conditions.push(`tenant_id = $${params.length}`);
  }
  if (filter.type) {
    params.push(filter.type);
    conditions.push(`type = $${params.length}`);
  }
  if (filter.sensitivity) {
    params.push(filter.sensitivity);
    conditions.push(`sensitivity_level = $${params.length}`);
  }
  if (filter.fiscalYear) {
    params.push(filter.fiscalYear);
    conditions.push(`fiscal_year = $${params.length}`);
  }
  if (filter.search) {
    params.push(`%${filter.search.toLowerCase()}%`);
    conditions.push(
      `(LOWER(title) LIKE $${params.length} OR LOWER(filename) LIKE $${params.length})`,
    );
  }

  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: countRows } = await pool.query<{ count: string }>(
    `SELECT COUNT(*) FROM rag_documents ${where}`,
    params,
  );
  const total = parseInt(countRows[0]?.count ?? "0", 10);

  const limit = filter.limit ?? 30;
  const offset = filter.offset ?? 0;
  const pagedParams = [...params, limit, offset];

  const { rows } = await pool.query<DocRow>(
    `SELECT * FROM rag_documents ${where}
     ORDER BY created_at DESC
     LIMIT $${pagedParams.length - 1} OFFSET $${pagedParams.length}`,
    pagedParams,
  );

  return { data: rows.map(rowToDoc), total };
}

// ─────────────────────────────────────────────────────────────────────────────
// Stats
// ─────────────────────────────────────────────────────────────────────────────

export async function getDocumentStats(): Promise<{
  total: number;
  byType: Record<string, number>;
  indexedChunks: number;
  tableChunks: number;
}> {
  const [docsResult, chunksResult] = await Promise.all([
    pool.query<{ type: string; count: string }>(
      `SELECT type, COUNT(*) as count FROM rag_documents GROUP BY type`,
    ),
    pool.query<{ chunk_count: string; table_count: string }>(
      `SELECT COUNT(*) as chunk_count,
              COUNT(*) FILTER (WHERE content_type = 'table') as table_count
       FROM rag_chunks`,
    ),
  ]);

  const byType: Record<string, number> = {};
  let total = 0;
  for (const row of docsResult.rows) {
    byType[row.type] = parseInt(row.count, 10);
    total += parseInt(row.count, 10);
  }

  const chunkRow = chunksResult.rows[0];
  return {
    total,
    byType,
    indexedChunks: parseInt(chunkRow?.chunk_count ?? "0", 10),
    tableChunks: parseInt(chunkRow?.table_count ?? "0", 10),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Chunks for a document (reads from rag_chunks, strips embedding)
// ─────────────────────────────────────────────────────────────────────────────

export interface StoredChunk {
  chunkId: string;
  documentId: string;
  chunkIndex: number;
  contentType: string;
  sectionTitle: string | null;
  chunkText: string;
  tokenCount: number | null;
  pageNumber: number | null;
  metadataTags: string[];
  sensitivityLevel: string;
}

interface ChunkRow {
  chunk_id: string;
  document_id: string;
  chunk_index: number;
  content_type: string;
  section_title: string | null;
  chunk_text: string;
  token_count: number | null;
  page_number: number | null;
  metadata_tags: string[] | null;
  sensitivity_level: string | null;
}

export async function getChunksByDocumentId(
  documentId: string,
  opts: { contentType?: string; limit?: number; offset?: number } = {},
): Promise<{
  data: StoredChunk[];
  total: number;
  tableChunks: number;
  narrativeChunks: number;
  avgTokenCount: number;
}> {
  const conditions: string[] = ["document_id = $1"];
  const params: unknown[] = [documentId];

  if (opts.contentType) {
    params.push(opts.contentType);
    conditions.push(`content_type = $${params.length}`);
  }

  const where = `WHERE ${conditions.join(" AND ")}`;

  const [countResult, dataResult] = await Promise.all([
    pool.query<{
      total: string;
      table_count: string;
      narrative_count: string;
      avg_tokens: string;
    }>(
      `SELECT
         COUNT(*) as total,
         COUNT(*) FILTER (WHERE content_type = 'table') as table_count,
         COUNT(*) FILTER (WHERE content_type = 'narrative') as narrative_count,
         COALESCE(AVG(token_count), 0)::int as avg_tokens
       FROM rag_chunks ${where}`,
      params,
    ),
    pool.query<ChunkRow>(
      `SELECT chunk_id, document_id, chunk_index, content_type,
              section_title, chunk_text, token_count, page_number,
              metadata_tags, sensitivity_level
       FROM rag_chunks ${where}
       ORDER BY chunk_index
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, opts.limit ?? 50, opts.offset ?? 0],
    ),
  ]);

  const cr = countResult.rows[0];
  return {
    total: parseInt(cr?.total ?? "0", 10),
    tableChunks: parseInt(cr?.table_count ?? "0", 10),
    narrativeChunks: parseInt(cr?.narrative_count ?? "0", 10),
    avgTokenCount: parseInt(cr?.avg_tokens ?? "0", 10),
    data: dataResult.rows.map((row) => ({
      chunkId: row.chunk_id,
      documentId: row.document_id,
      chunkIndex: row.chunk_index,
      contentType: row.content_type,
      sectionTitle: row.section_title,
      chunkText: row.chunk_text,
      tokenCount: row.token_count,
      pageNumber: row.page_number,
      metadataTags: row.metadata_tags ?? [],
      sensitivityLevel: row.sensitivity_level ?? "internal",
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Fetch table chunks WITH metadata_json (for Excel sheet reconstruction)
// ─────────────────────────────────────────────────────────────────────────────

export interface TableChunkMeta {
  chunkId: string;
  chunkIndex: number;
  sectionTitle: string | null;
  metadataJson: Record<string, unknown>;
}

export async function getTableChunksWithMeta(
  documentId: string,
): Promise<TableChunkMeta[]> {
  const { rows } = await pool.query<{
    chunk_id: string;
    chunk_index: number;
    section_title: string | null;
    metadata_json: Record<string, unknown> | null;
  }>(
    `SELECT chunk_id, chunk_index, section_title, metadata_json
     FROM rag_chunks
     WHERE document_id = $1 AND content_type = 'table'
     ORDER BY chunk_index`,
    [documentId],
  );

  return rows.map((r) => ({
    chunkId: r.chunk_id,
    chunkIndex: r.chunk_index,
    sectionTitle: r.section_title,
    metadataJson: r.metadata_json ?? {},
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Insert a single chunk (no embedding — used for Excel table chunks)
// ─────────────────────────────────────────────────────────────────────────────

export interface InsertChunkParams {
  chunkId: string;
  documentId: string;
  tenantId?: string;
  chunkIndex: number;
  contentType: string;
  sectionTitle?: string;
  chunkText: string;
  tokenCount?: number;
  metadataTags?: string[];
  sensitivityLevel?: string;
  metadataJson?: Record<string, unknown>;
}

export async function insertChunk(params: InsertChunkParams): Promise<void> {
  await pool.query(
    `INSERT INTO rag_chunks (
       chunk_id, document_id, tenant_id, chunk_index, content_type,
       section_title, chunk_text, token_count, metadata_tags,
       sensitivity_level, metadata_json
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (chunk_id) DO UPDATE SET
       chunk_text    = EXCLUDED.chunk_text,
       metadata_json = EXCLUDED.metadata_json,
       updated_at    = NOW()`,
    [
      params.chunkId,
      params.documentId,
      params.tenantId ?? "tenant-demo-001",
      params.chunkIndex,
      params.contentType,
      params.sectionTitle ?? null,
      params.chunkText,
      params.tokenCount ?? null,
      params.metadataTags ?? [],
      params.sensitivityLevel ?? "internal",
      JSON.stringify(params.metadataJson ?? {}),
    ],
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Delete a document + its chunks
// ─────────────────────────────────────────────────────────────────────────────

export async function deleteDocument(id: string): Promise<void> {
  await pool.query(`DELETE FROM rag_chunks WHERE document_id = $1`, [id]);
  await pool.query(`DELETE FROM rag_documents WHERE id = $1`, [id]);
}
