import { z } from "zod";
import { RoleSchema } from "@financeos/shared";

export const ReleaseStatusSchema = z.enum([
  "pending",
  "deployed",
  "rolled_back",
  "failed",
  "deprecated",
  "scheduled",
]);
export type ReleaseStatus = z.infer<typeof ReleaseStatusSchema>;

export const ReleaseTypeSchema = z.enum([
  "feature",
  "hotfix",
  "rollback",
  "config_change",
  "model_update",
  "policy_update",
  "security_patch",
]);

export const ChangeLogEntrySchema = z.object({
  type: z.enum(["added", "changed", "fixed", "removed", "security", "deprecated"]),
  description: z.string(),
  scope: z.string().optional(),
});

export const ReleaseApprovalSchema = z.object({
  approverName: z.string(),
  approverRole: RoleSchema,
  approvedAt: z.string().datetime(),
  comment: z.string().optional(),
});

export const ReleaseSchema = z.object({
  id: z.string().uuid(),
  version: z.string(),
  displayName: z.string(),
  description: z.string(),
  releaseType: ReleaseTypeSchema,
  status: ReleaseStatusSchema,
  environment: z.enum(["development", "staging", "production"]),
  scheduledAt: z.string().datetime().optional(),
  deployedAt: z.string().datetime().optional(),
  deployedBy: z.string().optional(),
  rolledBackAt: z.string().datetime().optional(),
  rolledBackBy: z.string().optional(),
  rollbackReason: z.string().optional(),
  rollbackTargetVersion: z.string().optional(),
  changeLog: z.array(ChangeLogEntrySchema),
  approvals: z.array(ReleaseApprovalSchema),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  affectedComponents: z.array(z.string()),
  testsPassed: z.boolean().optional(),
  createdAt: z.string().datetime(),
});
export type Release = z.infer<typeof ReleaseSchema>;

export const MOCK_RELEASES: Release[] = [
  {
    id: "rel000001-0000-0000-0000-000000000001",
    version: "2.4.0",
    displayName: "Workflow Agents GA",
    description: "General availability of 6 finance workflow automation agents with state machine execution.",
    releaseType: "feature",
    status: "deployed",
    environment: "production",
    deployedAt: "2025-09-15T10:00:00Z",
    deployedBy: "admin@financeos.demo",
    changeLog: [
      { type: "added", description: "6 finance workflow agents: Variance Analyst, Reconciliation, Close Management, AR Collections, AP Invoice Research, Policy Compliance", scope: "agents" },
      { type: "added", description: "Approval queue UI with multi-level sign-off", scope: "ui" },
      { type: "added", description: "Exception management with resolve/waive flow", scope: "ui" },
      { type: "added", description: "29-tool catalog with RBAC-gated tool execution", scope: "agents" },
      { type: "changed", description: "Agents page redesigned with run detail drawer and state machine viz", scope: "ui" },
    ],
    approvals: [
      { approverName: "J. Davies", approverRole: "controller", approvedAt: "2025-09-14T16:00:00Z", comment: "Reviewed agent schemas. Confirm no autonomous posting." },
      { approverName: "James Okafor", approverRole: "cfo", approvedAt: "2025-09-15T08:30:00Z", comment: "Approved for production." },
    ],
    riskLevel: "medium",
    affectedComponents: ["packages/agents", "artifacts/api-server", "artifacts/finance-os"],
    testsPassed: true,
    createdAt: "2025-09-12T00:00:00Z",
  },
  {
    id: "rel000001-0000-0000-0000-000000000002",
    version: "2.3.1",
    displayName: "RAG Retrieval Hotfix",
    description: "Fixed chunk scoring regression that caused policy compliance answers to return low-confidence results.",
    releaseType: "hotfix",
    status: "deployed",
    environment: "production",
    deployedAt: "2025-08-28T03:15:00Z",
    deployedBy: "admin@financeos.demo",
    changeLog: [
      { type: "fixed", description: "Chunk confidence scores incorrectly normalized — restored BM25 weight to 0.3", scope: "rag" },
      { type: "fixed", description: "Policy compliance agent abstaining on valid queries with score 0.61 (threshold was too high at 0.65)", scope: "agents" },
    ],
    approvals: [
      { approverName: "J. Davies", approverRole: "controller", approvedAt: "2025-08-28T02:50:00Z", comment: "Emergency hotfix approved." },
    ],
    riskLevel: "low",
    affectedComponents: ["packages/rag", "packages/agents"],
    testsPassed: true,
    createdAt: "2025-08-28T01:00:00Z",
  },
  {
    id: "rel000001-0000-0000-0000-000000000003",
    version: "2.3.0",
    displayName: "Eval Suite + Semantic Metrics",
    description: "25-case evaluation suite, YAML-driven semantic metric registry, and per-question confidence scoring.",
    releaseType: "feature",
    status: "deployed",
    environment: "production",
    deployedAt: "2025-08-01T09:00:00Z",
    deployedBy: "admin@financeos.demo",
    changeLog: [
      { type: "added", description: "25-case eval suite with automated grading", scope: "evals" },
      { type: "added", description: "YAML-driven semantic metric registry with 12 dimensions", scope: "semantic" },
      { type: "added", description: "Per-question confidence score and evidence citation display", scope: "ui" },
      { type: "changed", description: "Ask AI page updated with evidence panel", scope: "ui" },
    ],
    approvals: [
      { approverName: "James Okafor", approverRole: "cfo", approvedAt: "2025-07-31T17:00:00Z" },
    ],
    riskLevel: "low",
    affectedComponents: ["packages/rag", "packages/semantic", "artifacts/finance-os"],
    testsPassed: true,
    createdAt: "2025-07-28T00:00:00Z",
  },
  {
    id: "rel000001-0000-0000-0000-000000000004",
    version: "2.5.0",
    displayName: "Governance + Control Layer",
    description: "Enterprise governance layer: RBAC, row-level access, column sensitivity, prompt logging, policy simulator, model registry, environment config, release management.",
    releaseType: "feature",
    status: "scheduled",
    environment: "production",
    scheduledAt: "2025-10-15T10:00:00Z",
    changeLog: [
      { type: "added", description: "Row-level access policies for 7 roles", scope: "governance" },
      { type: "added", description: "Column sensitivity tagging with masking strategies", scope: "governance" },
      { type: "added", description: "Prompt and response audit log with outcome tracking", scope: "governance" },
      { type: "added", description: "Abstention policies for 6 trigger conditions", scope: "governance" },
      { type: "added", description: "Evidence requirement schemas for all agent actions", scope: "governance" },
      { type: "added", description: "AI model registry with production approval workflow", scope: "governance" },
      { type: "added", description: "Environment configuration management", scope: "governance" },
      { type: "added", description: "Governance dashboard with audit trail and policy simulator", scope: "ui" },
      { type: "added", description: "Mock security middleware with RBAC enforcement", scope: "api" },
      { type: "security", description: "Block compensation and strategic data exposure to analyst and below roles", scope: "governance" },
    ],
    approvals: [],
    riskLevel: "medium",
    affectedComponents: ["packages/governance", "artifacts/api-server", "artifacts/finance-os"],
    testsPassed: false,
    createdAt: "2025-10-01T00:00:00Z",
  },
];
