// Analytics contract layer — exported first as canonical definitions for
// FilterOperator, QueryFilter, TimeGranularity, TimeGranularitySchema
export * from "./analytics/index.js";
export * from "./validator.js";
export * from "./compiler.js";
export * from "./planner.js";
export * from "./registry.js";
// Semantic type system — only symbols not already exported by analytics above
export {
  GrainSchema, type Grain,
  AggregationSchema, type Aggregation,
  DataTypeSchema, type DataType,
  EntitySchema, type Entity,
  DimensionSchema, type Dimension,
  MeasureSchema, type Measure,
  MetricSchema, type Metric,
  MetricTypeSchema,
  JoinSchema, type Join,
  SynonymEntrySchema, type SynonymEntry,
  SynonymFileSchema, type SynonymFile,
  GlossaryEntrySchema, type GlossaryEntry,
  GlossaryFileSchema, type GlossaryFile,
  GuardrailSeveritySchema, type GuardrailSeverity,
  GuardrailSchema, type Guardrail,
  GuardrailFileSchema, type GuardrailFile,
  type CompiledDomain,
  type QueryPlan,
  type QueryTimeRange,
} from "./types.js";
// Legacy exports kept for backward compatibility
export * from "./metric-schema.js";
export * from "./data-contracts.js";
