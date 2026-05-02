import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Tool categories used by finance workflow agents
// ─────────────────────────────────────────────────────────────────────────────

export const ToolCategorySchema = z.enum([
  "semantic_analytics",   // query metric layer / semantic models
  "rag_retrieval",        // retrieve document chunks via RAG
  "data_fetch",           // pull live data from warehouse / GL
  "calculation",          // run deterministic financial calculations
  "draft_generation",     // LLM-powered text generation (commentary, memos)
  "validation",           // check against policy rules or thresholds
  "notification",         // send alerts / messages (read-only side effect)
  "audit_write",          // write immutable audit trail events
]);
export type ToolCategory = z.infer<typeof ToolCategorySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tool definition (static registry entry)
// ─────────────────────────────────────────────────────────────────────────────

export const ToolDefinitionSchema = z.object({
  name: z.string(),
  displayName: z.string(),
  description: z.string(),
  category: ToolCategorySchema,
  /** Whether this tool can produce irreversible side effects. */
  hasSideEffects: z.boolean().default(false),
  /** Whether a human must approve before this tool's output is acted upon. */
  requiresApproval: z.boolean().default(false),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  /** Typical latency in milliseconds. */
  typicalLatencyMs: z.number().int().optional(),
});
export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Tool call execution record
// ─────────────────────────────────────────────────────────────────────────────

export const ToolCallStatusSchema = z.enum([
  "pending",
  "running",
  "succeeded",
  "failed",
  "timeout",
  "skipped",
]);
export type ToolCallStatus = z.infer<typeof ToolCallStatusSchema>;

export const ToolCallSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  toolName: z.string(),
  category: ToolCategorySchema,
  /** Exact input passed to the tool. Persisted for audit. */
  input: z.record(z.string(), z.unknown()),
  /** Raw output from the tool. */
  output: z.record(z.string(), z.unknown()).nullable(),
  status: ToolCallStatusSchema,
  /** Whether this call was read from cache rather than re-executed. */
  cached: z.boolean().default(false),
  /** Error message if status === "failed". */
  error: z.string().optional(),
  latencyMs: z.number().int().optional(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  /** IDs of evidence items surfaced by this call. */
  evidenceIds: z.array(z.string()).default([]),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;
