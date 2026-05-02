# FinanceOS — Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            FinanceOS Enterprise Platform                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        React + Vite Frontend                            │   │
│  │  Metrics · Ask AI · Variance · Close · Documents · Governance · Agents  │   │
│  │  Approvals · Exceptions · Evals                                         │   │
│  └────────────────────────────────┬────────────────────────────────────────┘   │
│                                   │ HTTPS / REST                                │
│  ┌────────────────────────────────▼────────────────────────────────────────┐   │
│  │                     Express 5 API Server                                │   │
│  │                                                                         │   │
│  │  Middleware stack (in order):                                           │   │
│  │    pinoHttp → requestId → cors → json → routes → errorHandler           │   │
│  │                                                                         │   │
│  │  Route groups:                                                          │   │
│  │    /api/healthz          health + dependency probes                     │   │
│  │    /api/metrics          metric time-series                             │   │
│  │    /api/variance         variance drivers & forecasts                   │   │
│  │    /api/close            close task management                          │   │
│  │    /api/documents        document ingestion & retrieval                 │   │
│  │    /api/governance       RBAC · audit · policies · prompt logs          │   │
│  │    /api/agents           agent registry & sessions                      │   │
│  │    /api/workflows        workflow runs · approvals · exceptions          │   │
│  │    /api/ask              conversational AI interface                    │   │
│  │    /api/rag              RAG search & ingestion                         │   │
│  │    /api/semantic         semantic layer query & analytics               │   │
│  │    /api/analytics        NL→query pipeline                              │   │
│  │    /api/evals            benchmark harness (9 endpoints)                │   │
│  └───┬─────────┬──────────┬──────────┬──────────┬────────┬─────────────────┘   │
│      │         │          │          │          │        │                      │
│  ┌───▼───┐ ┌──▼───┐ ┌────▼───┐ ┌───▼───┐ ┌──▼───┐ ┌───▼───┐                 │
│  │ SQL   │ │Seman-│ │ Vector │ │Rerank │ │ LLM  │ │ Auth  │  ADAPTER LAYER   │
│  │Ware-  │ │ tic  │ │ Store  │ │  -er  │ │Prov- │ │Prov-  │  (interfaces     │
│  │house  │ │Engine│ │        │ │       │ │ider  │ │ ider  │   only — plug    │
│  │Adapter│ │Adapt-│ │Adapter │ │Adapt- │ │Adapt-│ │Adapt- │   in real        │
│  │       │ │ er   │ │        │ │  er   │ │ er   │ │ er    │   connectors)    │
│  └───┬───┘ └──┬───┘ └────┬───┘ └───┬───┘ └──┬───┘ └───┬───┘                 │
│      │        │           │         │         │         │                      │
│  ┌───▼────────▼───────────▼─────────▼─────────▼─────────▼────────────────┐   │
│  │                      DI Container (packages/container)                  │   │
│  │  container.get("sqlWarehouse")  .get("llmProvider")  .healthCheckAll() │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         Domain Packages                                 │   │
│  │  @financeos/agents   @financeos/rag     @financeos/semantic             │   │
│  │  @financeos/governance @financeos/evals @financeos/shared               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## Request Lifecycle

```
Browser
  │
  ▼  HTTPS
Reverse Proxy (Replit / nginx / ALB in prod)
  │
  ▼  HTTP
Express API Server
  │
  ├─ pinoHttp          → structured JSON log: method, path, status, durationMs
  ├─ requestIdMiddleware → attach requestId + traceId to req/res/log
  ├─ cors              → CORS preflight handling
  ├─ express.json()    → body parsing
  │
  ▼
Route Handler
  │
  ├─ Input validation  (Zod schema from @workspace/api-zod)
  ├─ Auth check        (container.get("authProvider").validateToken())
  ├─ RBAC check        (container.get("authProvider").authorize())
  ├─ Business logic    (domain packages)
  │   ├─ Semantic query  → container.get("semanticEngine").query()
  │   ├─ RAG retrieval   → container.get("vectorStore").search()
  │   │                     + container.get("reranker").rerank()
  │   └─ LLM generation  → container.get("llmProvider").complete()
  ├─ Response          (Zod-validated output)
  │
  ▼
errorHandlerMiddleware  (catches AppError subclasses → consistent JSON)
  │
  ▼
Browser
```

## Data Flow: Ask AI (conversational finance)

```
User Question (NL)
      │
      ▼
  SemanticAnalyticsPipeline          (@financeos/semantic)
      │  • intent classification
      │  • metric resolution
      │  • time range parsing
      │  • filter extraction
      ▼
  QueryContract (validated plan)
      │
      ├──────────────────────────────────────────────┐
      │  Semantic path                               │  RAG path
      ▼                                              ▼
  SemanticEngineAdapter                        VectorStoreAdapter
  (query actuals from warehouse)               (search document chunks)
      │                                              │
      ▼                                              ▼
  Metric values + time series              RerankerAdapter (re-score)
      │                                              │
      └──────────────────────────┬───────────────────┘
                                 │
                                 ▼
                         LlmProviderAdapter
                         (synthesise answer with citations)
                                 │
                                 ▼
                         AskResponse (answer + citations + confidence)
```

## Package Dependency Graph

```
@workspace/api-server
  ├── @workspace/api-zod       (generated request/response schemas)
  ├── @financeos/shared        (error types, logging contracts, models)
  ├── @financeos/adapters      (adapter interfaces + stubs)
  ├── @financeos/container     (DI container singleton)
  ├── @financeos/semantic      (NL→query pipeline, metric schema)
  ├── @financeos/rag           (document ingestion & retrieval)
  ├── @financeos/agents        (agentic workflow engine)
  ├── @financeos/governance    (RBAC, audit, policies)
  └── @financeos/evals         (benchmark harness)

@financeos/agents
  └── @financeos/shared

@financeos/rag
  └── @financeos/shared

@financeos/governance
  └── @financeos/shared

@financeos/semantic
  (standalone — no @financeos/* deps)

@financeos/adapters
  └── @financeos/shared

@financeos/container
  ├── @financeos/adapters
  └── @financeos/shared
```

## Security Boundaries

| Layer | Control |
|---|---|
| Network | TLS termination at reverse proxy |
| Auth | JWT validation via AuthProviderAdapter |
| RBAC | Per-route permission check (governance package) |
| Row-level | RowAccessPolicy evaluated per tenant |
| Column-level | ColumnSensitivityTag masks PII fields |
| Query | Guardrail rules block unsafe semantic queries |
| Prompt | AbstentionPolicy prevents out-of-scope LLM calls |
| Audit | All decisions written to immutable audit log |

## Observability

| Signal | Implementation |
|---|---|
| Structured logs | pino JSON (req.log in handlers, `logger` for non-request) |
| Request ID | `X-Request-Id` header, propagated to all log lines |
| Trace ID | `X-Trace-Id` header (ready for OpenTelemetry injection) |
| Health check | `GET /api/healthz` — probes all 6 adapter slots |
| Metrics (future) | Prometheus `/metrics` endpoint — see TODO in health.ts |
| Alerts | Wire `container.healthCheckAll()` to PagerDuty / OpsGenie |
