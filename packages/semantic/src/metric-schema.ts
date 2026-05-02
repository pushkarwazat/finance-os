import { z } from "zod";

export const SemanticMetricYamlSchema = z.object({
  apiVersion: z.literal("financeos.io/v1"),
  kind: z.literal("SemanticMetric"),
  metadata: z.object({
    name: z.string(),
    slug: z.string(),
    namespace: z.string().default("finance"),
    labels: z.record(z.string(), z.string()).default({}),
    annotations: z.record(z.string(), z.string()).default({}),
  }),
  spec: z.object({
    displayName: z.string(),
    description: z.string(),
    category: z.enum([
      "revenue",
      "expense",
      "margin",
      "liquidity",
      "leverage",
      "efficiency",
      "valuation",
      "growth",
      "budget",
      "treasury",
      "tax",
      "consolidation",
      "covenant",
      "risk",
    ]),
    unit: z.enum(["currency", "percentage", "ratio", "count", "days"]),
    formula: z.string().optional(),
    dependencies: z.array(z.string()).default([]),
    dataSource: z.object({
      warehouse: z.string(),
      table: z.string(),
      column: z.string(),
      grain: z.enum(["daily", "weekly", "monthly", "quarterly", "annual"]),
      filter: z.string().optional(),
    }),
    aggregation: z.enum(["sum", "avg", "min", "max", "last", "first", "count"]),
    thresholds: z.object({
      warning: z.number().optional(),
      critical: z.number().optional(),
      direction: z.enum(["higher_is_better", "lower_is_better"]).default("higher_is_better"),
    }).optional(),
    formatting: z.object({
      prefix: z.string().optional(),
      suffix: z.string().optional(),
      decimals: z.number().int().min(0).max(6).default(2),
      abbreviate: z.boolean().default(true),
    }).default({ decimals: 2, abbreviate: true }),
    tags: z.array(z.string()).default([]),
    owner: z.string(),
    reviewCycle: z.enum(["weekly", "monthly", "quarterly"]).default("monthly"),
  }),
});
export type SemanticMetricYaml = z.infer<typeof SemanticMetricYamlSchema>;

export interface SemanticMetricRegistry {
  register(metric: SemanticMetricYaml): Promise<void>;
  get(slug: string): Promise<SemanticMetricYaml | null>;
  list(namespace?: string): Promise<SemanticMetricYaml[]>;
  validate(metric: SemanticMetricYaml): { valid: boolean; errors: string[] };
}
