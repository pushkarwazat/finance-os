import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

export const GrainSchema = z.enum([
  "daily",
  "weekly",
  "monthly",
  "quarterly",
  "annual",
]);
export type Grain = z.infer<typeof GrainSchema>;

export const AggregationSchema = z.enum([
  "sum",
  "avg",
  "min",
  "max",
  "last",
  "first",
  "count",
  "count_distinct",
  "median",
  "p90",
  "p99",
]);
export type Aggregation = z.infer<typeof AggregationSchema>;

export const DataTypeSchema = z.enum([
  "string",
  "number",
  "integer",
  "boolean",
  "date",
  "timestamp",
  "currency",
  "percentage",
]);
export type DataType = z.infer<typeof DataTypeSchema>;

export const TimeGranularitySchema = z.enum([
  "day",
  "week",
  "month",
  "quarter",
  "year",
  "fiscal_quarter",
  "fiscal_year",
]);
export type TimeGranularity = z.infer<typeof TimeGranularitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Entity  — a logical table or object in the warehouse (without exposing DDL)
// ─────────────────────────────────────────────────────────────────────────────

export const EntitySchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Entity"),
  metadata: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case identifiers only"),
    domain: z.string(),
    description: z.string(),
    labels: z.record(z.string(), z.string()).default({}),
    owner: z.string().optional(),
  }),
  spec: z.object({
    // The physical warehouse location — kept here but hidden from end-users
    warehouse: z.string().describe("Warehouse name, e.g. 'snowflake'"),
    database: z.string().optional(),
    schema: z.string(),
    table: z.string(),
    // Natural-language alias shown to business users
    displayName: z.string(),
    // Primary key columns — used for deduplication guarantees
    primaryKey: z.array(z.string()).min(1),
    // Row-level security tag — governs which rows a role can see
    rlsTags: z.array(z.string()).default([]),
    // Approved for direct query (false = can only appear as joined entity)
    queryable: z.boolean().default(true),
  }),
});
export type Entity = z.infer<typeof EntitySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Dimension  — a descriptive attribute attached to an entity
// ─────────────────────────────────────────────────────────────────────────────

export const DimensionSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Dimension"),
  metadata: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case identifiers only"),
    entity: z.string().describe("Entity this dimension belongs to"),
    domain: z.string(),
    labels: z.record(z.string(), z.string()).default({}),
  }),
  spec: z.object({
    displayName: z.string(),
    description: z.string(),
    column: z.string().describe("Physical column name in the entity table"),
    dataType: DataTypeSchema,
    // Cardinality hint — helps query planner choose group-by strategy
    cardinality: z.enum(["low", "medium", "high"]).default("medium"),
    // Whether this dimension can be used as a filter
    filterable: z.boolean().default(true),
    // Whether this is a time dimension (enables time-series queries)
    isTimeDimension: z.boolean().default(false),
    // Allowed granularities if this is a time dimension
    timeGranularities: z.array(TimeGranularitySchema).optional(),
    // Approved values — restricts filter values to a known set
    allowedValues: z.array(z.union([z.string(), z.number()])).optional(),
    // Synonyms users might say ("quarter" → period_quarter)
    synonyms: z.array(z.string()).default([]),
    // Maps raw values to business-friendly labels
    valueLabels: z.record(z.string(), z.string()).optional(),
    hidden: z.boolean().default(false),
  }),
});
export type Dimension = z.infer<typeof DimensionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Measure  — an aggregated numeric column on an entity (raw building block)
// ─────────────────────────────────────────────────────────────────────────────

export const MeasureSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Measure"),
  metadata: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case identifiers only"),
    entity: z.string().describe("Entity this measure is computed from"),
    domain: z.string(),
    labels: z.record(z.string(), z.string()).default({}),
  }),
  spec: z.object({
    displayName: z.string(),
    description: z.string(),
    column: z.string().describe("Physical column being aggregated"),
    aggregation: AggregationSchema,
    dataType: DataTypeSchema,
    // Optional SQL expression override (avoids exposing table names to users)
    expression: z.string().optional(),
    // Grain at which this measure is valid
    grain: GrainSchema,
    // Filters always applied to this measure (partition guards, etc.)
    defaultFilters: z.array(z.string()).default([]),
    // Dimensions this measure can legitimately be sliced by
    allowedDimensions: z.array(z.string()).optional(),
    // Marks this as a non-additive measure (e.g. distinct counts, ratios)
    nonAdditive: z.boolean().default(false),
    hidden: z.boolean().default(false),
  }),
});
export type Measure = z.infer<typeof MeasureSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Metric  — a business KPI derived from one or more measures
// ─────────────────────────────────────────────────────────────────────────────

