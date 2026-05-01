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
    ├── rag/                 ← RAG interfaces (ingestion, retrieval, reranking)
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

- `packages/shared` — finance models (Metric, Forecast, CloseTask, Document, ApprovalRequest, AuditEvent)
- `packages/agents` — Agent, AgentSession, OrchestrationPlan, tool executor interfaces
- `packages/semantic` — SemanticMetricYaml YAML schema, DataContract, metric registry interface
- `packages/rag` — Chunk, IngestionJob, VectorRetriever, Reranker, EmbeddingProvider
- `packages/evals` — BenchmarkCase, BenchmarkSuite, EvalRun, ScoringHarness
- `packages/governance` — RBAC_POLICIES map, DEFAULT_APPROVAL_POLICIES, AuditLogger interface

## Environment

See `.env.example` for all configuration variables (warehouse, LLM, embedding, vector DB, auth, storage, observability).
