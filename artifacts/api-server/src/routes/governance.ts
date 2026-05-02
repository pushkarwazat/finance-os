import { randomUUID } from "node:crypto";
import { Router } from "express";
import {
  ListApprovalsQueryParams,
  DecideApprovalParams,
  DecideApprovalBody,
  ListAuditEventsQueryParams,
} from "@workspace/api-zod";
import { MOCK_APPROVALS, MOCK_AUDIT_EVENTS, MOCK_POLICIES } from "../data/fixtures.js";
import {
  RBAC_POLICIES,
  hasPermission,
  getPermissionsForRole,
  getRolesWithPermission,
  getRoleHierarchy,
  DEFAULT_ROW_ACCESS_POLICIES,
  evaluateRowAccess,
  COLUMN_SENSITIVITY_TAGS,
  canAccessColumn,
  MOCK_PROMPT_LOGS,
  DEFAULT_ABSTENTION_POLICIES,
  EVIDENCE_REQUIREMENTS,
  MODEL_REGISTRY,
  ENVIRONMENT_CONFIGS,
  MOCK_RELEASES,
  MOCK_USERS,
  runPolicyCheck,
  SAMPLE_FINANCE_POLICIES,
} from "@financeos/governance";
import type { Role, Permission } from "@financeos/shared";

const router = Router();
const approvals = MOCK_APPROVALS.map((a) => ({ ...a }));
const auditEvents = [...MOCK_AUDIT_EVENTS];
const promptLogs = [...MOCK_PROMPT_LOGS];

// ── Approvals ────────────────────────────────────────────────────────────────

router.get("/governance/approvals", (req, res) => {
  const parsed = ListApprovalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const { status, resourceType, limit = 30 } = parsed.data;
  let filtered = approvals;
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (resourceType) filtered = filtered.filter((a) => a.resourceType === resourceType);
  res.json({ data: filtered.slice(0, limit), total: filtered.length });
});

router.post("/governance/approvals/:id/decide", (req, res) => {
  const paramsParsed = DecideApprovalParams.safeParse(req.params);
  const bodyParsed = DecideApprovalBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const idx = approvals.findIndex((a) => a.id === paramsParsed.data.id);
  if (idx === -1) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Approval not found" });
    return;
  }
  const approval = approvals[idx];
  approval.status = bodyParsed.data.decision === "approved" ? "approved" : "rejected";
  approval.updatedAt = new Date();
  approval.resolvedAt = new Date();
  approvals[idx] = approval;
  auditEvents.push({
    id: randomUUID(),
    actorId: "u1000000-0000-0000-0000-000000000004",
    actorName: "James Okafor",
    actorRole: "cfo",
    action: `approval.${bodyParsed.data.decision}`,
    resourceType: approval.resourceType,
    resourceId: approval.resourceId,
    resourceLabel: approval.resourceLabel,
    timestamp: new Date(),
    outcome: "success",
    details: { comment: bodyParsed.data.comment ?? null },
  });
  res.json(approval);
});

// ── Audit Log ────────────────────────────────────────────────────────────────

