import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ForecastMethodSchema = z.enum([
  "rolling", "driver_based", "trend_based", "seasonal",
  "scenario_planning", "what_if", "budget_reforecast",
  "margin_forecast", "cash_forecast", "collections_forecast",
  "expense_forecast", "headcount_driven", "revenue_volume",
]);
export type ForecastMethod = z.infer<typeof ForecastMethodSchema>;

export const ForecastStatusSchema = z.enum([
  "draft", "in_review", "approved", "published", "superseded", "archived",
]);
export type ForecastStatus = z.infer<typeof ForecastStatusSchema>;

export const ForecastGrainSchema = z.enum([
  "daily", "weekly", "monthly", "quarterly", "annual",
]);
export type ForecastGrain = z.infer<typeof ForecastGrainSchema>;

export const DriverTypeSchema = z.enum([
  "pipeline", "close_rate", "avg_selling_price", "customer_count", "churn",
  "utilization", "payroll", "commission", "claim_rate", "enrollment_volume",
  "retention", "cost_per_lead", "service_cost_per_member", "vendor_spend",
  "fixed_cost", "variable_cost", "headcount", "volume", "price_mix",
]);
export type DriverType = z.infer<typeof DriverTypeSchema>;

export const ScenarioTypeSchema = z.enum([
  "baseline", "upside", "downside", "stress_test", "management_case",
  "board_case", "sensitivity",
]);
export type ScenarioType = z.infer<typeof ScenarioTypeSchema>;

// ─── Driver Models ────────────────────────────────────────────────────────────

export const DriverAssumptionSchema = z.object({
  id: z.string().uuid(),
  driverType: DriverTypeSchema,
  label: z.string(),
  value: z.number(),
  unit: z.enum(["absolute", "percentage", "multiplier", "count", "days"]),
  sensitivityLow: z.number().optional(),
  sensitivityHigh: z.number().optional(),
  rationale: z.string(),
  sourceRef: z.string().optional(),
  isLocked: z.boolean().default(false),
  lockedBy: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
});
export type DriverAssumption = z.infer<typeof DriverAssumptionSchema>;

export const ForecastDriverSchema = z.object({
  id: z.string().uuid(),
  forecastModelId: z.string(),
  metricSlug: z.string(),
  driverType: DriverTypeSchema,
  assumptions: z.array(DriverAssumptionSchema).default([]),
  contributionPct: z.number().min(0).max(1),
  isExplainabilityRequired: z.boolean().default(true),
  explainabilityText: z.string().optional(),
});
export type ForecastDriver = z.infer<typeof ForecastDriverSchema>;

// ─── Scenario Models ──────────────────────────────────────────────────────────

export const SensitivityCaseSchema = z.object({
  id: z.string().uuid(),
  scenarioSetId: z.string(),
  label: z.string(),
  driverOverrides: z.record(z.string(), z.number()),
  revenueImpactUsd: z.number(),
  ebitdaImpactUsd: z.number(),
  cashImpactUsd: z.number(),
  confidenceScore: z.number().min(0).max(1),
  notes: z.string().optional(),
});
export type SensitivityCase = z.infer<typeof SensitivityCaseSchema>;

