import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Consolidation Agent
// Purpose: Multi-entity financial consolidation workflow — aggregates entity
//          actuals, identifies and drafts intercompany elimination entries,
//          flags unmatched intercompany balances, and routes consolidated
//          financials for Controller + CFO sign-off.
//
// Rules:
//   - All elimination journal entries are DRAFTS only. No autonomous posting.
//   - Intercompany mismatches above materiality threshold require human resolution.
//   - Consolidation sign-off requires Controller + CFO dual approval.
// ─────────────────────────────────────────────────────────────────────────────

export const ConsolidationAgentConfigSchema = z.object({
  agentId: z.literal("consolidation-v1"),
  displayName: z.literal("Multi-Entity Consolidation"),
  description: z.literal(
    "Aggregates entity financials, drafts intercompany elimination entries, detects unmatched IC balances, and routes consolidated group P&L for sign-off. All eliminations require human approval."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    fiscalPeriod: z.string().describe("e.g. Q3 FY2026"),
    entityIds: z.array(z.string()).min(1).describe("All entities to include in consolidation run"),
    reportingCurrency: z.string().default("USD"),
    materialityThresholdUsd: z.number().default(10_000).describe("IC mismatch threshold (TODO:CONFIRM)"),
    consolidationMethod: z.enum(["full", "equity", "proportional"]).default("full"),
    includeMidPeriodAcquisitions: z.boolean().default(false),
  }),

  output: z.object({
    consolidationRunId: z.string().uuid(),
    status: z.enum(["draft", "pending_review", "approved", "rejected"]),
    consolidatedPL: z.object({
      revenue: z.number(),
      cogs: z.number(),
      grossProfit: z.number(),
      opex: z.number(),
      ebitda: z.number(),
      netIncome: z.number(),
    }),
    consolidatedBS: z.object({
      totalAssets: z.number(),
      totalLiabilities: z.number(),
      totalEquity: z.number(),
    }).optional(),
    intercompanyEliminations: z.array(
      z.object({
        eliminationId: z.string().uuid(),
        transactionType: z.string(),
        sellerEntityId: z.string(),
        buyerEntityId: z.string(),
        amountUsd: z.number(),
        glAccount: z.string().optional(),
        status: z.enum(["draft", "matched", "unmatched", "approved"]),
        mismatchAmountUsd: z.number().optional(),
        requiresResolution: z.boolean(),
      })
    ),
    unmatchedBalances: z.array(
      z.object({
        entityId: z.string(),
        counterpartyEntityId: z.string(),
        amountUsd: z.number(),
        description: z.string(),
        isMaterial: z.boolean(),
      })
    ),
    draftAdjustments: z.array(
      z.object({
        adjustmentId: z.string().uuid(),
        description: z.string(),
        amountUsd: z.number(),
        glAccount: z.string(),
        status: z.literal("draft"),
      })
    ).describe("All draft — no autonomous posting"),
    requiresHumanResolution: z.boolean(),
    approvalRequired: z.boolean(),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_entity_trial_balances",
    "identify_intercompany_transactions",
    "compute_eliminations",
    "detect_ic_mismatches",
    "draft_elimination_entries",
    "aggregate_consolidated_pl",
    "flag_for_approval",
  ]),
});

export type ConsolidationAgentConfig = z.infer<typeof ConsolidationAgentConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