export const MetricTypeSchema = z.enum([
  "simple",    // single measure, single aggregation
  "ratio",     // numerator measure / denominator measure
  "derived",   // formula over other metrics
  "cumulative", // running total over a time window
  "period_over_period", // YoY, QoQ, MoM comparison
]);

export const MetricSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Metric"),
  metadata: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/, "snake_case identifiers only"),
    slug: z.string().regex(/^[a-z][a-z0-9_]*$/),
    domain: z.string(),
    version: z.string().default("1.0.0"),
    labels: z.record(z.string(), z.string()).default({}),
    owner: z.string(),
    reviewCycle: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
  }),
  spec: z.object({
    displayName: z.string(),
    description: z.string(),
    // Short label used in charts and tables
    shortLabel: z.string().optional(),
    type: MetricTypeSchema,
    // For simple metrics
    measure: z.string().optional(),
    // For ratio metrics
    numerator: z.string().optional(),
    denominator: z.string().optional(),
    // For derived metrics — a formula referencing other metric slugs
    formula: z.string().optional(),
    // Metrics this derived metric depends on
    dependencies: z.array(z.string()).default([]),
    // Unit and formatting
    unit: z.enum(["currency", "percentage", "ratio", "count", "days", "x"]),
    currency: z.string().default("USD"),
    formatting: z.object({
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      decimals: z.number().int().min(0).max(6).default(2),
      abbreviate: z.boolean().default(true),
    }).default({ decimals: 2, abbreviate: true }),
    // The natural grain at which this metric is computed and compared
    grain: GrainSchema,
    // Dimensions this metric can be sliced by
    allowedDimensions: z.array(z.string()).default([]),
    // Time dimension to use for period-over-period and trending
    timeDimension: z.string().optional(),
    // Thresholds for alerting / variance badge colors
    thresholds: z.object({
      direction: z.enum(["higher_is_better", "lower_is_better"]).default("higher_is_better"),
      warning: z.number().optional(),
      critical: z.number().optional(),
    }).optional(),
    // Business glossary entry slug this metric is documented under
    glossaryRef: z.string().optional(),
    // Synonyms recognized in NL queries
    synonyms: z.array(z.string()).default([]),
    // Tags for categorization
    tags: z.array(z.string()).default([]),
    // Whether this metric can appear in self-serve dashboards
    selfServe: z.boolean().default(true),
    // Whether this metric is visible to non-finance users
    public: z.boolean().default(false),
    // Data certification status
    certified: z.boolean().default(false),
    certifiedBy: z.string().optional(),
  }),
});
export type Metric = z.infer<typeof MetricSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Join  — an approved join path between two entities
// ─────────────────────────────────────────────────────────────────────────────

export const JoinSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Join"),
  metadata: z.object({
    name: z.string().regex(/^[a-z][a-z0-9_]*$/),
    domain: z.string(),
    labels: z.record(z.string(), z.string()).default({}),
  }),
  spec: z.object({
    description: z.string(),
    // Left entity (the "one" side of a one-to-many)
    left: z.object({
      entity: z.string(),
      key: z.string(),
    }),
    // Right entity (the "many" side)
    right: z.object({
      entity: z.string(),
      key: z.string(),
    }),
    type: z.enum(["inner", "left", "right", "full"]).default("left"),
    // Whether this join is symmetric (a↔b same as b↔a)
    symmetric: z.boolean().default(false),
    // Whether this join can cause fan-out — if true, query planner must aggregate first
    fanOut: z.boolean().default(false),
    // Conditions in addition to the key match (e.g. active = true)
    additionalConditions: z.array(z.string()).default([]),
    // Measures that are only valid when this join is active
    dependentMeasures: z.array(z.string()).default([]),
  }),
});
export type Join = z.infer<typeof JoinSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Synonym  — business-friendly aliases for metric and dimension names
// ─────────────────────────────────────────────────────────────────────────────

export const SynonymEntrySchema = z.object({
  canonical: z.string().describe("The metric or dimension slug this refers to"),
  kind: z.enum(["metric", "dimension", "measure", "entity"]),
  domain: z.string().optional(),
  terms: z.array(z.string()).min(1).describe("Phrases that map to this canonical name"),
  context: z.string().optional().describe("When to prefer this synonym (e.g. 'saas context')"),
  locales: z.array(z.string()).default(["en"]),
});
export type SynonymEntry = z.infer<typeof SynonymEntrySchema>;

export const SynonymFileSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("SynonymMap"),
  metadata: z.object({
    domain: z.string(),
    description: z.string().optional(),
  }),
  synonyms: z.array(SynonymEntrySchema),
});
export type SynonymFile = z.infer<typeof SynonymFileSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Business Glossary  — plain-language definitions for finance terms
// ─────────────────────────────────────────────────────────────────────────────

