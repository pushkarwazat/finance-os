import { z } from "zod";

export const AgentCapabilitySchema = z.enum([
  "metric_analysis",
  "variance_explanation",
  "document_qa",
  "forecast_commentary",
  "anomaly_detection",
  "close_assistance",
  "governance_review",
  "benchmark_evaluation",
]);
export type AgentCapability = z.infer<typeof AgentCapabilitySchema>;

export const AgentStatusSchema = z.enum([
  "idle",
  "processing",
  "paused",
  "error",
  "offline",
]);
export type AgentStatus = z.infer<typeof AgentStatusSchema>;

export const AgentSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  capabilities: z.array(AgentCapabilitySchema),
  status: AgentStatusSchema,
  version: z.string(),
  modelId: z.string(),
  embeddingModelId: z.string().optional(),
  contextWindowTokens: z.number().int(),
  lastHeartbeatAt: z.string().datetime().nullable(),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type Agent = z.infer<typeof AgentSchema>;

export const AgentMessageRoleSchema = z.enum(["user", "assistant", "system", "tool"]);
export type AgentMessageRole = z.infer<typeof AgentMessageRoleSchema>;

export const AgentMessageSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  role: AgentMessageRoleSchema,
  content: z.string(),
  citationIds: z.array(z.string().uuid()).default([]),
  toolCalls: z
    .array(
      z.object({
        toolName: z.string(),
        input: z.record(z.string(), z.unknown()),
        output: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .default([]),
  tokens: z.number().int().optional(),
  latencyMs: z.number().int().optional(),
  createdAt: z.string().datetime(),
});
export type AgentMessage = z.infer<typeof AgentMessageSchema>;

export const AgentSessionSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  userId: z.string().uuid(),
  title: z.string().optional(),
  messages: z.array(AgentMessageSchema),
  context: z.record(z.string(), z.unknown()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type AgentSession = z.infer<typeof AgentSessionSchema>;
