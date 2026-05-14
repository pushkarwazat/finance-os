-- FinanceOS RAG schema
-- Run this against a fresh PostgreSQL 15+ database.
-- Requires the pgvector extension (pre-installed on RDS PostgreSQL 15+).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS rag_documents (
    id                text        NOT NULL,
    tenant_id         text        NOT NULL DEFAULT 'tenant-demo-001',
    title             text        NOT NULL,
    filename          text        NOT NULL DEFAULT '',
    mime_type         text        NOT NULL DEFAULT '',
    size_bytes        integer     NOT NULL DEFAULT 0,
    type              text        NOT NULL DEFAULT 'policy_doc',
    status            text        NOT NULL DEFAULT 'processing',
    chunk_count       integer     NOT NULL DEFAULT 0,
    page_count        integer,
    sensitivity_level text        NOT NULL DEFAULT 'internal',
    sensitivity_tags  text[]      NOT NULL DEFAULT '{}',
    tags              text[]      NOT NULL DEFAULT '{}',
    fiscal_year       integer,
    period            text,
    uploaded_by       text        NOT NULL DEFAULT 'system',
    summary           text,
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS rag_chunks (
    chunk_id          text        NOT NULL,
    document_id       text        NOT NULL,
    tenant_id         text        NOT NULL,
    chunk_index       integer     NOT NULL,
    content_type      text        NOT NULL,
    section_title     text,
    chunk_text        text        NOT NULL,
    token_count       integer,
    page_number       integer,
    metadata_tags     text[],
    sensitivity_level text,
    embedding         vector(1024),
    metadata_json     jsonb,
    created_at        timestamptz DEFAULT now(),
    updated_at        timestamptz DEFAULT now(),
    PRIMARY KEY (chunk_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS rag_chunks_document_idx ON rag_chunks (document_id);
CREATE INDEX IF NOT EXISTS rag_chunks_tenant_idx   ON rag_chunks (tenant_id);

-- HNSW vector index for fast cosine similarity search
CREATE INDEX IF NOT EXISTS rag_chunks_embedding_idx
    ON rag_chunks USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
