import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Budget Management Agent
// Purpose: FP&A workflow automation — loads actuals against approved budget,
//          flags material variances for human review, drafts reforecast
//          initiation memos, and manages budget approval workflows.
//
// Rules:
//   - All budget approvals are human-gated (no autonomous approval of plans).
//   - Variance commentary is a draft only — must be reviewed before distribution.
//   - Reforecast triggers are flagged as recommendations, never executed autonomously.
// ─────────────────────────────────────────────────────────────────────────────

export const BudgetManagementAgentConfigSchema = z.object({
  agentId: z.literal("budget-management-v1"),
  displayName: z.literal("Budget Management"),
  description: z.literal(
    "FP&A workflow: loads actuals vs approved budget, flags material variances, drafts reforecast memos, and manages budget approval gates. All approvals are human-executed."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    fiscalPeriod: z.string().describe("e.g. Q3 FY2026"),
    budgetVersion: z.string().default("latest_approved").describe("Budget version label"),
    entityIds: z.array(z.string()).default([]).describe("Entity IDs to include; empty = consolidated"),
    materialityThresholdUsd: z.number().default(50_000).describe("USD — suppress below threshold"),
    materialityThresholdPct: z.number().default(0.05).describe("Decimal % — suppress below threshold"),
    includeReforecastAnalysis: z.boolean().default(true),
  }),

  output: z.object({
    budgetSummary: z.object({
      totalBudgetRevenue: z.number(),
      totalActualRevenue: z.number(),
      totalBudgetOpex: z.number(),
      totalActualOpex: z.number(),
      revenueVarianceUsd: z.number(),
      revenueVariancePct: z.number(),
      opexVarianceUsd: z.number(),
      opexVariancePct: z.number(),
      ebitdaVarianceUsd: z.number(),
    }),
    materialVariances: z.array(
      z.object({
        lineItem: z.string(),
        budgetAmount: z.number(),
        actualAmount: z.number(),
        varianceUsd: z.number(),
        variancePct: z.number(),
        isFavourable: z.boolean(),
        rootCauseDraft: z.string(),
        requiresReforecast: z.boolean(),
        evidenceIds: z.array(z.string()),
      })
    ),
    draftManagementCommentary: z.string().describe("Draft only — requires human review before distribution"),
    reforecastRecommendation: z.object({
      recommended: z.boolean(),
      rationale: z.string(),
      affectedLineItems: z.array(z.string()),
    }).optional(),
    approvalRequired: z.boolean().describe("True if any variance exceeds the CFO approval threshold"),
    draftMemoId: z.string().uuid().optional(),
  }),

  requiredTools: z.array(z.string()).default([
    "query_actuals",
    "query_budget",
    "fetch_budget_document",
    "compute_variance",
    "draft_commentary",
    "flag_for_approval",
    "create_exception",
  ]),
});

export type BudgetManagementAgentConfig = z.infer<typeof BudgetManagementAgentConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Task schema
// ─────────────────────────────────────────────────────────────────────────────

export const BudgetTaskTypeSchema = z.enum([
  "load_actuals",
  "compute_variance",
  "flag_material_variance",
  "draft_commentary",
  "initiate_reforecast",
  "submit_for_approval",
  "approve_budget",
  "reject_budget",
  "publish_commentary",
]);
export type BudgetTaskType = z.infer<typeof BudgetTaskTypeSchema>;

export const BudgetTaskSchema = z.object({
  taskId: z.string().uuid(),
  type: BudgetTaskTypeSchema,
  fiscalPeriod: z.string(),
  budgetVersion: z.string(),
  entityId: z.string().optional(),
  lineItem: z.string().optional(),
  draftOutputRef: z.string().uuid().optional(),
  assignedTo: z.string().optional(),
  dueAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  completedAt: z.string().datetime().optional(),
});
export type BudgetTask = z.infer<typeof BudgetTaskSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

