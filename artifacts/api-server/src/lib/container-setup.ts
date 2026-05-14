/**
 * Container setup — wires real adapter implementations into the DI container.
 *
 * Called once at server startup (before the HTTP server binds).
 * Stubs remain in any slot whose env vars are not configured.
 */

import { container } from "@financeos/container";
import { BedrockLlmAdapter, PgVectorStoreAdapter, SqlServerWarehouseAdapter } from "@financeos/adapters";
import { logger } from "./logger.js";

export async function setupContainer(): Promise<void> {
  // ── LLM Provider (Bedrock) ────────────────────────────────────────────────
  if (process.env["LLM_PROVIDER"] === "bedrock" && process.env["AWS_REGION"]) {
    container.register("llmProvider", new BedrockLlmAdapter());
    logger.info({}, "Container: registered BedrockLlmAdapter as llmProvider");
  }

  // ── Vector Store (pgvector) ───────────────────────────────────────────────
  if (process.env["DATABASE_URL"]) {
    const pgAdapter = new PgVectorStoreAdapter();
    container.register("vectorStore", pgAdapter);
    logger.info({}, "Container: registered PgVectorStoreAdapter as vectorStore");
  }

  // ── SQL Warehouse (SQL Server) ────────────────────────────────────────────
  if (process.env["MSSQL_SERVER"] && process.env["MSSQL_DATABASE"]) {
    container.register("sqlWarehouse", new SqlServerWarehouseAdapter());
    logger.info({}, "Container: registered SqlServerWarehouseAdapter as sqlWarehouse");
  }

  // Log all wired adapters at startup
  const adapters = container.listAdapters();
  logger.info({ adapters }, "Container: adapter registry");
}