router.get("/governance/audit", (req, res) => {
  const parsed = ListAuditEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const { actorId, resourceType, action, since, limit = 50, offset = 0 } = parsed.data;
  let filtered = [...auditEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  if (actorId) filtered = filtered.filter((e) => e.actorId === actorId);
  if (resourceType) filtered = filtered.filter((e) => e.resourceType === resourceType);
  if (action) filtered = filtered.filter((e) => e.action.includes(action));
  if (since) filtered = filtered.filter((e) => new Date(e.timestamp) >= new Date(since));
  const total = filtered.length;
  res.json({ data: filtered.slice(offset, offset + limit), total });
});

// ── Policies ─────────────────────────────────────────────────────────────────

router.get("/governance/policies", (_req, res) => {
  const all = [...MOCK_POLICIES, ...SAMPLE_FINANCE_POLICIES];
  res.json({ data: all, total: all.length });
});

// ── RBAC ─────────────────────────────────────────────────────────────────────

router.get("/governance/rbac/roles", (_req, res) => {
  const roles = Object.values(RBAC_POLICIES).map((p) => ({
    ...p,
    permissionCount: p.permissions.length,
  }));
  res.json({ data: roles, total: roles.length });
});

router.get("/governance/rbac/check", (req, res) => {
  const { role, permission } = req.query as { role?: string; permission?: string };
  if (!role || !permission) {
    res.status(400).json({ error: "bad_request", message: "role and permission query params required" });
    return;
  }
  const allowed = hasPermission(role as Role, permission as Permission);
  const permissions = getPermissionsForRole(role as Role);
  const rolesWithPerm = getRolesWithPermission(permission as Permission);
  const hierarchy = getRoleHierarchy(role as Role);
  res.json({ role, permission, allowed, allPermissions: permissions, rolesWithPermission: rolesWithPerm, roleHierarchy: hierarchy });
});

router.get("/governance/rbac/permissions/:permission/roles", (req, res) => {
  const permission = req.params.permission as Permission;
  const roles = getRolesWithPermission(permission);
  res.json({ permission, roles });
});

// ── Row-Level Access ──────────────────────────────────────────────────────────

router.get("/governance/row-access", (req, res) => {
  const { role, resourceType } = req.query as { role?: string; resourceType?: string };
  let data = DEFAULT_ROW_ACCESS_POLICIES;
  if (role) data = data.filter((p) => p.allowedRoles.includes(role as never));
  if (resourceType) data = data.filter((p) => p.resourceType === resourceType);
  res.json({ data, total: data.length });
});

router.get("/governance/row-access/evaluate", (req, res) => {
  const { role, resourceType } = req.query as { role?: string; resourceType?: string };
  if (!role || !resourceType) {
    res.status(400).json({ error: "bad_request", message: "role and resourceType required" });
    return;
  }
  const result = evaluateRowAccess(role, resourceType, DEFAULT_ROW_ACCESS_POLICIES);
  res.json(result);
});

// ── Column Sensitivity ────────────────────────────────────────────────────────

router.get("/governance/column-sensitivity", (req, res) => {
  const { role, dataSource, sensitivityLevel } = req.query as {
    role?: string;
    dataSource?: string;
    sensitivityLevel?: string;
  };
  let data = COLUMN_SENSITIVITY_TAGS;
  if (dataSource) data = data.filter((t) => t.dataSource === dataSource);
  if (sensitivityLevel) data = data.filter((t) => t.sensitivityLevel === sensitivityLevel);
  const withAccess = data.map((t) => ({
    ...t,
    accessGranted: role ? canAccessColumn(role, t) : null,
  }));
  res.json({ data: withAccess, total: withAccess.length });
});

// ── Prompt Logs ───────────────────────────────────────────────────────────────

router.get("/governance/prompt-logs", (req, res) => {
  const { outcome, flaggedOnly, userId } = req.query as {
    outcome?: string;
    flaggedOnly?: string;
    userId?: string;
  };
  const limit = Number(req.query.limit ?? 50);
  const offset = Number(req.query.offset ?? 0);
  let data = [...promptLogs].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  if (outcome) data = data.filter((l) => l.outcome === outcome);
  if (flaggedOnly === "true") data = data.filter((l) => l.flaggedForReview);
  if (userId) data = data.filter((l) => l.userId === userId);
  const total = data.length;
  res.json({ data: data.slice(offset, offset + limit), total });
});

router.post("/governance/prompt-logs", (req, res) => {
  const entry = { id: randomUUID(), ...req.body, timestamp: new Date().toISOString() };
  promptLogs.push(entry);
  res.status(201).json(entry);
});

router.patch("/governance/prompt-logs/:id/review", (req, res) => {
  const idx = promptLogs.findIndex((l) => l.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "not_found" }); return; }
  promptLogs[idx] = {
    ...promptLogs[idx],
    flaggedForReview: req.body.flaggedForReview ?? promptLogs[idx].flaggedForReview,
    reviewNote: req.body.reviewNote ?? promptLogs[idx].reviewNote,
    reviewedBy: req.body.reviewedBy,
    reviewedAt: new Date().toISOString(),
  };
  res.json(promptLogs[idx]);
});

// ── Abstention Policies ───────────────────────────────────────────────────────

router.get("/governance/abstention-policies", (req, res) => {
  const { active } = req.query as { active?: string };
  let data = DEFAULT_ABSTENTION_POLICIES;
  if (active === "true") data = data.filter((p) => p.isActive);
  res.json({ data, total: data.length });
});

// ── Evidence Requirements ─────────────────────────────────────────────────────

router.get("/governance/evidence-requirements", (req, res) => {
  const { action, role } = req.query as { action?: string; role?: string };
  let data = EVIDENCE_REQUIREMENTS;
  if (action) data = data.filter((r) => r.appliesToAction.includes(action));
  if (role) data = data.filter((r) => r.appliesToRoles.includes(role as never));
  res.json({ data, total: data.length });
});

// ── Model Registry ────────────────────────────────────────────────────────────

router.get("/governance/model-registry", (req, res) => {
  const { approvedOnly, provider } = req.query as { approvedOnly?: string; provider?: string };
  let data = MODEL_REGISTRY;
  if (approvedOnly === "true") data = data.filter((m) => m.approvedForProduction);
  if (provider) data = data.filter((m) => m.provider === provider);
  res.json({ data, total: data.length });
});

// ── Environment Config ────────────────────────────────────────────────────────

router.get("/governance/environment", (req, res) => {
  const { env } = req.query as { env?: string };
  let data = ENVIRONMENT_CONFIGS;
  if (env) data = data.filter((c) => c.environment === env);
  res.json({ data, total: data.length });
});

// ── Releases ──────────────────────────────────────────────────────────────────