export const CONSOLIDATION_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "consolidation",
  initialState: "idle",
  terminalStates: ["complete"],
  humanGatedStates: [
    "awaiting_ic_resolution",
    "awaiting_controller_review",
    "awaiting_cfo_sign_off",
    "error",
  ],
  transitions: [
    { from: "idle",                         to: "fetching_trial_balances",        trigger: "START_CONSOLIDATION_RUN",  description: "Begin consolidation run",                              requiresHuman: false, requiresApproval: false },
    { from: "fetching_trial_balances",      to: "identifying_ic_transactions",    trigger: "BALANCES_LOADED",          description: "Balances loaded; identify IC transactions",            requiresHuman: false, requiresApproval: false },
    { from: "fetching_trial_balances",      to: "error",                          trigger: "FETCH_FAILED",             description: "Trial balance fetch failed",                           requiresHuman: false, requiresApproval: false },
    { from: "identifying_ic_transactions",  to: "matching_ic_balances",           trigger: "IC_IDENTIFIED",            description: "IC transactions identified; begin matching",           requiresHuman: false, requiresApproval: false },
    { from: "matching_ic_balances",         to: "computing_eliminations",         trigger: "ALL_MATCHED",              description: "All IC matched; compute eliminations",                 requiresHuman: false, requiresApproval: false },
    { from: "matching_ic_balances",         to: "awaiting_ic_resolution",         trigger: "MISMATCHES_FOUND",         description: "IC mismatches found — human resolution required",      requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_ic_resolution",       to: "computing_eliminations",         trigger: "MISMATCHES_RESOLVED",      description: "Mismatches resolved; compute eliminations",            requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_ic_resolution",       to: "computing_eliminations",         trigger: "OVERRIDE_ACCEPTED",        description: "Override accepted; proceed",                           requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_ic_resolution",       to: "complete",                       trigger: "ABORT",                    description: "Run aborted",                                          requiresHuman: true,  requiresApproval: false },
    { from: "computing_eliminations",       to: "aggregating_consolidated_pl",    trigger: "ELIMINATIONS_DRAFTED",     description: "Eliminations drafted; aggregate P&L",                  requiresHuman: false, requiresApproval: false },
    { from: "aggregating_consolidated_pl",  to: "awaiting_controller_review",     trigger: "PL_AGGREGATED",            description: "P&L aggregated; Controller review",                    requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_controller_review",   to: "awaiting_cfo_sign_off",          trigger: "CONTROLLER_APPROVED",      description: "Controller approved; CFO sign-off",                    requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_controller_review",   to: "computing_eliminations",         trigger: "CONTROLLER_REJECTED",      description: "Controller rejected; recompute",                       requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_cfo_sign_off",        to: "complete",                       trigger: "CFO_SIGNED",               description: "CFO signed; consolidation complete",                   requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_cfo_sign_off",        to: "awaiting_controller_review",     trigger: "CFO_REJECTED",             description: "CFO rejected; back to Controller",                     requiresHuman: true,  requiresApproval: false },
    { from: "error",                        to: "fetching_trial_balances",        trigger: "RETRY",                    description: "Retry",                                                requiresHuman: true,  requiresApproval: false },
    { from: "error",                        to: "complete",                       trigger: "ABORT",                    description: "Abort",                                                requiresHuman: true,  requiresApproval: false },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Escalation rules
// ─────────────────────────────────────────────────────────────────────────────

export const CONSOLIDATION_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "material intercompany mismatch > $10K — human resolution required before consolidation",
    category: "reconciliation_break",
    severity: "high",
    notifyRoles: ["analyst", "finance_manager", "controller"],
    autoEscalateAfterSeconds: 86400,
  },
  {
    condition: "consolidation adjustments > $500K — CFO review required",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 172800,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Consolidation run record schema
// ─────────────────────────────────────────────────────────────────────────────

export const ConsolidationRunSchema = z.object({
  id: z.string().uuid(),
  fiscalPeriod: z.string(),
  reportingCurrency: z.string().default("USD"),
  entityIds: z.array(z.string()),
  status: z.enum(["draft", "pending_ic_resolution", "pending_controller", "pending_cfo", "approved", "rejected"]),
  totalUnmatchedIcUsd: z.number().default(0),
  totalEliminationsUsd: z.number().default(0),
  consolidatedRevenueUsd: z.number().optional(),
  consolidatedEbitdaUsd: z.number().optional(),
  consolidatedNetIncomeUsd: z.number().optional(),
  controllerApprovedBy: z.string().optional(),
  controllerApprovedAt: z.string().datetime().optional(),
  cfoSignedOffBy: z.string().optional(),
  cfoSignedOffAt: z.string().datetime().optional(),
  runStartedAt: z.string().datetime(),
  runCompletedAt: z.string().datetime().optional(),
});
export type ConsolidationRun = z.infer<typeof ConsolidationRunSchema>;
