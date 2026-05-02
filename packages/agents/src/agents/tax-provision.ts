import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Tax Provision Agent
// Purpose: Quarterly ETR calculation, statutory-to-effective rate reconciliation
//          (ASC 740 rate bridge), provision workpaper review, and sign-off.
//
// Scope (per A-005):
//   - ETR dashboarding and trend analysis
//   - Rate reconciliation commentary draft
//   - Unusual ETR movement detection and flag
//   - Sign-off workflow routing
//
// Out of scope (this phase):
//   - Full deferred tax automation (valuation allowances, book/tax differences)
//   - Multi-jurisdiction GILTI/BEAT calculations
// ─────────────────────────────────────────────────────────────────────────────

export const TaxProvisionAgentConfigSchema = z.object({
  agentId: z.literal("tax-provision-v1"),
  displayName: z.literal("Tax Provision"),
  description: z.literal(
    "Quarterly ETR computation and ASC 740 rate reconciliation. Detects unusual ETR movements, drafts rate bridge commentary, routes workpapers for Controller + CFO sign-off. Deferred tax automation is out of scope for this phase."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    fiscalPeriod: z.string().describe("e.g. Q3 FY2026"),
    entityIds: z.array(z.string()).default([]).describe("Entities for provision; empty = consolidated"),
    statutoryRate: z.number().default(0.21).describe("Primary jurisdiction statutory rate"),
    materialEtrDeviationThreshold: z.number().default(0.05).describe("±pp deviation that triggers review"),
    includeRateBridge: z.boolean().default(true),
  }),

  output: z.object({
    provisionSummary: z.object({
      fiscalPeriod: z.string(),
      preTaxIncomeUsd: z.number(),
      currentTaxExpenseUsd: z.number(),
      deferredTaxExpenseUsd: z.number(),
      totalTaxProvisionUsd: z.number(),
      effectiveTaxRate: z.number(),
      statutoryRate: z.number(),
      etrDeviationPp: z.number().describe("Effective − Statutory in percentage points"),
      isMaterial: z.boolean(),
    }),
    rateBridge: z.array(
      z.object({
        bridgeItem: z.string().describe("e.g. Stock-based compensation, R&D credits, GILTI"),
        impactPp: z.number().describe("Impact on ETR in percentage points"),
        impactUsd: z.number(),
        isExplained: z.boolean(),
        notes: z.string().optional(),
      })
    ).optional(),
    draftCommentary: z.string().describe("Draft rate bridge commentary — requires Tax Director review"),
    anomalies: z.array(
      z.object({
        description: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        suggestedAction: z.string(),
      })
    ),
    workpaperId: z.string().uuid().optional().describe("Reference to tax provision workpaper document"),
    requiresSignOff: z.boolean().default(true),
    signOffRequiredFrom: z.array(z.string()).describe("Roles required to sign off"),
  }),

  requiredTools: z.array(z.string()).default([
    "query_pretax_income",
    "query_tax_expense",
    "compute_etr",
    "compute_rate_bridge",
    "retrieve_prior_period_provision",
    "draft_commentary",
    "flag_for_sign_off",
  ]),
});

export type TaxProvisionAgentConfig = z.infer<typeof TaxProvisionAgentConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