export const BUDGET_WORKFLOW_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "budget_management",
  initialState: "idle",
  terminalStates: ["complete"],
  humanGatedStates: ["awaiting_human_review", "reforecast_initiated", "error"],
  transitions: [
    { from: "idle",                    to: "loading_actuals",        trigger: "START_ACTUALS_LOAD",        description: "Begin loading period actuals from warehouse",     requiresHuman: false, requiresApproval: false },
    { from: "loading_actuals",         to: "computing_variance",     trigger: "ACTUALS_LOADED",            description: "Actuals loaded; begin variance computation",       requiresHuman: false, requiresApproval: false },
    { from: "loading_actuals",         to: "error",                  trigger: "LOAD_FAILED",               description: "Data load failed",                                requiresHuman: false, requiresApproval: false },
    { from: "computing_variance",      to: "reviewing_variances",    trigger: "VARIANCE_COMPUTED",         description: "Variance computed; begin AI review",               requiresHuman: false, requiresApproval: false },
    { from: "computing_variance",      to: "error",                  trigger: "COMPUTE_FAILED",            description: "Variance computation failed",                     requiresHuman: false, requiresApproval: false },
    { from: "reviewing_variances",     to: "drafting_commentary",    trigger: "MATERIAL_VARIANCES_FOUND",  description: "Material variances found; draft commentary",        requiresHuman: false, requiresApproval: false },
    { from: "reviewing_variances",     to: "complete",               trigger: "NO_MATERIAL_VARIANCES",     description: "No material variances; close run",                 requiresHuman: false, requiresApproval: false },
    { from: "drafting_commentary",     to: "awaiting_human_review",  trigger: "DRAFT_READY",               description: "Draft ready for human review",                    requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_human_review",   to: "publishing",             trigger: "COMMENTARY_APPROVED",       description: "Commentary approved; publish",                    requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_human_review",   to: "drafting_commentary",    trigger: "COMMENTARY_REJECTED",       description: "Commentary rejected; revise",                     requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_human_review",   to: "reforecast_initiated",   trigger: "REFORECAST_TRIGGERED",      description: "Reforecast workflow initiated",                   requiresHuman: true,  requiresApproval: false },
    { from: "reforecast_initiated",    to: "complete",               trigger: "REFORECAST_APPROVED",       description: "Reforecast approved",                             requiresHuman: true,  requiresApproval: true  },
    { from: "reforecast_initiated",    to: "awaiting_human_review",  trigger: "REFORECAST_REJECTED",       description: "Reforecast rejected; return to review",           requiresHuman: true,  requiresApproval: false },
    { from: "publishing",              to: "complete",               trigger: "PUBLISHED",                 description: "Commentary published",                            requiresHuman: false, requiresApproval: false },
    { from: "error",                   to: "loading_actuals",        trigger: "RETRY",                     description: "Retry from error",                                requiresHuman: true,  requiresApproval: false },
    { from: "error",                   to: "complete",               trigger: "ABORT",                     description: "Abort run",                                       requiresHuman: true,  requiresApproval: false },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Escalation rules
// ─────────────────────────────────────────────────────────────────────────────

export const BUDGET_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "revenue variance_pct > 10% or variance_usd > $500K — CFO review required",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 86400,
  },
  {
    condition: "opex variance_usd > $250K — Controller review required",
    category: "threshold_breach",
    severity: "medium",
    notifyRoles: ["finance_manager", "controller"],
    autoEscalateAfterSeconds: 172800,
  },
  {
    condition: "two consecutive budget misses — reforecast should be initiated",
    category: "threshold_breach",
    severity: "medium",
    notifyRoles: ["analyst", "finance_manager", "controller", "cfo"],
    autoEscalateAfterSeconds: 259200,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Budget variance line item schema (used by API + UI)
// ─────────────────────────────────────────────────────────────────────────────

export const BudgetVarianceLineSchema = z.object({
  id: z.string().uuid(),
  fiscalPeriod: z.string(),
  budgetVersion: z.string(),
  entityId: z.string().optional(),
  department: z.string().optional(),
  glAccount: z.string().optional(),
  lineItemName: z.string(),
  budgetAmount: z.number(),
  actualAmount: z.number(),
  varianceUsd: z.number(),
  variancePct: z.number(),
  isFavourable: z.boolean(),
  isMaterial: z.boolean(),
  requiresApproval: z.boolean(),
  approvalStatus: z.enum(["not_required", "pending", "approved", "rejected"]).default("not_required"),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  rootCauseDraft: z.string().optional(),
  evidenceDocumentIds: z.array(z.string().uuid()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BudgetVarianceLine = z.infer<typeof BudgetVarianceLineSchema>;

export const BudgetModelSummarySchema = z.object({
  id: z.string().uuid(),
  versionLabel: z.string(),
  modelType: z.enum(["original_budget", "revised_forecast", "rolling_forecast", "long_range_plan"]),
  fiscalYear: z.number().int(),
  periodsCount: z.number().int(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  isActive: z.boolean(),
  entityIds: z.array(z.string()).default([]),
  totalBudgetedRevenue: z.number().optional(),
  totalBudgetedOpex: z.number().optional(),
  createdAt: z.string().datetime(),
});
export type BudgetModelSummary = z.infer<typeof BudgetModelSummarySchema>;
