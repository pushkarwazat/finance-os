import { z } from "zod";
import { AgentCapabilitySchema } from "./contracts.js";

export const ToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  requiredCapability: AgentCapabilitySchema,
});
export type Tool = z.infer<typeof ToolSchema>;

export const OrchestrationPlanSchema = z.object({
  id: z.string().uuid(),
  goal: z.string(),
  steps: z.array(
    z.object({
      id: z.string().uuid(),
      agentId: z.string().uuid(),
      toolName: z.string(),
      input: z.record(z.string(), z.unknown()),
      dependsOn: z.array(z.string().uuid()).default([]),
      status: z.enum(["pending", "running", "done", "failed"]),
      output: z.record(z.string(), z.unknown()).optional(),
      startedAt: z.string().datetime().nullable(),
      completedAt: z.string().datetime().nullable(),
    })
  ),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OrchestrationPlan = z.infer<typeof OrchestrationPlanSchema>;

export interface AgentOrchestrator {
  dispatch(goal: string, context: Record<string, unknown>): Promise<OrchestrationPlan>;
  getStatus(planId: string): Promise<OrchestrationPlan>;
  cancel(planId: string): Promise<void>;
}

export interface AgentToolExecutor {
  execute(toolName: string, input: Record<string, unknown>): Promise<Record<string, unknown>>;
  listTools(): Promise<Tool[]>;
}
