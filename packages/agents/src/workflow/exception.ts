import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Exception severity & category
// ─────────────────────────────────────────────────────────────────────────────

export const ExceptionSeveritySchema = z.enum([
  "critical",   // stop-the-close / SOX control failure
  "high",       // material misstatement risk
  "medium",     // requires investigation before period close
  "low",        // informational, log and continue
  "info",       // no action required
]);
export type ExceptionSeverity = z.infer<typeof ExceptionSeveritySchema>;

export const ExceptionCategorySchema = z.enum([
  "data_quality",          // missing, stale, or inconsistent source data
  "threshold_breach",      // metric or amount exceeds defined limit
  "policy_violation",      // ASC 606, IFRS 15, SOX, internal policy
  "reconciliation_break",  // unmatched items in balance / sub-ledger
  "approval_timeout",      // approval gate not resolved within SLA
  "confidence_low",        // agent confidence below required threshold
  "tool_failure",          // underlying tool / API returned an error
  "escalation",            // agent could not determine action; needs human
  "access_control",        // sensitivity or tenant isolation breach attempted
]);
export type ExceptionCategory = z.infer<typeof ExceptionCategorySchema>;

export const ExceptionStatusSchema = z.enum([
  "open",
  "acknowledged",
  "in_review",
  "resolved",
  "waived",       // accepted as-is with documented rationale
  "escalated",
]);
export type ExceptionStatus = z.infer<typeof ExceptionStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Escalation rule — embedded in agent config
// ─────────────────────────────────────────────────────────────────────────────

export const EscalationRuleSchema = z.object({
  /** Condition that triggers escalation (human-readable description). */
  condition: z.string(),
  /** Category of exception this rule fires on. */
  category: ExceptionCategorySchema,
  severity: ExceptionSeveritySchema,
  /** Roles to notify on escalation. */
  notifyRoles: z.array(z.string()),
  /** Maximum seconds before auto-escalating if unacknowledged. */
  autoEscalateAfterSeconds: z.number().int().optional(),
});
export type EscalationRule = z.infer<typeof EscalationRuleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Exception record
// ─────────────────────────────────────────────────────────────────────────────

export const ExceptionSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  taskId: z.string().uuid().optional(),
  agentId: z.string(),
  severity: ExceptionSeveritySchema,
  category: ExceptionCategorySchema,
  status: ExceptionStatusSchema,
  title: z.string(),
  description: z.string(),
  /** Technical details for debugging (not user-facing). */
  technicalDetail: z.string().optional(),
  /** IDs of evidence items related to this exception. */
  evidenceIds: z.array(z.string()).default([]),
  /** Dollar amount involved, if applicable. */
  amountUsd: z.number().optional(),
  /** Account codes affected. */
  accounts: z.array(z.string()).default([]),
  /** Named escalation rule that fired, if any. */
  escalationRuleId: z.string().optional(),
  /** Users / roles already notified. */
  notifiedRoles: z.array(z.string()).default([]),
  resolvedBy: z.string().nullable(),
  resolutionNote: z.string().optional(),
  waivedBy: z.string().nullable(),
  waiverRationale: z.string().optional(),
  raisedAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().nullable(),
  resolvedAt: z.string().datetime().nullable(),
});
export type Exception = z.infer<typeof ExceptionSchema>;
