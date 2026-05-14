/**
 * @financeos/adapters
 *
 * Adapter interfaces and stub implementations for all external infrastructure.
 * Each interface has exactly one stub that is safe to run in development
 * (returns empty/mock data) but will warn in /healthz when not replaced.
 *
 * See docs/onboarding/ for wiring in each real adapter.
 */

export * from "./sql-warehouse.js";
export * from "./mssql-warehouse.js";
export * from "./semantic-engine.js";
export * from "./vector-store.js";
export * from "./pgvector-store.js";
export * from "./reranker.js";
export * from "./llm-provider.js";
export * from "./bedrock-llm-provider.js";
export * from "./auth-provider.js";
