import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Workflow types
// ─────────────────────────────────────────────────────────────────────────────

export const WorkflowTypeSchema = z.enum([
  "variance_analysis",
  "reconciliation",
  "close_management",
  "ar_collections",
  "ap_invoice_research",
  "policy_compliance",
  "budget_management",
  "treasury_management",
  "tax_provision",
  "consolidation",
  "covenant_monitoring",
]);
export type WorkflowType = z.infer<typeof WorkflowTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Per-workflow state enumerations
// ─────────────────────────────────────────────────────────────────────────────

export const VarianceAnalystStateSchema = z.enum([
  "idle",
  "fetching_actuals",
  "fetching_budget",
  "computing_variances",
  "retrieving_context",
  "drafting_commentary",
  "awaiting_approval",
  "approved",
  "rejected",
  "escalated",
  "exception",
  "completed",
  "cancelled",
]);
export type VarianceAnalystState = z.infer<typeof VarianceAnalystStateSchema>;

export const ReconciliationStateSchema = z.enum([
  "idle",
  "loading_gl_items",
  "loading_subledger_items",
  "matching_items",
  "identifying_breaks",
  "generating_recommendations",
  "awaiting_approval",
  "approved",
  "rejected",
  "escalated",
  "exception",
  "completed",
  "cancelled",
]);
export type ReconciliationState = z.infer<typeof ReconciliationStateSchema>;

export const CloseManagementStateSchema = z.enum([
  "idle",
  "loading_checklist",
  "checking_dependencies",
  "validating_entries",
  "requesting_sign_offs",
  "sign_off_required",
  "awaiting_approval",
  "approved",
  "rejected",
  "escalated",
  "exception",
  "completed",
  "cancelled",
]);
export type CloseManagementState = z.infer<typeof CloseManagementStateSchema>;

export const ARCollectionsStateSchema = z.enum([
  "idle",
  "loading_aging_report",
  "classifying_risk",
  "retrieving_customer_context",
  "drafting_actions",
  "awaiting_approval",
  "approved",
  "rejected",
  "escalated",
  "exception",
  "completed",
  "cancelled",
]);
export type ARCollectionsState = z.infer<typeof ARCollectionsStateSchema>;

export const APInvoiceResearchStateSchema = z.enum([
  "idle",
  "loading_invoice",
  "searching_documents",
  "matching_purchase_order",
  "three_way_match",
  "reconciling_discrepancies",
  "drafting_memo",
  "awaiting_approval",
  "approved",
  "rejected",
  "escalated",
  "exception",
  "completed",
  "cancelled",
]);
export type APInvoiceResearchState = z.infer<typeof APInvoiceResearchStateSchema>;

export const PolicyComplianceStateSchema = z.enum([
  "idle",
  "loading_document",
  "extracting_requirements",
  "checking_compliance",
  "flagging_issues",
  "drafting_findings_memo",
  "awaiting_approval",
  "approved",
  "rejected",
  "escalated",
  "exception",
  "completed",
  "cancelled",
]);
export type PolicyComplianceState = z.infer<typeof PolicyComplianceStateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Generic workflow state (union over all agent states)
// ─────────────────────────────────────────────────────────────────────────────

export const WorkflowStateSchema = z.union([
  VarianceAnalystStateSchema,
  ReconciliationStateSchema,
  CloseManagementStateSchema,
  ARCollectionsStateSchema,
  APInvoiceResearchStateSchema,
  PolicyComplianceStateSchema,
]);
export type WorkflowState = z.infer<typeof WorkflowStateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State transition — one hop in the state machine
// ─────────────────────────────────────────────────────────────────────────────

export const StateTransitionSchema = z.object({
  fromState: z.string(),
  toState: z.string(),
  trigger: z.string(),
  /** ISO 8601 datetime when the transition occurred. */
  occurredAt: z.string().datetime(),
  /** User or system actor that caused the transition. */
  actor: z.string(),
  note: z.string().optional(),
});
export type StateTransition = z.infer<typeof StateTransitionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State machine definition (static, per workflow type)
// ─────────────────────────────────────────────────────────────────────────────

