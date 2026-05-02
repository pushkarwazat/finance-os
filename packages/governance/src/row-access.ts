import { z } from "zod";
import { RoleSchema } from "@financeos/shared";

export const RowScopeSchema = z.enum([
  "own_entity",
  "all_entities",
  "specified_entities",
  "own_department",
  "own_cost_center",
]);

export const RowAccessPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  resourceType: z.enum(["metric", "document", "workflow", "close_task", "audit_event"]),
  filterField: z.string(),
  allowedRoles: z.array(RoleSchema),
  scope: RowScopeSchema,
  specifiedEntities: z.array(z.string()).optional(),
  denyRoles: z.array(RoleSchema).default([]),
  isActive: z.boolean().default(true),
  effectiveFrom: z.string().datetime(),
  effectiveTo: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type RowAccessPolicy = z.infer<typeof RowAccessPolicySchema>;

export const DEFAULT_ROW_ACCESS_POLICIES: RowAccessPolicy[] = [
  {
    id: "ra000001-0000-0000-0000-000000000001",
    name: "Analyst — Own Cost Center Only",
    description: "Analysts can only read metrics scoped to their assigned cost center.",
    resourceType: "metric",
    filterField: "cost_center_id",
    allowedRoles: ["analyst"],
    scope: "own_cost_center",
    denyRoles: [],
    isActive: true,
    effectiveFrom: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "ra000001-0000-0000-0000-000000000002",
    name: "Finance Manager — Own Department",
    description: "Finance managers see all data within their department.",
    resourceType: "metric",
    filterField: "department_id",
    allowedRoles: ["finance_manager"],
    scope: "own_department",
    denyRoles: [],
    isActive: true,
    effectiveFrom: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "ra000001-0000-0000-0000-000000000003",
    name: "Controller + CFO — All Entities",
    description: "Controller and CFO have cross-entity read access to all financial records.",
    resourceType: "metric",
    filterField: "legal_entity_id",
    allowedRoles: ["controller", "cfo", "admin"],
    scope: "all_entities",
    denyRoles: [],
    isActive: true,
    effectiveFrom: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "ra000001-0000-0000-0000-000000000004",
    name: "Auditor — All Entities Read-Only",
    description: "Auditors have cross-entity read access but cannot write or approve.",
    resourceType: "audit_event",
    filterField: "tenant_id",
    allowedRoles: ["auditor"],
    scope: "all_entities",
    denyRoles: [],
    isActive: true,
    effectiveFrom: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "ra000001-0000-0000-0000-000000000005",
    name: "Operator — Assigned Workflows Only",
    description: "Operators can only view and interact with workflows explicitly assigned to them.",
    resourceType: "workflow",
    filterField: "assigned_operator_id",
    allowedRoles: ["operator"],
    scope: "own_entity",
    denyRoles: [],
    isActive: true,
    effectiveFrom: "2025-01-01T00:00:00Z",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

export function evaluateRowAccess(
  role: string,
  resourceType: string,
  policies: RowAccessPolicy[]
): { allowed: boolean; scope: string; filterField: string | null; policy: string | null } {
  const matching = policies.filter(
    (p) => p.isActive && p.resourceType === resourceType && p.allowedRoles.includes(role as never)
  );
  if (matching.length === 0) {
    return { allowed: false, scope: "none", filterField: null, policy: null };
  }
  const widest = matching.sort((a, b) => {
    const order: Record<string, number> = { all_entities: 0, own_department: 1, own_cost_center: 2, own_entity: 3, specified_entities: 2 };
    return (order[a.scope] ?? 9) - (order[b.scope] ?? 9);
  })[0];
  return { allowed: true, scope: widest.scope, filterField: widest.filterField, policy: widest.id };
}