export const GlossaryEntrySchema = z.object({
  term: z.string(),
  slug: z.string().regex(/^[a-z][a-z0-9_]*$/),
  domain: z.string(),
  shortDefinition: z.string().max(150),
  definition: z.string(),
  formula: z.string().optional(),
  examples: z.array(z.string()).default([]),
  // Related metrics and dimensions
  relatedMetrics: z.array(z.string()).default([]),
  relatedDimensions: z.array(z.string()).default([]),
  // Related glossary slugs
  seeAlso: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  certifiedBy: z.string().optional(),
  lastReviewed: z.string().optional(),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntrySchema>;

export const GlossaryFileSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Glossary"),
  metadata: z.object({
    description: z.string().optional(),
    version: z.string().default("1.0.0"),
  }),
  entries: z.array(GlossaryEntrySchema),
});
export type GlossaryFile = z.infer<typeof GlossaryFileSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails  — safety rules for the query planner
// ─────────────────────────────────────────────────────────────────────────────

export const GuardrailSeveritySchema = z.enum(["block", "warn", "log"]);
export type GuardrailSeverity = z.infer<typeof GuardrailSeveritySchema>;

export const GuardrailSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  severity: GuardrailSeveritySchema,
  // Pattern that identifies this violation (regex or keyword list)
  pattern: z.union([
    z.object({ type: z.literal("regex"), value: z.string() }),
    z.object({ type: z.literal("keywords"), values: z.array(z.string()) }),
    z.object({
      type: z.literal("structural"),
      rule: z.enum([
        "no_cross_domain_join",
        "no_unapproved_join",
        "no_raw_table_reference",
        "require_time_filter",
        "max_join_depth",
        "no_unbounded_aggregation",
        "no_pii_field_exposure",
      ]),
      params: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
    }),
  ]),
  // Suggested rewrite shown to the user when a guardrail fires
  suggestion: z.string().optional(),
  // Whether this rule can be overridden by a specific role
  overridableBy: z.array(z.string()).default([]),
});
export type Guardrail = z.infer<typeof GuardrailSchema>;

export const GuardrailFileSchema = z.object({
  apiVersion: z.literal("semantics.financeos.io/v1"),
  kind: z.literal("Guardrails"),
  metadata: z.object({ description: z.string().optional() }),
  guardrails: z.array(GuardrailSchema),
});
export type GuardrailFile = z.infer<typeof GuardrailFileSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Compiled Semantic Model  — the merged, validated output of the compiler
// ─────────────────────────────────────────────────────────────────────────────

export interface CompiledDomain {
  domain: string;
  version: string;
  compiledAt: string;
  entities: Entity["spec"][];
  dimensions: Dimension["spec"][];
  measures: Measure["spec"][];
  metrics: Metric["spec"][];
  joins: Join["spec"][];
  synonymMap: Record<string, string>; // term → canonical slug
}

// ─────────────────────────────────────────────────────────────────────────────
// Query Plan  — the abstract query returned by the planner (never raw SQL)
// ─────────────────────────────────────────────────────────────────────────────

export type FilterOperator =
  | "eq" | "neq" | "gt" | "gte" | "lt" | "lte"
  | "in" | "not_in" | "contains" | "between" | "is_null" | "is_not_null";

export interface QueryFilter {
  dimension: string;
  operator: FilterOperator;
  value: unknown;
}

export interface QueryTimeRange {
  timeDimension: string;
  granularity: TimeGranularity;
  from?: string;
  to?: string;
  relativeRange?: string; // e.g. "last_quarter", "ytd", "last_12_months"
}

export interface QueryPlan {
  id: string;
  question: string;          // Original natural-language question
  intent: string;            // Interpreted intent (e.g. "trend_analysis")
  metrics: string[];         // Metric slugs to compute
  dimensions: string[];      // Dimension slugs to group by
  filters: QueryFilter[];    // Filter constraints
  timeRange?: QueryTimeRange;
  joinPaths: string[];       // Approved join names used
  guardrailsChecked: string[]; // IDs of guardrails that were evaluated
  guardrailViolations: Array<{
    guardrailId: string;
    severity: GuardrailSeverity;
    message: string;
  }>;
  confidence: number;        // 0-1 planner confidence in interpretation
  warnings: string[];
  // Hints passed to the execution layer (not SQL)
  executionHints: {
    estimatedRows?: number;
    requiresPreAggregation?: boolean;
    cacheKey?: string;
    suggestedVisualization?: "table" | "line" | "bar" | "waterfall" | "pie" | "scorecard";
  };
}
