/**
 * SQL Warehouse Adapter Interface
 *
 * Abstracts the underlying data warehouse (Snowflake, BigQuery, Databricks,
 * Redshift, DuckDB, etc.) behind a query-contract-compatible interface.
 *
 * TODO: Replace the stub implementation with a real connector.
 * See: docs/onboarding/01-sql-warehouse.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface WarehouseColumn {
  name: string;
  type: "string" | "number" | "integer" | "boolean" | "date" | "timestamp" | "json";
  nullable: boolean;
}

export interface WarehouseQueryResult {
  columns: WarehouseColumn[];
  rows: unknown[][];
  rowCount: number;
  /** Wall-clock time spent executing the query in the warehouse. */
  executionMs: number;
  /** Approximate bytes scanned — used for cost monitoring. */
  bytesScanned?: number;
  /** Whether this result came from the warehouse's own query cache. */
  cached: boolean;
  /** Warehouse-assigned query ID for audit logs. */
  queryId?: string;
}

export interface WarehouseSchemaInfo {
  database: string;
  schema: string;
  tables: Array<{
    name: string;
    columns: WarehouseColumn[];
    rowCount?: number;
    lastModified?: string;
  }>;
}

export interface WarehouseQueryOptions {
  /** Request-scoped timeout in ms. Defaults to adapter default. */
  timeoutMs?: number;
  /** Maximum rows to return (safety limit). */
  maxRows?: number;
  /** Hint to use a specific warehouse/cluster if the adapter supports it. */
  warehouseHint?: string;
  /** Dry-run: validate query syntax without executing. */
  dryRun?: boolean;
  /** Tags forwarded to the warehouse for cost attribution. */
  labels?: Record<string, string>;
  requestId?: string;
  traceId?: string;
  /** Identity of the application user who triggered this query — written to SQL Server session context for audit. */
  actorId?: string;
  actorEmail?: string;
}

export interface WarehouseHealthStatus {
  connected: boolean;
  latencyMs?: number;
  warehouseVersion?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SqlWarehouseAdapter {
  readonly name: string;

  /**
   * Execute a pre-validated SQL string. The string is produced by the semantic
   * layer compiler — callers must NEVER pass raw user input here.
   */
  executeQuery(sql: string, opts?: WarehouseQueryOptions): Promise<WarehouseQueryResult>;

  /**
   * Test connectivity and measure round-trip latency.
   * Called by the /healthz endpoint.
   */
  healthCheck(): Promise<WarehouseHealthStatus>;

  /**
   * Introspect the schema of one or more tables.
   * Used by the semantic compiler to validate entity definitions.
   */
  describeSchema(database: string, schema: string, tables?: string[]): Promise<WarehouseSchemaInfo>;

  /**
   * Cancel a running query by its warehouse query ID.
   */
  cancelQuery?(queryId: string): Promise<void>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub — replace with real connector in production
// TODO: Implement SnowflakeWarehouseAdapter, BigQueryWarehouseAdapter, etc.
// ─────────────────────────────────────────────────────────────────────────────

export class StubSqlWarehouseAdapter implements SqlWarehouseAdapter {
  readonly name = "stub-sql-warehouse";

  async executeQuery(sql: string, opts?: WarehouseQueryOptions): Promise<WarehouseQueryResult> {
    // TODO: Connect to real warehouse. See docs/onboarding/01-sql-warehouse.md
    void sql; void opts;
    return {
      columns: [{ name: "value", type: "number", nullable: false }],
      rows: [[42]],
      rowCount: 1,
      executionMs: 0,
      cached: false,
    };
  }

  async healthCheck(): Promise<WarehouseHealthStatus> {
    // TODO: Implement real health check
    return { connected: false, error: "StubSqlWarehouseAdapter: no real warehouse configured. See docs/onboarding/01-sql-warehouse.md" };
  }

  async describeSchema(): Promise<WarehouseSchemaInfo> {
    // TODO: Implement real schema introspection
    return { database: "stub", schema: "stub", tables: [] };
  }
}
