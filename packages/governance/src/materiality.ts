import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Materiality Thresholds
// All thresholds are marked TODO:CONFIRM — must be validated with CFO/Controller
// before production go-live. See requirements/assumptions.md A-003.
// ─────────────────────────────────────────────────────────────────────────────

export const MaterialityClassSchema = z.enum([
  "pl_variance",
  "balance_sheet",
  "treasury_cash",
  "intercompany",
  "covenant_breach",
  "tax_provision",
  "consolidation_adjustment",
  "journal_entry",
]);
export type MaterialityClass = z.infer<typeof MaterialityClassSchema>;

export const MaterialityThresholdSchema = z.object({
  class: MaterialityClassSchema,
  displayName: z.string(),
  description: z.string(),
  absoluteUsd: z.number().describe("USD amount — transactions below this are sub-threshold"),
  percentagePct: z.number().describe("Percentage — applies where relevant (0–1 decimal)"),
  direction: z.enum(["absolute", "favourable_only", "unfavourable_only", "both"]),
  escalationRole: z.string().describe("Minimum role that must review material items"),
  dualApprovalAboveUsd: z.number().optional().describe("USD amount above which dual approval is required"),
  dualApprovalRole: z.string().optional(),
  retentionPeriodDays: z.number().int(),
  todoConfirm: z.boolean().default(true).describe("Must be confirmed with CFO before production go-live"),
});
export type MaterialityThreshold = z.infer<typeof MaterialityThresholdSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Default materiality table
// Source: requirements/assumptions.md A-003
// ─────────────────────────────────────────────────────────────────────────────

export const MATERIALITY_THRESHOLDS: Record<MaterialityClass, MaterialityThreshold> = {
  pl_variance: {
    class: "pl_variance",
    displayName: "P&L Variance",
    description:
      "Budget vs actual variances in revenue, OpEx, gross margin, or EBITDA. " +
      "Variances below both thresholds are suppressed from the variance report. " +
      "TODO:CONFIRM with CFO and Controller.",
    absoluteUsd: 50_000,
    percentagePct: 0.05,
    direction: "both",
    escalationRole: "finance_manager",
    dualApprovalAboveUsd: 500_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: true,
  },
  balance_sheet: {
    class: "balance_sheet",
    displayName: "Balance Sheet Adjustment",
    description:
      "Balance sheet adjustments, reclassifications, and restatements. " +
      "TODO:CONFIRM with CFO and Controller.",
    absoluteUsd: 500_000,
    percentagePct: 0.10,
    direction: "both",
    escalationRole: "controller",
    dualApprovalAboveUsd: 500_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: true,
  },
  treasury_cash: {
    class: "treasury_cash",
    displayName: "Treasury Cash Variance",
    description:
      "Unexplained variances in treasury cash position vs prior-day or forecast. " +
      "TODO:CONFIRM with Treasury team.",
    absoluteUsd: 25_000,
    percentagePct: 0.02,
    direction: "both",
    escalationRole: "finance_manager",
    dualApprovalAboveUsd: 1_000_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 1825,
    todoConfirm: true,
  },
  intercompany: {
    class: "intercompany",
    displayName: "Intercompany Mismatch",
    description:
      "Difference between seller and buyer records for an intercompany transaction. " +
      "Mismatches above threshold block consolidation. TODO:CONFIRM with Controller.",
    absoluteUsd: 10_000,
    percentagePct: 0.01,
    direction: "both",
    escalationRole: "controller",
    dualApprovalAboveUsd: 100_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: true,
  },
  covenant_breach: {
    class: "covenant_breach",
    displayName: "Covenant Breach",
    description:
      "Any breach of a debt covenant, regardless of size. Materiality is irrelevant — " +
      "all breaches trigger immediate escalation.",
    absoluteUsd: 0,
    percentagePct: 0.0,
    direction: "both",
    escalationRole: "cfo",
    dualApprovalAboveUsd: 0,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: false,
  },
  tax_provision: {
    class: "tax_provision",
    displayName: "Tax Provision Adjustment",
    description:
      "Adjustments to the tax provision or ETR. ETR deviations > 5pp from statutory rate trigger review. " +
      "TODO:CONFIRM with Tax Director.",
    absoluteUsd: 50_000,
    percentagePct: 0.05,
    direction: "both",
    escalationRole: "controller",
    dualApprovalAboveUsd: 1_000_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: true,
  },
  consolidation_adjustment: {
    class: "consolidation_adjustment",
    displayName: "Consolidation Adjustment",
    description:
      "Top-side consolidation adjustments above the materiality threshold require Controller + CFO dual approval. " +
      "TODO:CONFIRM with Controller.",
    absoluteUsd: 100_000,
    percentagePct: 0.05,
    direction: "both",
    escalationRole: "controller",
    dualApprovalAboveUsd: 500_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: true,
  },
  journal_entry: {
    class: "journal_entry",
    displayName: "Journal Entry (AI-Suggested)",
    description:
      "AI-suggested journal entries above materiality require dual approval. " +
      "ALL AI journal entries are drafts regardless of amount. TODO:CONFIRM with Controller.",
    absoluteUsd: 50_000,
    percentagePct: 0.05,
    direction: "both",
    escalationRole: "controller",
    dualApprovalAboveUsd: 500_000,
    dualApprovalRole: "cfo",
    retentionPeriodDays: 2555,
    todoConfirm: true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper functions
// ─────────────────────────────────────────────────────────────────────────────

export function isMaterial(
  materialityClass: MaterialityClass,
  amountUsd: number,
  percentageActual?: number
): boolean {
  const t = MATERIALITY_THRESHOLDS[materialityClass];
  if (!t) return true;
  if (materialityClass === "covenant_breach") return true;
  const aboveAbsolute = Math.abs(amountUsd) >= t.absoluteUsd;
  const abovePercentage =
    percentageActual !== undefined
      ? Math.abs(percentageActual) >= t.percentagePct
      : false;
  return aboveAbsolute || abovePercentage;
}

export function requiresDualApproval(
  materialityClass: MaterialityClass,
  amountUsd: number
): boolean {
  const t = MATERIALITY_THRESHOLDS[materialityClass];
  if (!t) return true;
  if (t.dualApprovalAboveUsd === undefined) return false;
  return Math.abs(amountUsd) >= t.dualApprovalAboveUsd;
}

export function getEscalationRole(materialityClass: MaterialityClass): string {
  return MATERIALITY_THRESHOLDS[materialityClass]?.escalationRole ?? "controller";
}

export function getPendingConfirmations(): MaterialityThreshold[] {
  return Object.values(MATERIALITY_THRESHOLDS).filter((t) => t.todoConfirm);
}
