# FinanceOS — Enterprise Finance AI Platform

## Overview

Production-grade enterprise finance AI platform scaffold. A monorepo providing metric intelligence, document-grounded Q&A, variance analysis, financial close management, governance workflows, and agent evaluation.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: None (mock repositories — set `MOCK_DATA=false` to enable real DB)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Architecture

```
FinanceOS (pnpm monorepo)
├── artifacts/
│   ├── api-server/          ← Express 5 REST API  (port 8080, path /api)
│   └── finance-os/          ← React + Vite admin UI  (port 24160, path /)
├── lib/
│   ├── api-spec/            ← OpenAPI 3.1 contract (source of truth)
│   ├── api-client-react/    ← Generated React Query hooks
│   ├── api-zod/             ← Generated Zod validators
│   └── db/                  ← Drizzle ORM schema (unused in mock mode)
└── packages/
    ├── shared/              ← Domain models, Zod schemas
    ├── agents/              ← Agent contracts and orchestration interfaces
    ├── semantic/            ← YAML metric schemas + data contracts
    ├── rag/                 ← Full RAG abstraction layer (see RAG section below)
    ├── evals/               ← Benchmark definitions and scoring harness
    └── governance/          ← RBAC policies, approval rules, audit schemas
```

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/finance-os run dev` — run web UI locally
- `pnpm --filter @workspace/api-server run dev` — run API server locally

## Workflows

- **API Server**: `PORT=8080 BASE_PATH=/api pnpm --filter @workspace/api-server run dev`
- **FinanceOS**: `PORT=24160 BASE_PATH=/ pnpm --filter @workspace/finance-os run dev`

## API Endpoints

All endpoints prefixed with `/api`:

- `GET /api/healthz` — health check
- `GET /api/metrics` — list metrics (params: category, period, fiscalYear, limit, offset)
- `GET /api/metrics/summary` — metric dashboard summary
- `GET /api/metrics/:id` — metric by ID
- `POST /api/ask` — natural language Q&A
- `GET /api/ask/sessions` — session list
- `GET /api/variance` — variance drivers
- `GET /api/variance/forecast` — forecast vs actuals
- `GET /api/close/tasks` — close task list
- `POST /api/close/tasks` — create task
- `GET /api/close/tasks/:id` — task by ID
- `PATCH /api/close/tasks/:id` — update task
- `GET /api/close/summary` — close progress summary
- `GET /api/documents` — document list
- `GET /api/documents/stats` — document stats
- `GET /api/documents/:id` — document by ID
- `GET /api/governance/approvals` — approval requests
- `POST /api/governance/approvals/:id/decide` — approve/reject
- `GET /api/governance/audit` — audit log
- `GET /api/governance/policies` — policies
- `GET /api/evals/suites` — benchmark suites
- `GET /api/evals/runs` — eval runs
- `POST /api/evals/runs` — start eval run
- `GET /api/agents` — agent registry
- `GET /api/agents/:id/sessions` — agent sessions

## Mock Data

All data is mock/in-memory. No external DB or vector DB required. Fixtures in `artifacts/api-server/src/data/fixtures.ts`.

## Packages Summary

- `packages/shared` — finance models (Metric, Forecast, CloseTask, Document, ApprovalRequest, AuditEvent) + Role enum with 8 roles (viewer, analyst, finance_manager, operator, controller, cfo, auditor, admin) + Permission enum with 21 permissions
- `packages/agents` — Full workflow agent layer: 6 finance agents, state machines, approval/exception/action schemas, mock engine, orchestrator routing
- `packages/semantic` — SemanticMetricYaml YAML schema, DataContract, metric registry interface
- `packages/rag` — Full RAG layer: 7 document type schemas, chunk/citation schemas, 7-step ingestion pipeline, hybrid retrieval contracts, mock providers, 7 document fixtures + 17 chunks, 25-case eval suite, tenant isolation
- `packages/governance` — Enterprise governance layer: RBAC (8 roles), row-level access, column sensitivity tags, prompt/response logging, abstention policies, evidence requirements, model registry, environment config, release management, mock security middleware, sample finance policies

## RAG Layer (`packages/rag` — `@financeos/rag`)

### Document Schemas (`src/documents/schema.ts`)
7 typed finance document schemas via Zod discriminated union:
- `ContractDocument` — MSA/SOW/NDA with counterparty, value, renewal window
- `InvoiceDocument` — vendor invoices with line items, GL codes, payment status
- `PolicyDocument` — compliance policies with frameworks (ASC 606, IFRS 15, SOX)
- `CloseMemoDocument` — quarterly close with adjustments, sign-off, materiality
- `BoardDeckDocument` — board materials with MNPI flags and agenda items
- `AuditWorkpaperDocument` — SOX/ITGC findings with risk ratings and remediation
- `SOPDocument` — procedures with systems, roles, and control points

### Chunk Schema (`src/chunks/schema.ts`)
Full retrieval unit with: `chunkId`, `documentId`, `tenantId`, `chunkIndex`, `contentType` (narrative/table/list/header/…), `sectionTitle`, `sectionPath`, `chunkText`, `tokenCount`, `pageNumber`, `tableReference` (with Markdown table, headers, financial flag), `metadataTags`, `sensitivityLevel`, `sensitivityTags`, `entities` (NER, graph-ready), `relationships`, `embedding`, `embeddingModel`.

### Ingestion Pipeline (`src/ingestion/`)
7-step interface: `parse → normalize → classify → chunk → embed → index → enrich`
- `ChunkingStrategy`: fixed_tokens | sentence_aware | semantic_boundary | table_aware
- Tables are isolated as separate chunks with full markdown + header extraction
- `MockDocumentIngestionPipeline` implements all 7 steps with deterministic output
- `IngestionJob` tracks per-step status, counts, warnings, errors

### Retrieval Contracts (`src/retrieval/`)
- `DenseRetrievalConfig` — cosine similarity with topK + minScore
- `KeywordRetrievalConfig` — BM25 with k1/b params + query expansion
- `HybridRetrievalConfig` — RRF fusion with alpha weight (default 0.6 dense)
- `MetadataFilter` — DSL for tenant, type, year, period, tags, sensitivity, table filter
- `RerankConfig` — pluggable reranker with model and topK
- `CitationAssemblyConfig` — max citations, dedup, prefer tables for numbers
- `mockRetrieve()` — deterministic hybrid scorer + reranker + citation assembler

### Provider Config Contracts (`src/providers/config.ts`)
Vector stores: Pinecone, Qdrant, pgvector, Weaviate, OpenSearch, in_memory
Embeddings: OpenAI (text-embedding-3-small/large), Cohere, Mock
Rerankers: Cohere (rerank-english-v3.0), Mock
Parsers: Unstructured, Tika, pdfplumber, LlamaParse, Mock

### Fixtures (`src/fixtures/`)
- 7 `FinanceDocument` fixtures (one per type) with realistic metadata
- 17 `Chunk` fixtures: 13 narrative + 4 table chunks with markdown tables

### Evaluation (`src/evaluation/`)
- 25 `RetrievalEvalCase` test cases across 8 categories
- Checks: abstention correctness, document hit, keyword hit, confidence threshold, table citation presence
- `runEvalSuite()` — batch runner with per-category breakdown. Current mock pass rate: 64% (16/25), avg score 91%

### Tenant Isolation (`src/tenant/isolation.ts`)
- `TenantConfig` — per-tenant document type allow-list, sensitivity ceiling, rate limits
- 3 isolation strategies: namespace, filter, collection
- `MetadataFilterBuilder` — fluent builder that enforces tenant ceilings
- `InMemoryTenantRegistry` — swap for DB in production
- `checkTenantAccess()` — enforces sensitivity and document type policies

## RAG API Endpoints

- `GET /api/rag/status` — pipeline manifest (providers, capabilities, counts)
- `POST /api/rag/search` — hybrid RAG search → `DocumentAnswer` with citations
- `GET /api/rag/documents` — list indexed RAG documents (filter: type, sensitivity, fiscalYear, search)
- `GET /api/rag/documents/:id` — single document detail
- `GET /api/rag/documents/:id/chunks` — document chunks (filter: contentType)
- `POST /api/rag/ingest` — simulate 7-step ingestion pipeline for a document
- `GET /api/rag/eval` — run retrieval evaluation suite (filter: tag, caseId)
- `GET /api/rag/eval/cases` — list eval test cases
- `GET /api/rag/providers` — list supported and active provider configs
- `packages/evals` — BenchmarkCase, BenchmarkSuite, EvalRun, ScoringHarness
- `packages/governance` — RBAC_POLICIES map, DEFAULT_APPROVAL_POLICIES, AuditLogger interface

## Environment

See `.env.example` for all configuration variables (warehouse, LLM, embedding, vector DB, auth, storage, observability).
