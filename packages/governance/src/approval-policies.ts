import { z } from "zod";

export const ApprovalPolicySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  resourceType: z.enum(["metric", "document", "workflow", "close_task", "policy"]),
  trigger: z.object({
    condition: z.string(),
    threshold: z.number().optional(),
    currency: z.string().optional(),
  }),
  requiredApprovers: z.number().int().min(1),
  approverRoles: z.array(z.string()),
  escalationAfterHours: z.number().optional(),
  autoApproveIfNoResponse: z.boolean().default(false),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type ApprovalPolicy = z.infer<typeof ApprovalPolicySchema>;

export const DEFAULT_APPROVAL_POLICIES: ApprovalPolicy[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    name: "Metric Value Override",
    resourceType: "metric",
    trigger: {
      condition: "variance_pct > 0.05",
      threshold: 5,
    },
    requiredApprovers: 2,
    approverRoles: ["controller", "cfo"],
    escalationAfterHours: 24,
    autoApproveIfNoResponse: false,
    isActive: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    name: "Close Task Sign-off",
    resourceType: "close_task",
    trigger: {
      condition: "priority IN ('high', 'critical')",
    },
    requiredApprovers: 1,
    approverRoles: ["controller", "cfo"],
    escalationAfterHours: 48,
    autoApproveIfNoResponse: false,
    isActive: true,
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    name: "Large Document Upload",
    resourceType: "document",
    trigger: {
      condition: "size_bytes > 10485760",
    },
    requiredApprovers: 1,
    approverRoles: ["controller"],
    escalationAfterHours: 12,
    autoApproveIfNoResponse: false,
    isActive: true,
  },
];
