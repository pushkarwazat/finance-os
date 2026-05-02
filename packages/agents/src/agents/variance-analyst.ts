import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Variance Analyst Agent
// Purpose: Automatically compute budget-vs-actual variances, identify root
//          causes, draft management commentary, and flag exceptions for human
//          review. Never autonomously books adjustments.
// ─────────────────────────────────────────────────────────────────────────────

export const VarianceAnalystAgentConfigSchema = z.object({
  agentId: z.literal("variance-analyst-v1"),
  displayName: z.literal("Variance Analyst"),
  description: z.literal(
    "Computes budget-vs-actual variances, identifies root causes via hybrid RAG + semantic analytics, drafts management commentary, and surfaces material exceptions for human review."
  ),
  version: z.string().default("1.0.0"),

  // ── Input contract ──────────────────────────────────────────────────────
  input: z.object({
    fiscalPeriod: z.string().describe("e.g. Q3 FY2025"),
    metricCategories: z
      .array(z.string())
      .default(["revenue", "opex", "gross_margin", "headcount"])
      .describe("Which metric categories to analyse"),
    materialityThresholdUsd: z
      .number()
      .default(50_000)
      .describe("USD amount below which variances are auto-suppressed"),
    materialityThresholdPct: z
      .number()
      .default(0.05)
      .describe("Percentage (as decimal) below which variances are auto-suppressed"),
  }),

  // ── Output contract ─────────────────────────────────────────────────────
  output: z.object({
    varianceTable: z.array(
      z.object({
        metric: z.string(),
        actual: z.number(),
        budget: z.number(),
        variance: z.number(),
        variancePct: z.number(),
        isMaterial: z.boolean(),
        rootCauseSummary: z.string(),
        evidenceIds: z.array(z.string()),
      })
    ),
    executiveSummary: z.string(),
    draftCommentary: z.string().describe("Board/management commentary draft"),
    materialExceptions: z.array(z.string()).describe("Exception IDs raised"),
    recommendedActions: z.array(z.string()).describe("ActionRecommendation IDs"),
  }),

  // ── Required tools ──────────────────────────────────────────────────────
  requiredTools: z.array(z.string()).default([
    "query_actuals",           // semantic_analytics: pull actuals from metric layer
    "query_budget",            // semantic_analytics: pull budget/forecast
    "compute_variance",        // calculation: compute deltas and percentages
    "rag_search",              // rag_retrieval: search close memos, board decks
    "draft_commentary",        // draft_generation: LLM variance commentary
    "write_audit_event",       // audit_write: log all actions
  ]),

  // ── Confidence thresholds ───────────────────────────────────────────────
  confidenceThresholds: z.object({
    minToPublish: z.number().default(0.70).describe("Below this, add disclaimer"),
    minToAutoApprove: z.number().default(0.95).describe("Above this, enable auto-approve for immaterial items"),
    abstainBelow: z.number().default(0.40).describe("Below this, escalate to human"),
  }),

  // ── Approval requirements ───────────────────────────────────────────────
  approvalRequirements: z.object({
    commentaryAboveUsd: z.number().default(0).describe("All commentary requires controller sign-off"),
    entryAboveUsd: z.number().default(0).describe("Agent never posts entries"),
    requiredRole: z.string().default("controller"),
  }),

  // ── Human handoff triggers ──────────────────────────────────────────────
  humanHandoffTriggers: z.array(z.string()).default([
    "confidence < 0.40",
    "variance > 10% and amount > $500k",
    "no comparable period data found",
    "conflicting signals across metric sources",
    "policy exception detected",
  ]),
});
export type VarianceAnalystAgentConfig = z.infer<typeof VarianceAnalystAgentConfigSchema>;