router.get("/governance/releases", (req, res) => {
  const { env, status } = req.query as { env?: string; status?: string };
  let data = [...MOCK_RELEASES].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  if (env) data = data.filter((r) => r.environment === env);
  if (status) data = data.filter((r) => r.status === status);
  res.json({ data, total: data.length });
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get("/governance/users", (_req, res) => {
  const safe = MOCK_USERS.map(({ userId, name, email, role, tenantId, departmentId, costCenterId }) => ({
    userId, name, email, role, tenantId, departmentId, costCenterId,
  }));
  res.json({ data: safe, total: safe.length });
});

// ── Policy Simulator ──────────────────────────────────────────────────────────

router.post("/governance/simulate", (req, res) => {
  const {
    role, permission, dataDomains = [],
    retrievalCount, maxChunkScore, changeAmountUsd, changeAmountPct,
    hasPendingApproval, queryDomainScore, evidenceConflictScore,
  } = req.body as {
    role: string; permission: string; dataDomains: string[];
    retrievalCount?: number; maxChunkScore?: number;
    changeAmountUsd?: number; changeAmountPct?: number;
    hasPendingApproval?: boolean; queryDomainScore?: number;
    evidenceConflictScore?: number;
  };
  if (!role || !permission) {
    res.status(400).json({ error: "bad_request", message: "role and permission required" });
    return;
  }
  const result = runPolicyCheck(role as Role, permission as Permission, dataDomains, {
    retrievalCount, maxChunkScore, changeAmountUsd, changeAmountPct,
    hasPendingApproval, queryDomainScore, evidenceConflictScore,
  });
  const matchingAbstentionPolicies = DEFAULT_ABSTENTION_POLICIES.filter(
    (p) => p.isActive && p.appliesToRoles.includes(role as never)
  );
  const matchingRowAccess = DEFAULT_ROW_ACCESS_POLICIES.filter(
    (p) => p.isActive && p.allowedRoles.includes(role as never)
  );
  const matchingEvidenceReqs = EVIDENCE_REQUIREMENTS.filter(
    (r) => r.isActive && r.appliesToRoles.includes(role as never)
  );
  const columnAccess = COLUMN_SENSITIVITY_TAGS.map((t) => ({
    column: `${t.dataSource}.${t.columnName}`,
    sensitivityLevel: t.sensitivityLevel,
    canAccess: canAccessColumn(role, t),
    maskingStrategy: t.maskingStrategy,
  })).filter((t) => dataDomains.length === 0 || dataDomains.some((d) => t.column.startsWith(d)));
  res.json({
    input: { role, permission, dataDomains },
    result,
    details: {
      rbacPolicy: RBAC_POLICIES[role as keyof typeof RBAC_POLICIES] ?? null,
      rowAccessPolicies: matchingRowAccess,
      abstentionPolicies: matchingAbstentionPolicies,
      evidenceRequirements: matchingEvidenceReqs,
      columnAccessSummary: columnAccess,
    },
  });
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get("/governance/dashboard", (_req, res) => {
  const now = Date.now();
  const last24h = now - 86400 * 1000;
  const activePolicies = [...MOCK_POLICIES, ...SAMPLE_FINANCE_POLICIES].filter((p) => p.status === "active").length;
  const pendingApprovals = approvals.filter((a) => a.status === "pending").length;
  const auditLast24h = auditEvents.filter((e) => new Date(e.timestamp).getTime() > last24h).length;
  const flaggedPrompts = promptLogs.filter((l) => l.flaggedForReview).length;
  const blockedPrompts = promptLogs.filter((l) => l.outcome === "blocked").length;
  const modelsRegistered = MODEL_REGISTRY.length;
  const modelsApproved = MODEL_REGISTRY.filter((m) => m.approvedForProduction).length;
  const openReleases = MOCK_RELEASES.filter((r) => r.status === "scheduled" || r.status === "pending").length;
  const totalPrompts = promptLogs.length;
  const answeredPrompts = promptLogs.filter((l) => l.outcome === "answered").length;
  const answerRate = totalPrompts > 0 ? Math.round((answeredPrompts / totalPrompts) * 100) : 0;
  res.json({
    activePolicies, pendingApprovals, auditLast24h,
    flaggedPrompts, blockedPrompts, modelsRegistered, modelsApproved,
    openReleases, answerRate, totalPrompts,
    auditByOutcome: {
      success: auditEvents.filter((e) => e.outcome === "success").length,
      failure: auditEvents.filter((e) => e.outcome === "failure").length,
      denied: auditEvents.filter((e) => e.outcome === "denied").length,
    },
    promptByOutcome: {
      answered: promptLogs.filter((l) => l.outcome === "answered").length,
      blocked: promptLogs.filter((l) => l.outcome === "blocked").length,
      escalated: promptLogs.filter((l) => l.outcome === "escalated").length,
      abstained: promptLogs.filter((l) => l.outcome === "abstained").length,
    },
    rolesCount: Object.keys(RBAC_POLICIES).length,
    abstentionPoliciesActive: DEFAULT_ABSTENTION_POLICIES.filter((p) => p.isActive).length,
    evidenceRequirementsActive: EVIDENCE_REQUIREMENTS.filter((r) => r.isActive).length,
    columnTagsTotal: COLUMN_SENSITIVITY_TAGS.length,
    rowAccessPoliciesActive: DEFAULT_ROW_ACCESS_POLICIES.filter((p) => p.isActive).length,
  });
});

export default router;
