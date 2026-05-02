/**
 * Semantic Engine Adapter Interface
 *
 * Abstracts the semantic / metric layer (dbt Semantic Layer, Cube.dev,
 * LookML, AtScale, Metricflow, or a custom implementation) that translates
 * natural-language query contracts into executable queries.
 *
 * TODO: Replace the stub with a real semantic layer connector.
 * See: docs/onboarding/02-semantic-engine.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticMetricValue {
  metricSlug: string;
  value: number | null;
  formattedValue: string;
  period: string;
  dimensions: Record<string, string | number | boolean>;
  currency?: string;
}

export interface SemanticQueryRequest {
  /** Metric slugs to fetch. */
  metrics: string[];
  /** Dimension slugs to group by. */
  dimensions?: string[];
  /** ISO 8601 date range. */
  timeRange?: { start: string; end: string; granularity: string };
  /** Comparison window (for variance). */
  comparisonPeriod?: { start: string; end: string };
  /** Arbitrary filters expressed as semantic-layer filter objects. */
  filters?: Array<{ dimension: string; operator: string; value: unknown }>;
  /** Max rows returned. */
  limit?: number;
  /** Sort direction for ranked queries. */
  sortDirection?: "asc" | "desc";
  requestId?: string;
  traceId?: string;
}

export interface SemanticQueryResult {
  metrics: SemanticMetricValue[];
  totalRows: number;
  executionMs: number;
  queryId?: string;
  /** The SQL that was ultimately executed (for audit/debug). Never expose to end users. */
  debugSql?: string;
  cached: boolean;
}

export interface SemanticMetricDefinition {
  slug: string;
  displayName: string;
  description: string;
  unit: string;
  grain: string;
  domain: string;
  synonyms: string[];
  allowedDimensions: string[];
}

export interface SemanticEngineHealthStatus {
  connected: boolean;
  latencyMs?: number;
  engineVersion?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticEngineAdapter {
  readonly name: string;

  /**
   * Execute a semantic query request and return typed metric values.
   */
  query(request: SemanticQueryRequest): Promise<SemanticQueryResult>;

  /**
   * List all metric definitions available in this semantic layer.
   * Used to populate the metric registry and NL synonym map.
   */
  listMetrics(): Promise<SemanticMetricDefinition[]>;

  /**
   * Fetch a single metric definition by slug.
   */
  getMetric(slug: string): Promise<SemanticMetricDefinition | null>;

  /**
   * Health check — called by /healthz.
   */
  healthCheck(): Promise<SemanticEngineHealthStatus>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub — replace with real connector in production
// TODO: Implement DbtSemanticLayerAdapter, CubeAdapter, etc.
// ─────────────────────────────────────────────────────────────────────────────

export class StubSemanticEngineAdapter implements SemanticEngineAdapter {
  readonly name = "stub-semantic-engine";

  async query(request: SemanticQueryRequest): Promise<SemanticQueryResult> {
    // TODO: Connect to real semantic layer. See docs/onboarding/02-semantic-engine.md
    void request;
    return { metrics: [], totalRows: 0, executionMs: 0, cached: false };
  }

  async listMetrics(): Promise<SemanticMetricDefinition[]> {
    // TODO: Return metrics from real semantic layer
    return [];
  }

  async getMetric(_slug: string): Promise<SemanticMetricDefinition | null> {
    // TODO: Return metric from real semantic layer
    return null;
  }

  async healthCheck(): Promise<SemanticEngineHealthStatus> {
    return { connected: false, error: "StubSemanticEngineAdapter: no real engine configured. See docs/onboarding/02-semantic-engine.md" };
  }
}
