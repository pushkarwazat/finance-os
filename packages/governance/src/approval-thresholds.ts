import { z } from "zod";
import type { Role } from "@financeos/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Approval Threshold Registry
// Defines minimum approver roles and dual-approval requirements by action type
// and dollar amount. See requirements/assumptions.md A-003, A-004.
// All thresholds marked TODO:CONFIRM must be validated before production.
// ─────────────────────────────────────────────────────────────────────────────

export const ApprovalActionSchema = z.enum([
  "close.sign_off",
  "metric.override",
  "variance.publish",
  "budget.approve",
  "budget.activate",
  "treasury.sweep_instruction",
  "treasury.covenant_waiver",
  "tax.provision_sign_off",
  "consolidation.sign_off",
  "consolidation.elimination_approve",
  "reconciliation.draft_je",
  "document.delete",
  "governance.policy_change",
  "agent.deploy",
]);
export type ApprovalAction = z.infer<typeof ApprovalActionSchema>;

export const ApprovalTierSchema = z.object({
  minAmountUsd: z.number().describe("Inclusive lower bound (0 = no lower bound)"),
  maxAmountUsd: z.number().describe("Exclusive upper bound (Infinity = no upper bound)"),
  minimumApproverRole: z.string() as z.ZodType<Role>,
  requiresDualApproval: z.boolean(),
  secondApproverRole: z.string().optional() as z.ZodType<Role | undefined>,
  notifyRoles: z.array(z.string()) as z.ZodType<Role[]>,
  slaHours: z.number().int(),
  todoConfirm: z.boolean().default(true),
});
export type ApprovalTier = z.infer<typeof ApprovalTierSchema>;

export const ApprovalThresholdConfigSchema = z.object({
  action: ApprovalActionSchema,
  description: z.string(),
  tiers: z.array(ApprovalTierSchema),
});
export type ApprovalThresholdConfig = z.infer<typeof ApprovalThresholdConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Threshold registry
// ─────────────────────────────────────────────────────────────────────────────

