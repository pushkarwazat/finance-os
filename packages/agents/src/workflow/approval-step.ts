import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Approval step — every agent recommendation that involves posting or
// committing must pass through a named approval gate before execution.
// ─────────────────────────────────────────────────────────────────────────────

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "escalated",
  "expired",
  "auto_approved",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalLevelSchema = z.enum([
  /** Any user with the relevant role can approve. */
  "self_serve",
  /** Controller or senior accountant required. */
  "controller",
  /** CFO or VP Finance required. */
  "cfo",
  /** Audit committee or board sign-off required. */
  "audit_committee",
]);
export type ApprovalLevel = z.infer<typeof ApprovalLevelSchema>;

export const ApprovalStepSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  actionId: z.string().uuid(),
  /** Short name of this approval gate (e.g. "controller_sign_off"). */
  gateId: z.string(),
  displayName: z.string(),
  description: z.string(),
  requiredLevel: ApprovalLevelSchema,
  /** Roles that satisfy this approval gate. */
  requiredRoles: z.array(z.string()),
  status: ApprovalStatusSchema,
  /** User who approved/rejected, if resolved. */
  decidedBy: z.string().nullable(),
  decision: z.enum(["approved", "rejected"]).nullable(),
  /** Free-text rationale the approver provides. */
  decisionNote: z.string().optional(),
  /** Whether the action was auto-approved based on materiality thresholds. */
  autoApproved: z.boolean().default(false),
  autoApprovalReason: z.string().optional(),
  /** The dollar value or materiality score driving the required approval level. */
  materialityAmount: z.number().optional(),
  materialityThreshold: z.number().optional(),
  /** IDs of evidence items the approver should review. */
  evidenceIds: z.array(z.string()).default([]),
  /** Unix timestamp (ms) after which this step expires if not decided. */
  expiresAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  decidedAt: z.string().datetime().nullable(),
});
export type ApprovalStep = z.infer<typeof ApprovalStepSchema>;
