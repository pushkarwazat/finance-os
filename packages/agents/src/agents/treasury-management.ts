import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Treasury Management Agent
// Purpose: Daily cash position monitoring, runway calculation, liquidity
//          dashboarding, and covenant-adjacent cash metrics.
//
// Rules:
//   - Agent NEVER initiates actual bank transfers or sweep instructions.
//   - All payment/sweep instructions are drafted for human review and require
//     Controller + CFO dual approval above $1M (TODO:CONFIRM threshold).
//   - Cash position data pulled from warehouse only (no live bank feed).
// ─────────────────────────────────────────────────────────────────────────────

export const TreasuryManagementAgentConfigSchema = z.object({
  agentId: z.literal("treasury-management-v1"),
  displayName: z.literal("Treasury Management"),
  description: z.literal(
    "Monitors daily cash positions, computes runway, tracks working capital KPIs, drafts sweep instructions for human approval, and alerts on liquidity covenant proximity."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    asOfDate: z.string().describe("ISO date — position date for this run"),
    entityIds: z.array(z.string()).default([]).describe("Empty = all entities"),
    includeCovenant: z.boolean().default(true),
    includeAging: z.boolean().default(true),
    criticalCashThresholdUsd: z.number().default(10_000_000).describe("TODO:CONFIRM"),
    warningCashThresholdUsd: z.number().default(25_000_000).describe("TODO:CONFIRM"),
  }),

  output: z.object({
    cashSummary: z.object({
      totalUnrestrictedCashUsd: z.number(),
      totalRestrictedCashUsd: z.number(),
      netCashPositionUsd: z.number(),
      asOfDate: z.string(),
      alertLevel: z.enum(["ok", "warning", "critical"]),
      runwayMonths: z.number().optional(),
      netMonthlyBurnUsd: z.number().optional(),
    }),
    bankAccountBreakdown: z.array(
      z.object({
        accountRef: z.string().describe("Internal reference — not actual account number"),
        entityId: z.string(),
        balanceUsd: z.number(),
        isRestricted: z.boolean(),
      })
    ),
    workingCapitalMetrics: z.object({
      arBalanceUsd: z.number(),
      apBalanceUsd: z.number(),
      dsoDays: z.number().optional(),
      dpoDays: z.number().optional(),
      netWorkingCapitalUsd: z.number(),
    }),
    covenantProximity: z.array(
      z.object({
        covenantId: z.string(),
        covenantName: z.string(),
        metricSlug: z.string(),
        currentValue: z.number(),
        thresholdValue: z.number(),
        headroomPct: z.number(),
        status: z.enum(["compliant", "watch", "breach"]),
      })
    ).optional(),
    draftSweepInstructions: z.array(
      z.object({
        instructionId: z.string().uuid(),
        description: z.string(),
        amountUsd: z.number(),
        fromAccountRef: z.string(),
        toAccountRef: z.string(),
        rationale: z.string(),
        requiresDualApproval: z.boolean(),
        status: z.literal("draft"),
      })
    ).describe("ALL instructions are drafts — never executed without dual human approval"),
    alerts: z.array(
      z.object({
        alertId: z.string().uuid(),
        severity: z.enum(["info", "warning", "critical"]),
        message: z.string(),
        metricSlug: z.string().optional(),
        currentValue: z.number().optional(),
        threshold: z.number().optional(),
      })
    ),
  }),

  requiredTools: z.array(z.string()).default([
    "query_cash_positions",
    "query_ar_aging",
    "query_ap_aging",
    "compute_runway",
    "query_covenant_metrics",
    "draft_sweep_instruction",
    "create_alert",
  ]),
});

export type TreasuryManagementAgentConfig = z.infer<typeof TreasuryManagementAgentConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

