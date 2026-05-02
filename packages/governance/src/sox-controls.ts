import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// SOX Controls Catalog
// Covers IT General Controls (ITGC) and Key Financial Reporting Controls relevant
// to the FinanceOS platform. All controls reference a COSO component and a
// SOX section. Evidence collection is automated where possible.
// ─────────────────────────────────────────────────────────────────────────────

export const SoxControlCategorySchema = z.enum([
  "access_management",
  "change_management",
  "computer_operations",
  "data_integrity",
  "financial_reporting",
  "fraud_risk",
  "third_party_risk",
]);
export type SoxControlCategory = z.infer<typeof SoxControlCategorySchema>;

export const SoxControlFrequencySchema = z.enum([
  "continuous",
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annually",
  "per_event",
]);
export type SoxControlFrequency = z.infer<typeof SoxControlFrequencySchema>;

export const SoxControlSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: SoxControlCategorySchema,
  cosoBcomponent: z.enum([
    "control_environment",
    "risk_assessment",
    "control_activities",
    "information_communication",
    "monitoring",
  ]),
  keyControl: z.boolean().describe("True if failure could result in material misstatement"),
  automatedEvidence: z.boolean().describe("True if evidence collection is automated by FinanceOS"),
  testFrequency: SoxControlFrequencySchema,
  evidenceTypes: z.array(z.string()),
  ownerRole: z.string(),
  reviewerRole: z.string(),
  relatedModules: z.array(z.string()),
  remediationSlaHours: z.number().int(),
});
export type SoxControl = z.infer<typeof SoxControlSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Control catalog
// ─────────────────────────────────────────────────────────────────────────────

