import { randomUUID } from "crypto";
import type {
  QueryPlan,
  QueryFilter,
  QueryTimeRange,
  TimeGranularity,
  FilterOperator,
  Metric,
  Dimension,
  Join,
  Guardrail,
  GuardrailSeverity,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Intent classifier — maps question patterns to intent types
// ─────────────────────────────────────────────────────────────────────────────

type Intent =
  | "trend_analysis"
  | "comparison"
  | "breakdown"
  | "ranking"
  | "variance_explanation"
  | "forecast"
  | "single_value"
  | "relationship"
  | "unknown";

interface IntentPattern {
  intent: Intent;
  patterns: RegExp[];
}

const INTENT_PATTERNS: IntentPattern[] = [
  {
    intent: "trend_analysis",
    patterns: [
      /\b(trend(s|ed|ing)?|over time|month.over.month|quarter.over.quarter|year.over.year|yoy|qoq|mom|trajectory)\b/i,
      /\bhow (has|did|have).+(changed|moved|grown|declined)\b/i,
    ],
  },
  {
    intent: "comparison",
    patterns: [
      /\b(compare|vs\.?|versus|against|relative to|compared to|difference between)\b/i,
      /\b(better|worse|higher|lower|more|less) than\b/i,
    ],
  },
  {
    intent: "ranking",
    patterns: [
      /\b(top|bottom)\s+\d+\b/i,                                            // "top 10", "bottom 5"
      /\b(best|worst|highest|lowest|largest|smallest|rank|ranking)\b/i,
      /\b(most|least) (profitable|expensive|active|common)\b/i,
    ],
  },
  {
    intent: "breakdown",
    patterns: [
      /\b(by|broken down by|split by|segments?|breakdown|distribution)\b/i,
      /\bwhich (segment|region|product|customer|team|department)\b/i,
    ],
  },
  {
    intent: "variance_explanation",
    patterns: [
      /\b(why|what caused|explain|reason|driver|drivers|miss|beat|variance|gap)\b/i,
      /\b(below|above|behind|ahead of) (budget|target|plan|forecast)\b/i,
    ],
  },
  {
    intent: "forecast",
    patterns: [
      /\b(forecast|predict|projection|expect|next (month|quarter|year)|estimate|will be)\b/i,
    ],
  },
  {
    intent: "single_value",
    patterns: [
      /\b(what is|what was|what are|tell me|show me|give me)\b/i,
      /\b(current|latest|last|total|ytd|qtd|mtd)\b/i,
    ],
  },
  {
    intent: "relationship",
    patterns: [
      /\b(correlation|related|relationship|impact|effect|affect|drives|influence)\b/i,
    ],
  },
];

function classifyIntent(question: string): Intent {
  for (const { intent, patterns } of INTENT_PATTERNS) {
    if (patterns.some((p) => p.test(question))) return intent;
  }
  return "unknown";
}

// ─────────────────────────────────────────────────────────────────────────────
// Metric extractor — identifies metrics mentioned in a question
// ─────────────────────────────────────────────────────────────────────────────

function extractMetrics(
  question: string,
  availableMetrics: Metric[],
  synonymMap: Record<string, string>,
): string[] {
  const found = new Set<string>();
  const lower = question.toLowerCase();

  for (const metric of availableMetrics) {
    // Check display name
    if (lower.includes(metric.spec.displayName.toLowerCase())) {
      found.add(metric.metadata.slug);
      continue;
    }
    // Check slug
    if (lower.includes(metric.metadata.slug.replace(/_/g, " "))) {
      found.add(metric.metadata.slug);
      continue;
    }
    // Check synonyms on the metric itself
    for (const syn of metric.spec.synonyms) {
      if (lower.includes(syn.toLowerCase())) {
        found.add(metric.metadata.slug);
        break;
      }
    }
  }

  // Check synonym map
  for (const [term, canonical] of Object.entries(synonymMap)) {
    if (lower.includes(term.toLowerCase())) {
      // Resolve to metric slug if it exists
      if (availableMetrics.some((m) => m.metadata.slug === canonical)) {
        found.add(canonical);
      }
    }
  }

  return Array.from(found);
}

// ─────────────────────────────────────────────────────────────────────────────
// Dimension extractor — identifies grouping dimensions
// ─────────────────────────────────────────────────────────────────────────────

function extractDimensions(
  question: string,
  availableDimensions: Dimension[],
  metrics: string[],
  metricsMap: Map<string, Metric>,
): string[] {
  const found = new Set<string>();
  const lower = question.toLowerCase();

  // Get allowed dimensions across all selected metrics
  const allowedDimsForMetrics = new Set<string>();
  for (const slug of metrics) {
    const m = metricsMap.get(slug);
    if (m) m.spec.allowedDimensions.forEach((d) => allowedDimsForMetrics.add(d));
  }

  for (const dim of availableDimensions) {
    if (dim.spec.hidden) continue;
    const name = dim.metadata.name;
    const displayName = dim.spec.displayName.toLowerCase();

    if (lower.includes(displayName) || lower.includes(name.replace(/_/g, " "))) {
      // Only include if allowed for selected metrics (or no metrics selected yet)
      if (allowedDimsForMetrics.size === 0 || allowedDimsForMetrics.has(name)) {
        found.add(name);
      }
    }
    for (const syn of dim.spec.synonyms) {
      if (lower.includes(syn.toLowerCase())) {
        if (allowedDimsForMetrics.size === 0 || allowedDimsForMetrics.has(name)) {
          found.add(name);
        }
        break;
      }
    }
  }

  return Array.from(found);
}

// ─────────────────────────────────────────────────────────────────────────────
// Time range extractor
// ─────────────────────────────────────────────────────────────────────────────

interface RelativeRangePattern {
  pattern: RegExp;
  relativeRange: string;
  granularity: TimeGranularity;
}

const RELATIVE_RANGE_PATTERNS: RelativeRangePattern[] = [
  { pattern: /\blast\s+month\b/i, relativeRange: "last_month", granularity: "month" },
  { pattern: /\blast\s+quarter\b/i, relativeRange: "last_quarter", granularity: "quarter" },
  { pattern: /\blast\s+year\b/i, relativeRange: "last_year", granularity: "year" },
  { pattern: /\blast\s+12\s+months?\b/i, relativeRange: "last_12_months", granularity: "month" },
  { pattern: /\byear.to.date\b|\bytd\b/i, relativeRange: "ytd", granularity: "month" },
  { pattern: /\bquarter.to.date\b|\bqtd\b/i, relativeRange: "qtd", granularity: "month" },
  { pattern: /\bmonth.to.date\b|\bmtd\b/i, relativeRange: "mtd", granularity: "day" },
  { pattern: /\b(this|current)\s+quarter\b/i, relativeRange: "current_quarter", granularity: "quarter" },
  { pattern: /\b(this|current)\s+month\b/i, relativeRange: "current_month", granularity: "month" },
  { pattern: /\b(this|current)\s+year\b/i, relativeRange: "current_year", granularity: "month" },
  { pattern: /\bq[1-4]\s+fy?\d{2,4}\b/i, relativeRange: "specific_quarter", granularity: "quarter" },
  { pattern: /\bfy\d{2,4}\b/i, relativeRange: "fiscal_year", granularity: "fiscal_year" },
];

function extractTimeRange(
  question: string,
  timeDimension: string = "date",
): QueryTimeRange | undefined {
  for (const { pattern, relativeRange, granularity } of RELATIVE_RANGE_PATTERNS) {
    if (pattern.test(question)) {
      return { timeDimension, granularity, relativeRange };
    }
  }
  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Filter extractor — pulls simple equality/range filters from the question
// ─────────────────────────────────────────────────────────────────────────────

function extractFilters(
  question: string,
  dimensions: Dimension[],
): QueryFilter[] {
  const filters: QueryFilter[] = [];

  for (const dim of dimensions) {
    if (!dim.spec.filterable || !dim.spec.allowedValues) continue;
    for (const val of dim.spec.allowedValues) {
      const strVal = String(val).toLowerCase();
      if (question.toLowerCase().includes(strVal)) {
        filters.push({
          dimension: dim.metadata.name,
          operator: "eq" as FilterOperator,
          value: val,
        });
        break;
      }
    }
  }

  return filters;
}

// ─────────────────────────────────────────────────────────────────────────────
// Guardrail checker
// ─────────────────────────────────────────────────────────────────────────────

interface GuardrailViolation {
  guardrailId: string;
  severity: GuardrailSeverity;
  message: string;
}

function checkGuardrails(
  question: string,
  metrics: string[],
  dimensions: string[],
  joinPaths: string[],
  guardrails: Guardrail[],
): { checked: string[]; violations: GuardrailViolation[] } {
  const checked: string[] = [];
  const violations: GuardrailViolation[] = [];

  for (const guardrail of guardrails) {
    checked.push(guardrail.id);
    const pattern = guardrail.pattern;

    if (pattern.type === "regex") {
      const re = new RegExp(pattern.value, "i");
      if (re.test(question)) {
        violations.push({
          guardrailId: guardrail.id,
          severity: guardrail.severity,
          message: guardrail.suggestion ?? `Query matches prohibited pattern: ${guardrail.name}`,
        });
      }
    } else if (pattern.type === "keywords") {
      const lower = question.toLowerCase();
      const hit = pattern.values.find((kw) => lower.includes(kw.toLowerCase()));
      if (hit) {
        violations.push({
          guardrailId: guardrail.id,
          severity: guardrail.severity,
          message: guardrail.suggestion ?? `Query contains prohibited keyword: '${hit}'`,
        });
      }
    } else if (pattern.type === "structural") {
      switch (pattern.rule) {
        case "require_time_filter":
          if (metrics.length > 0 && dimensions.length === 0) {
            violations.push({
              guardrailId: guardrail.id,
              severity: guardrail.severity,
              message: "Queries without a time filter may scan unbounded data",
            });
          }
          break;
        case "no_cross_domain_join":
          if (joinPaths.length > 1) {
            violations.push({
              guardrailId: guardrail.id,
              severity: guardrail.severity,
              message: "Query spans multiple domains — verify join paths are approved",
            });
          }
          break;
        case "max_join_depth": {
          const maxDepth = (pattern.params?.["max"] as number) ?? 3;
          if (joinPaths.length > maxDepth) {
            violations.push({
              guardrailId: guardrail.id,
              severity: guardrail.severity,
              message: `Query join depth (${joinPaths.length}) exceeds maximum allowed (${maxDepth})`,
            });
          }
          break;
        }
      }
    }
  }

  return { checked, violations };
}

// ─────────────────────────────────────────────────────────────────────────────
// Visualization suggester
// ─────────────────────────────────────────────────────────────────────────────

type VizType = "table" | "line" | "bar" | "waterfall" | "pie" | "scorecard";

function suggestVisualization(
  intent: Intent,
  metricCount: number,
  dimensionCount: number,
  hasTimeRange: boolean,
): VizType {
  if (metricCount === 1 && dimensionCount === 0 && !hasTimeRange) return "scorecard";
  if (hasTimeRange && intent === "trend_analysis") return "line";
  if (intent === "breakdown" && dimensionCount === 1) return "bar";
  if (intent === "variance_explanation") return "waterfall";
  if (intent === "ranking") return "bar";
  if (dimensionCount === 1 && metricCount === 1) return "bar";
  return "table";
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence scorer
// ─────────────────────────────────────────────────────────────────────────────

function scoreConfidence(
  metrics: string[],
  dimensions: string[],
  intent: Intent,
  violations: GuardrailViolation[],
): number {
  let score = 0.5;
  if (metrics.length > 0) score += 0.2;
  if (intent !== "unknown") score += 0.15;
  if (dimensions.length > 0) score += 0.1;
  if (violations.some((v) => v.severity === "block")) score -= 0.4;
  if (violations.some((v) => v.severity === "warn")) score -= 0.1;
  return Math.max(0, Math.min(1, score));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public planner interface
// ─────────────────────────────────────────────────────────────────────────────

export interface PlannerContext {
  metrics: Metric[];
  dimensions: Dimension[];
  joins: Join[];
  guardrails: Guardrail[];
  synonymMap: Record<string, string>;
  defaultTimeDimension?: string;
}

export interface QueryPlanner {
  plan(question: string, context?: Partial<PlannerContext>): QueryPlan;
}

export function createQueryPlanner(baseContext: PlannerContext): QueryPlanner {
  return {
    plan(question: string, overrides: Partial<PlannerContext> = {}): QueryPlan {
      const ctx: PlannerContext = { ...baseContext, ...overrides };
      const metricsMap = new Map(ctx.metrics.map((m) => [m.metadata.slug, m]));

      const intent = classifyIntent(question);
      const metricSlugs = extractMetrics(question, ctx.metrics, ctx.synonymMap);
      const dimensionNames = extractDimensions(question, ctx.dimensions, metricSlugs, metricsMap);

      // Pick time dimension from first matched metric
      const timeDim =
        ctx.defaultTimeDimension ??
        metricSlugs.flatMap((s) => metricsMap.get(s)?.spec.timeDimension ?? []).at(0) ??
        "date";

      const timeRange = extractTimeRange(question, timeDim);
      const filters = extractFilters(question, ctx.dimensions);

      // Determine which joins are needed (simplified: any join referencing selected metrics' entities)
      const joinPaths = ctx.joins
        .filter((j) =>
          dimensionNames.some(
            (d) => d.includes(j.spec.left.entity) || d.includes(j.spec.right.entity)
          )
        )
        .map((j) => j.metadata.name);

      const { checked, violations } = checkGuardrails(
        question,
        metricSlugs,
        dimensionNames,
        joinPaths,
        ctx.guardrails,
      );

      const confidence = scoreConfidence(metricSlugs, dimensionNames, intent, violations);

      const warnings: string[] = [];
      if (metricSlugs.length === 0) {
        warnings.push("No metrics identified — please specify what you want to measure");
      }
      if (intent === "unknown") {
        warnings.push("Could not determine query intent — results may be broad");
      }
      const blockedViolations = violations.filter((v) => v.severity === "block");
      if (blockedViolations.length > 0) {
        warnings.push(`Query blocked by guardrail(s): ${blockedViolations.map((v) => v.guardrailId).join(", ")}`);
      }

      return {
        id: randomUUID(),
        question,
        intent,
        metrics: metricSlugs,
        dimensions: dimensionNames,
        filters,
        timeRange,
        joinPaths,
        guardrailsChecked: checked,
        guardrailViolations: violations,
        confidence,
        warnings,
        executionHints: {
          estimatedRows: metricSlugs.length > 0 ? 10_000 : undefined,
          requiresPreAggregation: ctx.joins.some((j) => j.spec.fanOut && joinPaths.includes(j.metadata.name)),
          cacheKey: `${metricSlugs.sort().join("|")}::${dimensionNames.sort().join("|")}::${timeRange?.relativeRange ?? "no-time"}`,
          suggestedVisualization: suggestVisualization(
            intent,
            metricSlugs.length,
            dimensionNames.length,
            !!timeRange,
          ),
        },
      };
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Default no-context planner (useful for testing)
// ─────────────────────────────────────────────────────────────────────────────

export const defaultPlanner: QueryPlanner = createQueryPlanner({
  metrics: [],
  dimensions: [],
  joins: [],
  guardrails: [],
  synonymMap: {},
  defaultTimeDimension: "date",
});
