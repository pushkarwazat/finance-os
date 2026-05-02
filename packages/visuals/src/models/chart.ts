import { z } from "zod";

// ─── Enums ────────────────────────────────────────────────────────────────────

export const ChartKindSchema = z.enum([
  "kpi_card", "sparkline_card", "trend_line", "bar_actual_vs_budget",
  "forecast_overlay", "variance_waterfall", "bridge_chart", "heatmap",
  "cohort_chart", "scenario_comparison", "stacked_composition",
  "funnel_chart", "contribution_chart", "margin_waterfall",
  "cash_runway_chart", "collections_aging_heatmap", "spend_concentration_treemap",
  "anomaly_timeline", "recommendation_pipeline_board", "bu_scorecard",
]);
export type ChartKind = z.infer<typeof ChartKindSchema>;

export const ColorSchemeSchema = z.enum([
  "default_dark", "default_light", "board_presentation",
  "traffic_light", "variance_red_green", "blue_gradient", "accessible",
]);
export type ColorScheme = z.infer<typeof ColorSchemeSchema>;

export const ThemeSchema = z.enum(["dark", "light", "system"]);
export type Theme = z.infer<typeof ThemeSchema>;

// ─── Metric Binding ───────────────────────────────────────────────────────────

export const ChartMetricBindingSchema = z.object({
  metricSlug: z.string(),
  displayLabel: z.string(),
  role: z.enum(["primary", "comparison", "target", "confidence_low", "confidence_high", "annotation"]),
  format: z.enum(["currency", "percentage", "ratio", "count", "days"]),
  color: z.string().optional(),
  axis: z.enum(["left", "right"]).default("left"),
});
export type ChartMetricBinding = z.infer<typeof ChartMetricBindingSchema>;

// ─── Visual Annotations ───────────────────────────────────────────────────────

export const ChartAnnotationSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  value: z.number().optional(),
  period: z.string().optional(),
  type: z.enum(["threshold_line", "event_marker", "commentary_pin", "trend_arrow"]),
  color: z.string().optional(),
  text: z.string().optional(),
});
export type ChartAnnotation = z.infer<typeof ChartAnnotationSchema>;

export const ThresholdConfigSchema = z.object({
  value: z.number(),
  label: z.string(),
  color: z.enum(["red", "amber", "green", "blue"]),
  showLabel: z.boolean().default(true),
});
export type ThresholdConfig = z.infer<typeof ThresholdConfigSchema>;

// ─── Drilldown Config ─────────────────────────────────────────────────────────

export const DrilldownConfigSchema = z.object({
  enabled: z.boolean().default(false),
  targetRoute: z.string().optional(),
  targetMetricSlug: z.string().optional(),
  dimensions: z.array(z.string()).default([]),
  requiresApproval: z.boolean().default(false),
});
export type DrilldownConfig = z.infer<typeof DrilldownConfigSchema>;

// ─── Tooltip Config ───────────────────────────────────────────────────────────

export const TooltipConfigSchema = z.object({
  enabled: z.boolean().default(true),
  showVariance: z.boolean().default(true),
  showConfidence: z.boolean().default(false),
  showEvidence: z.boolean().default(false),
  customTemplate: z.string().optional(),
});
export type TooltipConfig = z.infer<typeof TooltipConfigSchema>;

// ─── Export + Presentation ────────────────────────────────────────────────────

export const ExportConfigSchema = z.object({
  exportReady: z.boolean().default(false),
  boardPresentationMode: z.boolean().default(false),
  hideLegendInExport: z.boolean().default(false),
  exportFormats: z.array(z.enum(["png", "svg", "pdf", "json"])).default(["png", "json"]),
});
export type ExportConfig = z.infer<typeof ExportConfigSchema>;

// ─── Core Chart Spec ──────────────────────────────────────────────────────────

export const ChartSpecSchema = z.object({
  id: z.string().uuid(),
  kind: ChartKindSchema,
  title: z.string(),
  subtitle: z.string().optional(),
  metricBindings: z.array(ChartMetricBindingSchema),
  colorScheme: ColorSchemeSchema.default("default_dark"),
  theme: ThemeSchema.default("dark"),
  thresholds: z.array(ThresholdConfigSchema).default([]),
  annotations: z.array(ChartAnnotationSchema).default([]),
  drilldown: DrilldownConfigSchema.optional(),
  tooltip: TooltipConfigSchema.optional(),
  exportConfig: ExportConfigSchema.optional(),
  showConfidenceBand: z.boolean().default(false),
  showCommentaryPanel: z.boolean().default(false),
  accessibilityLabel: z.string().optional(),
  periodFilter: z.string().optional(),
  entityFilter: z.string().optional(),
  lastRefreshedAt: z.string().datetime().optional(),
  lineageRef: z.string().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type ChartSpec = z.infer<typeof ChartSpecSchema>;

// ─── KPI Card ─────────────────────────────────────────────────────────────────

export const KpiCardSpecSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  metricSlug: z.string(),
  value: z.number(),
  format: z.enum(["currency", "percentage", "ratio", "count", "days"]),
  variance: z.number().optional(),
  variancePct: z.number().optional(),
  comparisonLabel: z.string().optional(),
  trend: z.enum(["up", "down", "flat"]).optional(),
  trendDirection: z.enum(["favourable", "unfavourable", "neutral"]).optional(),
  sparklineValues: z.array(z.number()).optional(),
  threshold: ThresholdConfigSchema.optional(),
  isMaterial: z.boolean().default(false),
  lastRefreshedAt: z.string().datetime().optional(),
});
export type KpiCardSpec = z.infer<typeof KpiCardSpecSchema>;

// ─── Dashboard ────────────────────────────────────────────────────────────────

export const DashboardSectionSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  position: z.number().int(),
  layoutColumns: z.number().int().min(1).max(4).default(3),
  chartIds: z.array(z.string()).default([]),
  kpiCardIds: z.array(z.string()).default([]),
  accessLevel: z.enum(["all", "management", "board", "restricted"]).default("all"),
});
export type DashboardSection = z.infer<typeof DashboardSectionSchema>;

export const DashboardDefinitionSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  audience: z.enum(["cfo", "ceo", "board", "management", "analyst", "all"]),
  fiscalPeriod: z.string(),
  sections: z.array(DashboardSectionSchema).default([]),
  charts: z.array(ChartSpecSchema).default([]),
  kpiCards: z.array(KpiCardSpecSchema).default([]),
  theme: ThemeSchema.default("dark"),
  isLive: z.boolean().default(false),
  refreshIntervalSeconds: z.number().int().optional(),
  lastRefreshedAt: z.string().datetime().optional(),
  exportConfig: ExportConfigSchema.optional(),
  boardPresentationMode: z.boolean().default(false),
  accessTags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DashboardDefinition = z.infer<typeof DashboardDefinitionSchema>;

// ─── Visualization Config Presets ─────────────────────────────────────────────

export const VisualizationConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  preset: z.enum([
    "executive_summary", "board_pack", "variance_deep_dive",
    "forecast_review", "scenario_comparison", "cost_reduction",
    "margin_optimization", "anomaly_investigation",
  ]),
  defaultTheme: ThemeSchema,
  defaultColorScheme: ColorSchemeSchema,
  enableAnimations: z.boolean().default(true),
  enableDrilldowns: z.boolean().default(true),
  enableExport: z.boolean().default(true),
  boardPresentationMode: z.boolean().default(false),
  accessibilityMode: z.boolean().default(false),
});
export type VisualizationConfig = z.infer<typeof VisualizationConfigSchema>;