export const StateMachineTransitionDefSchema = z.object({
  from: z.string(),
  to: z.string(),
  trigger: z.string(),
  description: z.string(),
  /** Whether a human must explicitly trigger this transition. */
  requiresHuman: z.boolean().default(false),
  /** Whether approval must be granted before this transition can occur. */
  requiresApproval: z.boolean().default(false),
});
export type StateMachineTransitionDef = z.infer<typeof StateMachineTransitionDefSchema>;

export const StateMachineDefinitionSchema = z.object({
  workflowType: WorkflowTypeSchema,
  initialState: z.string(),
  terminalStates: z.array(z.string()),
  /** States in which workflow execution is blocked waiting for human input. */
  humanGatedStates: z.array(z.string()),
  transitions: z.array(StateMachineTransitionDefSchema),
});
export type StateMachineDefinition = z.infer<typeof StateMachineDefinitionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Audit event — every state transition and significant action is logged
// ─────────────────────────────────────────────────────────────────────────────

export const AuditEventTypeSchema = z.enum([
  "workflow_started",
  "state_transition",
  "tool_called",
  "tool_succeeded",
  "tool_failed",
  "action_drafted",
  "action_approved",
  "action_rejected",
  "action_executed",
  "approval_requested",
  "approval_granted",
  "approval_denied",
  "exception_raised",
  "exception_resolved",
  "exception_waived",
  "escalation_triggered",
  "human_handoff",
  "workflow_completed",
  "workflow_cancelled",
  "workflow_failed",
]);
export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

export const WorkflowAuditEventSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  eventType: AuditEventTypeSchema,
  actor: z.string(),
  summary: z.string(),
  detail: z.record(z.string(), z.unknown()).default({}),
  /** IDs of evidence items referenced by this event. */
  evidenceIds: z.array(z.string()).default([]),
  occurredAt: z.string().datetime(),
});
export type WorkflowAuditEvent = z.infer<typeof WorkflowAuditEventSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Workflow run — the live execution record
// ─────────────────────────────────────────────────────────────────────────────

export const WorkflowRunStatusSchema = z.enum([
  "queued",
  "running",
  "awaiting_human",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
]);
export type WorkflowRunStatus = z.infer<typeof WorkflowRunStatusSchema>;

export const WorkflowRunSchema = z.object({
  id: z.string().uuid(),
  workflowType: WorkflowTypeSchema,
  agentId: z.string(),
  /** Short human-readable label ("Q3 FY2025 Variance Analysis"). */
  title: z.string(),
  status: WorkflowRunStatusSchema,
  /** Current state machine state. */
  currentState: z.string(),
  /** Valid transitions from the current state. */
  availableTransitions: z.array(z.string()),
  /** Full state history. */
  stateHistory: z.array(StateTransitionSchema),
  /** Ordered task IDs for this run. */
  taskIds: z.array(z.string().uuid()).default([]),
  /** IDs of all tool calls made. */
  toolCallIds: z.array(z.string().uuid()).default([]),
  /** IDs of approval steps required. */
  approvalStepIds: z.array(z.string().uuid()).default([]),
  /** IDs of exceptions raised. */
  exceptionIds: z.array(z.string().uuid()).default([]),
  /** IDs of action recommendations produced. */
  actionIds: z.array(z.string().uuid()).default([]),
  /** IDs of explanations produced. */
  explanationIds: z.array(z.string().uuid()).default([]),
  /** Full audit trail for this run. */
  auditTrail: z.array(WorkflowAuditEventSchema),
  /** Whether the workflow is blocked waiting for human input. */
  awaitingHuman: z.boolean().default(false),
  humanHandoffReason: z.string().optional(),
  /** Tenant context. */
  tenantId: z.string(),
  /** User who initiated the run. */
  requestedBy: z.string(),
  /** Fiscal period (e.g. "Q3 FY2025"). */
  fiscalPeriod: z.string().optional(),
  /** Free-form input parameters for the run. */
  inputPayload: z.record(z.string(), z.unknown()),
  /** Final output summary (populated on completion). */
  outputSummary: z.string().optional(),
  /** Overall confidence for the completed run, 0–1. */
  confidence: z.number().min(0).max(1).optional(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  failedAt: z.string().datetime().nullable(),
  failureReason: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;
