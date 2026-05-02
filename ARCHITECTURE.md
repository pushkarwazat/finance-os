# FinanceOS — Architecture & 90-Day Enterprise Deployment Guide

> **Version:** 1.0.0 — Production Readiness Scaffold  
> **Last updated:** May 2026  
> **Status:** Scaffold complete. Infrastructure adapters are stubbed and documented.
> Wire in real connectors following the onboarding guides in `docs/onboarding/`.

---

## Table of Contents

1. [What FinanceOS is](#1-what-financeos-is)
2. [System architecture](#2-system-architecture)
3. [Package map](#3-package-map)
4. [Adapter model](#4-adapter-model)
5. [Dependency injection container](#5-dependency-injection-container)
6. [Error handling & logging](#6-error-handling--logging)
7. [Health & observability](#7-health--observability)
8. [Security model](#8-security-model)
9. [Evals & quality gates](#9-evals--quality-gates)
10. [90-day enterprise deployment path](#10-90-day-enterprise-deployment-path)
11. [File index](#11-file-index)

---

## 1. What FinanceOS is

FinanceOS is an enterprise finance AI platform that puts a semantic intelligence
layer on top of your existing data warehouse, ERP, and document repositories.
It provides:

- **Ask AI** — conversational natural-language interface to financial metrics
- **Variance analysis** — automated budget-vs-actual with LLM-written narratives
- **Close management** — agentic period-end close with human approval gates
- **Document Q&A** — RAG over contracts, policies, invoices, and memos
- **Governance** — RBAC, audit logging, prompt logs, column-level sensitivity
- **Agents** — autonomous financial workflows (AP matching, AR collections, etc.)
- **Evals** — offline + online benchmarking harness with 300 test cases

The platform is **warehouse-agnostic**, **LLM-agnostic**, and **IdP-agnostic**
via the adapter layer described below.

---

## 2. System architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (React + Vite)                                              │
│  /metrics · /ask · /variance · /close · /documents · /governance    │
│  /agents · /approvals · /exceptions · /evals                        │
└───────────────────────────────┬──────────────────────────────────────┘
                                │ HTTPS (TLS at proxy)
┌───────────────────────────────▼──────────────────────────────────────┐
│  Express 5 API Server  (artifacts/api-server)                        │
│                                                                      │
│  pinoHttp → requestId/traceId → cors → json → routes                │
│                                                 └→ errorHandler      │
│                                                                      │
│  Route groups: /api/{healthz,metrics,variance,close,documents,       │
│                      governance,agents,workflows,ask,rag,            │
│                      semantic,analytics,evals}                       │
└──┬──────────┬──────────┬─────────┬──────────┬──────────┬────────────┘
   │          │          │         │          │          │
   ▼          ▼          ▼         ▼          ▼          ▼
SQL Wh.  Semantic   Vector    Reranker  LLM Prov.  Auth Prov.
Adapter   Engine    Store     Adapter   Adapter    Adapter
(stub)   Adapter   Adapter   (stub)    (stub)     (stub)
(stub)   (stub)    (stub)
   │          │          │         │          │          │
   └──────────┴──────────┴────┬────┴──────────┴──────────┘
                              │  @financeos/container (DI)
                              ▼
              Domain packages: @financeos/{agents,rag,semantic,
                               governance,evals,shared,adapters}
```

See `docs/architecture/overview.md` for a detailed ASCII diagram with
request lifecycle and data flow.

---

## 3. Package map

| Package | Description | Key exports |
|---|---|---|
| `@workspace/api-server` | Express 5 REST API (15 route groups) | App entry point |
| `@workspace/api-zod` | Generated Zod schemas from OpenAPI spec | Request/response validators |
| `@workspace/api-client-react` | Generated React Query hooks | Frontend data fetching |
| `@financeos/shared` | Shared types, error classes, logging contracts | `AppError`, `Logger`, models |
| `@financeos/adapters` | 6 adapter interfaces + stubs | `SqlWarehouseAdapter`, etc. |
| `@financeos/container` | DI container singleton | `container`, `FinanceOsContainer` |
| `@financeos/semantic` | NL→query pipeline, metric schema compiler | `analyzeQuery`, semantic types |
| `@financeos/rag` | Document ingestion + RAG retrieval | `MockIngester`, `MockRetriever` |
| `@financeos/agents` | Agentic workflow engine, 6 agent types | `AgentEngine`, `WorkflowRun` |
| `@financeos/governance` | RBAC, audit, policies, prompt logs | `RBAC_POLICIES`, `hasPermission` |
| `@financeos/evals` | Benchmark harness, 300 test cases, CLI | `EvalRunner`, `MockScorer` |

---

## 4. Adapter model

Every piece of external infrastructure (warehouse, LLM, vector DB, etc.) is
accessed through a typed interface in `packages/adapters/src/`. The adapters
follow these rules:

1. **Interfaces are pure TypeScript** — no runtime dependencies
2. **Each interface has exactly one stub** — safe for development, warns in `/healthz/ready`
3. **Each stub has `TODO` comments** pointing to the onboarding doc
4. **The DI container** holds one registered instance per adapter slot
5. **Route handlers never import adapter implementations** — only call `container.get()`

```
packages/adapters/src/
  sql-warehouse.ts     SqlWarehouseAdapter      → Snowflake, BigQuery, Redshift
  semantic-engine.ts   SemanticEngineAdapter    → dbt Semantic Layer, Cube.dev
  vector-store.ts      VectorStoreAdapter       → Pinecone, Qdrant, pgvector
  reranker.ts          RerankerAdapter          → Cohere, Jina, BGE
  llm-provider.ts      LlmProviderAdapter       → OpenAI, Anthropic, Azure OpenAI
  auth-provider.ts     AuthProviderAdapter      → Auth0, Okta, Entra ID
```

Onboarding docs: `docs/onboarding/0{1..6}-*.md`

---

## 5. Dependency injection container

```typescript
// packages/container/src/container.ts
import { container } from "@financeos/container";

// Read an adapter (throws if slot not registered)
const llm = container.get("llmProvider");
await llm.complete({ model: "gpt-4o", messages });

// Register a real adapter (in your server entry point, before app.listen)
import { OpenAiLlmAdapter } from "./adapters/openai.js";
container.register("llmProvider", new OpenAiLlmAdapter({ apiKey: process.env.OPENAI_API_KEY! }));

// Check adapter health (used by /healthz/ready)
const health = await container.healthCheckAll();
// → { sqlWarehouse: { ok: false, stub: true, ... }, llmProvider: { ok: true, stub: false, ... } }

// Detect stubs programmatically
if (container.isStub("authProvider")) {
  logger.warn({}, "Auth is running on stub — no real access control");
}
```

All 6 slots start as stubs. Replace them one at a time as you onboard each
infrastructure component.

---

## 6. Error handling & logging

### Error types (`packages/shared/src/errors.ts`)

| Class | HTTP | Code |
|---|---|---|
| `NotFoundError` | 404 | `not_found` |
| `ValidationError` | 400 | `validation_error` |
| `BadRequestError` | 400 | `bad_request` |
| `UnauthorizedError` | 401 | `unauthorized` |
| `ForbiddenError` | 403 | `forbidden` |
| `AdapterUnavailableError` | 503 | `adapter_unavailable` |
| `AdapterTimeoutError` | 504 | `adapter_timeout` |
| `AbstentionError` | 422 | `abstention` |
| `PolicyViolationError` | 403 | `policy_violation` |
| `WorkflowTransitionError` | 422 | `workflow_invalid_transition` |

Throw any `AppError` subclass in a route handler — the error handler
middleware catches it and serialises it to the standard `ErrorResponse` shape.

### Logging contract (`packages/shared/src/logging.ts`)

```typescript
import type { Logger, RequestLogEvent, LlmCallEvent } from "@financeos/shared";

// In route handlers — use req.log (pino child with requestId/traceId bound)
req.log.info({ durationMs: 42 } satisfies RequestLogEvent, "Request handled");

// In adapters — accept Logger via constructor injection
class MyAdapter {
  constructor(private readonly logger: Logger) {}
  async call() {
    this.logger.info({ adapterName: "my-adapter", durationMs: 150 } satisfies LlmCallEvent, "LLM call complete");
  }
}
```

### Request ID propagation

Every request gets a `requestId` (UUID) and `traceId` (from upstream or = requestId):

- Attached to `res.locals.requestId` / `res.locals.traceId`
- Forwarded in response headers: `X-Request-Id`, `X-Trace-Id`
- Bound to the pino child logger so every log line carries both IDs
- Accepted from upstream via `X-Request-Id`, `X-Correlation-Id`, `traceparent`

---

## 7. Health & observability

### Endpoints

| Endpoint | Purpose | Probe type |
|---|---|---|
| `GET /api/healthz` | Process alive | Kubernetes liveness |
| `GET /api/healthz/ready` | All adapters ok | Kubernetes readiness |

### `/api/healthz/ready` response

```json
{
  "status": "degraded",
  "version": "0.0.0",
  "uptimeSeconds": 3601,
  "requestId": "550e8400-e29b-41d4-a716-446655440000",
  "note": "One or more adapters are stubs — see docs/onboarding/ to wire real connectors.",
  "dependencies": {
    "sqlWarehouse":    { "ok": false, "name": "stub-sql-warehouse",    "stub": true  },
    "semanticEngine":  { "ok": false, "name": "stub-semantic-engine",  "stub": true  },
    "vectorStore":     { "ok": false, "name": "stub-vector-store",     "stub": true  },
    "reranker":        { "ok": false, "name": "stub-reranker",         "stub": true  },
    "llmProvider":     { "ok": true,  "name": "openai",                "stub": false, "latencyMs": 84 },
    "authProvider":    { "ok": false, "name": "stub-auth-provider",    "stub": true  }
  }
}
```

### Structured log fields

Every log line emitted by the API server includes:

```json
{
  "level": "info",
  "time": 1746200000000,
  "requestId": "550e8400-...",
  "traceId": "550e8400-...",
  "req": { "id": "...", "method": "GET", "url": "/api/metrics" },
  "res": { "statusCode": 200 },
  "responseTime": 42
}
```

---

## 8. Security model

| Layer | Control | Status |
|---|---|---|
| TLS | Terminate at reverse proxy | ✅ Replit proxy handles this |
| Auth | JWT validation via `AuthProviderAdapter` | 🟡 Stub — wire real IdP |
| RBAC | `hasPermission(role, action)` in every route | ✅ Implemented |
| Row-level | `RowAccessPolicy` per tenant | ✅ Implemented |
| Column-level | `ColumnSensitivityTag` masks PII | ✅ Implemented |
| Query guardrails | Semantic guardrail rules block unsafe queries | ✅ Implemented |
| Prompt abstention | `AbstentionPolicy` prevents out-of-scope LLM calls | ✅ Implemented |
| Audit log | All decisions written to `auditEvents` | ✅ Implemented |
| LLM prompt log | All prompts + completions stored | ✅ Implemented |

> 🟡 items require real adapter wiring — see `docs/onboarding/06-auth-rbac.md`.

---

## 9. Evals & quality gates

The evals system (`packages/evals/`, `artifacts/api-server/src/routes/evals.ts`)
provides a 300-case offline benchmark harness across 7 suites:

| Suite | Cases | Target pass |
|---|---|---|
| Finance Analytics | 100 | 82% |
| Variance Analysis | 50 | 78% |
| Document Extraction | 50 | 76% |
| Workflow Task | 25 | 80% |
| Ambiguous Query | 25 | 70% |
| Unsupported Query | 25 | 85% |
| Regression | 25 | 90% |

**Quality gates for production promotion:**
- All suites must pass target rate
- Hallucination rate must stay below 10%
- Regression suite must maintain 90%+ (zero regressions allowed)
- Run `pnpm --filter @financeos/evals run cli` to execute offline

---

## 10. 90-Day enterprise deployment path

### Days 1–14: Foundation

| Task | Owner | Guide |
|---|---|---|
| Stand up the API server on a VM / ECS task | DevOps | `pnpm --filter @workspace/api-server run build && run start` |
| Configure TLS and domain | DevOps | Replit Deployments or nginx reverse proxy |
| Wire SQL warehouse adapter | Data Engineering | `docs/onboarding/01-sql-warehouse.md` |
| Define first semantic domain (Revenue) | Analytics Engineering | `docs/onboarding/02-semantic-engine.md` |
| Replace stub auth with real IdP | Security | `docs/onboarding/06-auth-rbac.md` |
| Set up log aggregation (Datadog / Splunk) | DevOps | Use pino JSON → log shipper |

**Exit criteria:**
- ✅ `GET /api/healthz/ready` returns `status: "ok"` with `sqlWarehouse` and `authProvider` ok
- ✅ `/api/metrics` returns real actuals for at least one metric
- ✅ Authentication rejects unauthenticated requests

---

### Days 15–30: RAG & LLM

| Task | Owner | Guide |
|---|---|---|
| Wire LLM provider (OpenAI or Azure OpenAI) | Engineering | `docs/onboarding/05-llm-provider.md` |
| Wire vector store (Pinecone or pgvector) | Engineering | `docs/onboarding/03-vector-db.md` |
| Wire reranker (Cohere Rerank) | Engineering | `docs/onboarding/04-reranker.md` |
| Ingest first document corpus (policies, contracts) | Engineering | `packages/rag/src/ingestion/` |
| Enable Ask AI for pilot users | Product | `/ask` route is ready |
| Run eval suite against real LLM | QA | `pnpm --filter @financeos/evals run cli` |

**Exit criteria:**
- ✅ `GET /api/healthz/ready` returns all 6 adapters ok
- ✅ Ask AI returns grounded answers with document citations
- ✅ Eval suite passes all target pass rates
- ✅ Hallucination rate < 10%

---

### Days 31–60: Workflows & Close

| Task | Owner | Guide |
|---|---|---|
| Configure approval email notifications | Engineering | Wire `getUsersByRole()` to real IdP |
| Connect close task list to ERP | Data Engineering | Extend `CloseTask` with real data |
| Enable Variance Analysis workflow for pilot FP&A team | Finance | `/workflows` route is ready |
| Implement AP 3-way match integration | Engineering | `packages/agents/src/agents/ap-invoice-research.ts` |
| Set up Prometheus metrics exporter | DevOps | Add `/metrics` endpoint — see TODO in health.ts |
| SOX ITGC evidence collection | Compliance | Audit log → evidence package |

**Exit criteria:**
- ✅ At least 2 agentic workflows running against real data
- ✅ Approval notifications delivered to real approvers
- ✅ Audit log exported to SIEM

---

### Days 61–90: Production Hardening

| Task | Owner | Guide |
|---|---|---|
| Enable column-level masking for PII fields | Security | `packages/governance/src/column-sensitivity.ts` |
| Multi-tenant isolation audit | Security | `packages/rag/src/tenant/isolation.ts` |
| Load test: 50 concurrent users, p95 < 2s | DevOps | Use k6 or Locust |
| Disaster recovery runbook | DevOps | Define RTO/RPO per adapter |
| Enable eval regression gate in CI | Engineering | `pnpm --filter @financeos/evals run cli --fail-on-regression` |
| Train finance team on Ask AI | Change Management | — |
| Go-live sign-off (Controller + CISO) | Governance | Audit trail required |

**Exit criteria:**
- ✅ p95 API latency < 2s under load
- ✅ All 6 adapters registered and healthy in production
- ✅ Zero eval regressions over 30-day baseline
- ✅ SOC 2 / ISO 27001 evidence package complete
- ✅ Controller and CISO sign-off documented in audit log

---

### Beyond Day 90: Scale & Extend

- Add new financial domains to the semantic layer (AP, Payroll, Treasury)
- Implement streaming LLM responses for long-form variance narratives
- Add multi-model routing (cost vs. quality per use case)
- Expand evals to 1,000+ cases using real QA data
- Enable self-serve dashboard creation via semantic query API
- Integrate with BI tools (Tableau, Power BI) via semantic layer API

---

## 11. File index

```
/
├── ARCHITECTURE.md                    ← this file
├── coverage-summary.md                ← test coverage summary
├── docs/
│   ├── architecture/
│   │   └── overview.md               ← system diagram + request lifecycle
│   └── onboarding/
│       ├── 01-sql-warehouse.md
│       ├── 02-semantic-engine.md
│       ├── 03-vector-db.md
│       ├── 04-reranker.md
│       ├── 05-llm-provider.md
│       └── 06-auth-rbac.md
├── packages/
│   ├── adapters/src/                  ← 6 adapter interfaces + stubs
│   │   ├── sql-warehouse.ts
│   │   ├── semantic-engine.ts
│   │   ├── vector-store.ts
│   │   ├── reranker.ts
│   │   ├── llm-provider.ts
│   │   └── auth-provider.ts
│   ├── container/src/container.ts     ← DI container singleton
│   ├── shared/src/
│   │   ├── errors.ts                  ← AppError + 10 typed subclasses
│   │   └── logging.ts                 ← Logger interface + event shapes
│   ├── semantic/src/                  ← NL→query pipeline + metric schema
│   ├── rag/src/                       ← RAG ingestion + retrieval
│   ├── agents/src/                    ← 6 agentic workflow types
│   ├── governance/src/                ← RBAC, audit, policies
│   └── evals/src/                     ← 300-case benchmark harness
├── artifacts/
│   ├── api-server/src/
│   │   ├── app.ts                     ← Express app + middleware stack
│   │   ├── index.ts                   ← Server entry point
│   │   ├── lib/logger.ts              ← pino logger singleton
│   │   ├── middlewares/
│   │   │   ├── request-id.ts          ← requestId + traceId injection
│   │   │   └── error-handler.ts       ← centralised error handler
│   │   └── routes/
│   │       ├── health.ts              ← /healthz + /healthz/ready
│   │       └── ...                    ← 12 other route groups
│   └── finance-os/src/               ← React + Vite frontend
└── lib/
    ├── api-spec/openapi.yaml          ← OpenAPI 3.0 spec (source of truth)
    ├── api-zod/src/                   ← Generated Zod validators
    └── api-client-react/src/          ← Generated React Query hooks
```
