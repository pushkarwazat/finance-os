import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Action recommendation — agents RECOMMEND and DRAFT; they never post entries
// autonomously. Every recommended action requires a human to approve and
// execute it.
// ─────────────────────────────────────────────────────────────────────────────

export const ActionTypeSchema = z.enum([
  // Accounting entries (always require approval)
  "post_journal_entry",
  "reverse_journal_entry",
  "reclassify_transaction",
  "accrue_expense",
  "release_accrual",
  // Collections / AR
  "send_collection_notice",
  "escalate_to_collections",
  "write_off_receivable",
  "apply_payment",
  // AP / Invoice
  "approve_invoice",
  "hold_invoice",
  "dispute_invoice",
  "request_credit_memo",
  // Close
  "sign_off_close_step",
  "reopen_close_step",
  "request_extension",
  // Compliance / Policy
  "flag_policy_exception",
  "request_waiver",
  "update_disclosure",
  // General
  "notify_stakeholder",
  "request_additional_evidence",
  "escalate_to_human",
]);
export type ActionType = z.infer<typeof ActionTypeSchema>;

export const ActionStatusSchema = z.enum([
  "drafted",        // agent produced the recommendation
  "pending_review", // awaiting human review
  "approved",       // approved; ready for human to execute
  "rejected",       // reviewer declined this action
  "executed",       // human has executed the action in the source system
  "voided",         // cancelled before execution
]);
export type ActionStatus = z.infer<typeof ActionStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Journal entry line item (used when action = post_journal_entry)
// ─────────────────────────────────────────────────────────────────────────────

export const JournalLineSchema = z.object({
  accountCode: z.string(),
  accountName: z.string(),
  debit: z.number().min(0).optional(),
  credit: z.number().min(0).optional(),
  costCenter: z.string().optional(),
  department: z.string().optional(),
  memo: z.string().optional(),
});
export type JournalLine = z.infer<typeof JournalLineSchema>;

export const DraftedJournalEntrySchema = z.object({
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  period: z.string(),
  description: z.string(),
  referenceNumber: z.string().optional(),
  lines: z.array(JournalLineSchema).min(2),
  totalDebit: z.number(),
  totalCredit: z.number(),
  /** Must equal true for a balanced entry. */
  isBalanced: z.boolean(),
  supportingDocumentIds: z.array(z.string()).default([]),
  policyBasis: z.string().optional(),
});
export type DraftedJournalEntry = z.infer<typeof DraftedJournalEntrySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Action recommendation
// ─────────────────────────────────────────────────────────────────────────────

export const ActionRecommendationSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  taskId: z.string().uuid(),
  agentId: z.string(),
  actionType: ActionTypeSchema,
  status: ActionStatusSchema,
  /** Short imperative label shown in UI ("Post Q3 Accrual — Marketing"). */
  title: z.string(),
  rationale: z.string(),
  /** Agent confidence that this action is correct, 0–1. */
  confidence: z.number().min(0).max(1),
  /** Whether a formal approval step is required before execution. */
  requiresApproval: z.boolean().default(true),
  /** ID of the approval step, if created. */
  approvalStepId: z.string().uuid().optional(),
  /** For journal entry actions: the drafted entry. */
  draftedJournalEntry: DraftedJournalEntrySchema.optional(),
  /** For text-based actions: the drafted text (email, notice, memo). */
  draftedText: z.string().optional(),
  /** Dollar amount at stake, for materiality UI display. */
  amountUsd: z.number().optional(),
  /** Accounts affected. */
  accounts: z.array(z.string()).default([]),
  /** IDs of evidence items (chunks, metrics) that justify this action. */
  evidenceIds: z.array(z.string()).default([]),
  /** Policy references that mandate or support this action. */
  policyReferences: z.array(z.string()).default([]),
  /** ISO 8601 deadline by which action should be executed. */
  dueDate: z.string().datetime().optional(),
  approvedBy: z.string().nullable(),
  approvedAt: z.string().datetime().nullable(),
  executedBy: z.string().nullable(),
  executedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ActionRecommendation = z.infer<typeof ActionRecommendationSchema>;
