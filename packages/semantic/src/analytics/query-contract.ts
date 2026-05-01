import { z } from "zod";
import { IntentTypeSchema } from "./intent.js";

// ─────────────────────────────────────────────────────────────────────────────
// Primitive building blocks
// ─────────────────────────────────────────────────────────────────────────────

export const FilterOperatorSchema = z.enum([
  "eq", "neq", "gt", "gte", "lt", "lte", "in", "not_in", "like", "between",
]);
export type FilterOperator = z.infer<typeof FilterOperatorSchema>;

export const TimeGranularitySchema = z.enum([
  "day", "week", "month", "quarter", "year",
]);
export type TimeGranularity = z.infer<typeof TimeGranularitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Query filter
// ─────────────────────────────────────────────────────────────────────────────

export const QueryFilterSchema = z.object({
  /** Semantic dimension slug (e.g. "region", "product_line", "customer_tier"). */
  dimension: z.string(),
  operator: FilterOperatorSchema,
  /** Single value or array for IN / BETWEEN operators. */
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.union([z.string(), z.number()]))]),
  /** Human-readable description of this filter for display. */
  label: z.string().optional(),
});
export type QueryFilter = z.infer<typeof QueryFilterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Time range
// ─────────────────────────────────────────────────────────────────────────────

export const TimeRangeSchema = z.object({
  /** ISO 8601 date string, e.g. "2025-01-01". */
  start: z.string(),
  end: z.string(),
  granularity: TimeGranularitySchema,
  /** Human-readable label e.g. "Q3 FY2025", "last 6 months". */
  label: z.string().optional(),
  /** Whether this range was explicitly stated by the user or inferred. */
  inferred: z.boolean().default(false),
});
export type TimeRange = z.infer<typeof TimeRangeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Metric reference (resolved from the semantic layer)
// ─────────────────────────────────────────────────────────────────────────────

export const MetricRefSchema = z.object({
  slug: z.string(),
  label: z.string(),
  domain: z.string(),
  /** How we arrived at this metric — "exact_match" | "synonym" | "inferred". */
  matchType: z.enum(["exact_match", "synonym", "inferred"]),
  /** Confidence the correct metric was resolved (0 – 1). */
  resolutionConfidence: z.number().min(0).max(1),
  formula: z.string().optional(),
});
export type MetricRef = z.infer<typeof MetricRefSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Missing parameter descriptor
// ─────────────────────────────────────────────────────────────────────────────

export const MissingParameterSchema = z.object({
  parameter: z.enum([
    "time_range", "comparison_period", "metric", "dimension",
    "filter_value", "rank_limit", "cohort_date",
  ]),
  description: z.string(),
  /** Default that will be assumed if the user doesn't clarify. */
  assumedDefault: z.string().optional(),
});
export type MissingParameter = z.infer<typeof MissingParameterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Abstract query plan
// Describes WHAT to compute, not HOW (no SQL, no data warehouse dialect).
// ─────────────────────────────────────────────────────────────────────────────

export const AbstractQueryPlanSchema = z.object({
  /** Metrics to retrieve from the semantic layer. */
  metrics: z.array(MetricRefSchema),
  /** Dimensions to group by. */
  groupBy: z.array(z.string()),
  /** Filters to apply. */
  filters: z.array(QueryFilterSchema),
  /** Primary time range. */
  timeRange: TimeRangeSchema.optional(),
  /** Secondary time range for comparison / variance. */
  comparisonPeriod: TimeRangeSchema.optional(),
  /** For ranking intents: number of results to return. */
  limit: z.number().int().positive().optional(),
  /** For ranking intents: "asc" | "desc". */
  sortDirection: z.enum(["asc", "desc"]).optional(),
  /** For trend intents: the time-series granularity. */
  seriesGranularity: TimeGranularitySchema.optional(),
  /** For cohort intents: cohort definition date range. */
  cohortDefinition: TimeRangeSchema.optional(),
});
export type AbstractQueryPlan = z.infer<typeof AbstractQueryPlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Query contract — the complete, validated interpretation of a user question
// ─────────────────────────────────────────────────────────────────────────────

export const QueryContractSchema = z.object({
  /** Unique ID for this parse (matches the request trace ID). */
  contractId: z.string().uuid(),
  /** The original verbatim question. */
  rawQuestion: z.string(),
  /** Normalised lowercase version used by classifiers. */
  normalisedQuestion: z.string(),
  /** Classified intent. */
  intent: IntentTypeSchema,
  /** Overall confidence in this interpretation (0 – 1). */
  confidence: z.number().min(0).max(1),
  /** The fully resolved query plan. */
  queryPlan: AbstractQueryPlanSchema,
  /** All detected metric references before resolution. */
  detectedEntities: z.object({
    rawMetricMentions: z.array(z.string()),
    rawDimensionMentions: z.array(z.string()),
    rawTimeMentions: z.array(z.string()),
    rawFilterMentions: z.array(z.string()),
  }),
  /** Parameters that were missing and either inferred or pending clarification. */
  missingParameters: z.array(MissingParameterSchema),
  /** Whether the query planner needs a clarification round-trip before proceeding. */
  requiresClarification: z.boolean(),
  /** ISO 8601 timestamp of when this contract was created. */
  parsedAt: z.string(),
  /** Version of the query contract schema. */
  schemaVersion: z.literal("1.0"),
});
export type QueryContract = z.infer<typeof QueryContractSchema>;
