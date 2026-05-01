# FinanceOS Analytics Pipeline — Developer Reference

> **Version:** 1.0.0  
> **Schema:** `semantics.financeos.io/v1`  
> **No live LLM integration. No raw SQL generation. Everything is deterministic.**

---

## Overview

The analytics pipeline transforms a free-text finance question into a fully structured, traceable response. Every step is inspectable, every assumption is surfaced, and abstention is explicit.

```
User prompt
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                      AnalyticsPipeline v1                       │
│                                                                  │
│  receive → normalise → classify_intent → extract_entities       │
│      → resolve_metrics → build_query_plan → check_abstention    │
│      → check_guardrails → fetch_mock_data → format_answer       │
│      → build_response                                            │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
AnalyticsResponse (intent · confidence · queryPlan · mockData ·
                   sourceMetrics · assumptions · caveats · trace)
```

---

## Intent Types

The classifier maps every question to exactly one of eight intents. Patterns are evaluated in priority order (highest first).

| Intent | Priority | Description | Example |
|---|---|---|---|
| `unsupported_request` | 100 | SQL requests, market data, PII | *"Write a SQL query to get revenue"* |
| `clarification_required` | 90 | Question too ambiguous to resolve | *"Show me the numbers"* |
| `cohort_question` | 80 | Analysis scoped to an acquisition cohort | *"Churn for Q1 FY2025 cohort"* |
| `variance_analysis` | 70 | Deviation from budget / prior period | *"Why did we miss the Q3 revenue budget?"* |
| `ranking` | 60 | Top-N or bottom-N by a metric | *"Top 10 customers by ARR"* |
| `trend_analysis` | 50 | Metric over a time series | *"How has ARR trended over 6 months?"* |
| `comparison` | 40 | Compare two entities or periods | *"EMEA vs APAC revenue for Q3"* |
| `metric_lookup` | 10 | Point-in-time metric retrieval | *"What is our current ARR?"* |

---

## Pipeline Steps

### 1. `receive`
Accept the raw question string. Log length and source session ID.

### 2. `normalise`
Lowercase and collapse whitespace. Output is the `normalisedQuestion` used by all subsequent steps. No stemming, no stop-word removal — deterministic.

### 3. `classify_intent`
Evaluate `INTENT_PATTERNS` in descending priority order. The first matching pattern wins. Returns:
- `intent: IntentType`
- `confidence: number` (0 – 1). For regex matches: 0.75–0.95. For fallback: 0.60.

### 4. `extract_entities`
Detect three categories of entity in the normalised question:

| Entity Type | Method | Source |
|---|---|---|
| Metric mentions | Substring match against `METRIC_SYNONYMS` dictionary | 45 synonym entries |
| Dimensions | Substring match against `KNOWN_DIMENSIONS` set | 10 dimension slugs |
| Filters | Regex for region codes (EMEA/APAC/AMER), tier names, TOP-N limits | — |
| Time expressions | Regex for quarter (Q3 FY2025), month (September 2025), rolling windows | — |

### 5. `resolve_metrics`
Map detected raw metric mentions → canonical semantic metric slugs using `METRIC_SYNONYMS`. If no metric is found, infer `total_revenue` as the default and record an `inferred_metric` assumption.

Each resolved metric carries:
- `matchType: "exact_match" | "synonym" | "inferred"`
- `resolutionConfidence: number` (exact = 0.98, synonym = 0.88, inferred = 0.55)

### 6. `build_query_plan`
Assemble an `AbstractQueryPlan`:

```typescript
{
  metrics: MetricRef[];     // resolved semantic metrics
  groupBy: string[];        // dimension slugs
  filters: QueryFilter[];   // field / operator / value triples
  timeRange?: TimeRange;    // start · end · granularity · label · inferred
  comparisonPeriod?: TimeRange;
  limit?: number;           // for ranking intents
  sortDirection?: "asc" | "desc";
  seriesGranularity?: TimeGranularity;
  cohortDefinition?: TimeRange;
}
```

If no time range was detected, default to Q3 FY2025 (most recently closed quarter) and record an `inferred_time_range` assumption.

**No SQL is generated at this step.** The query plan is purely abstract — it describes *what* to compute, not *how*.

### 7. `check_abstention`
Evaluate `ABSTENTION_POLICY` rules in sequence. If a **hard** rule fires, the pipeline short-circuits and returns an `AnalyticsResponse` with `abstained: true`.

Abstention reasons:

| Reason | Rule ID | Trigger |
|---|---|---|
| `unsupported_operation` | UNSUPPORTED_SQL_001 / UNSUPPORTED_MARKET_001 | Intent = unsupported_request |
| `pii_detected` | PII_001 | PII regex match in normalised question |
| `low_confidence` | LOW_CONF_001 | `confidence < 0.35` |
| `time_range_out_of_scope` | TIME_SCOPE_001 | `timeRange.start < "2022-01-01"` |
| `no_semantic_coverage` | NO_COVERAGE_001 | No metric resolved (future) |
| `guardrail_triggered` | GUARDRAIL_PRELIM_001 | Soft rule — adds caveat only |

### 8. `check_guardrails`
After abstention check, evaluate semantic guardrails. Currently implemented:

