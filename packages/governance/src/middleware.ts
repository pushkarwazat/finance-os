import { z } from "zod";
import { RoleSchema, type Role, type Permission } from "@financeos/shared";
import { hasPermission } from "./rbac.js";
import { COLUMN_SENSITIVITY_TAGS } from "./column-sensitivity.js";
import { DEFAULT_ABSTENTION_POLICIES } from "./abstention-policy.js";

export const MockUserSchema = z.object({
  userId: z.string().uuid(),
  name: z.string(),
  email: z.string(),
  role: RoleSchema,
  tenantId: z.string(),
  costCenterId: z.string().optional(),
  departmentId: z.string().optional(),
  sessionId: z.string(),
});
export type MockUser = z.infer<typeof MockUserSchema>;

export const MOCK_USERS: MockUser[] = [
  {
    userId: "u1000000-0000-0000-0000-000000000001",
    name: "Sarah Chen",
    email: "sarah.chen@demo.financeos",
    role: "analyst",
    tenantId: "tenant-demo-001",
    costCenterId: "cc-eng-001",
    departmentId: "dept-engineering",
    sessionId: "sess-analyst-001",
  },
  {
    userId: "u1000000-0000-0000-0000-000000000002",
    name: "Maria Santos",
    email: "maria.santos@demo.financeos",
    role: "finance_manager",
    tenantId: "tenant-demo-001",
    departmentId: "dept-finance",
    sessionId: "sess-fm-001",
  },
  {
    userId: "u1000000-0000-0000-0000-000000000003",
    name: "J. Davies",
    email: "j.davies@demo.financeos",
    role: "controller",
    tenantId: "tenant-demo-001",
    sessionId: "sess-controller-001",
  },
  {
    userId: "u1000000-0000-0000-0000-000000000004",
    name: "James Okafor",
    email: "james.okafor@demo.financeos",
    role: "cfo",
    tenantId: "tenant-demo-001",
    sessionId: "sess-cfo-001",
  },
  {
    userId: "u1000000-0000-0000-0000-000000000005",
    name: "Alex Rivera",
    email: "alex.rivera@demo.financeos",
    role: "auditor",
    tenantId: "tenant-demo-001",
    sessionId: "sess-auditor-001",
  },
  {
    userId: "u1000000-0000-0000-0000-000000000006",
    name: "Priya Sharma",
    email: "priya.sharma@demo.financeos",
    role: "operator",
    tenantId: "tenant-demo-001",
    sessionId: "sess-operator-001",
  },
  {
    userId: "u1000000-0000-0000-0000-000000000007",
    name: "Tom Wallace",
    email: "tom.wallace@demo.financeos",
    role: "admin",
    tenantId: "tenant-demo-001",
    sessionId: "sess-admin-001",
  },
];

export const DEFAULT_SESSION_USER: MockUser = MOCK_USERS[2];

export interface PolicyCheckResult {
  allowed: boolean;
  outcome: "allowed" | "blocked" | "escalated" | "abstained";
  reason: string | null;
  appliedPolicies: string[];
  requiredRole: Role | null;
  sensitiveColumns: string[];
  abstentionTriggers: string[];
}

export function checkColumnAccess(role: Role, dataDomainsRequested: string[]): {
  blockedColumns: string[];
  maskedColumns: string[];
  sensitiveColumns: string[];
} {
  const relevant = COLUMN_SENSITIVITY_TAGS.filter((t) =>
    dataDomainsRequested.includes(t.dataSource)
  );
  const blocked: string[] = [];
  const masked: string[] = [];
  const sensitive: string[] = [];
  for (const tag of relevant) {
    if (!tag.requiredRoles.includes(role as never)) {
      if (tag.sensitivityLevel === "top_secret" || tag.sensitivityLevel === "restricted") {
        blocked.push(`${tag.dataSource}.${tag.columnName}`);
      } else {
        masked.push(`${tag.dataSource}.${tag.columnName}`);
      }
    }
    if (tag.sensitivityLevel !== "public" && tag.sensitivityLevel !== "internal") {
      sensitive.push(`${tag.dataSource}.${tag.columnName}`);
    }
  }
  return { blockedColumns: blocked, maskedColumns: masked, sensitiveColumns: sensitive };
}

