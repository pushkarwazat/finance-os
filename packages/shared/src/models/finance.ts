import { z } from "zod";

export const PeriodSchema = z.enum([
  "Q1",
  "Q2",
  "Q3",
  "Q4",
  "FY",
  "MTD",
  "YTD",
  "LTM",
]);
export type Period = z.infer<typeof PeriodSchema>;

export const CurrencySchema = z.enum(["USD", "EUR", "GBP", "JPY", "CAD"]);
export type Currency = z.infer<typeof CurrencySchema>;

export const MetricCategorySchema = z.enum([
  "revenue",
  "expense",
  "margin",
  "liquidity",
  "leverage",
  "efficiency",
  "valuation",
  "growth",
]);
export type MetricCategory = z.infer<typeof MetricCategorySchema>;

export const MetricSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  category: MetricCategorySchema,
  description: z.string(),
  formula: z.string().optional(),
  unit: z.enum(["currency", "percentage", "ratio", "count", "days"]),
  value: z.number(),
  previousValue: z.number().optional(),
  variance: z.number().optional(),
  variancePct: z.number().optional(),
  period: PeriodSchema,
  fiscalYear: z.number().int(),
  currency: CurrencySchema,
  tags: z.array(z.string()).default([]),
  updatedAt: z.string().datetime(),
});
export type Metric = z.infer<typeof MetricSchema>;

export const VarianceDriverSchema = z.object({
  id: z.string().uuid(),
  metricId: z.string().uuid(),
  driver: z.string(),
  impact: z.number(),
  impactPct: z.number(),
  explanation: z.string(),
  category: z.enum(["volume", "price", "mix", "fx", "one-time", "structural"]),
  period: PeriodSchema,
  fiscalYear: z.number().int(),
});
export type VarianceDriver = z.infer<typeof VarianceDriverSchema>;

export const ForecastSchema = z.object({
  id: z.string().uuid(),
  metricId: z.string().uuid(),
  metricName: z.string(),
  period: PeriodSchema,
  fiscalYear: z.number().int(),
  actual: z.number().nullable(),
  budget: z.number(),
  forecast: z.number(),
  prior: z.number().nullable(),
  currency: CurrencySchema,
  confidence: z.number().min(0).max(1),
  scenarioId: z.string().uuid().optional(),
  updatedAt: z.string().datetime(),
});
export type Forecast = z.infer<typeof ForecastSchema>;

export const CloseTaskStatusSchema = z.enum([
  "pending",
  "in_progress",
  "review",
  "approved",
  "blocked",
  "complete",
]);
export type CloseTaskStatus = z.infer<typeof CloseTaskStatusSchema>;

export const CloseTaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  status: CloseTaskStatusSchema,
  assigneeId: z.string().uuid().optional(),
  assigneeName: z.string().optional(),
  dueDate: z.string().date(),
  closePeriod: PeriodSchema,
  fiscalYear: z.number().int(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  dependencies: z.array(z.string().uuid()).default([]),
  comments: z.number().int().default(0),
  attachments: z.number().int().default(0),
  updatedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});
export type CloseTask = z.infer<typeof CloseTaskSchema>;

export const MetricSummarySchema = z.object({
  totalMetrics: z.number().int(),
  byCategory: z.record(MetricCategorySchema, z.number().int()),
  favorableVariances: z.number().int(),
  unfavorableVariances: z.number().int(),
  period: PeriodSchema,
  fiscalYear: z.number().int(),
});
export type MetricSummary = z.infer<typeof MetricSummarySchema>;