- **Preliminary data caveat**: if the requested period starts on or after `2025-09-01`, append a `warning` caveat indicating figures are unreviewed.

Guardrail evaluations that pass produce `status: "ok"`. A fired guardrail adds a `Caveat` but does not block the answer (unlike hard abstention).

### 9. `fetch_mock_data`
Generate deterministic mock `MockDataPoint[]` based on intent type and resolved metric:

| Intent | Output shape |
|---|---|
| `metric_lookup` | Single data point |
| `trend_analysis` | 6-month time series |
| `variance_analysis` | Actual / Budget / Variance triple |
| `ranking` | Top-5 entities with values |
| `comparison` | Current / Prior / Change triple |
| `cohort_question` | 3-cohort comparison |

Values are derived from a static `MOCK_METRIC_VALUES` dictionary. No database queries are made.

### 10. `format_answer`
Generate a prose `answerText` using intent-specific templates. The template inlines the formatted mock data values and appends any assumption notices.

**Example (variance_analysis):**
```
Total Revenue for Q3 FY2025 came in at $94.2M, compared to the budget of $98.4M.
The variance is -$4.2M (unfavorable). Key drivers include timing differences
in enterprise renewals and infrastructure cost overruns.
Note: No time period specified — defaulting to Q3 FY2025.
```

### 11. `build_response`
Assemble the full `AnalyticsResponse`:

```typescript
{
  traceId: UUID;        // correlates all server logs for this request
  sessionId: UUID;
  messageId: UUID;
  createdAt: ISO8601;
  rawQuestion: string;
  intent: IntentType;
  confidence: number;
  confidenceTier: "high" | "medium" | "low";
  answerText: string;
  queryPlan: AbstractQueryPlan;
  mockData: MockDataPoint[];
  sourceMetrics: MetricRef[];   // semantic provenance
  assumptions: Assumption[];     // what was inferred (overridable)
  caveats: Caveat[];             // what the user should know
  clarificationRequired?: ClarificationRequest;
  abstained: boolean;
  abstentionReason?: AbstentionReason;
  abstentionMessage?: string;
  pipelineTrace: PipelineStep[]; // full step-by-step log
  latencyMs: number;
  semanticSchemaVersion: "semantics.financeos.io/v1";
  contractSchemaVersion: "1.0";
}
```

---

## API Endpoints

### `GET /api/analytics/intents`
Returns the full intent catalogue (8 entries).

### `GET /api/analytics/examples`
Returns the 100-example canonical test library.  
Query params: `intent`, `tag`, `abstentionOnly`, `clarificationOnly`, `limit`, `offset`.

### `GET /api/analytics/examples/:id`
Returns a single example by stable ID (e.g. `ml-001`).

### `POST /api/analytics/parse`
Parse-only: classify intent + build query plan. Does not run data retrieval.  
Body: `{ question: string, sessionId?: UUID }`

### `POST /api/analytics/answer`
Full pipeline. Returns the complete `AnalyticsResponse`.  
Body: `{ question: string, sessionId?: UUID }`

### `GET /api/analytics/pipeline`
Pipeline health check + capability metadata.

---

## Confidence Tiers

| Tier | Range | Meaning |
|---|---|---|
| `high` | ≥ 0.80 | Classifier matched a strong pattern; answer is reliable |
| `medium` | 0.55 – 0.79 | Moderate signal; assumptions likely; review caveats |
| `low` | 0.35 – 0.54 | Weak match; clarification recommended |
| *(abstain)* | < 0.35 | Policy threshold — system will not answer |

---

## Assumptions vs. Caveats

| Type | Purpose | User action |
|---|---|---|
| `Assumption` | The pipeline inferred a parameter that was not explicit | User can override (e.g. change time period) |
| `Caveat` | A condition that affects how results should be interpreted | User should acknowledge before acting |

Assumption categories: `time_range`, `metric`, `filter`, `scope`, `granularity`.  
Caveat severities: `info`, `warning`, `critical`.

---

## Adding Coverage

To add a new metric to the semantic layer:

1. Add a YAML definition in `packages/semantic/domains/<domain>/metrics.yaml`.
2. Add the slug + synonyms to `METRIC_SYNONYMS` in `pipeline.ts`.
3. Add a mock value to `MOCK_METRIC_VALUES` in `pipeline.ts`.
4. Add a glossary entry to `packages/semantic/glossary.yaml`.
5. Add ≥ 2 example prompts to `ANALYTICS_EXAMPLES` in `examples.ts`.
6. Run `pnpm --filter @financeos/semantic test` — all existing tests must pass.

---

## Extension Points (Not Yet Implemented)

| Extension | Where to hook in |
|---|---|
| Live LLM intent classification | Replace `classifyIntent()` in `pipeline.ts` |
| Real data retrieval | Replace `generateMockData()` in `pipeline.ts` |
| SQL / semantic query execution | Add `execute_query_plan` step after `build_query_plan` |
| Vector-search metric resolution | Extend `resolve_metrics` in `pipeline.ts` |
| User clarification round-trip | Wire `ClarificationResponse` into a second pipeline pass |
| Persistent session store | Replace in-memory session in `analytics.ts` with DB |

---

*Last updated: 2025-10-01 · Owner: Data Engineering / CFO Office*
