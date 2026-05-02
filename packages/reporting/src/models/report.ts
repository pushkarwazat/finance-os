import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ReportTypeSchema = z.enum([
  "daily_operating",
  "weekly_flash",
  "monthly_financial_package",
  "board_deck_data_pack",
  "budget_vs_actual",
  "department_spend",
  "margin_waterfall",
  "revenue_bridge",
  "cash_flow_summary",
  "collections",
  "ar_ap_aging",
  "unit_economics",
  "channel_profitability",
  "scenario_comparison",
  "executive_summary",
  "cost_optimization",
  "margin_expansion",
  "forecast_review_pack",
  "kpi_scorecard",
  "monthly_business_review",
]);
export type ReportType = z.infer<typeof ReportTypeSchema>;

export const ReportCadenceSchema = z.enum([
  "daily", "weekly", "bi_weekly", "monthly", "quarterly", "ad_hoc",
]);
export type ReportCadence = z.infer<typeof ReportCadenceSchema>;

export const ReportStatusSchema = z.enum([
  "draft", "under_review", "approved", "published", "archived", "superseded",
]);
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

export const ExportModeSchema = z.enum([
  "pdf", "ppt_json", "dashboard", "email_summary", "csv_extract",
]);
export type ExportMode = z.infer<typeof ExportModeSchema>;

export const ChartTypeSchema = z.enum([
  "bar", "stacked_bar", "line", "area", "waterfall", "bridge",
  "kpi_card", "sparkline", "heatmap", "treemap", "funnel",
  "scatter", "cohort", "table", "gauge",
]);
export type ChartType = z.infer<typeof ChartTypeSchema>;

export const SectionTypeSchema = z.enum([
  "kpi_summary", "variance_table", "chart_panel", "narrative_block",
  "commentary_block", "drilldown_table", "evidence_links", "approval_stamp",
]);
export type SectionType = z.infer<typeof SectionTypeSchema>;

// ─── Core Schemas ─────────────────────────────────────────────────────────────

export const ReportingPeriodSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  fiscalYear: z.number().int(),
  fiscalQuarter: z.number().int().min(1).max(4).optional(),
  fiscalMonth: z.number().int().min(1).max(12).optional(),
  startDate: z.string().date(),
  endDate: z.string().date(),
  isLocked: z.boolean().default(false),
  lockedBy: z.string().optional(),
  lockedAt: z.string().datetime().optional(),
});
export type ReportingPeriod = z.infer<typeof ReportingPeriodSchema>;

export const ReportAudienceSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  roles: z.array(z.string()),
  accessLevel: z.enum(["full", "summary_only", "restricted"]),
  confidentiality: z.enum(["public", "internal", "confidential", "board_only"]),
});
export type ReportAudience = z.infer<typeof ReportAudienceSchema>;

export const ReportFilterSetSchema = z.object({
  entityIds: z.array(z.string()).default([]),
  departments: z.array(z.string()).default([]),
  costCenters: z.array(z.string()).default([]),
  productLines: z.array(z.string()).default([]),
  channels: z.array(z.string()).default([]),
  currencies: z.array(z.string()).default([]),
  periodOverride: z.string().optional(),
});
export type ReportFilterSet = z.infer<typeof ReportFilterSetSchema>;

export const ReportDimensionGroupSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  dimensions: z.array(z.string()),
  allowedDrilldowns: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(false),
});
export type ReportDimensionGroup = z.infer<typeof ReportDimensionGroupSchema>;

export const ReportMetricBindingSchema = z.object({
  id: z.string().uuid(),
  metricSlug: z.string(),
  displayLabel: z.string(),
  format: z.enum(["currency", "percentage", "ratio", "count", "days"]),
  aggregation: z.enum(["sum", "avg", "last", "first", "min", "max"]),
  comparisonTarget: z.enum(["budget", "prior_period", "prior_year", "forecast", "none"]).default("budget"),
  materialityThresholdUsd: z.number().optional(),
  materialityThresholdPct: z.number().optional(),
  varianceThresholdPct: z.number().optional(),
  includeInNarrative: z.boolean().default(true),
  requiresCommentary: z.boolean().default(false),
  evidenceRequired: z.boolean().default(false),
});
export type ReportMetricBinding = z.infer<typeof ReportMetricBindingSchema>;

