import { z } from "zod";

export const WorkflowStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "complete",
  "cancelled",
  "error",
]);
export type WorkflowStatus = z.infer<typeof WorkflowStatusSchema>;

export const WorkflowStepStatusSchema = z.enum([
  "waiting",
  "running",
  "success",
  "failed",
  "skipped",
]);
export type WorkflowStepStatus = z.infer<typeof WorkflowStepStatusSchema>;

export const WorkflowStepSchema = z.object({
  id: z.string().uuid(),
  workflowId: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: WorkflowStepStatusSchema,
  order: z.number().int(),
  assigneeId: z.string().uuid().optional(),
  assigneeName: z.string().optional(),
  agentId: z.string().uuid().optional(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  errorMessage: z.string().optional(),
  outputs: z.record(z.string(), z.unknown()).default({}),
});
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;

export const WorkflowSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: WorkflowStatusSchema,
  templateId: z.string().uuid().optional(),
  ownerId: z.string().uuid(),
  ownerName: z.string(),
  steps: z.array(WorkflowStepSchema),
  currentStepIndex: z.number().int(),
  metadata: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type Workflow = z.infer<typeof WorkflowSchema>;
