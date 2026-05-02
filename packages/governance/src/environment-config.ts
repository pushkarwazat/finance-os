import { z } from "zod";

export const EnvironmentSchema = z.enum(["development", "staging", "production"]);
export type Environment = z.infer<typeof EnvironmentSchema>;

export const AuditLevelSchema = z.enum(["none", "minimal", "standard", "full"]);
export type AuditLevel = z.infer<typeof AuditLevelSchema>;

export const PiiHandlingSchema = z.enum(["allow", "mask", "block"]);

export const FeatureFlagSchema = z.object({
  key: z.string(),
  enabled: z.boolean(),
  description: z.string(),
  rolloutPct: z.number().min(0).max(100).default(100),
});
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

export const EnvironmentConfigSchema = z.object({
  id: z.string().uuid(),
  environment: EnvironmentSchema,
  tenantId: z.string(),
  displayName: z.string(),
  features: z.array(FeatureFlagSchema),
  modelBindings: z.record(z.string(), z.string()),
  rateLimit: z.object({
    requestsPerMinute: z.number().int(),
    tokensPerDay: z.number().int(),
    maxConcurrentSessions: z.number().int(),
  }),
  dataDomains: z.array(z.object({
    domain: z.string(),
    enabled: z.boolean(),
    readOnly: z.boolean().default(false),
    description: z.string(),
  })),
  auditLevel: AuditLevelSchema,
  piiHandling: PiiHandlingSchema,
  retentionDays: z.number().int(),
  promptLoggingEnabled: z.boolean().default(true),
  approvalWorkflowEnabled: z.boolean().default(true),
  updatedAt: z.string().datetime(),
  updatedBy: z.string(),
});
export type EnvironmentConfig = z.infer<typeof EnvironmentConfigSchema>;

export const ENVIRONMENT_CONFIGS: EnvironmentConfig[] = [
  {
    id: "ec000001-0000-0000-0000-000000000001",
    environment: "production",
    tenantId: "tenant-demo-001",
    displayName: "Production — Demo Tenant",
    features: [
      { key: "ask_ai", enabled: true, description: "AI chat interface", rolloutPct: 100 },
      { key: "workflow_agents", enabled: true, description: "Finance workflow automation agents", rolloutPct: 100 },
      { key: "rag_retrieval", enabled: true, description: "RAG-powered document Q&A", rolloutPct: 100 },
      { key: "variance_commentary", enabled: true, description: "AI variance commentary drafts", rolloutPct: 100 },
      { key: "policy_simulator", enabled: true, description: "Governance policy simulator", rolloutPct: 100 },
      { key: "model_registry", enabled: true, description: "AI model governance registry", rolloutPct: 100 },
      { key: "evals_dashboard", enabled: true, description: "Answer quality evaluation suite", rolloutPct: 100 },
      { key: "autonomous_posting", enabled: false, description: "Autonomous GL entry posting — DISABLED by design", rolloutPct: 0 },
    ],
    modelBindings: {
      default: "gpt-4o-2024-08-06",
      embeddings: "text-embedding-3-large",
      routing: "gpt-4o-mini-2024-07-18",
      policy_compliance: "gpt-4o-2024-08-06",
    },
    rateLimit: {
      requestsPerMinute: 60,
      tokensPerDay: 2_000_000,
      maxConcurrentSessions: 25,
    },
    dataDomains: [
      { domain: "metrics", enabled: true, readOnly: false, description: "Financial metrics and KPIs" },
      { domain: "documents", enabled: true, readOnly: false, description: "Finance documents and contracts" },
      { domain: "forecasts", enabled: true, readOnly: false, description: "Budget and forecast data" },
      { domain: "workflows", enabled: true, readOnly: false, description: "Agent workflow runs and actions" },
      { domain: "compensation", enabled: true, readOnly: true, description: "Employee compensation — read-only, restricted" },
      { domain: "strategic_plans", enabled: true, readOnly: true, description: "Strategic planning — restricted access" },
    ],
    auditLevel: "full",
    piiHandling: "mask",
    retentionDays: 2555,
    promptLoggingEnabled: true,
    approvalWorkflowEnabled: true,
    updatedAt: "2025-09-15T00:00:00Z",
    updatedBy: "admin@financeos.demo",
  },
  {
    id: "ec000001-0000-0000-0000-000000000002",
    environment: "staging",
    tenantId: "tenant-demo-001",
    displayName: "Staging — Demo Tenant",
    features: [
      { key: "ask_ai", enabled: true, description: "AI chat interface", rolloutPct: 100 },
      { key: "workflow_agents", enabled: true, description: "Finance workflow automation agents", rolloutPct: 100 },
      { key: "rag_retrieval", enabled: true, description: "RAG-powered document Q&A", rolloutPct: 100 },
      { key: "variance_commentary", enabled: true, description: "AI variance commentary drafts", rolloutPct: 100 },
      { key: "policy_simulator", enabled: true, description: "Governance policy simulator", rolloutPct: 100 },
      { key: "model_registry", enabled: true, description: "AI model governance registry", rolloutPct: 100 },
      { key: "evals_dashboard", enabled: true, description: "Answer quality evaluation suite", rolloutPct: 100 },
      { key: "autonomous_posting", enabled: false, description: "Autonomous GL entry posting — DISABLED", rolloutPct: 0 },
    ],
    modelBindings: {
      default: "gpt-4o-2024-08-06",
      embeddings: "text-embedding-3-large",
      routing: "gpt-4o-mini-2024-07-18",
      policy_compliance: "claude-3-5-sonnet-20241022",
    },
    rateLimit: {
      requestsPerMinute: 120,
      tokensPerDay: 5_000_000,
      maxConcurrentSessions: 50,
    },
    dataDomains: [
      { domain: "metrics", enabled: true, readOnly: false, description: "Financial metrics and KPIs" },
      { domain: "documents", enabled: true, readOnly: false, description: "Finance documents and contracts" },
      { domain: "forecasts", enabled: true, readOnly: false, description: "Budget and forecast data" },
      { domain: "workflows", enabled: true, readOnly: false, description: "Agent workflow runs and actions" },
      { domain: "compensation", enabled: true, readOnly: true, description: "Employee compensation — read-only" },
      { domain: "strategic_plans", enabled: true, readOnly: false, description: "Strategic planning" },
    ],
    auditLevel: "standard",
    piiHandling: "mask",
    retentionDays: 90,
    promptLoggingEnabled: true,
    approvalWorkflowEnabled: true,
    updatedAt: "2025-09-15T00:00:00Z",
    updatedBy: "admin@financeos.demo",
  },
];
