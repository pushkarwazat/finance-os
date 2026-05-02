import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// AR Collections Agent
// Purpose: Analyse AR aging, classify customer risk, draft collection actions
//          (notices, calls, escalations), and recommend write-offs — all
//          subject to human approval before outreach or write-off is executed.
// ─────────────────────────────────────────────────────────────────────────────

export const ARCollectionsAgentConfigSchema = z.object({
  agentId: z.literal("ar-collections-v1"),
  displayName: z.literal("AR Collections Agent"),
  description: z.literal(
    "Analyses AR aging buckets, classifies customer payment risk, drafts collection communications and escalation actions, and recommends write-offs — all require human approval before execution."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Aging report as-of date"),
    agingBuckets: z
      .array(z.enum(["current", "1_30", "31_60", "61_90", "91_plus"]))
      .default(["31_60", "61_90", "91_plus"])
      .describe("Buckets to focus collections effort on"),
    minimumBalanceUsd: z.number().default(500).describe("Ignore balances below this amount"),
    includeCustomerContext: z.boolean().default(true).describe("Search contracts and RAG for customer history"),
  }),

  output: z.object({
    totalArBalance: z.number(),
    pastDueBalance: z.number(),
    dso: z.number().describe("Days Sales Outstanding"),
    riskClassification: z.record(
      z.string(),
      z.enum(["low", "medium", "high", "critical", "write_off_candidate"])
    ),
    draftedActions: z.array(z.string()).describe("ActionRecommendation IDs"),
    writeOffRecommendations: z.array(z.string()).describe("ActionRecommendation IDs for write-offs"),
    exceptions: z.array(z.string()),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_ar_aging",           // data_fetch: pull AR aging from GL/sub-ledger
    "classify_customer_risk",   // calculation: risk scoring model
    "rag_search",               // rag_retrieval: search contracts, payment history
    "draft_collection_notice",  // draft_generation: collection email/letter
    "draft_write_off_entry",    // draft_generation: write-off JE (requires approval)
    "write_audit_event",        // audit_write
  ]),

  confidenceThresholds: z.object({
    minToPublish: z.number().default(0.75),
    minToAutoApprove: z.number().default(0.98).describe("Write-offs never auto-approved"),
    abstainBelow: z.number().default(0.45),
  }),

  approvalRequirements: z.object({
    collectionNoticeRequiresApproval: z.boolean().default(true),
    writeOffRequiresApproval: z.boolean().default(true),
    writeOffAboveUsdRequiresCFO: z.number().default(10_000),
    requiredRoles: z.array(z.string()).default(["ar_manager", "controller"]),
  }),

  humanHandoffTriggers: z.array(z.string()).default([
    "write-off candidate > $50k",
    "customer in active contract negotiation",
    "disputed invoice — legal hold",
    "customer flagged for bankruptcy risk",
    "confidence < 0.45 on risk classification",
  ]),
});
export type ARCollectionsAgentConfig = z.infer<typeof ARCollectionsAgentConfigSchema>;

export const AR_COLLECTIONS_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "Write-off recommendation > $50k",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 3600,
  },
  {
    condition: "Customer balance 91+ days and > $10k",
    category: "threshold_breach",
    severity: "medium",
    notifyRoles: ["ar_manager", "controller"],
    autoEscalateAfterSeconds: 86400,
  },
  {
    condition: "Invoice under legal dispute",
    category: "policy_violation",
    severity: "high",
    notifyRoles: ["legal", "controller"],
    autoEscalateAfterSeconds: 1800,
  },
];

export const AR_COLLECTIONS_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "ar_collections",
  initialState: "idle",
  terminalStates: ["completed", "cancelled", "exception"],
  humanGatedStates: ["awaiting_approval", "escalated"],
  transitions: [
    { from: "idle",                       to: "loading_aging_report",         trigger: "start",                  description: "Load AR aging report",                       requiresHuman: false, requiresApproval: false },
    { from: "loading_aging_report",       to: "classifying_risk",             trigger: "aging_loaded",           description: "Aging loaded; classify customer risk",        requiresHuman: false, requiresApproval: false },
    { from: "classifying_risk",           to: "retrieving_customer_context",  trigger: "risk_classified",        description: "Risk classified; retrieve customer docs",     requiresHuman: false, requiresApproval: false },
    { from: "retrieving_customer_context",to: "drafting_actions",             trigger: "context_retrieved",      description: "Context retrieved; draft collection actions", requiresHuman: false, requiresApproval: false },
    { from: "drafting_actions",           to: "awaiting_approval",            trigger: "drafts_ready",           description: "Drafts ready; request AR manager approval",   requiresHuman: false, requiresApproval: true  },
    { from: "awaiting_approval",          to: "approved",                     trigger: "approved",               description: "Actions approved",                           requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",          to: "rejected",                     trigger: "rejected",               description: "Actions rejected; revise",                   requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",          to: "escalated",                    trigger: "escalate",               description: "Escalated to controller/CFO",                requiresHuman: true,  requiresApproval: false },
    { from: "approved",                   to: "completed",                    trigger: "actions_executed",       description: "Human executed approved actions",            requiresHuman: true,  requiresApproval: false },
    { from: "rejected",                   to: "drafting_actions",             trigger: "revise",                 description: "Agent revises collection strategy",          requiresHuman: false, requiresApproval: false },
    { from: "classifying_risk",           to: "exception",                    trigger: "exception_raised",       description: "Risk model failure",                         requiresHuman: false, requiresApproval: false },
  ],
};
