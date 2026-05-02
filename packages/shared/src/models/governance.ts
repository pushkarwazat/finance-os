import { z } from "zod";

export const RoleSchema = z.enum([
  "viewer",
  "analyst",
  "finance_manager",
  "operator",
  "controller",
  "cfo",
  "auditor",
  "admin",
]);
export type Role = z.infer<typeof RoleSchema>;

export const PermissionSchema = z.enum([
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
]);
export type Permission = z.infer<typeof PermissionSchema>;

export const RbacPolicySchema = z.object({
  role: RoleSchema,
  permissions: z.array(PermissionSchema),
  description: z.string(),
  inheritsFrom: z.array(RoleSchema).default([]),
});
export type RbacPolicy = z.infer<typeof RbacPolicySchema>;

export const ApprovalStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
  "escalated",
  "expired",
]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalRequestSchema = z.object({
  id: z.string().uuid(),
  resourceType: z.enum(["metric", "document", "workflow", "close_task", "policy"]),
  resourceId: z.string().uuid(),
  resourceLabel: z.string(),
  requestedBy: z.string().uuid(),
  requesterName: z.string(),
  approvers: z.array(
    z.object({
      userId: z.string().uuid(),
      name: z.string(),
      role: RoleSchema,
      status: ApprovalStatusSchema,
      decidedAt: z.string().datetime().nullable(),
      comment: z.string().optional(),
    })
  ),
  requiredApprovals: z.number().int().min(1),
  status: ApprovalStatusSchema,
  dueDate: z.string().datetime().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().nullable(),
});
export type ApprovalRequest = z.infer<typeof ApprovalRequestSchema>;

export const AuditEventSchema = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid(),
  actorName: z.string(),
  actorRole: RoleSchema,
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string().uuid(),
  resourceLabel: z.string(),
  diff: z.record(z.string(), z.unknown()).optional(),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  sessionId: z.string().optional(),
  timestamp: z.string().datetime(),
  outcome: z.enum(["success", "failure", "denied"]),
  details: z.record(z.string(), z.unknown()).default({}),
});
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export const PolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  category: z.enum(["approval", "access", "retention", "classification", "disclosure"]),
  version: z.string(),
  effectiveDate: z.string().date(),
  expiryDate: z.string().date().optional(),
  status: z.enum(["draft", "active", "retired"]),
  rules: z.array(
    z.object({
      id: z.string().uuid(),
      condition: z.string(),
      action: z.string(),
      priority: z.number().int(),
    })
  ),
  ownerId: z.string().uuid(),
  ownerName: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Policy = z.infer<typeof PolicySchema>;
