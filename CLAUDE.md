# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
pnpm install

# Start the API server (builds first, then starts)
pnpm --filter @workspace/api-server run dev

# Start the React/Vite web UI
pnpm --filter @workspace/finance-os run dev

# Typecheck all packages
pnpm run typecheck

# Typecheck a single package
pnpm --filter @workspace/api-server run typecheck

# Build API server for production
pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run start

# Regenerate Zod validators and React Query hooks from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Run the eval benchmark harness (300 cases)
pnpm --filter @financeos/evals run cli
```

The API server runs on port `8080` by default. The Vite UI dev server runs on `5173`.

## Architecture

### Monorepo layout

```
artifacts/          ← runnable applications
  api-server/       ← Express 5 REST API
  finance-os/       ← React 19 + Vite admin workbench
lib/                ← generated / shared contracts
  api-spec/         ← OpenAPI 3.1 spec (source of truth — do not hand-edit generated files)
  api-zod/          ← generated Zod validators (via Orval from openapi.yaml)
  api-client-react/ ← generated React Query hooks (via Orval from openapi.yaml)
  db/               ← Drizzle ORM schema (PostgreSQL)
packages/           ← domain logic, interfaces, no runnable entry points
  adapters/         ← 6 adapter interfaces + stub implementations
  container/        ← DI container singleton
  shared/           ← AppError subclasses, Logger interface, domain models
  semantic/         ← NL→query pipeline, YAML metric schemas
  rag/              ← document ingestion + RAG retrieval interfaces
  agents/           ← agentic workflow engine (6 agent types)
  governance/       ← RBAC policies, audit logger, approval policies
  evals/            ← benchmark harness, 300 test cases
```

### Adapter layer + DI container

Every external dependency (SQL warehouse, LLM, vector DB, reranker, auth, semantic engine) is accessed only through a typed interface in `packages/adapters/src/`. **Route handlers must never import adapter implementations directly** — they call `container.get("adapterKey")` instead.

All 6 adapter slots start as stubs (safe for development, return mock data). Replace them by calling `container.register()` in the server entry point before `app.listen()`. The `GET /api/healthz/ready` endpoint reports which adapters are still stubs.

```typescript
import { container } from "@financeos/container";
const llm = container.get("llmProvider");
```

Adapter slots: `sqlWarehouse`, `semanticEngine`, `vectorStore`, `reranker`, `llmProvider`, `authProvider`. Onboarding guides for each live in `docs/onboarding/`.

### Mock mode

`MOCK_DATA=true` (the default in `.env.example`) makes all repository calls return in-memory fixture data — no external services needed. Set `MOCK_DATA=false` and provide real env vars to switch.

### API contract flow

`lib/api-spec/openapi.yaml` is the single source of truth. Adding an endpoint means:
1. Update `openapi.yaml`
2. Run `pnpm --filter @workspace/api-spec run codegen` to regenerate `api-zod/` and `api-client-react/`
3. Implement the route handler in `artifacts/api-server/src/routes/`

### Error handling

Throw any `AppError` subclass from `packages/shared/src/errors.ts` inside a route handler; the `errorHandlerMiddleware` in `artifacts/api-server/src/middlewares/error-handler.ts` catches it and serializes it to a standard `ErrorResponse`. Subclasses include `NotFoundError`, `ValidationError`, `UnauthorizedError`, `ForbiddenError`, `AdapterUnavailableError`, `AbstentionError`, `PolicyViolationError`, etc.

### Logging

Use `req.log` (a pino child logger) inside route handlers — it has `requestId` and `traceId` automatically bound. Adapters accept a `Logger` via constructor injection. Every log line carries both IDs, which are also forwarded in `X-Request-Id` / `X-Trace-Id` response headers.

### RBAC

`packages/governance/src/` exports `hasPermission(role, action)` and `RBAC_POLICIES`. Six roles: `viewer`, `analyst`, `controller`, `cfo`, `auditor`, `admin`. Call `hasPermission` at the top of each route handler. The auth adapter (`authProvider`) is still a stub by default — wire a real IdP via `docs/onboarding/06-auth-rbac.md`.

### Frontend

React 19, wouter (routing), TanStack Query (data fetching via generated hooks from `@workspace/api-client-react`), Radix UI primitives, Tailwind CSS v4, Recharts. All pages live in `artifacts/finance-os/src/pages/`. The app wraps everything in `AuthProvider` → `QueryClientProvider` → `WouterRouter`.

### Extending the platform

| Task | Where |
|---|---|
| Add a metric definition | `packages/semantic/metrics/*.yaml` |
| Add an API endpoint | `lib/api-spec/openapi.yaml` → codegen → `artifacts/api-server/src/routes/` |
| Wire a real adapter | `packages/adapters/src/<adapter>.ts` + `container.register()` in server entry |
| Add a governance policy | `packages/governance/src/approval-policies.ts` |
| Add an eval case | `packages/evals/fixtures/` (follow `BenchmarkCase` schema) |
