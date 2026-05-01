import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Clarification type taxonomy
// ─────────────────────────────────────────────────────────────────────────────

export const ClarificationTypeSchema = z.enum([
  /** The user's question does not specify which period to analyse. */
  "time_range",
  /** The user named a metric that maps to multiple semantic metrics. */
  "metric_ambiguity",
  /** A grouping dimension is ambiguous (e.g. "region" could be legal entity or sales territory). */
  "dimension_ambiguity",
  /** The scope is unclear — e.g. "all customers" vs. "enterprise tier only". */
  "scope",
  /** A filter value is present but cannot be resolved (unknown product name, etc.). */
  "value_ambiguity",
  /** The question is too broad to produce a useful plan. */
  "too_broad",
]);
export type ClarificationType = z.infer<typeof ClarificationTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// A single clarification dimension needed from the user
// ─────────────────────────────────────────────────────────────────────────────

export const ClarificationDimensionSchema = z.object({
  type: ClarificationTypeSchema,
  /** Machine-readable parameter name being clarified. */
  parameter: z.string(),
  /** Question to surface to the user. */
  prompt: z.string(),
  /**
   * Structured options the user can pick from.
   * Present only when there is a finite, known set of choices.
   */
  options: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  /**
   * Default that will be applied if the user does not respond within
   * the timeout or explicitly asks to proceed.
   */
  suggestedDefault: z
    .object({
      value: z.string(),
      rationale: z.string(),
    })
    .optional(),
});
export type ClarificationDimension = z.infer<typeof ClarificationDimensionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Clarification request — the full payload sent back to the client when
// the system cannot resolve a query without additional input.
// ─────────────────────────────────────────────────────────────────────────────

export const ClarificationRequestSchema = z.object({
  /** Opaque ID for this clarification round. */
  clarificationId: z.string().uuid(),
  /** The contract ID that triggered this clarification. */
  contractId: z.string().uuid(),
  /**
   * Summary message to display to the user explaining why clarification
   * is needed.
   */
  message: z.string(),
  /**
   * Whether any dimension has a usable default that lets the system
   * proceed autonomously.
   */
  canProceedWithDefaults: z.boolean(),
  /**
   * When true, the system will proceed using all available defaults
   * after one response turn regardless of user answer.
   */
  autoResolveAfterOneTurn: z.boolean().default(true),
  /** The specific dimensions that need clarification. */
  dimensions: z.array(ClarificationDimensionSchema).min(1),
});
export type ClarificationRequest = z.infer<typeof ClarificationRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Clarification response — what the user (or a UI picker) sends back
// ─────────────────────────────────────────────────────────────────────────────

export const ClarificationResponseSchema = z.object({
  clarificationId: z.string().uuid(),
  contractId: z.string().uuid(),
  /** Map of parameter → resolved value. */
  resolutions: z.record(z.string(), z.string()),
  /** True when the user explicitly asked to use defaults. */
  useDefaults: z.boolean().default(false),
});
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Clarification builder — helper that generates common clarification payloads
// ─────────────────────────────────────────────────────────────────────────────

export function buildTimeRangeClarification(
  contractId: string,
  clarificationId: string
): ClarificationRequest {
  return ClarificationRequestSchema.parse({
    clarificationId,
    contractId,
    message:
      "Your question doesn't specify a time period. Please choose one of the standard reporting periods below, or type a custom date range.",
    canProceedWithDefaults: true,
    autoResolveAfterOneTurn: true,
    dimensions: [
      {
        type: "time_range",
        parameter: "time_range",
        prompt: "Which period would you like to analyse?",
        options: [
          { label: "Current Quarter (Q3 FY2025)", value: "2025-07-01/2025-09-30", description: "Most recent closed quarter" },
          { label: "Last 3 Months", value: "rolling_3m", description: "Rolling 90-day window ending today" },
          { label: "Last 6 Months", value: "rolling_6m", description: "Rolling 180-day window ending today" },
          { label: "Year to Date (FY2025)", value: "2025-01-01/2025-09-30", description: "Full fiscal year to date" },
          { label: "Full Year FY2024", value: "2024-01-01/2024-12-31", description: "Prior fiscal year" },
        ],
        suggestedDefault: {
          value: "2025-07-01/2025-09-30",
          rationale: "Defaulting to the most recently closed quarter (Q3 FY2025).",
        },
      },
    ],
  });
}

export function buildMetricAmbiguityClarification(
  contractId: string,
  clarificationId: string,
  rawTerm: string,
  candidates: Array<{ slug: string; label: string; description: string }>
): ClarificationRequest {
  return ClarificationRequestSchema.parse({
    clarificationId,
    contractId,
    message: `The term "${rawTerm}" matches multiple metrics. Please choose the one you meant.`,
    canProceedWithDefaults: false,
    autoResolveAfterOneTurn: false,
    dimensions: [
      {
        type: "metric_ambiguity",
        parameter: "metric",
        prompt: `Which "${rawTerm}" metric do you mean?`,
        options: candidates.map((c) => ({
          label: c.label,
          value: c.slug,
          description: c.description,
        })),
      },
    ],
  });
}
