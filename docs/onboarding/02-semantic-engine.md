# Onboarding: Semantic Engine Adapter

**Interface:** `SemanticEngineAdapter` (`packages/adapters/src/semantic-engine.ts`)  
**DI key:** `semanticEngine`  
**Current stub:** `StubSemanticEngineAdapter` — returns empty results

---

## What this adapter does

The semantic engine adapter translates structured query contracts (produced
by the NL→query pipeline in `@financeos/semantic`) into executable metric
queries and returns typed financial values. It abstracts the semantic /
metric layer so that route handlers never write SQL or know which metric
definitions are stored where.

---

## Supported semantic layers

| Product | Notes |
|---|---|
| dbt Semantic Layer | Best choice for dbt shops — MetricFlow integration |
| Cube.dev | REST API, rich caching, pre-aggregations |
| LookML / Looker | Via Looker's SDK |
| AtScale | SAP / Microsoft BI gateway |
| Custom MetricFlow | Self-hosted MetricFlow with any warehouse |
| Direct warehouse | Implement query generation inline with the SQL adapter |

---

## Implementation steps (dbt Semantic Layer)

### 1. Install the dbt Semantic Layer client

```bash
pnpm --filter @workspace/api-server add @dbt-labs/semantic-layer-sdk
```

### 2. Create your adapter

```typescript
import { SemanticEngineAdapter, SemanticQueryRequest, SemanticQueryResult } from "@financeos/adapters";

export class DbtSemanticLayerAdapter implements SemanticEngineAdapter {
  readonly name = "dbt-semantic-layer";

  constructor(private readonly opts: {
    environmentId: string;
    serviceToken: string;
    host: string;
  }) {}

  async query(request: SemanticQueryRequest): Promise<SemanticQueryResult> {
    const t = Date.now();
    // TODO: call dbt Semantic Layer JDBC/GraphQL API
    // Map request.metrics, request.dimensions, request.timeRange → dbt query
    // Parse response into SemanticMetricValue[]
    return { metrics: [], totalRows: 0, executionMs: Date.now() - t, cached: false };
  }

  async listMetrics() {
    // TODO: call dbt Semantic Layer /metrics endpoint
    return [];
  }

  async getMetric(slug: string) {
    const all = await this.listMetrics();
    return all.find(m => m.slug === slug) ?? null;
  }

  async healthCheck() {
    const t = Date.now();
    try {
      await this.listMetrics();
      return { connected: true, latencyMs: Date.now() - t };
    } catch (err) {
      return { connected: false, error: String(err) };
    }
  }
}
```

### 3. Register in the DI container

```typescript
container.register("semanticEngine", new DbtSemanticLayerAdapter({
  environmentId: process.env.DBT_ENVIRONMENT_ID!,
  serviceToken: process.env.DBT_SERVICE_TOKEN!,
  host: process.env.DBT_SEMANTIC_LAYER_HOST ?? "semantic-layer.cloud.getdbt.com",
}));
```

### 4. Sync metric definitions

The semantic engine adapter's `listMetrics()` output feeds the NL synonym
map used by `@financeos/semantic` for intent classification. Run this
sync on startup and on a schedule:

```typescript
const metrics = await container.get("semanticEngine").listMetrics();
// TODO: write to MetricRegistry so NL queries resolve correctly
```

---

## Production checklist

- [ ] Cache `listMetrics()` result — call on startup + refresh every 15 min
- [ ] Add request-level caching keyed on (metricSlugs, timeRange, filters)
- [ ] Set per-query timeouts consistent with your UI SLA (e.g. 10s)
- [ ] Log `debugSql` to a secure audit bucket — never expose to users
- [ ] Monitor p95 query latency via `/api/healthz` latencyMs