export const TAX_PROVISION_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "tax_provision",
  initialState: "idle",
  terminalStates: ["complete"],
  humanGatedStates: [
    "awaiting_tax_director_review",
    "awaiting_controller_sign_off",
    "awaiting_cfo_sign_off",
    "error",
  ],
  transitions: [
    { from: "idle",                          to: "loading_financials",              trigger: "START_QUARTERLY_PROVISION",  description: "Begin quarterly provision run",                   requiresHuman: false, requiresApproval: false },
    { from: "loading_financials",            to: "computing_etr",                   trigger: "FINANCIALS_LOADED",          description: "Financials loaded; compute ETR",                  requiresHuman: false, requiresApproval: false },
    { from: "loading_financials",            to: "error",                           trigger: "LOAD_FAILED",                description: "Financial load failed",                           requiresHuman: false, requiresApproval: false },
    { from: "computing_etr",                 to: "building_rate_bridge",            trigger: "ETR_COMPUTED",               description: "ETR computed; build rate bridge",                 requiresHuman: false, requiresApproval: false },
    { from: "computing_etr",                 to: "error",                           trigger: "COMPUTE_FAILED",             description: "ETR computation failed",                          requiresHuman: false, requiresApproval: false },
    { from: "building_rate_bridge",          to: "detecting_anomalies",             trigger: "BRIDGE_COMPLETE",            description: "Rate bridge built; detect anomalies",             requiresHuman: false, requiresApproval: false },
    { from: "building_rate_bridge",          to: "error",                           trigger: "BRIDGE_FAILED",              description: "Rate bridge failed",                              requiresHuman: false, requiresApproval: false },
    { from: "detecting_anomalies",           to: "drafting_commentary",             trigger: "ANOMALIES_FOUND",            description: "Anomalies found; draft commentary",               requiresHuman: false, requiresApproval: false },
    { from: "detecting_anomalies",           to: "drafting_commentary",             trigger: "NO_ANOMALIES",               description: "No anomalies; draft commentary",                  requiresHuman: false, requiresApproval: false },
    { from: "drafting_commentary",           to: "awaiting_tax_director_review",    trigger: "DRAFT_READY",                description: "Draft ready for Tax Director",                    requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_tax_director_review",  to: "awaiting_controller_sign_off",    trigger: "DIRECTOR_APPROVED",          description: "Tax Director approved; Controller sign-off",      requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_tax_director_review",  to: "drafting_commentary",             trigger: "DIRECTOR_REJECTED",          description: "Rejected; revise commentary",                     requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_controller_sign_off",  to: "awaiting_cfo_sign_off",           trigger: "CONTROLLER_SIGNED",          description: "Controller signed; CFO sign-off",                 requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_controller_sign_off",  to: "awaiting_tax_director_review",    trigger: "CONTROLLER_REJECTED",        description: "Controller rejected; back to Tax Director",       requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_cfo_sign_off",         to: "complete",                        trigger: "CFO_SIGNED",                 description: "CFO signed; provision complete",                  requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_cfo_sign_off",         to: "awaiting_controller_sign_off",    trigger: "CFO_REJECTED",               description: "CFO rejected; back to Controller",                requiresHuman: true,  requiresApproval: false },
    { from: "error",                         to: "loading_financials",              trigger: "RETRY",                      description: "Retry",                                           requiresHuman: true,  requiresApproval: false },
    { from: "error",                         to: "complete",                        trigger: "ABORT",                      description: "Abort",                                           requiresHuman: true,  requiresApproval: false },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Escalation rules
// ─────────────────────────────────────────────────────────────────────────────

export const TAX_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "abs(etr_deviation_pp) > 5pp from statutory rate — Tax Director review required",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["analyst", "controller"],
    autoEscalateAfterSeconds: 172800,
  },
  {
    condition: "total_tax_provision_usd > $1M — CFO sign-off required",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 259200,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Tax provision record schema
// ─────────────────────────────────────────────────────────────────────────────

export const TaxProvisionRecordSchema = z.object({
  id: z.string().uuid(),
  fiscalPeriod: z.string(),
  entityId: z.string(),
  preTaxIncomeUsd: z.number(),
  currentTaxExpenseUsd: z.number(),
  deferredTaxExpenseUsd: z.number(),
  totalTaxProvisionUsd: z.number(),
  effectiveTaxRate: z.number(),
  statutoryRate: z.number(),
  etrDeviationPp: z.number(),
  isMaterial: z.boolean(),
  signOffStatus: z.enum(["draft", "tax_director_review", "controller_review", "cfo_review", "signed_off", "rejected"]),
  signedOffBy: z.string().optional(),
  signedOffAt: z.string().datetime().optional(),
  workpaperDocumentId: z.string().uuid().optional(),
  draftCommentary: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type TaxProvisionRecord = z.infer<typeof TaxProvisionRecordSchema>;
