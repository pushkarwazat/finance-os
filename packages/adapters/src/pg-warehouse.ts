/**
 * PostgreSQL Warehouse Adapter
 *
 * Implements SqlWarehouseAdapter against a PostgreSQL database using the
 * existing DATABASE_URL connection. Intended as a temporary shim while
 * the real SQL Server / OpenMetadata MCP path is being set up.
 *
 * Only SELECT and WITH queries are permitted.
 */

import { Pool } from "pg";
import type {
  SqlWarehouseAdapter,
  WarehouseQueryResult,
  WarehouseQueryOptions,
  WarehouseSchemaInfo,
  WarehouseHealthStatus,
  WarehouseColumn,
} from "./sql-warehouse.js";

function pgTypeToWarehouseType(dataType: string): WarehouseColumn["type"] {
  const t = dataType.toLowerCase();
  if (t === "boolean") return "boolean";
  if (t === "date") return "date";
  if (t.includes("timestamp") || t === "timetz" || t === "timestamptz") return "timestamp";
  if (t === "integer" || t === "bigint" || t === "smallint" || t === "serial" || t === "bigserial") return "integer";
  if (t === "numeric" || t === "decimal" || t === "real" || t === "double precision" || t === "float") return "number";
  if (t === "json" || t === "jsonb") return "json";
  return "string";
}

export class PgWarehouseAdapter implements SqlWarehouseAdapter {
  readonly name = "pg-warehouse";
  private readonly pool: Pool;

  constructor() {
    this.pool = new Pool({
      connectionString: process.env["DATABASE_URL"],
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
      ssl: process.env["DATABASE_URL"] ? { rejectUnauthorized: false } : false,
    });
    this.pool.on("error", (err) => {
      console.error("[pg-warehouse] pool error:", err.message);
    });
  }

  async executeQuery(sqlStr: string, opts?: WarehouseQueryOptions): Promise<WarehouseQueryResult> {
    const trimmed = sqlStr.trimStart().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      throw new Error("Only SELECT/WITH queries are permitted");
    }

    const startMs = Date.now();
    const maxRows = opts?.maxRows ?? 500;

    const wrappedSql = `SELECT * FROM (${sqlStr}) AS _q LIMIT ${maxRows}`;
    const result = await this.pool.query(wrappedSql);
    const executionMs = Date.now() - startMs;

    const fields = result.fields ?? [];
    const columns: WarehouseColumn[] = fields.map((f) => ({
      name: f.name,
      type: "string" as const,
      nullable: true,
    }));

    const colNames = columns.map((c) => c.name);
    const rows = (result.rows as Record<string, unknown>[]).map((row) =>
      colNames.map((c) => row[c]),
    );

    return { columns, rows, rowCount: rows.length, executionMs, cached: false };
  }

  async healthCheck(): Promise<WarehouseHealthStatus> {
    try {
      const startMs = Date.now();
      await this.pool.query("SELECT 1");
      return { connected: true, latencyMs: Date.now() - startMs };
    } catch (err) {
      return { connected: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async describeSchema(database: string, schema: string, tables?: string[]): Promise<WarehouseSchemaInfo> {
    const params: unknown[] = [schema];
    let tableFilter = "";
    if (tables && tables.length > 0) {
      tables.forEach((t, i) => params.push(t));
      tableFilter = `AND c.table_name = ANY($${params.length + 1}::text[])`;
      params.push(tables);
    }

    const result = await this.pool.query<{
      table_name: string;
      column_name: string;
      data_type: string;
      is_nullable: string;
    }>(
      `SELECT c.table_name, c.column_name, c.data_type, c.is_nullable
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_name = c.table_name AND t.table_schema = c.table_schema
       WHERE c.table_schema = $1
         AND t.table_type = 'BASE TABLE'
         ${tableFilter}
       ORDER BY c.table_name, c.ordinal_position`,
      params,
    );

    const tableMap = new Map<string, WarehouseColumn[]>();
    for (const row of result.rows) {
      const cols = tableMap.get(row.table_name) ?? [];
      cols.push({
        name: row.column_name,
        type: pgTypeToWarehouseType(row.data_type),
        nullable: row.is_nullable === "YES",
      });
      tableMap.set(row.table_name, cols);
    }

    return {
      database,
      schema,
      tables: Array.from(tableMap.entries()).map(([name, columns]) => ({ name, columns })),
    };
  }
}
