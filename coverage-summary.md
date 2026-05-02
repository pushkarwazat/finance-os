# FinanceOS — Test Coverage Summary

> Last updated: May 2026  
> Coverage tool: Vitest (unit) + Playwright (e2e)  
> Status: Offline eval harness complete. Unit + e2e coverage expansion is a Day 31–60 task.

---

## Eval Harness (packages/evals)

The primary quality signal is the **offline benchmark harness** — 300 curated
test cases across 7 suites, scored by the `MockScorer` with deterministic
pass/fail logic.

| Suite | Cases | Target | Current (mock) | Notes |
|---|---|---|---|---|
| Finance Analytics | 100 | 82% | 70–90% | Metrics, trends, period-over-period |
| Variance Analysis | 50 | 78% | 70–90% | Revenue, cost, margin variance |
| Document Extraction | 50 | 76% | 70–90% | Contract Q&A, memo retrieval |
| Workflow Task | 25 | 80% | 70–90% | Agentic state machine tests |
| Ambiguous Query | 25 | 70% | 70–90% | Clarification / abstention required |
| Unsupported Query | 25 | 85% | 70–90% | Out-of-scope abstention |
| Regression | 25 | 90% | 70–90% | Core queries, zero-regression gate |
| **Total** | **300** | — | — | |

**Avg pass rate (mock scorer):** ~82%  
**Avg hallucination rate (mock scorer):** ~7%

> Current scores come from `MockScorer` (deterministic simulation).
> Wire a real LLM provider to get production-representative scores.

---

## Unit Tests (packages/semantic)

| Test file | Scope | Tests |
|---|---|---|
| `packages/semantic/src/__tests__/planner.test.ts` | Query planner | NL→QueryContract |
| `packages/semantic/src/__tests__/validator.test.ts` | Schema validator | Entity, Metric, Join |

Run: `pnpm --filter @financeos/semantic run test`

---

## API-level coverage (route handlers)

All 15 route groups are covered by manual curl tests documented in the
evals harness. Automated API tests are planned for Day 31–60.

| Route group | Endpoint count | Coverage |
|---|---|---|
| `/api/healthz` | 2 | ✅ Manual |
| `/api/metrics` | 4 | ✅ Manual |
| `/api/variance` | 3 | ✅ Manual |
| `/api/close` | 5 | ✅ Manual |
| `/api/documents` | 4 | ✅ Manual |
| `/api/governance` | 12 | ✅ Manual |
| `/api/agents` | 8 | ✅ Manual |
| `/api/workflows` | 10 | ✅ Manual |
| `/api/ask` | 4 | ✅ Manual |
| `/api/rag` | 5 | ✅ Manual |
| `/api/semantic` | 6 | ✅ Manual |
| `/api/analytics` | 2 | ✅ Manual |
| `/api/evals` | 9 | ✅ Manual |

---

## Coverage targets (Day 31–60 roadmap)

| Layer | Current | Target | Tool |
|---|---|---|---|
| Domain packages (unit) | ~10% | 80% | Vitest |
| API routes (integration) | 0% automated | 70% | Vitest + supertest |
| Frontend components | 0% | 60% | Vitest + React Testing Library |
| Critical user flows (e2e) | 0% | 90% | Playwright |
| Eval harness (real LLM) | Mock scorer | Pass target on all suites | EvalRunner |

---

## Running the eval harness

```bash
# Run all 300 cases (mock scorer — no LLM required)
pnpm --filter @financeos/evals run cli

# Run a single suite
pnpm --filter @financeos/evals run cli --suite finance_analytics

# Fail build on regression (use in CI)
pnpm --filter @financeos/evals run cli --fail-on-regression

# Full typecheck (must pass before merging)
pnpm run typecheck
```

---

## Adding new test cases

Add cases to `packages/evals/src/benchmarks.ts`:

```typescript
export const MY_NEW_CASES: EvalCase[] = [
  {
    id: "my-case-001",
    suiteId: "finance_analytics",
    question: "What was gross margin in Q3 FY2025?",
    intent: "metric_lookup",
    domain: "revenue",
    fiscalPeriod: "Q3 FY2025",
    goldAnswer: {
      expectedMetrics: ["gross_margin"],
      mustContainAny: ["gross margin", "61.8%"],
      mustNotContain: ["I don't know"],
      minConfidence: 0.80,
      maxHallucinationScore: 0.15,
    },
    tags: ["metric", "margin", "regression"],
  },
];
```

Then register the suite in `packages/evals/src/suite-meta.ts`.