export const ScenarioSchema = z.object({
  id: z.string().uuid(),
  scenarioSetId: z.string(),
  scenarioType: ScenarioTypeSchema,
  name: z.string(),
  description: z.string(),
  keyAssumptions: z.array(DriverAssumptionSchema).default([]),
  projectedRevenueUsd: z.number(),
  projectedEbitdaUsd: z.number(),
  projectedCashUsd: z.number(),
  projectedEbitdaMarginPct: z.number(),
  confidenceScore: z.number().min(0).max(1),
  probabilityWeight: z.number().min(0).max(1).optional(),
  sensitivityCases: z.array(SensitivityCaseSchema).default([]),
  narrativeSummary: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ScenarioSetSchema = z.object({
  id: z.string().uuid(),
  forecastModelId: z.string(),
  name: z.string(),
  fiscalPeriod: z.string(),
  baseline: ScenarioSchema.optional(),
  upside: ScenarioSchema.optional(),
  downside: ScenarioSchema.optional(),
  management: ScenarioSchema.optional(),
  scenarios: z.array(ScenarioSchema).default([]),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type ScenarioSet = z.infer<typeof ScenarioSetSchema>;

// ─── Override + Audit ─────────────────────────────────────────────────────────

export const OverrideReasonSchema = z.enum([
  "management_judgment", "market_intelligence", "customer_commitment",
  "risk_adjustment", "seasonal_correction", "one_time_item", "model_error_correction",
]);

export const ForecastOverrideSchema = z.object({
  id: z.string().uuid(),
  forecastRunId: z.string(),
  metricSlug: z.string(),
  period: z.string(),
  originalValue: z.number(),
  overrideValue: z.number(),
  overrideReason: OverrideReasonSchema,
  rationale: z.string(),
  overriddenBy: z.string(),
  overriddenAt: z.string().datetime(),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  requiresApproval: z.boolean().default(true),
  approvalStatus: z.enum(["pending", "approved", "rejected", "not_required"]).default("pending"),
});
export type ForecastOverride = z.infer<typeof ForecastOverrideSchema>;

// ─── Confidence + Seasonality ─────────────────────────────────────────────────

export const ConfidenceBandSchema = z.object({
  period: z.string(),
  low: z.number(),
  mid: z.number(),
  high: z.number(),
  confidenceLevel: z.number().min(0).max(1),
  driverSensitivity: z.record(z.string(), z.number()).default({}),
});
export type ConfidenceBand = z.infer<typeof ConfidenceBandSchema>;

export const SeasonalityProfileSchema = z.object({
  id: z.string().uuid(),
  metricSlug: z.string(),
  monthlyIndices: z.tuple([
    z.number(), z.number(), z.number(), z.number(),
    z.number(), z.number(), z.number(), z.number(),
    z.number(), z.number(), z.number(), z.number(),
  ]),
  yearsOfHistory: z.number().int(),
  lastUpdatedAt: z.string().datetime(),
});
export type SeasonalityProfile = z.infer<typeof SeasonalityProfileSchema>;

// ─── Forecast Core Models ─────────────────────────────────────────────────────

export const ForecastVersionSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string(),
  versionLabel: z.string(),
  method: ForecastMethodSchema,
  grain: ForecastGrainSchema,
  horizonMonths: z.number().int(),
  status: ForecastStatusSchema,
  createdAt: z.string().datetime(),
  supersededAt: z.string().datetime().optional(),
  supersededBy: z.string().optional(),
});
export type ForecastVersion = z.infer<typeof ForecastVersionSchema>;

export const ForecastModelSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  method: ForecastMethodSchema,
  grain: ForecastGrainSchema,
  horizonMonths: z.number().int(),
  entityId: z.string(),
  metricSlugs: z.array(z.string()),
  drivers: z.array(ForecastDriverSchema).default([]),
  scenarioSets: z.array(z.string()).default([]),
  activeVersionId: z.string().optional(),
  versions: z.array(ForecastVersionSchema).default([]),
  seasonalityProfiles: z.array(SeasonalityProfileSchema).default([]),
  confidenceBands: z.array(ConfidenceBandSchema).default([]),
  isExplainabilityRequired: z.boolean().default(true),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ForecastModel = z.infer<typeof ForecastModelSchema>;

export const ForecastRunSchema = z.object({
  id: z.string().uuid(),
  modelId: z.string(),
  versionId: z.string(),
  fiscalPeriod: z.string(),
  status: ForecastStatusSchema,
  triggeredBy: z.enum(["scheduled", "manual", "agent", "approval_loop"]),
  requestedBy: z.string(),
  overrides: z.array(ForecastOverrideSchema).default([]),
  outputMetrics: z.record(z.string(), z.array(ConfidenceBandSchema)).default({}),
  explainabilityBlocks: z.record(z.string(), z.string()).default({}),
  approvalStatus: z.enum(["pending", "approved", "rejected", "not_required"]).default("not_required"),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  exceptions: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ForecastRun = z.infer<typeof ForecastRunSchema>;

export const ForecastCommentarySchema = z.object({
  id: z.string().uuid(),
  forecastRunId: z.string(),
  metricSlug: z.string(),
  whatChanged: z.string(),
  whyItChanged: z.string(),
  soWhat: z.string(),
  whatToDoNext: z.string(),
  assumptions: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
  isAiGenerated: z.boolean().default(true),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  isApproved: z.boolean().default(false),
  createdAt: z.string().datetime(),
});
export type ForecastCommentary = z.infer<typeof ForecastCommentarySchema>;

export const ForecastExceptionSchema = z.object({
  id: z.string().uuid(),
  forecastRunId: z.string(),
  metricSlug: z.string(),
  exceptionType: z.enum([
    "confidence_below_threshold", "override_required", "driver_missing",
    "seasonality_outlier", "model_divergence", "approval_required",
  ]),
  severity: z.enum(["low", "medium", "high", "critical"]),
  description: z.string(),
  requiresHumanReview: z.boolean().default(true),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type ForecastException = z.infer<typeof ForecastExceptionSchema>;