export const NarrativeBlockSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string(),
  position: z.number().int(),
  placeholder: z.string(),
  aiDraftText: z.string().optional(),
  humanReviewedText: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  isApproved: z.boolean().default(false),
  evidenceDocumentIds: z.array(z.string()).default([]),
  confidenceScore: z.number().min(0).max(1).optional(),
});
export type NarrativeBlock = z.infer<typeof NarrativeBlockSchema>;

export const CommentaryBlockSchema = z.object({
  id: z.string().uuid(),
  sectionId: z.string(),
  authorId: z.string(),
  authorRole: z.string(),
  text: z.string(),
  attachedMetricSlugs: z.array(z.string()).default([]),
  isAiGenerated: z.boolean().default(false),
  requiresHumanApproval: z.boolean().default(true),
  isApproved: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CommentaryBlock = z.infer<typeof CommentaryBlockSchema>;

export const ReportSectionSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string(),
  sectionType: SectionTypeSchema,
  title: z.string(),
  position: z.number().int(),
  metricBindings: z.array(ReportMetricBindingSchema).default([]),
  chartType: ChartTypeSchema.optional(),
  dimensionGroup: z.string().optional(),
  narrativeBlocks: z.array(NarrativeBlockSchema).default([]),
  commentaryBlocks: z.array(CommentaryBlockSchema).default([]),
  isOptional: z.boolean().default(false),
  accessLevel: z.enum(["all", "management", "board", "restricted"]).default("all"),
});
export type ReportSection = z.infer<typeof ReportSectionSchema>;

export const ReportTemplateSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  reportType: ReportTypeSchema,
  version: z.string(),
  description: z.string(),
  owner: z.string(),
  audience: ReportAudienceSchema,
  cadence: ReportCadenceSchema,
  sections: z.array(ReportSectionSchema).default([]),
  allowedFilters: ReportFilterSetSchema,
  approvedDimensions: z.array(z.string()).default([]),
  exportModes: z.array(ExportModeSchema).default(["dashboard"]),
  commentaryRequirements: z.enum(["none", "material_variances", "all_variances", "full"]).default("material_variances"),
  narrativePlaceholders: z.array(z.string()).default([]),
  materialityThresholdUsd: z.number().default(50_000),
  materialityThresholdPct: z.number().default(0.05),
  requiresApprovalBeforeDistribution: z.boolean().default(true),
  isVersioned: z.boolean().default(true),
  rowLevelAccessEnabled: z.boolean().default(false),
  lastRefreshedAt: z.string().datetime().optional(),
  lineageMetadata: z.record(z.string(), z.string()).default({}),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportTemplate = z.infer<typeof ReportTemplateSchema>;

export const ReportDistributionScheduleSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string(),
  cadence: ReportCadenceSchema,
  nextRunAt: z.string().datetime(),
  recipientRoles: z.array(z.string()),
  exportMode: ExportModeSchema,
  requiresApprovalBeforeSend: z.boolean().default(true),
  approvalPolicy: z.enum(["controller", "cfo", "dual_sign_off", "auto"]).default("controller"),
  isActive: z.boolean().default(true),
});
export type ReportDistributionSchedule = z.infer<typeof ReportDistributionScheduleSchema>;

export const BoardPackSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  fiscalPeriod: z.string(),
  preparedBy: z.string(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  status: ReportStatusSchema,
  confidentiality: z.enum(["board_only", "confidential", "internal"]).default("board_only"),
  sections: z.array(z.string()),
  executiveSummary: z.string().optional(),
  aiNarrativeDraft: z.string().optional(),
  exportReadyAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BoardPack = z.infer<typeof BoardPackSchema>;

export const ReportRunSchema = z.object({
  id: z.string().uuid(),
  templateId: z.string(),
  fiscalPeriod: z.string(),
  status: ReportStatusSchema,
  generatedBy: z.enum(["scheduled", "manual", "agent"]),
  requestedBy: z.string(),
  filters: ReportFilterSetSchema,
  narrativeApprovalStatus: z.enum(["pending", "approved", "rejected", "not_required"]),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  exportUrls: z.record(ExportModeSchema, z.string()).optional(),
  lastRefreshedAt: z.string().datetime(),
  lineageHash: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ReportRun = z.infer<typeof ReportRunSchema>;
