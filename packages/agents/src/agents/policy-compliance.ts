import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Policy Compliance Agent
// Purpose: Given a document or transaction, extract applicable policy
//          requirements (ASC 606, IFRS 15, SOX, internal policies), check for
//          compliance, flag issues, and draft a findings memo. All findings
//          require controller review.
// ─────────────────────────────────────────────────────────────────────────────

export const PolicyComplianceAgentConfigSchema = z.object({
  agentId: z.literal("policy-compliance-v1"),
  displayName: z.literal("Policy Compliance Agent"),
  description: z.literal(
    "Extracts applicable policy requirements, checks documents or transactions against ASC 606 / IFRS 15 / SOX / internal policies, flags non-compliance issues, and drafts a findings memo requiring controller review."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    subjectType: z
      .enum(["document", "transaction", "contract", "journal_entry", "disclosure"])
      .describe("What is being checked"),
    subjectId: z.string().describe("ID of the document, transaction, etc."),
    frameworks: z
      .array(z.enum(["asc_606", "ifrs_15", "sox", "asc_842", "internal_policy", "all"]))
      .default(["asc_606", "sox", "internal_policy"])
      .describe("Policy frameworks to check against"),
    strictMode: z.boolean().default(false).describe("Treat warnings as failures"),
  }),

  output: z.object({
    overallStatus: z.enum(["compliant", "minor_issues", "material_issues", "non_compliant", "indeterminate"]),
    findings: z.array(
      z.object({
        findingId: z.string(),
        framework: z.string(),
        clause: z.string(),
        severity: z.enum(["critical", "high", "medium", "low", "info"]),
        description: z.string(),
        evidenceIds: z.array(z.string()),
        recommendedRemediationId: z.string().optional(),
      })
    ),
    findingsMemo: z.string(),
    exceptions: z.array(z.string()),
    recommendedActions: z.array(z.string()),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_subject",            // data_fetch: retrieve the document/transaction
    "rag_search",               // rag_retrieval: search policy documents
    "extract_requirements",     // calculation: extract applicable clauses
    "check_compliance",         // validation: compare subject against requirements
    "draft_findings_memo",      // draft_generation: compliance findings memo
    "write_audit_event",        // audit_write
  ]),

  confidenceThresholds: z.object({
    minToPublish: z.number().default(0.75),
    minToAutoApprove: z.number().default(0.99).describe("Compliance findings never auto-approved"),
    abstainBelow: z.number().default(0.50),
  }),

  approvalRequirements: z.object({
    findingsMemoRequiresControllerApproval: z.boolean().default(true),
    materialFindingsRequireCFOApproval: z.boolean().default(true),
    externalAuditNotificationThreshold: z.enum(["material_issues", "non_compliant"]).default("non_compliant"),
  }),

  humanHandoffTriggers: z.array(z.string()).default([
    "SOX control failure (any severity)",
    "ASC 606 revenue recognition issue > $50k",
    "non-compliance finding (critical or high)",
    "conflict between internal policy and GAAP",
    "confidence < 0.50 on compliance determination",
    "document contains MNPI",
  ]),
});
export type PolicyComplianceAgentConfig = z.infer<typeof PolicyComplianceAgentConfigSchema>;

export const POLICY_COMPLIANCE_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "Critical or high SOX control failure",
    category: "policy_violation",
    severity: "critical",
    notifyRoles: ["controller", "cfo", "audit_committee", "external_auditor"],
    autoEscalateAfterSeconds: 300,
  },
  {
    condition: "ASC 606 revenue recognition non-compliance > $50k",
    category: "policy_violation",
    severity: "high",
    notifyRoles: ["controller", "cfo", "fp_and_a"],
    autoEscalateAfterSeconds: 1800,
  },
  {
    condition: "Agent cannot determine compliance due to ambiguous policy language",
    category: "confidence_low",
    severity: "medium",
    notifyRoles: ["controller", "technical_accounting"],
    autoEscalateAfterSeconds: 3600,
  },
  {
    condition: "Document marked MNPI — access control check required",
    category: "access_control",
    severity: "high",
    notifyRoles: ["controller", "legal", "compliance"],
    autoEscalateAfterSeconds: 900,
  },
];

export const POLICY_COMPLIANCE_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "policy_compliance",
  initialState: "idle",
  terminalStates: ["completed", "cancelled", "exception"],
  humanGatedStates: ["awaiting_approval", "escalated"],
  transitions: [
    { from: "idle",                   to: "loading_document",         trigger: "start",                    description: "Load subject document or transaction",         requiresHuman: false, requiresApproval: false },
    { from: "loading_document",       to: "extracting_requirements",  trigger: "document_loaded",          description: "Document loaded; extract policy requirements", requiresHuman: false, requiresApproval: false },
    { from: "extracting_requirements",to: "checking_compliance",      trigger: "requirements_extracted",   description: "Requirements extracted; check compliance",     requiresHuman: false, requiresApproval: false },
    { from: "checking_compliance",    to: "flagging_issues",          trigger: "compliance_checked",       description: "Compliance checked; flag any issues",          requiresHuman: false, requiresApproval: false },
    { from: "flagging_issues",        to: "drafting_findings_memo",   trigger: "issues_flagged",           description: "Issues flagged; draft findings memo",          requiresHuman: false, requiresApproval: false },
    { from: "drafting_findings_memo", to: "awaiting_approval",        trigger: "memo_drafted",             description: "Memo drafted; request controller review",      requiresHuman: false, requiresApproval: true  },
    { from: "awaiting_approval",      to: "approved",                 trigger: "approved",                 description: "Controller reviewed and approved",             requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",      to: "rejected",                 trigger: "rejected",                 description: "Findings rejected; agent revises",             requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",      to: "escalated",                trigger: "escalate",                 description: "Escalated to CFO / audit committee",           requiresHuman: true,  requiresApproval: false },
    { from: "approved",               to: "completed",                trigger: "memo_published",           description: "Findings memo published",                      requiresHuman: true,  requiresApproval: false },
    { from: "rejected",               to: "drafting_findings_memo",   trigger: "revise",                   description: "Agent revises findings",                       requiresHuman: false, requiresApproval: false },
    { from: "checking_compliance",    to: "exception",                trigger: "exception_raised",         description: "Unrecoverable compliance check error",         requiresHuman: false, requiresApproval: false },
    { from: "extracting_requirements",to: "exception",                trigger: "exception_raised",         description: "Policy document not found in index",           requiresHuman: false, requiresApproval: false },
  ],
};
