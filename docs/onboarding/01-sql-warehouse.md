# Onboarding: SQL Warehouse Adapter

**Interface:** `SqlWarehouseAdapter` (`packages/adapters/src/sql-warehouse.ts`)  
**DI key:** `sqlWarehouse`  
**Current stub:** `StubSqlWarehouseAdapter` — returns mock data, `/healthz` reports `connected: false`

---

## What this adapter does

The SQL warehouse adapter executes pre-validated SQL strings produced by
the semantic layer compiler. It is the only component that ever touches
raw warehouse credentials. Route handlers and domain packages never see
connection strings or query results — they work through the semantic engine
adapter, which in turn calls this adapter.

---

## Supported warehouse targets

| Warehouse | Recommended driver |
|---|---|
| Snowflake | `snowflake-sdk` |
| BigQuery | `@google-cloud/bigquery` |
| Databricks | `databricks-sql-connector` |
| Redshift | `pg` (Redshift is Postgres-compatible) |
| DuckDB | `duckdb` |
| PostgreSQL | `pg` + `drizzle-orm` |

---

## Implementation steps

### 1. Install the driver

```bash
pnpm --filter @workspace/api-server add snowflake-sdk
# or
pnpm --filter @workspace/api-server add @google-cloud/bigquery
```

### 2. Create your adapter class

Create `artifacts/api-server/src/adapters/snowflake-warehouse.ts`:

```typescript
import { SqlWarehouseAdapter, WarehouseQueryResult, WarehouseHealthStatus } from "@financeos/adapters";
import snowflake from "snowflake-sdk";

export class SnowflakeWarehouseAdapter implements SqlWarehouseAdapter {
  readonly name = "snowflake";
  private connection: snowflake.Connection;

  constructor(opts: {
    account: string;
    username: string;
    password: string;    // use env var — never hardcode
    warehouse: string;
    database: string;
    schema: string;
    role: string;
  }) {
    this.connection = snowflake.createConnection(opts);
  }

  async executeQuery(sql: string, opts = {}): Promise<WarehouseQueryResult> {
    // TODO: wrap in connection pool, handle timeouts, add cost labels
    return new Promise((resolve, reject) => {
      this.connection.execute({
        sqlText: sql,
        complete: (err, stmt, rows) => {
          if (err) return reject(err);
          resolve({
            columns: stmt.getColumns().map(c => ({ name: c.getName(), type: "string", nullable: true })),
            rows: (rows ?? []).map(r => Object.values(r as object)),
            rowCount: rows?.length ?? 0,
            executionMs: 0,
            cached: false,
            queryId: stmt.getStatementId(),
          });
        },
      });
    });
  }

  async healthCheck(): Promise<WarehouseHealthStatus> {
    const t = Date.now();
    try {
      await this.executeQuery("SELECT 1");
      return { connected: true, latencyMs: Date.now() - t };
    } catch (err) {
      return { connected: false, error: String(err) };
    }
  }

  async describeSchema(database: string, schema: string) {
    // TODO: query INFORMATION_SCHEMA
    return { database, schema, tables: [] };
  }
}
```

### 3. Register in the DI container

In `artifacts/api-server/src/index.ts`, before `app.listen`:

```typescript
import { container } from "@financeos/container";
import { SnowflakeWarehouseAdapter } from "./adapters/snowflake-warehouse.js";

container.register("sqlWarehouse", new SnowflakeWarehouseAdapter({
  account: process.env.SNOWFLAKE_ACCOUNT!,
  username: process.env.SNOWFLAKE_USER!,
  password: process.env.SNOWFLAKE_PASSWORD!,
  warehouse: process.env.SNOWFLAKE_WAREHOUSE ?? "COMPUTE_WH",
  database: process.env.SNOWFLAKE_DATABASE!,
  schema: process.env.SNOWFLAKE_SCHEMA ?? "PUBLIC",
  role: process.env.SNOWFLAKE_ROLE ?? "SYSADMIN",
}));
```

### 4. Add environment variables

```bash
# .env (never commit)
SNOWFLAKE_ACCOUNT=xy12345.us-east-1
SNOWFLAKE_USER=financeos_svc
SNOWFLAKE_PASSWORD=<secret>
SNOWFLAKE_WAREHOUSE=FINANCEOS_WH
SNOWFLAKE_DATABASE=PROD_FINANCE
SNOWFLAKE_SCHEMA=REPORTING
SNOWFLAKE_ROLE=FINANCEOS_ROLE
```

### 5. Verify

```bash
curl localhost:80/api/healthz | jq .dependencies.sqlWarehouse
# Expected: { "ok": true, "name": "snowflake", "stub": false }
```

---

## Production checklist

- [ ] Use a dedicated service account with read-only warehouse role
- [ ] Enable Multi-Factor Authentication on the service account
- [ ] Set `timeoutMs` to ≤ 30 seconds per query
- [ ] Add cost labels (`labels: { requestId, tenantId }`) for billing attribution
- [ ] Enable query result caching in the warehouse
- [ ] Rotate credentials via your secrets manager (Vault, AWS Secrets Manager, etc.)
- [ ] Monitor `bytesScanned` to catch accidental full-table scans
