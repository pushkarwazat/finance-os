import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Close Management Agent
// Purpose: Drive period-end close by checking task dependencies, validating
//          journal entries against policy, requesting sign-offs, and flagging
//          blockers. Never marks a period closed without full sign-off chain.
// ─────────────────────────────────────────────────────────────────────────────

export const CloseManagementAgentConfigSchema = z.object({
  agentId: z.literal("close-management-v1"),
  displayName: z.literal("Close Management Agent"),
  description: z.literal(
    "Drives the period-end close checklist: validates entries, tracks dependencies, collects sign-offs, and escalates blockers — never marks a period closed without complete sign-off."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    fiscalPeriod: z.string().describe("e.g. Sep-2025"),
    checklistTemplateId: z.string().default("standard_monthly_close"),
    strictMode: z.boolean().default(true).describe("Fail on any SOX control gap"),
  }),

  output: z.object({
    totalTasks: z.number().int(),
    completedTasks: z.number().int(),
    blockedTasks: z.number().int(),
    pendingSignOffs: z.number().int(),
    isCloseable: z.boolean(),
    blockerSummary: z.string(),
    signOffStatus: z.record(z.string(), z.enum(["pending", "complete", "overdue"])),
    exceptions: z.array(z.string()),
    recommendedActions: z.array(z.string()),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_close_checklist",    // data_fetch: retrieve close task list
    "check_task_dependencies",  // calculation: validate dependency graph
    "validate_journal_entries", // validation: policy & balance checks
    "request_sign_off",         // notification: send sign-off request
    "rag_search",               // rag_retrieval: search close memos, SOPs
    "draft_status_report",      // draft_generation: period-end status summary
    "write_audit_event",        // audit_write
  ]),

  confidenceThresholds: z.object({
    minToPublish: z.number().default(0.85),
    minToAutoApprove: z.number().default(0.99).describe("Close sign-off almost never auto-approved"),
    abstainBelow: z.number().default(0.60),
  }),

  approvalRequirements: z.object({
    closeSignOffRequiredFrom: z.array(z.string()).default(["controller", "cfo"]),
    soxControlSignOffRequired: z.boolean().default(true),
    externalAuditNotificationRequired: z.boolean().default(false),
  }),

  humanHandoffTriggers: z.array(z.string()).default([
    "any SOX ITGC control failing",
    "journal entry outside approved threshold",
    "sign-off SLA breached",
    "period cannot be closed due to open reconciliations",
    "management override requested",
  ]),
});
export type CloseManagementAgentConfig = z.infer<typeof CloseManagementAgentConfigSchema>;

export const CLOSE_MANAGEMENT_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "SOX control failure identified during close",
    category: "policy_violation",
    severity: "critical",
    notifyRoles: ["controller", "cfo", "audit_committee"],
    autoEscalateAfterSeconds: 300,
  },
  {
    condition: "Sign-off SLA exceeded by 24 hours",
    category: "approval_timeout",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 86400,
  },
  {
    condition: "Journal entry exceeds approved materiality limit",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 1800,
  },
];

export const CLOSE_MANAGEMENT_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "close_management",
  initialState: "idle",
  terminalStates: ["completed", "cancelled", "exception"],
  humanGatedStates: ["sign_off_required", "awaiting_approval", "escalated"],
  transitions: [
    { from: "idle",                  to: "loading_checklist",       trigger: "start",                  description: "Load close checklist for period",              requiresHuman: false, requiresApproval: false },
    { from: "loading_checklist",     to: "checking_dependencies",   trigger: "checklist_loaded",       description: "Checklist loaded; verify dependency graph",    requiresHuman: false, requiresApproval: false },
    { from: "checking_dependencies", to: "validating_entries",      trigger: "dependencies_checked",   description: "Dependencies OK; validate journal entries",    requiresHuman: false, requiresApproval: false },
    { from: "validating_entries",    to: "requesting_sign_offs",    trigger: "entries_validated",      description: "Entries valid; request sign-offs",             requiresHuman: false, requiresApproval: false },
    { from: "requesting_sign_offs",  to: "sign_off_required",       trigger: "sign_offs_requested",    description: "Sign-off requests sent; waiting for humans",   requiresHuman: false, requiresApproval: false },
    { from: "sign_off_required",     to: "awaiting_approval",       trigger: "all_sign_offs_received", description: "All sign-offs received; final approval",       requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_approval",     to: "approved",                trigger: "approved",               description: "CFO approved period close",                   requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",     to: "rejected",                trigger: "rejected",               description: "Period close rejected; return to validation",  requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",     to: "escalated",               trigger: "escalate",               description: "Escalated to audit committee",                 requiresHuman: true,  requiresApproval: false },
    { from: "approved",              to: "completed",               trigger: "period_closed",          description: "Period officially closed",                     requiresHuman: true,  requiresApproval: false },
    { from: "rejected",              to: "validating_entries",      trigger: "revise",                 description: "Return to validation",                         requiresHuman: false, requiresApproval: false },
    { from: "validating_entries",    to: "exception",               trigger: "exception_raised",       description: "SOX control failure — halt",                  requiresHuman: false, requiresApproval: false },
    { from: "checking_dependencies", to: "exception",               trigger: "exception_raised",       description: "Blocking dependency loop detected",            requiresHuman: false, requiresApproval: false },
  ],
};