export const SOX_CONTROLS: SoxControl[] = [
  // ── Access Management ──────────────────────────────────────────────────────
  {
    id: "SOX-AM-001",
    name: "User Access Provisioning and Review",
    description:
      "All FinanceOS user accounts are provisioned via the Auth0 provider and mapped to RBAC roles. " +
      "Quarterly user access reviews are conducted by the Controller. Orphaned accounts are disabled within 48 hours of departure.",
    category: "access_management",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "quarterly",
    evidenceTypes: ["audit_event", "approval"],
    ownerRole: "admin",
    reviewerRole: "auditor",
    relatedModules: ["packages/governance/src/rbac.ts", "packages/adapters/src/auth-provider.ts"],
    remediationSlaHours: 48,
  },
  {
    id: "SOX-AM-002",
    name: "Privileged Access Controls",
    description:
      "Admin and CFO roles are restricted to named individuals. Any elevation to admin role requires CFO approval " +
      "and is logged with a time-bound justification. Admin sessions are logged in the audit trail.",
    category: "access_management",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "per_event",
    evidenceTypes: ["audit_event", "approval"],
    ownerRole: "admin",
    reviewerRole: "auditor",
    relatedModules: ["packages/governance/src/rbac.ts", "packages/governance/src/audit.ts"],
    remediationSlaHours: 4,
  },
  {
    id: "SOX-AM-003",
    name: "Segregation of Duties (SoD) Enforcement",
    description:
      "RBAC policies enforce SoD: the user who initiates a workflow cannot also approve it. " +
      "Analyst role cannot approve any workflow items. Approval and initiation roles are mutually exclusive.",
    category: "access_management",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "continuous",
    evidenceTypes: ["audit_event"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: [
      "packages/governance/src/rbac.ts",
      "packages/agents/src/workflow/approval-step.ts",
    ],
    remediationSlaHours: 2,
  },
  // ── Financial Reporting ───────────────────────────────────────────────────
  {
    id: "SOX-FR-001",
    name: "Period-End Close Sign-Off",
    description:
      "All period-end close workflows require Controller sign-off. Material adjustments require dual approval " +
      "(Controller + CFO). Sign-off events are recorded in the immutable audit log with timestamp and user identity.",
    category: "financial_reporting",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "monthly",
    evidenceTypes: ["approval", "audit_event", "document"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: [
      "packages/agents/src/agents/close-management.ts",
      "packages/governance/src/approval-policies.ts",
    ],
    remediationSlaHours: 24,
  },
  {
    id: "SOX-FR-002",
    name: "AI-Generated Output Review Gate",
    description:
      "All AI-generated outputs (variance narratives, close memos, budget commentary, consolidation adjustments) " +
      "are marked as drafts and require human review and approval before any downstream use. " +
      "No AI output bypasses the approval workflow.",
    category: "financial_reporting",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "per_event",
    evidenceTypes: ["approval", "audit_event"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: [
      "packages/agents/src/workflow/approval-step.ts",
      "packages/governance/src/approval-policies.ts",
    ],
    remediationSlaHours: 1,
  },
  {
    id: "SOX-FR-003",
    name: "Journal Entry Authorization",
    description:
      "All AI-suggested journal entries are drafts only. Material entries require dual approval. " +
      "The AI layer has no write access to the general ledger. Posting is performed exclusively by " +
      "human operators in the ERP system after approval.",
    category: "financial_reporting",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: false,
    testFrequency: "per_event",
    evidenceTypes: ["approval", "gl_export", "audit_event"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: [
      "packages/agents/src/agents/reconciliation.ts",
      "packages/agents/src/agents/consolidation.ts",
    ],
    remediationSlaHours: 2,
  },
  {
    id: "SOX-FR-004",
    name: "Budget Approval Workflow",
    description:
      "Annual budget and all revised forecasts require Controller + CFO dual approval before activation. " +
      "Budget version changes after activation require a new approval cycle.",
    category: "financial_reporting",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "annually",
    evidenceTypes: ["approval", "document", "audit_event"],
    ownerRole: "cfo",
    reviewerRole: "auditor",
    relatedModules: ["packages/agents/src/agents/budget-management.ts"],
    remediationSlaHours: 48,
  },
  {
    id: "SOX-FR-005",
    name: "Consolidation Elimination Authorization",
    description:
      "Intercompany elimination journal entries require Controller review and CFO sign-off. " +
      "Unresolved intercompany mismatches above $10K (TODO:CONFIRM) block consolidation completion.",
    category: "financial_reporting",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "monthly",
    evidenceTypes: ["approval", "audit_event", "document"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: ["packages/agents/src/agents/consolidation.ts"],
    remediationSlaHours: 24,
  },
  // ── Data Integrity ─────────────────────────────────────────────────────────
  {
    id: "SOX-DI-001",
    name: "Immutable Audit Trail",
    description:
      "All governance events, approvals, and AI-generated output reviews are recorded in an append-only " +
      "audit log. Log records cannot be modified or deleted by any application user. " +
      "Retention: 7 years (2555 days).",
    category: "data_integrity",
    cosoBcomponent: "information_communication",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "continuous",
    evidenceTypes: ["audit_event"],
    ownerRole: "admin",
    reviewerRole: "auditor",
    relatedModules: ["packages/governance/src/audit.ts"],
    remediationSlaHours: 1,
  },
  {
    id: "SOX-DI-002",
    name: "Column-Level Data Sensitivity Classification",
    description:
      "All data columns in the semantic warehouse are classified by sensitivity level (public, internal, " +
      "confidential, restricted). The AI layer enforces these classifications — restricted columns are " +
      "never returned in AI responses without explicit CFO authorisation.",
    category: "data_integrity",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "continuous",
    evidenceTypes: ["audit_event"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: ["packages/governance/src/column-sensitivity.ts"],
    remediationSlaHours: 1,
  },
  {
    id: "SOX-DI-003",
    name: "RAG Citation Transparency",
    description:
      "All AI answers that reference financial evidence must include source citations with document ID, " +
      "chunk ID, and relevance score. Answers without sufficient citations are blocked by the evidence " +
      "requirements policy.",
    category: "data_integrity",
    cosoBcomponent: "information_communication",
    keyControl: false,
    automatedEvidence: true,
    testFrequency: "continuous",
    evidenceTypes: ["rag_chunk", "audit_event"],
    ownerRole: "analyst",
    reviewerRole: "auditor",
    relatedModules: [
      "packages/governance/src/evidence-requirements.ts",
      "packages/rag/src/citations/",
    ],
    remediationSlaHours: 4,
  },
  // ── Change Management ──────────────────────────────────────────────────────
  {
    id: "SOX-CM-001",
    name: "Metric Definition Change Control",
    description:
      "Changes to semantic metric definitions (formula, aggregation, threshold) require peer review and " +
      "Controller approval. Changes are versioned and the prior definition is retained for audit purposes.",
    category: "change_management",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: false,
    testFrequency: "per_event",
    evidenceTypes: ["approval", "audit_event"],
    ownerRole: "controller",
    reviewerRole: "auditor",
    relatedModules: ["packages/semantic/src/metric-schema.ts"],
    remediationSlaHours: 24,
  },
  {
    id: "SOX-CM-002",
    name: "AI Model Version Control and Approval",
    description:
      "All LLM model versions used in production are registered in the model registry. Version promotions " +
      "require evaluation benchmark pass and CFO approval. Rollback is available within 48 hours.",
    category: "change_management",
    cosoBcomponent: "control_activities",
    keyControl: true,
    automatedEvidence: true,
    testFrequency: "per_event",
    evidenceTypes: ["approval", "audit_event"],
    ownerRole: "admin",
    reviewerRole: "auditor",
    relatedModules: [
      "packages/governance/src/model-registry.ts",
      "packages/governance/src/release.ts",
    ],
    remediationSlaHours: 4,
  },
];

export const SOX_CONTROLS_BY_ID = Object.fromEntries(SOX_CONTROLS.map((c) => [c.id, c]));

export function getKeyControls(): SoxControl[] {
  return SOX_CONTROLS.filter((c) => c.keyControl);
}

export function getControlsByCategory(category: SoxControlCategory): SoxControl[] {
  return SOX_CONTROLS.filter((c) => c.category === category);
}

export function getControlsForModule(moduleRef: string): SoxControl[] {
  return SOX_CONTROLS.filter((c) => c.relatedModules.some((m) => m.includes(moduleRef)));
}
