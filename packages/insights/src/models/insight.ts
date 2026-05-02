import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const InsightTypeSchema = z.enum([
  "anomaly", "trend_change", "driver_shift", "root_cause",
  "margin_leakage", "cost_growth", "pricing_opportunity",
  "mix_shift", "performance_outlier", "working_capital_opportunity",
  "spend_concentration", "operational_inefficiency", "business_alert",
]);
export type InsightType = z.infer<typeof InsightTypeSchema>;

export const InsightSeveritySchema = z.enum(["info", "watch", "warning", "critical"]);
export type InsightSeverity = z.infer<typeof InsightSeveritySchema>;

export const InsightStatusSchema = z.enum([
  "open", "acknowledged", "under_investigation", "resolved", "dismissed",
]);
export type InsightStatus = z.infer<typeof InsightStatusSchema>;

export const RecommendationCategorySchema = z.enum([
  "reduce_vendor_spend", "reduce_acquisition_cost", "renegotiate_contract",
  "improve_collections", "reduce_churn", "improve_pricing_discipline",
  "reduce_service_delivery_cost", "improve_staffing_efficiency",
  "reduce_reporting_latency", "reduce_non_core_overhead",
  "shift_channel_mix", "optimize_customer_segment_mix",
  "working_capital_improvement", "revenue_acceleration",
]);
export type RecommendationCategory = z.infer<typeof RecommendationCategorySchema>;

export const RecommendationStatusSchema = z.enum([
  "pending_review", "approved", "in_progress", "implemented", "rejected", "deferred",
]);
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;

export const RecommendationUrgencySchema = z.enum(["low", "medium", "high", "immediate"]);
export type RecommendationUrgency = z.infer<typeof RecommendationUrgencySchema>;

// ─── Core Insight Models ──────────────────────────────────────────────────────

export const AnomalySchema = z.object({
  id: z.string().uuid(),
  metricSlug: z.string(),
  period: z.string(),
  observedValue: z.number(),
  expectedValue: z.number(),
  deviationPct: z.number(),
  deviationSigma: z.number(),
  detectionMethod: z.enum(["zscore", "iqr", "moving_avg", "rule_based", "ml_model"]),
  isConfirmed: z.boolean().default(false),
  confirmedBy: z.string().optional(),
  rootCauseHypotheses: z.array(z.string()).default([]),
  severity: InsightSeveritySchema,
  detectedAt: z.string().datetime(),
});
export type Anomaly = z.infer<typeof AnomalySchema>;

export const DriverShiftSchema = z.object({
  id: z.string().uuid(),
  metricSlug: z.string(),
  period: z.string(),
  driverSlug: z.string(),
  driverLabel: z.string(),
  previousContributionPct: z.number(),
  currentContributionPct: z.number(),
  shiftMagnitudeUsd: z.number(),
  explanation: z.string(),
  isSignificant: z.boolean(),
});
export type DriverShift = z.infer<typeof DriverShiftSchema>;

export const RootCauseHypothesisSchema = z.object({
  id: z.string().uuid(),
  insightId: z.string(),
  hypothesis: z.string(),
  confidence: z.number().min(0).max(1),
  supportingEvidence: z.array(z.string()).default([]),
  contradictingEvidence: z.array(z.string()).default([]),
  affectedMetricSlugs: z.array(z.string()).default([]),
  verifiedBy: z.string().optional(),
  verifiedAt: z.string().datetime().optional(),
  isConfirmed: z.boolean().default(false),
});
export type RootCauseHypothesis = z.infer<typeof RootCauseHypothesisSchema>;

export const InsightNarrativeSchema = z.object({
  executiveSummary: z.string(),
  whatChanged: z.string(),
  whyItChanged: z.string(),
  soWhat: z.string(),
  whatToDoNext: z.string(),
  assumptions: z.array(z.string()).default([]),
  evidenceSummary: z.string().optional(),
  confidence: z.number().min(0).max(1),
  isAiGenerated: z.boolean().default(true),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().datetime().optional(),
  isApproved: z.boolean().default(false),
});
export type InsightNarrative = z.infer<typeof InsightNarrativeSchema>;