export const VARIANCE_ANALYST_CONFIG: VarianceAnalystAgentConfig = {
  agentId: "variance-analyst-v1",
  displayName: "Variance Analyst",
  description:
    "Computes budget-vs-actual variances, identifies root causes via hybrid RAG + semantic analytics, drafts management commentary, and surfaces material exceptions for human review.",
  version: "1.0.0",
  input: {
    fiscalPeriod: "Q3 FY2025",
    metricCategories: ["revenue", "opex", "gross_margin", "headcount"],
    materialityThresholdUsd: 50_000,
    materialityThresholdPct: 0.05,
  },
  output: {
    varianceTable: [],
    executiveSummary: "",
    draftCommentary: "",
    materialExceptions: [],
    recommendedActions: [],
  },
  requiredTools: [
    "query_actuals",
    "query_budget",
    "compute_variance",
    "rag_search",
    "draft_commentary",
    "write_audit_event",
  ],
  confidenceThresholds: {
    minToPublish: 0.70,
    minToAutoApprove: 0.95,
    abstainBelow: 0.40,
  },
  approvalRequirements: {
    commentaryAboveUsd: 0,
    entryAboveUsd: 0,
    requiredRole: "controller",
  },
  humanHandoffTriggers: [
    "confidence < 0.40",
    "variance > 10% and amount > $500k",
    "no comparable period data found",
    "conflicting signals across metric sources",
    "policy exception detected",
  ],
};

export const VARIANCE_ANALYST_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "Material variance (>10%, >$500k) with no documented root cause",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 3600,
  },
  {
    condition: "Confidence below 0.40 — agent cannot determine root cause",
    category: "confidence_low",
    severity: "medium",
    notifyRoles: ["controller"],
    autoEscalateAfterSeconds: 1800,
  },
  {
    condition: "Conflicting actuals between metric layer and close memo",
    category: "data_quality",
    severity: "high",
    notifyRoles: ["controller", "fp_and_a"],
    autoEscalateAfterSeconds: 900,
  },
];

export const VARIANCE_ANALYST_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "variance_analysis",
  initialState: "idle",
  terminalStates: ["completed", "cancelled", "exception"],
  humanGatedStates: ["awaiting_approval", "escalated"],
  transitions: [
    { from: "idle",                to: "fetching_actuals",     trigger: "start",              description: "Begin fetching actuals from metric layer",       requiresHuman: false, requiresApproval: false },
    { from: "fetching_actuals",    to: "fetching_budget",      trigger: "actuals_loaded",     description: "Actuals loaded; now fetch budget/forecast",      requiresHuman: false, requiresApproval: false },
    { from: "fetching_budget",     to: "computing_variances",  trigger: "budget_loaded",      description: "Budget loaded; compute variance table",          requiresHuman: false, requiresApproval: false },
    { from: "computing_variances", to: "retrieving_context",   trigger: "variances_computed", description: "Variances computed; retrieve supporting context", requiresHuman: false, requiresApproval: false },
    { from: "retrieving_context",  to: "drafting_commentary",  trigger: "context_retrieved",  description: "Context retrieved; draft management commentary",  requiresHuman: false, requiresApproval: false },
    { from: "drafting_commentary", to: "awaiting_approval",    trigger: "draft_complete",     description: "Draft complete; request controller sign-off",     requiresHuman: false, requiresApproval: true  },
    { from: "awaiting_approval",   to: "approved",             trigger: "approved",           description: "Controller approved commentary",                  requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",   to: "rejected",             trigger: "rejected",           description: "Controller rejected; return to drafting",         requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",   to: "escalated",            trigger: "escalate",           description: "Escalated to CFO due to materiality",            requiresHuman: true,  requiresApproval: false },
    { from: "approved",            to: "completed",            trigger: "publish",            description: "Commentary published to board package",           requiresHuman: true,  requiresApproval: false },
    { from: "rejected",            to: "drafting_commentary",  trigger: "revise",             description: "Agent revises draft based on feedback",           requiresHuman: false, requiresApproval: false },
    { from: "drafting_commentary", to: "exception",            trigger: "exception_raised",   description: "Unrecoverable exception; halt run",              requiresHuman: false, requiresApproval: false },
    { from: "computing_variances", to: "exception",            trigger: "exception_raised",   description: "Data quality exception; halt run",               requiresHuman: false, requiresApproval: false },
  ],
};
