import { RbacPolicy, Role, Permission } from "@financeos/shared";

export const RBAC_POLICIES: Record<Role, RbacPolicy> = {
  viewer: {
    role: "viewer",
    description: "Read-only access to metrics, documents, and dashboards.",
    inheritsFrom: [],
    permissions: [
      "metrics:read",
      "documents:read",
      "workflows:read",
      "close:read",
      "governance:read",
      "evals:read",
      "ask:read",
    ],
  },
  analyst: {
    role: "analyst",
    description: "Can read and write metrics, documents, and close tasks. Cannot approve.",
    inheritsFrom: ["viewer"],
    permissions: [
      "metrics:read",
      "metrics:write",
      "documents:read",
      "documents:write",
      "workflows:read",
      "workflows:write",
      "close:read",
      "close:write",
      "governance:read",
      "governance:simulate",
      "evals:read",
      "evals:write",
      "ask:read",
      "ask:write",
    ],
  },
  finance_manager: {
    role: "finance_manager",
    description: "Manages finance team workflows within their department. Can review and approve low-value items.",
    inheritsFrom: ["analyst"],
    permissions: [
      "metrics:read",
      "metrics:write",
      "documents:read",
      "documents:write",
      "workflows:read",
      "workflows:write",
      "workflows:approve",
      "close:read",
      "close:write",
      "governance:read",
      "governance:simulate",
      "evals:read",
      "evals:write",
      "ask:read",
      "ask:write",
    ],
  },
  operator: {
    role: "operator",
    description: "Executes assigned workflow tasks. Read-only on financials; write access limited to workflow state.",
    inheritsFrom: ["viewer"],
    permissions: [
      "metrics:read",
      "documents:read",
      "workflows:read",
      "workflows:write",
      "close:read",
      "governance:read",
      "evals:read",
      "ask:read",
      "ask:write",
    ],
  },
  controller: {
    role: "controller",
    description:
      "Full access to financial operations. Can approve metrics and close tasks. Cannot manage policies.",
    inheritsFrom: ["finance_manager"],
    permissions: [
      "metrics:read",
      "metrics:write",
      "metrics:approve",
      "documents:read",
      "documents:write",
      "documents:delete",
      "workflows:read",
      "workflows:write",
      "workflows:approve",
      "close:read",
      "close:write",
      "close:approve",
      "governance:read",
      "governance:simulate",
      "evals:read",
      "evals:write",
      "ask:read",
      "ask:write",
    ],
  },
  cfo: {
    role: "cfo",
    description: "Full operational access plus governance write. Highest business authority.",
    inheritsFrom: ["controller"],
    permissions: [
      "metrics:read",
      "metrics:write",
      "metrics:approve",
      "documents:read",
      "documents:write",
      "documents:delete",
      "workflows:read",
      "workflows:write",
      "workflows:approve",
      "close:read",
      "close:write",
      "close:approve",
      "governance:read",
      "governance:write",
      "governance:simulate",
      "evals:read",
      "evals:write",
      "ask:read",
      "ask:write",
    ],
  },
  auditor: {
    role: "auditor",
    description:
      "Read-only plus audit trails. Can review governance but cannot mutate business data.",
    inheritsFrom: ["viewer"],
    permissions: [
      "metrics:read",
      "documents:read",
      "workflows:read",
      "close:read",
      "governance:read",
      "governance:simulate",
      "evals:read",
      "ask:read",
    ],
  },
  admin: {
    role: "admin",
    description: "Full platform access including user and policy administration.",
    inheritsFrom: ["cfo"],
    permissions: [
      "metrics:read",
      "metrics:write",
      "metrics:approve",
      "documents:read",
      "documents:write",
      "documents:delete",
      "workflows:read",
      "workflows:write",
      "workflows:approve",
      "close:read",
      "close:write",
      "close:approve",
      "governance:read",
      "governance:write",
      "governance:simulate",
      "evals:read",
      "evals:write",
      "ask:read",
      "ask:write",
      "admin:full",
    ],
  },
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const policy = RBAC_POLICIES[role];
  if (!policy) return false;
  return policy.permissions.includes(permission);
}

export function getPermissionsForRole(role: Role): Permission[] {
  const policy = RBAC_POLICIES[role];
  if (!policy) return [];
  return policy.permissions;
}

export function getRolesWithPermission(permission: Permission): Role[] {
  return (Object.keys(RBAC_POLICIES) as Role[]).filter((r) =>
    RBAC_POLICIES[r].permissions.includes(permission)
  );
}

export function getRoleHierarchy(role: Role): Role[] {
  const visited = new Set<Role>();
  const collect = (r: Role) => {
    if (visited.has(r)) return;
    visited.add(r);
    const policy = RBAC_POLICIES[r];
    if (policy) policy.inheritsFrom.forEach(collect);
  };
  collect(role);
  return Array.from(visited);
}