export const APPROVAL_THRESHOLDS: ApprovalThresholdConfig[] = [
  {
    action: "close.sign_off",
    description: "Period-end close sign-off — always requires Controller minimum regardless of amount.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: 500_000,
        minimumApproverRole: "controller",
        requiresDualApproval: false,
        notifyRoles: ["finance_manager"],
        slaHours: 24,
        todoConfirm: false,
      },
      {
        minAmountUsd: 500_000,
        maxAmountUsd: Infinity,
        minimumApproverRole: "controller",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["finance_manager", "cfo"],
        slaHours: 12,
        todoConfirm: false,
      },
    ],
  },
  {
    action: "metric.override",
    description: "Manual override of a metric value in the semantic layer.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: 50_000,
        minimumApproverRole: "controller",
        requiresDualApproval: false,
        notifyRoles: ["finance_manager"],
        slaHours: 48,
        todoConfirm: true,
      },
      {
        minAmountUsd: 50_000,
        maxAmountUsd: Infinity,
        minimumApproverRole: "controller",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["finance_manager", "cfo"],
        slaHours: 24,
        todoConfirm: true,
      },
    ],
  },
  {
    action: "budget.approve",
    description: "Approval of a budget version — original budget or revised forecast.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: 500_000,
        minimumApproverRole: "controller",
        requiresDualApproval: false,
        notifyRoles: ["finance_manager"],
        slaHours: 72,
        todoConfirm: true,
      },
      {
        minAmountUsd: 500_000,
        maxAmountUsd: Infinity,
        minimumApproverRole: "controller",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["finance_manager", "controller", "cfo"],
        slaHours: 48,
        todoConfirm: true,
      },
    ],
  },
  {
    action: "treasury.sweep_instruction",
    description: "Cash sweep or transfer instruction — all are drafts until human execution in the banking portal.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: 250_000,
        minimumApproverRole: "controller",
        requiresDualApproval: false,
        notifyRoles: ["finance_manager"],
        slaHours: 24,
        todoConfirm: true,
      },
      {
        minAmountUsd: 250_000,
        maxAmountUsd: 1_000_000,
        minimumApproverRole: "controller",
        requiresDualApproval: false,
        notifyRoles: ["controller", "cfo"],
        slaHours: 8,
        todoConfirm: true,
      },
      {
        minAmountUsd: 1_000_000,
        maxAmountUsd: Infinity,
        minimumApproverRole: "cfo",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["controller", "cfo"],
        slaHours: 4,
        todoConfirm: true,
      },
    ],
  },
  {
    action: "treasury.covenant_waiver",
    description: "Initiation of a covenant waiver request — CFO-only; any amount.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: Infinity,
        minimumApproverRole: "cfo",
        requiresDualApproval: false,
        notifyRoles: ["controller", "cfo"],
        slaHours: 2,
        todoConfirm: false,
      },
    ],
  },
  {
    action: "tax.provision_sign_off",
    description: "Quarterly tax provision sign-off — always requires dual Controller + CFO.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: Infinity,
        minimumApproverRole: "controller",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["controller", "cfo"],
        slaHours: 72,
        todoConfirm: false,
      },
    ],
  },
  {
    action: "consolidation.sign_off",
    description: "Multi-entity consolidation sign-off — always requires dual Controller + CFO.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: Infinity,
        minimumApproverRole: "controller",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["controller", "cfo"],
        slaHours: 48,
        todoConfirm: false,
      },
    ],
  },
  {
    action: "reconciliation.draft_je",
    description: "AI-suggested clearing journal entry — draft only; amount-based approval routing.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: 50_000,
        minimumApproverRole: "finance_manager",
        requiresDualApproval: false,
        notifyRoles: ["finance_manager"],
        slaHours: 48,
        todoConfirm: true,
      },
      {
        minAmountUsd: 50_000,
        maxAmountUsd: 500_000,
        minimumApproverRole: "controller",
        requiresDualApproval: false,
        notifyRoles: ["controller"],
        slaHours: 24,
        todoConfirm: true,
      },
      {
        minAmountUsd: 500_000,
        maxAmountUsd: Infinity,
        minimumApproverRole: "controller",
        requiresDualApproval: true,
        secondApproverRole: "cfo",
        notifyRoles: ["controller", "cfo"],
        slaHours: 12,
        todoConfirm: true,
      },
    ],
  },
  {
    action: "governance.policy_change",
    description: "Any change to a governance policy, RBAC role, or approval threshold.",
    tiers: [
      {
        minAmountUsd: 0,
        maxAmountUsd: Infinity,
        minimumApproverRole: "cfo",
        requiresDualApproval: false,
        notifyRoles: ["admin", "auditor"],
        slaHours: 48,
        todoConfirm: false,
      },
    ],
  },
];

export const APPROVAL_THRESHOLDS_BY_ACTION = Object.fromEntries(
  APPROVAL_THRESHOLDS.map((t) => [t.action, t])
);

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve approval tier for a given action and amount
// ─────────────────────────────────────────────────────────────────────────────

export function resolveApprovalTier(
  action: ApprovalAction,
  amountUsd: number
): ApprovalTier | null {
  const config = APPROVAL_THRESHOLDS_BY_ACTION[action];
  if (!config) return null;
  return (
    config.tiers.find(
      (t) => amountUsd >= t.minAmountUsd && amountUsd < t.maxAmountUsd
    ) ?? null
  );
}

export function getRequiredApprovers(
  action: ApprovalAction,
  amountUsd: number
): { primary: Role; secondary?: Role } | null {
  const tier = resolveApprovalTier(action, amountUsd);
  if (!tier) return null;
  return {
    primary: tier.minimumApproverRole,
    secondary: tier.requiresDualApproval ? tier.secondApproverRole : undefined,
  };
}