export const TREASURY_WORKFLOW_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "treasury_management",
  initialState: "idle",
  terminalStates: ["complete"],
  humanGatedStates: ["awaiting_human_review", "executing_instructions", "error"],
  transitions: [
    { from: "idle",                         to: "fetching_positions",          trigger: "START_DAILY_RUN",           description: "Begin daily treasury run",                                         requiresHuman: false, requiresApproval: false },
    { from: "fetching_positions",           to: "computing_metrics",           trigger: "POSITIONS_LOADED",          description: "Cash positions loaded; compute metrics",                           requiresHuman: false, requiresApproval: false },
    { from: "fetching_positions",           to: "error",                       trigger: "FETCH_FAILED",              description: "Position fetch failed",                                            requiresHuman: false, requiresApproval: false },
    { from: "computing_metrics",            to: "evaluating_alerts",           trigger: "METRICS_COMPUTED",          description: "Metrics computed; evaluate thresholds",                            requiresHuman: false, requiresApproval: false },
    { from: "evaluating_alerts",            to: "escalating",                  trigger: "CRITICAL_ALERT",            description: "Critical cash threshold breached — escalate",                      requiresHuman: false, requiresApproval: false },
    { from: "evaluating_alerts",            to: "drafting_sweep_instructions", trigger: "WARNING_ALERT",             description: "Warning threshold — draft sweep instructions",                     requiresHuman: false, requiresApproval: false },
    { from: "evaluating_alerts",            to: "complete",                    trigger: "NO_ALERTS",                 description: "All thresholds OK; run complete",                                  requiresHuman: false, requiresApproval: false },
    { from: "drafting_sweep_instructions",  to: "awaiting_human_review",       trigger: "DRAFTS_READY",              description: "Sweep instruction drafts ready for human review",                  requiresHuman: true,  requiresApproval: false },
    { from: "escalating",                   to: "awaiting_human_review",       trigger: "ESCALATION_SENT",           description: "Critical alert sent; await human response",                        requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_human_review",        to: "executing_instructions",      trigger: "INSTRUCTIONS_APPROVED",     description: "Instructions approved — human executes in treasury portal",         requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_human_review",        to: "complete",                    trigger: "INSTRUCTIONS_REJECTED",     description: "Instructions rejected; close run",                                 requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_human_review",        to: "complete",                    trigger: "ALERT_ACKNOWLEDGED",        description: "Alert acknowledged; close run",                                    requiresHuman: true,  requiresApproval: false },
    { from: "executing_instructions",       to: "complete",                    trigger: "EXECUTION_CONFIRMED",       description: "Human confirmed execution in treasury portal",                     requiresHuman: true,  requiresApproval: false },
    { from: "error",                        to: "fetching_positions",          trigger: "RETRY",                     description: "Retry",                                                            requiresHuman: true,  requiresApproval: false },
    { from: "error",                        to: "complete",                    trigger: "ABORT",                     description: "Abort run",                                                        requiresHuman: true,  requiresApproval: false },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Escalation rules
// ─────────────────────────────────────────────────────────────────────────────

export const TREASURY_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "total_unrestricted_cash_usd < $10M — immediate CFO attention required",
    category: "threshold_breach",
    severity: "critical",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 7200,
  },
  {
    condition: "total_unrestricted_cash_usd < $25M warning threshold",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["finance_manager", "controller"],
    autoEscalateAfterSeconds: 28800,
  },
  {
    condition: "runway_months < 6 — Board notification may be required",
    category: "threshold_breach",
    severity: "critical",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 14400,
  },
  {
    condition: "covenant_status == breach — legal and CFO must be notified immediately",
    category: "threshold_breach",
    severity: "critical",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 3600,
  },
  {
    condition: "sweep_amount_usd >= $1M — requires dual Controller + CFO approval",
    category: "approval_timeout",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 86400,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Cash position snapshot schema
// ─────────────────────────────────────────────────────────────────────────────

export const CashPositionSnapshotSchema = z.object({
  id: z.string().uuid(),
  asOfDate: z.string(),
  entityId: z.string(),
  totalUnrestrictedCashUsd: z.number(),
  totalRestrictedCashUsd: z.number(),
  shortTermInvestmentsUsd: z.number().optional(),
  runwayMonths: z.number().optional(),
  netMonthlyBurnUsd: z.number().optional(),
  alertLevel: z.enum(["ok", "warning", "critical"]),
  computedAt: z.string().datetime(),
  sourceJobId: z.string().uuid().optional(),
});
export type CashPositionSnapshot = z.infer<typeof CashPositionSnapshotSchema>;

export const CovenantTestResultSchema = z.object({
  id: z.string().uuid(),
  covenantId: z.string(),
  covenantName: z.string(),
  testDate: z.string(),
  metricSlug: z.string(),
  currentValue: z.number(),
  thresholdValue: z.number(),
  headroomAbs: z.number(),
  headroomPct: z.number(),
  status: z.enum(["compliant", "watch", "breach"]),
  requiresWaiver: z.boolean().default(false),
  waiverRequestedAt: z.string().datetime().optional(),
  certifiedBy: z.string().optional(),
  certifiedAt: z.string().datetime().optional(),
});
export type CovenantTestResult = z.infer<typeof CovenantTestResultSchema>;