export const InsightSchema = z.object({
  id: z.string().uuid(),
  insightType: InsightTypeSchema,
  severity: InsightSeveritySchema,
  status: InsightStatusSchema,
  title: z.string(),
  summary: z.string(),
  affectedMetricSlugs: z.array(z.string()),
  affectedPeriods: z.array(z.string()),
  affectedEntities: z.array(z.string()).default([]),
  anomalies: z.array(AnomalySchema).default([]),
  driverShifts: z.array(DriverShiftSchema).default([]),
  rootCauseHypotheses: z.array(RootCauseHypothesisSchema).default([]),
  narrative: InsightNarrativeSchema.optional(),
  financialImpactUsd: z.number().optional(),
  financialImpactDescription: z.string().optional(),
  evidenceDocumentIds: z.array(z.string()).default([]),
  supportingChartIds: z.array(z.string()).default([]),
  recommendationIds: z.array(z.string()).default([]),
  acknowledgedBy: z.string().optional(),
  acknowledgedAt: z.string().datetime().optional(),
  resolvedBy: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Insight = z.infer<typeof InsightSchema>;

export const InsightClusterSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  theme: z.string(),
  insights: z.array(z.string()),
  aggregateImpactUsd: z.number(),
  severity: InsightSeveritySchema,
  recommendedOwner: z.string(),
  createdAt: z.string().datetime(),
});
export type InsightCluster = z.infer<typeof InsightClusterSchema>;

// ─── Recommendation Models ────────────────────────────────────────────────────

export const RecommendationImpactEstimateSchema = z.object({
  annualizedSavingsUsd: z.number(),
  oneTimeSavingsUsd: z.number().optional(),
  revenueUpliftUsd: z.number().optional(),
  marginImprovementPpt: z.number().optional(),
  paybackPeriodMonths: z.number().optional(),
  implementationCostUsd: z.number().optional(),
  netImpactUsd: z.number(),
  confidenceLevel: z.enum(["low", "medium", "high"]),
  assumptions: z.array(z.string()).default([]),
  sensitivityNotes: z.string().optional(),
});
export type RecommendationImpactEstimate = z.infer<typeof RecommendationImpactEstimateSchema>;

export const RecommendationSchema = z.object({
  id: z.string().uuid(),
  insightId: z.string(),
  category: RecommendationCategorySchema,
  title: z.string(),
  summary: z.string(),
  businessRationale: z.string(),
  affectedMetricSlugs: z.array(z.string()),
  impactEstimate: RecommendationImpactEstimateSchema,
  confidence: z.number().min(0).max(1),
  urgency: RecommendationUrgencySchema,
  status: RecommendationStatusSchema,
  supportingTrends: z.array(z.string()).default([]),
  supportingChartIds: z.array(z.string()).default([]),
  requiredEvidence: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([]),
  nextActions: z.array(z.string()).default([]),
  recommendedOwner: z.string(),
  requiresApproval: z.boolean().default(true),
  approvedBy: z.string().optional(),
  approvedAt: z.string().datetime().optional(),
  explainabilityBlock: z.string().optional(),
  evidenceDocumentIds: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const WatchlistItemSchema = z.object({
  id: z.string().uuid(),
  metricSlug: z.string(),
  addedBy: z.string(),
  reason: z.string(),
  thresholdBreachValue: z.number().optional(),
  currentValue: z.number(),
  alertLevel: z.enum(["watch", "warning", "critical"]),
  lastCheckedAt: z.string().datetime(),
  addedAt: z.string().datetime(),
});
export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

export const BusinessAlertSchema = z.object({
  id: z.string().uuid(),
  alertType: z.enum([
    "metric_breach", "forecast_miss", "covenant_proximity", "anomaly_detected",
    "approval_overdue", "data_staleness", "manual_override_pending",
  ]),
  title: z.string(),
  description: z.string(),
  severity: InsightSeveritySchema,
  metricSlugs: z.array(z.string()).default([]),
  requiresAction: z.boolean().default(true),
  actionDeadline: z.string().datetime().optional(),
  assignedTo: z.string().optional(),
  isResolved: z.boolean().default(false),
  resolvedAt: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
});
export type BusinessAlert = z.infer<typeof BusinessAlertSchema>;

export const MarginLeakageSchema = z.object({
  id: z.string().uuid(),
  period: z.string(),
  category: z.string(),
  description: z.string(),
  annualizedLeakageUsd: z.number(),
  rootCause: z.string(),
  recoveryPotentialUsd: z.number(),
  confidence: z.number().min(0).max(1),
  requiresInvestigation: z.boolean().default(true),
  insightId: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type MarginLeakage = z.infer<typeof MarginLeakageSchema>;

export const CostReductionCandidateSchema = z.object({
  id: z.string().uuid(),
  category: RecommendationCategorySchema,
  lineItem: z.string(),
  department: z.string(),
  currentAnnualSpendUsd: z.number(),
  benchmarkSpendUsd: z.number().optional(),
  potentialSavingsUsd: z.number(),
  potentialSavingsPct: z.number(),
  implementation: z.enum(["quick_win", "medium_term", "strategic"]),
  confidence: z.number().min(0).max(1),
  insightId: z.string().optional(),
  createdAt: z.string().datetime(),
});
export type CostReductionCandidate = z.infer<typeof CostReductionCandidateSchema>;
