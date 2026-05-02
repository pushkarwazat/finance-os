/**
 * Legacy stub — superseded by the full RAG schema layer.
 * Kept for backwards compatibility; new code should import directly
 * from the specific sub-modules (documents/, chunks/, retrieval/, etc.).
 */
export * from "./documents/schema.js";
export * from "./chunks/schema.js";
export * from "./citations/schema.js";
export * from "./ingestion/pipeline.js";
export * from "./retrieval/contracts.js";
