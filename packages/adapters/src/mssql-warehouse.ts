/**
 * SQL Server Warehouse Adapter
 *
 * Implements SqlWarehouseAdapter against SQL Server / Azure SQL using mssql.
 * Connection is pooled and lazy — first call opens it.
 *
 * Auth modes (MSSQL_AUTH_TYPE):
 *   windows (default) — NTLM with domain service account credentials.
 *                       Works from Linux Docker/ECS containers.
 *                       Required: MSSQL_DOMAIN, MSSQL_USER, MSSQL_PASSWORD
 *   sql               — SQL Server authentication (username + password only).
 *                       Required: MSSQL_USER, MSSQL_PASSWORD
 *
 * Required env (all modes): MSSQL_SERVER, MSSQL_DATABASE
 * Optional env: MSSQL_PORT, MSSQL_INSTANCE, MSSQL_ENCRYPT, MSSQL_TRUST_CERT
 */

import sql from "mssql";
import type {
  SqlWarehouseAdapter,
  WarehouseQueryResult,
  WarehouseQueryOptions,
  WarehouseSchemaInfo,
  WarehouseHealthStatus,
  WarehouseColumn,
} from "./sql-warehouse.js";

function sqlTypeToWarehouseType(sqlTypeName: string): WarehouseColumn["type"] {
  const t = sqlTypeName.toLowerCase();
  if (t === "bit") return "boolean";
  if (t === "date") return "date";
  if (t.includes("time") || t === "datetime" || t === "datetime2" || t === "smalldatetime" || t === "datetimeoffset") return "timestamp";
  if (t === "int" || t === "bigint" || t === "smallint" || t === "tinyint") return "integer";
  if (t === "float" || t === "real" || t.includes("decimal") || t.includes("numeric") || t.includes("money")) return "number";
  return "string";
}

export class SqlServerWarehouseAdapter implements SqlWarehouseAdapter {
  readonly name = "mssql-warehouse";
  private pool: sql.ConnectionPool | null = null;

  private buildConfig(): sql.config {
    const authType = process.env.MSSQL_AUTH_TYPE ?? "windows";

    const authentication: sql.config["authentication"] =
      authType === "sql"
        ? {
            type: "default",
            options: {
              userName: process.env.MSSQL_USER ?? "",
              password: process.env.MSSQL_PASSWORD ?? "",
            },
          }
        : {
            // Windows auth via NTLM — works from Linux/Docker containers
            type: "ntlm",
            options: {
              domain: process.env.MSSQL_DOMAIN ?? "",
              userName: process.env.MSSQL_USER ?? "",
              password: process.env.MSSQL_PASSWORD ?? "",
            },
          };

    return {
      server: process.env.MSSQL_SERVER ?? "localhost",
      port: Number(process.env.MSSQL_PORT ?? 1433),
      database: process.env.MSSQL_DATABASE,
      authentication,
      options: {
        encrypt: process.env.MSSQL_ENCRYPT !== "false",
        trustServerCertificate: process.env.MSSQL_TRUST_CERT === "true",
        instanceName: process.env.MSSQL_INSTANCE,
        // Visible in sys.dm_exec_sessions.program_name — helps DBAs identify source
        appName: "FinanceOS/api-server",
      },
      pool: { max: 10, min: 1, idleTimeoutMillis: 30_000 },
      requestTimeout: 30_000,
    };
  }

  private async getPool(): Promise<sql.ConnectionPool> {
    if (!this.pool) {
      this.pool = await new sql.ConnectionPool(this.buildConfig()).connect();
    }
    return this.pool;
  }