export function checkAbstentionTriggers(
  role: Role,
  dataDomainsRequested: string[],
  context: {
    retrievalCount?: number;
    maxChunkScore?: number;
    changeAmountUsd?: number;
    changeAmountPct?: number;
    hasPendingApproval?: boolean;
    queryDomainScore?: number;
    evidenceConflictScore?: number;
  }
): { triggered: boolean; policy: string | null; reason: string | null; escalateTo: string | null } {
  for (const policy of DEFAULT_ABSTENTION_POLICIES) {
    if (!policy.isActive) continue;
    if (!policy.appliesToRoles.includes(role as never) && !policy.appliesToRoles.includes("*" as never)) continue;
    const domainMatch = policy.appliesToDataDomains.includes("*") ||
      policy.appliesToDataDomains.some((d) => dataDomainsRequested.includes(d));
    if (!domainMatch) continue;

    let triggered = false;
    if (policy.trigger === "insufficient_evidence" &&
      context.retrievalCount !== undefined && context.maxChunkScore !== undefined &&
      (context.retrievalCount < 2 || context.maxChunkScore < 0.6)) triggered = true;
    if (policy.trigger === "materiality_threshold" &&
      context.changeAmountPct !== undefined && Math.abs(context.changeAmountPct) > 0.05) triggered = true;
    if (policy.trigger === "pending_approval" && context.hasPendingApproval) triggered = true;
    if (policy.trigger === "out_of_scope" &&
      context.queryDomainScore !== undefined && context.queryDomainScore < 0.3) triggered = true;
    if (policy.trigger === "conflicting_evidence" &&
      context.evidenceConflictScore !== undefined && context.evidenceConflictScore > 0.4) triggered = true;

    if (triggered) {
      return {
        triggered: true,
        policy: policy.id,
        reason: policy.responseTemplate,
        escalateTo: policy.escalateTo ?? null,
      };
    }
  }
  return { triggered: false, policy: null, reason: null, escalateTo: null };
}

export function runPolicyCheck(
  role: Role,
  permission: Permission,
  dataDomainsRequested: string[],
  context: {
    retrievalCount?: number;
    maxChunkScore?: number;
    changeAmountUsd?: number;
    changeAmountPct?: number;
    hasPendingApproval?: boolean;
    queryDomainScore?: number;
    evidenceConflictScore?: number;
  } = {}
): PolicyCheckResult {
  const permissionGranted = hasPermission(role, permission);
  if (!permissionGranted) {
    return {
      allowed: false,
      outcome: "blocked",
      reason: `Role '${role}' does not have permission '${permission}'.`,
      appliedPolicies: ["rbac"],
      requiredRole: null,
      sensitiveColumns: [],
      abstentionTriggers: [],
    };
  }

  const columnCheck = checkColumnAccess(role, dataDomainsRequested);
  if (columnCheck.blockedColumns.length > 0) {
    return {
      allowed: false,
      outcome: "blocked",
      reason: `Access denied: columns [${columnCheck.blockedColumns.join(", ")}] are classified above role '${role}'.`,
      appliedPolicies: ["column_sensitivity"],
      requiredRole: null,
      sensitiveColumns: columnCheck.sensitiveColumns,
      abstentionTriggers: [],
    };
  }

  const abstention = checkAbstentionTriggers(role, dataDomainsRequested, context);
  if (abstention.triggered) {
    return {
      allowed: false,
      outcome: abstention.escalateTo ? "escalated" : "abstained",
      reason: abstention.reason,
      appliedPolicies: abstention.policy ? [abstention.policy] : [],
      requiredRole: abstention.escalateTo as Role ?? null,
      sensitiveColumns: columnCheck.sensitiveColumns,
      abstentionTriggers: [abstention.policy ?? "unknown"],
    };
  }

  return {
    allowed: true,
    outcome: "allowed",
    reason: null,
    appliedPolicies: ["rbac", "column_sensitivity", "abstention_policies"],
    requiredRole: null,
    sensitiveColumns: columnCheck.sensitiveColumns,
    abstentionTriggers: [],
  };
}
