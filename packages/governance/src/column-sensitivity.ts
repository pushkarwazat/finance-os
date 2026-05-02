import { z } from "zod";
import { RoleSchema } from "@financeos/shared";

export const SensitivityLevelSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
  "top_secret",
]);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

export const PiiCategorySchema = z.enum([
  "none",
  "financial",
  "personal",
  "compensation",
  "strategic",
  "legal",
]);
export type PiiCategory = z.infer<typeof PiiCategorySchema>;

export const MaskingStrategySchema = z.enum([
  "none",
  "partial_mask",
  "full_mask",
  "hash",
  "redact",
  "tokenize",
]);

export const ColumnSensitivityTagSchema = z.object({
  id: z.string().uuid(),
  dataSource: z.string(),
  columnName: z.string(),
  displayLabel: z.string(),
  sensitivityLevel: SensitivityLevelSchema,
  piiCategory: PiiCategorySchema,
  requiredRoles: z.array(RoleSchema),
  maskingStrategy: MaskingStrategySchema,
  regulatoryBasis: z.array(z.string()).default([]),
  aiPromptExposureAllowed: z.boolean().default(true),
  requiresAuditLog: z.boolean().default(false),
  notes: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ColumnSensitivityTag = z.infer<typeof ColumnSensitivityTagSchema>;

export const COLUMN_SENSITIVITY_TAGS: ColumnSensitivityTag[] = [
  {
    id: "cs000001-0000-0000-0000-000000000001",
    dataSource: "metrics",
    columnName: "value",
    displayLabel: "Metric Value",
    sensitivityLevel: "confidential",
    piiCategory: "financial",
    requiredRoles: ["analyst", "finance_manager", "controller", "cfo", "auditor", "admin"],
    maskingStrategy: "none",
    regulatoryBasis: ["SOX", "GAAP"],
    aiPromptExposureAllowed: true,
    requiresAuditLog: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "cs000001-0000-0000-0000-000000000002",
    dataSource: "metrics",
    columnName: "variance",
    displayLabel: "Budget Variance",
    sensitivityLevel: "confidential",
    piiCategory: "financial",
    requiredRoles: ["controller", "cfo", "auditor", "admin"],
    maskingStrategy: "none",
    regulatoryBasis: ["SOX"],
    aiPromptExposureAllowed: true,
    requiresAuditLog: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "cs000001-0000-0000-0000-000000000003",
    dataSource: "documents",
    columnName: "content",
    displayLabel: "Document Content",
    sensitivityLevel: "restricted",
    piiCategory: "legal",
    requiredRoles: ["controller", "cfo", "auditor", "admin"],
    maskingStrategy: "redact",
    regulatoryBasis: ["SOX", "GDPR", "SEC"],
    aiPromptExposureAllowed: false,
    requiresAuditLog: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "cs000001-0000-0000-0000-000000000004",
    dataSource: "users",
    columnName: "salary",
    displayLabel: "Employee Salary",
    sensitivityLevel: "top_secret",
    piiCategory: "compensation",
    requiredRoles: ["cfo", "admin"],
    maskingStrategy: "full_mask",
    regulatoryBasis: ["GDPR", "CCPA"],
    aiPromptExposureAllowed: false,
    requiresAuditLog: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "cs000001-0000-0000-0000-000000000005",
    dataSource: "forecasts",
    columnName: "projected_value",
    displayLabel: "Forecast Value",
    sensitivityLevel: "restricted",
    piiCategory: "strategic",
    requiredRoles: ["controller", "cfo", "admin"],
    maskingStrategy: "none",
    regulatoryBasis: ["SEC", "SOX"],
    aiPromptExposureAllowed: true,
    requiresAuditLog: true,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "cs000001-0000-0000-0000-000000000006",
    dataSource: "metrics",
    columnName: "name",
    displayLabel: "Metric Name",
    sensitivityLevel: "internal",
    piiCategory: "none",
    requiredRoles: ["viewer", "analyst", "finance_manager", "operator", "controller", "cfo", "auditor", "admin"],
    maskingStrategy: "none",
    regulatoryBasis: [],
    aiPromptExposureAllowed: true,
    requiresAuditLog: false,
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  },
];

export function canAccessColumn(role: string, tag: ColumnSensitivityTag): boolean {
  return tag.requiredRoles.includes(role as never);
}

export function getTagsBySensitivity(level: SensitivityLevel, tags: ColumnSensitivityTag[]) {
  return tags.filter((t) => t.sensitivityLevel === level);
}