  async executeQuery(sqlStr: string, opts?: WarehouseQueryOptions): Promise<WarehouseQueryResult> {
    const trimmed = sqlStr.trimStart().toUpperCase();
    if (!trimmed.startsWith("SELECT") && !trimmed.startsWith("WITH")) {
      throw new Error("Only SELECT/WITH queries are permitted");
    }

    const pool = await this.getPool();
    const startMs = Date.now();

    // Prepend sp_set_session_context so the actor is visible to SQL Server Audit,
    // triggers, and SESSION_CONTEXT() — all in the same batch/connection.
    const request = pool.request();
    const ctxLines: string[] = [];
    if (opts?.actorId) {
      request.input("_actorId", sql.NVarChar(128), opts.actorId);
      ctxLines.push("EXEC sp_set_session_context @key = N'userId', @value = @_actorId;");
    }
    if (opts?.actorEmail) {
      request.input("_actorEmail", sql.NVarChar(256), opts.actorEmail);
      ctxLines.push("EXEC sp_set_session_context @key = N'userEmail', @value = @_actorEmail;");
    }
    if (opts?.requestId) {
      request.input("_requestId", sql.NVarChar(64), opts.requestId);
      ctxLines.push("EXEC sp_set_session_context @key = N'requestId', @value = @_requestId;");
    }

    const batch = ctxLines.length > 0 ? ctxLines.join("\n") + "\n" + sqlStr : sqlStr;
    const result = await request.query(batch);
    const executionMs = Date.now() - startMs;

    // sp_set_session_context produces no result set, so result.recordset is the SELECT data
    const recordset: Record<string, unknown>[] = (result.recordset as unknown as Record<string, unknown>[]) ?? [];
    const maxRows = opts?.maxRows ?? 200;
    const rows = recordset.slice(0, maxRows);

    // Build column metadata from the recordset's column map if available
    const columnMeta = result.recordset.columns as Record<string, { type?: { declaration?: string }; nullable?: boolean }> | undefined;
    let columns: WarehouseColumn[];
    if (columnMeta) {
      columns = Object.entries(columnMeta).map(([name, col]) => ({
        name,
        type: sqlTypeToWarehouseType(col.type?.declaration ?? "varchar"),
        nullable: col.nullable ?? true,
      }));
    } else if (rows.length > 0) {
      columns = Object.keys(rows[0]).map((name) => ({ name, type: "string" as const, nullable: true }));
    } else {
      columns = [];
    }

    const colNames = columns.map((c) => c.name);

    return {
      columns,
      rows: rows.map((row) => colNames.map((c) => row[c])),
      rowCount: rows.length,
      executionMs,
      cached: false,
    };
  }

  async healthCheck(): Promise<WarehouseHealthStatus> {
    try {
      const startMs = Date.now();
      const pool = await this.getPool();
      await pool.request().query("SELECT 1 AS ping");
      return { connected: true, latencyMs: Date.now() - startMs };
    } catch (err) {
      return { connected: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async describeSchema(database: string, schema: string, tables?: string[]): Promise<WarehouseSchemaInfo> {
    const pool = await this.getPool();
    const request = pool.request();
    request.input("db", sql.VarChar, database);
    request.input("schema", sql.VarChar, schema);

    let tableFilter = "";
    if (tables && tables.length > 0) {
      tables.forEach((t, i) => request.input(`t${i}`, sql.VarChar, t));
      tableFilter = `AND t.TABLE_NAME IN (${tables.map((_, i) => `@t${i}`).join(", ")})`;
    }

    const result = await request.query(`
      SELECT
        t.TABLE_NAME,
        c.COLUMN_NAME,
        c.DATA_TYPE,
        c.IS_NULLABLE
      FROM INFORMATION_SCHEMA.TABLES t
      JOIN INFORMATION_SCHEMA.COLUMNS c
        ON  c.TABLE_NAME   = t.TABLE_NAME
        AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
      WHERE t.TABLE_TYPE   = 'BASE TABLE'
        AND t.TABLE_CATALOG = @db
        AND t.TABLE_SCHEMA  = @schema
        ${tableFilter}
      ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION
    `);

    const tableMap = new Map<string, WarehouseColumn[]>();
    for (const row of result.recordset as Array<{ TABLE_NAME: string; COLUMN_NAME: string; DATA_TYPE: string; IS_NULLABLE: string }>) {
      const cols = tableMap.get(row.TABLE_NAME) ?? [];
      cols.push({
        name: row.COLUMN_NAME,
        type: sqlTypeToWarehouseType(row.DATA_TYPE),
        nullable: row.IS_NULLABLE === "YES",
      });
      tableMap.set(row.TABLE_NAME, cols);
    }

    return {
      database,
      schema,
      tables: Array.from(tableMap.entries()).map(([name, columns]) => ({ name, columns })),
    };
  }
}
