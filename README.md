# FinanceOS

> Enterprise Finance AI Platform — Production-Grade Scaffold

FinanceOS is a modular, production-grade scaffold for building AI-augmented financial operations platforms. It provides the architectural skeleton for metric intelligence, document-grounded Q&A, variance analysis, financial close management, governance workflows, and agent evaluation — all in a type-safe TypeScript monorepo.

---

## Architecture Overview

```
FinanceOS (pnpm monorepo)
├── artifacts/
│   ├── api-server/          ← Express 5 REST API (Node + TypeScript)
│   └── finance-os/          ← React + Vite admin workbench UI
├── lib/
│   ├── api-spec/            ← OpenAPI 3.1 contract (source of truth)
│   ├── api-client-react/    ← Generated React Query hooks (from OpenAPI)
│   ├── api-zod/             ← Generated Zod validators (from OpenAPI)
│   └── db/                  ← Drizzle ORM schema (PostgreSQL)
└── packages/
    ├── shared/              ← Domain models, Zod schemas, shared types
    ├── agents/              ← Agent contracts and orchestration interfaces
    ├── semantic/            ← Semantic metric YAML schemas + data contracts
    ├── rag/                 ← Document ingestion, retrieval, reranking interfaces
    ├── evals/               ← Benchmark definitions and scoring harness
    └── governance/          ← RBAC policies, approval rules, audit schemas
```

---

## Key Design Principles

| Principle | Implementation |
|---|---|
| **Contract-first API** | OpenAPI 3.1 spec drives codegen for hooks, validators, and types |
| **No real database (scaffold)** | All repositories use in-memory mock adapters. Set `MOCK_DATA=false` + real `DATABASE_URL` to switch |
| **No real vector DB (scaffold)** | `VectorRetriever` interface decouples retrieval from any specific vendor |
| **Domain logic in packages** | Business rules, RBAC, and approval policies live in `packages/`, not UI components |
| **Compile-independent modules** | Each package has its own `tsconfig.json` and compiles independently |
| **YAML-as-code metric layer** | Metric definitions, data contracts, and governance policies are declarative YAML |

---

## Packages

### `packages/shared`
Shared domain models for the entire platform:
- **Finance**: `Metric`, `VarianceDriver`, `Forecast`, `CloseTask`, `MetricSummary`
- **Documents**: `Document`, `Citation`, `DocumentStats`
- **Workflows**: `Workflow`, `WorkflowStep`
- **Governance**: `ApprovalRequest`, `AuditEvent`, `Policy`, `RbacPolicy`
- **Users**: `User`, role/permission enums

### `packages/agents`
Agent system contracts:
- `Agent`, `AgentSession`, `AgentMessage` — LLM agent data models
- `AgentOrchestrator` interface — multi-agent coordination contract
- `AgentToolExecutor` interface — tool dispatch abstraction
- `OrchestrationPlan` — DAG-style planning schema

### `packages/semantic`
Semantic layer (YAML-as-code):
- `SemanticMetricYaml` — metric definitions with formula, datasource, SLA, thresholds
- `DataContract` — field-level schema, SLA, lineage, classification
- `SemanticMetricRegistry` interface — pluggable metric registry

Sample metric definitions: `metrics/revenue.yaml`, `metrics/margins.yaml`  
Sample data contracts: `contracts/income-statement.yaml`

### `packages/rag`
Document intelligence interfaces:
- `DocumentIngester` — ingestion pipeline contract (extract → chunk → embed → index)
- `VectorRetriever` — query interface for any vector DB
- `Reranker` — reranking abstraction (Cohere, VoyageAI, etc.)
- `EmbeddingProvider` — embedding model abstraction
- Zod schemas: `Chunk`, `RetrievalQuery`, `RetrievalResult`, `IngestionJob`

### `packages/evals`
Evaluation harness:
- `BenchmarkCase`, `BenchmarkSuite` — structured eval definitions
- `EvalRun` — run tracking with per-case scores
- `ScoringHarness` interface — pluggable scorer (LLM-as-judge, ROUGE, BLEU)
- Sample suite: `fixtures/benchmark-suite.json`

### `packages/governance`
Governance layer:
- `RBAC_POLICIES` — role → permission mapping for all 6 roles
- `hasPermission()` / `getPermissionsForRole()` — runtime RBAC helpers
- `DEFAULT_APPROVAL_POLICIES` — threshold-based approval rules
- `AuditLogger` interface — structured event logging contract

---

## RBAC Roles

| Role | Description |
|---|---|
| `viewer` | Read-only access to all surfaces |
| `analyst` | Read + write metrics, documents, close tasks |
| `controller` | Analyst + approve metrics, documents, close |
| `cfo` | Controller + governance write |
| `auditor` | Viewer + full audit trail access |
| `admin` | Full platform access + user/policy management |

---

## API Endpoints

See `lib/api-spec/openapi.yaml` for the full contract. Major endpoint groups:

| Group | Base Path | Description |
|---|---|---|
| Health | `GET /api/healthz` | Service health check |
| Metrics | `GET/POST /api/metrics` | Finance metric CRUD + summary |
| Ask | `POST /api/ask` | Natural language Q&A with citations |
| Variance | `GET /api/variance` | Variance drivers by metric/period |
| Close | `GET/POST /api/close/tasks` | Close checklist management |
| Documents | `GET/POST /api/documents` | Document library management |
| Governance | `GET/POST /api/governance/approvals` | Approval workflows |
| Audit | `GET /api/governance/audit` | Immutable audit log |
| Evals | `GET/POST /api/evals` | Benchmark runs and results |
| Agents | `GET /api/agents` | Agent registry and status |

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Run codegen (regenerate hooks from OpenAPI spec)
pnpm --filter @workspace/api-spec run codegen

# Start the API server
pnpm --filter @workspace/api-server run dev

# Start the web UI
pnpm --filter @workspace/finance-os run dev

# Typecheck all packages
pnpm run typecheck
```

---

## Environment Configuration

See `.env.example` for all required and optional environment variables, grouped by:
- Server config
- Data warehouse (Snowflake / BigQuery)
- LLM provider (OpenAI / Anthropic / Azure OpenAI)
- Embedding model
- Vector database (Pinecone / Weaviate / Qdrant / pgvector)
- Reranker (Cohere / VoyageAI)
- Authentication (Clerk / Azure AD / Okta)
- Document storage (S3 / GCS / Azure Blob)
- Observability (Langfuse / Helicone)

---

## Mock Mode

When `MOCK_DATA=true` (default for scaffold), all repository calls return in-memory fixture data. This enables full UI development and integration testing without any external service dependencies. Switch to production adapters by:
1. Setting `MOCK_DATA=false`
2. Providing the relevant environment variables
3. Implementing the repository interfaces in `artifacts/api-server/src/repositories/`

---

## Extending the Platform

1. **Add a metric** → Create a YAML file in `packages/semantic/metrics/` following the `SemanticMetricYaml` schema
2. **Add an endpoint** → Update `lib/api-spec/openapi.yaml`, run codegen, implement handler in `artifacts/api-server/src/routes/`
3. **Add an agent tool** → Implement `AgentToolExecutor` in `packages/agents/`
4. **Add a governance policy** → Add to `packages/governance/src/approval-policies.ts`
5. **Add an eval case** → Add to `packages/evals/fixtures/` following `BenchmarkCase` schema
