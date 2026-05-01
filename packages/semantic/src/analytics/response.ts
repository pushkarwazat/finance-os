import { z } from "zod";
import { IntentTypeSchema, IntentCatalogueEntrySchema } from "./intent.js";
import { AbstractQueryPlanSchema, MetricRefSchema } from "./query-contract.js";
import { ClarificationRequestSchema } from "./clarification.js";

// ─────────────────────────────────────────────────────────────────────────────
// Assumption
// ─────────────────────────────────────────────────────────────────────────────

export const AssumptionSchema = z.object({
  /** Short machine key identifying what was assumed. */
  key: z.string(),
  /** Human-readable description of the assumption. */
  description: z.string(),
  /**
   * Category of assumption — lets the UI render different icons / colours.
   *
   * time_range    — a date range was inferred
   * metric        — a metric slug was inferred from ambiguous text
   * filter        — a filter value was defaulted
   * scope         — organisational scope was defaulted (e.g. "consolidated")
   * granularity   — time series granularity was inferred
   */
  category: z.enum(["time_range", "metric", "filter", "scope", "granularity"]),
  /** How confident the system is that this assumption is correct (0 – 1). */
  confidence: z.number().min(0).max(1),
  /** The value that was assumed. */
  assumedValue: z.string(),
  /** Whether the user can override this assumption inline. */
  overridable: z.boolean().default(true),
});
export type Assumption = z.infer<typeof AssumptionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Caveat
// ─────────────────────────────────────────────────────────────────────────────

export const CaveatSchema = z.object({
  key: z.string(),
  /** The caveat text to display to the user. */
  description: z.string(),
  /**
   * Severity level:
   * info     — informational; doesn't affect reliability
   * warning  — user should be aware; may affect interpretation
   * critical — result may be materially incorrect without user acknowledgement
   */
  severity: z.enum(["info", "warning", "critical"]),
  /** Optional link to documentation or a glossary entry. */
  referenceSlug: z.string().optional(),
});
export type Caveat = z.infer<typeof CaveatSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline trace step
// ─────────────────────────────────────────────────────────────────────────────

export const PipelineStepSchema = z.object({
  /** Step name / identifier. */
  step: z.enum([
    "receive",
    "normalise",
    "classify_intent",
    "extract_entities",
    "resolve_metrics",
    "build_query_plan",
    "check_abstention",
    "check_guardrails",
    "fetch_mock_data",
    "format_answer",
    "build_response",
  ]),
  /** Status of this step. */
  status: z.enum(["ok", "skipped", "warned", "failed"]),
  /** Human-readable description of what happened at this step. */
  detail: z.string(),
  /** Elapsed milliseconds for this step (cumulative from start). */
  elapsedMs: z.number().int().min(0),
  /** Optional structured output from this step for debugging. */
  output: z.record(z.string(), z.unknown()).optional(),
});
export type PipelineStep = z.infer<typeof PipelineStepSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Mock data payload
// ─────────────────────────────────────────────────────────────────────────────

export const MockDataPointSchema = z.object({
  label: z.string(),
  value: z.union([z.number(), z.string(), z.null()]),
  unit: z.string().optional(),
  formattedValue: z.string().optional(),
  /** For time-series results. */
  timestamp: z.string().optional(),
  /** For comparison results: the reference period value. */
  referenceValue: z.union([z.number(), z.null()]).optional(),
  /** For variance results: actual minus reference. */
  variance: z.union([z.number(), z.null()]).optional(),
  /** Whether the variance is favorable from a business perspective. */
  isFavorable: z.boolean().optional(),
  /** Additional breakdown key-value pairs. */
  breakdown: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
});
export type MockDataPoint = z.infer<typeof MockDataPointSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Analytics response — the complete, structured answer returned to the client
// ─────────────────────────────────────────────────────────────────────────────

export const AnalyticsResponseSchema = z.object({
  // ── Identity ───────────────────────────────────────────────────────────────
  /** Globally unique trace ID for this request (correlates server logs). */
  traceId: z.string().uuid(),
  sessionId: z.string().uuid(),
  messageId: z.string().uuid(),
  /** ISO 8601 timestamp. */
  createdAt: z.string(),

  // ── Question + intent ─────────────────────────────────────────────────────
  rawQuestion: z.string(),
  intent: IntentTypeSchema,
  /** Overall confidence in the interpretation (0 – 1). */
  confidence: z.number().min(0).max(1),
  /** Confidence tier label for display. */
  confidenceTier: z.enum(["high", "medium", "low"]),

  // ── Core answer ───────────────────────────────────────────────────────────
  /**
   * Prose answer text generated by the mock pipeline.
   * Will be an empty string if abstained or clarification required.
   */
  answerText: z.string(),

  // ── Structured data ───────────────────────────────────────────────────────
  /** The resolved, abstract query plan. */
  queryPlan: AbstractQueryPlanSchema.optional(),
  /** Mock data points used to generate the answer. */
  mockData: z.array(MockDataPointSchema).optional(),

  // ── Semantic provenance ───────────────────────────────────────────────────
  /** Metrics referenced in the answer, resolved from the semantic layer. */
  sourceMetrics: z.array(MetricRefSchema),

  // ── Epistemic annotations ─────────────────────────────────────────────────
  assumptions: z.array(AssumptionSchema),
  caveats: z.array(CaveatSchema),

  // ── Clarification ─────────────────────────────────────────────────────────
  /** Present when the system needs more information before answering. */
  clarificationRequired: ClarificationRequestSchema.optional(),

  // ── Abstention ────────────────────────────────────────────────────────────
  /** Whether the system declined to answer. */
  abstained: z.boolean(),
  /** Reason for abstention if abstained = true. */
  abstentionReason: z
    .enum([
      "no_semantic_coverage",
      "low_confidence",
      "policy_violation",
      "time_range_out_of_scope",
      "pii_detected",
      "unsupported_operation",
      "guardrail_triggered",
    ])
    .optional(),
  /** Human-readable explanation of why the system abstained. */
  abstentionMessage: z.string().optional(),

  // ── Pipeline observability ────────────────────────────────────────────────
  pipelineTrace: z.array(PipelineStepSchema),
  /** Total latency for this request in milliseconds. */
  latencyMs: z.number().int().min(0),
  /** Semantic schema version used to resolve metrics. */
  semanticSchemaVersion: z.literal("semantics.financeos.io/v1"),
  /** Query contract schema version. */
  contractSchemaVersion: z.literal("1.0"),
});
export type AnalyticsResponse = z.infer<typeof AnalyticsResponseSchema>;
