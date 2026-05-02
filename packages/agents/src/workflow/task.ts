import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Task priority & status
// ─────────────────────────────────────────────────────────────────────────────

export const TaskPrioritySchema = z.enum(["critical", "high", "medium", "low"]);
export type TaskPriority = z.infer<typeof TaskPrioritySchema>;

export const TaskStatusSchema = z.enum([
  "pending",
  "queued",
  "running",
  "awaiting_input",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
  "skipped",
]);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Task input / output envelopes
// ─────────────────────────────────────────────────────────────────────────────

export const TaskInputSchema = z.object({
  /** Free-form payload for the task. Shape is agent-specific. */
  payload: z.record(z.string(), z.unknown()),
  /** IDs of evidence items (chunks, metrics, docs) required before execution. */
  requiredEvidenceIds: z.array(z.string()).default([]),
  /** Tenant context. */
  tenantId: z.string(),
  /** Fiscal period context (e.g. "Q3 FY2025"). */
  fiscalPeriod: z.string().optional(),
  /** User who initiated the task. */
  requestedBy: z.string(),
});
export type TaskInput = z.infer<typeof TaskInputSchema>;

export const TaskOutputSchema = z.object({
  /** Summary answer / recommendation text. */
  summary: z.string(),
  /** Structured result data (agent-specific). */
  data: z.record(z.string(), z.unknown()).default({}),
  /** IDs of evidence items used to produce this output. */
  evidenceIds: z.array(z.string()).default([]),
  /** IDs of action recommendations produced. */
  actionIds: z.array(z.string()).default([]),
  /** IDs of approval steps required before actions can be taken. */
  approvalIds: z.array(z.string()).default([]),
  /** IDs of exceptions raised during execution. */
  exceptionIds: z.array(z.string()).default([]),
  /** Agent confidence in this output, 0–1. */
  confidence: z.number().min(0).max(1),
  /** Human-readable confidence rationale. */
  confidenceRationale: z.string().optional(),
});
export type TaskOutput = z.infer<typeof TaskOutputSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Core Task schema
// ─────────────────────────────────────────────────────────────────────────────

export const TaskSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  agentId: z.string(),
  /** Short slug identifying the task type within a workflow. */
  taskType: z.string(),
  displayName: z.string(),
  description: z.string(),
  priority: TaskPrioritySchema,
  status: TaskStatusSchema,
  /** Ordered list of task IDs that must complete before this one starts. */
  dependsOn: z.array(z.string().uuid()).default([]),
  input: TaskInputSchema,
  output: TaskOutputSchema.nullable(),
  /** Tool calls executed during this task. */
  toolCallIds: z.array(z.string().uuid()).default([]),
  /** Wall-clock time budget in seconds. */
  timeoutSeconds: z.number().int().positive().default(30),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  /** Human-readable failure reason if status === "failed". */
  failureReason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Task = z.infer<typeof TaskSchema>;
