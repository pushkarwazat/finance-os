import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Intent types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The eight supported intent classes.
 *
 * metric_lookup       — Retrieve a single metric value or current state.
 * trend_analysis      — Show how a metric changes over time.
 * variance_analysis   — Explain deviation from budget, target, or prior period.
 * comparison          — Compare two or more entities, periods, or cohorts.
 * ranking             — Sort entities by a metric and return top / bottom N.
 * cohort_question     — Analyse a group of customers / records defined by an
 *                        acquisition or event date.
 * clarification_required — The system cannot resolve the query without more
 *                        information from the user.
 * unsupported_request — The query cannot be answered through the semantic layer
 *                        (policy violation, no coverage, raw-SQL request, etc.).
 */
export const IntentTypeSchema = z.enum([
  "metric_lookup",
  "trend_analysis",
  "variance_analysis",
  "comparison",
  "ranking",
  "cohort_question",
  "clarification_required",
  "unsupported_request",
]);
export type IntentType = z.infer<typeof IntentTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Intent signal patterns (used by the classifier)
// ─────────────────────────────────────────────────────────────────────────────

export interface IntentPattern {
  intent: IntentType;
  patterns: RegExp[];
  /** Priority — higher values are evaluated first (avoids false positives). */
  priority: number;
}

export const INTENT_PATTERNS: IntentPattern[] = [
  // ── unsupported: must be first to short-circuit other matches ────────────
  {
    intent: "unsupported_request",
    priority: 100,
    patterns: [
      /\b(write|generate|create|produce|export).{0,30}\b(sql|query|script|code)\b/i,
      /\b(sql query|raw sql|sql script|sql code|sql statement)\b/i,
      /\braw (data|sql|table|export|dump)\b/i,
      /\b(personal|pii|ssn|credit card|password|salary of)\b/i,
      /\b(stock price|share price|market cap|valuation multiple)\b/i,
      /\b(buy|sell|invest|trade|position)\b/i,
    ],
  },

  // ── clarification: patterns that indicate ambiguity ──────────────────────
  {
    intent: "clarification_required",
    priority: 90,
    patterns: [
      /^(what|show|tell me|give me)\s+(it|that|this|the thing)\b/i,
      /\b(some|any|a few|couple of)\s+metrics?\b/i,
    ],
  },

  // ── cohort_question ───────────────────────────────────────────────────────
  {
    intent: "cohort_question",
    priority: 80,
    patterns: [
      /\b(cohort|acquired in|signed up in|joined in|onboarded in)\b/i,
      /\b(customers from|clients from|users from)\s+(q[1-4]|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
      /\b(retention|churn)\s+(of|for|among)\s+(customers|clients|accounts)\s+(who|that)\b/i,
    ],
  },

  // ── variance_analysis ────────────────────────────────────────────────────
  {
    intent: "variance_analysis",
    priority: 70,
    patterns: [
      /\b(why|what caused|explain|reason for|driver(s)?|root cause)\b/i,
      /\b(miss|beat|shortfall|overrun|behind|ahead of)\b/i,
      /\b(variance|gap|deviation|delta)\b/i,
      /\b(below|above|under|over)\s+(budget|target|plan|forecast|expectation)\b/i,
    ],
  },

  // ── ranking ──────────────────────────────────────────────────────────────
  {
    intent: "ranking",
    priority: 60,
    patterns: [
      /\b(top|bottom)\s+\d+\b/i,
      /\b(best|worst|highest|lowest|largest|smallest)\b/i,
      /\b(most|least)\s+(profitable|expensive|active|valuable|common|frequent)\b/i,
      /\branking\b/i,
    ],
  },

  // ── trend_analysis ───────────────────────────────────────────────────────
  {
    intent: "trend_analysis",
    priority: 50,
    patterns: [
      /\b(trend(s|ed|ing)?|over time|trajectory|movement|progression)\b/i,
      /\b(month.over.month|quarter.over.quarter|year.over.year|yoy|qoq|mom)\b/i,
      /\bhow (has|did|have).+(changed?|moved?|grown?|declined?|evolved?)\b/i,
      /\b(last|past|previous)\s+(\d+\s+)?(months?|quarters?|years?|weeks?)\b/i,
    ],
  },

  // ── comparison ───────────────────────────────────────────────────────────
  {
    intent: "comparison",
    priority: 40,
    patterns: [
      /\b(compare|vs\.?|versus|against|relative to|compared (to|with))\b/i,
      /\b(difference between|contrast)\b/i,
      /\b(higher|lower|better|worse|more|less) than\b/i,
    ],
  },

  // ── metric_lookup ────────────────────────────────────────────────────────
  {
    intent: "metric_lookup",
    priority: 10,
    patterns: [
      /\b(what (is|are|was|were)|show me|get|fetch|retrieve|tell me)\b/i,
      /\b(current|latest|today'?s?|this (month|quarter|year))\b/i,
      /\b(arr|mrr|nrr|dso|arpu|ltv|cac|ebitda|gross margin|churn rate|burn rate)\b/i,
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Intent catalogue entry (for API response)
// ─────────────────────────────────────────────────────────────────────────────

export const IntentCatalogueEntrySchema = z.object({
  intent: IntentTypeSchema,
  label: z.string(),
  description: z.string(),
  exampleQuestions: z.array(z.string()),
  supportedMetricSlugs: z.array(z.string()).optional(),
  requiresTimeRange: z.boolean(),
  requiresComparison: z.boolean(),
  maxConfidence: z.number().min(0).max(1),
});
export type IntentCatalogueEntry = z.infer<typeof IntentCatalogueEntrySchema>;

export const INTENT_CATALOGUE: IntentCatalogueEntry[] = [
  {
    intent: "metric_lookup",
    label: "Metric Lookup",
    description: "Retrieve a point-in-time value for one or more named metrics.",
    requiresTimeRange: false,
    requiresComparison: false,
    maxConfidence: 0.97,
    exampleQuestions: [
      "What is our current ARR?",
      "Show me gross margin for Q3 FY2025.",
      "What was MRR at the end of October?",
    ],
  },
  {
    intent: "trend_analysis",
    label: "Trend Analysis",
    description: "Show how a metric has changed over a time series.",
    requiresTimeRange: true,
    requiresComparison: false,
    maxConfidence: 0.95,
    exampleQuestions: [
      "How has NRR trended over the last 6 months?",
      "Show month-over-month revenue growth for FY2025.",
      "What is the trajectory of our DSO over the last year?",
    ],
  },
  {
    intent: "variance_analysis",
    label: "Variance Analysis",
    description: "Explain a deviation from budget, target, prior period, or plan.",
    requiresTimeRange: true,
    requiresComparison: true,
    maxConfidence: 0.92,
    exampleQuestions: [
      "Why did we miss the Q4 revenue budget?",
      "What drove the gross margin compression in October?",
      "Explain the $2M gap between actual and budgeted OpEx.",
    ],
  },
  {
    intent: "comparison",
    label: "Comparison",
    description: "Compare metrics across two or more entities, periods, or segments.",
    requiresTimeRange: false,
    requiresComparison: true,
    maxConfidence: 0.93,
    exampleQuestions: [
      "Compare EMEA vs APAC revenue for Q3.",
      "How does our gross margin compare to last year?",
      "Which product line has higher NRR — Enterprise or SMB?",
    ],
  },
  {
    intent: "ranking",
    label: "Ranking",
    description: "Rank entities by a metric and return top or bottom N results.",
    requiresTimeRange: false,
    requiresComparison: false,
    maxConfidence: 0.94,
    exampleQuestions: [
      "Top 10 customers by ARR.",
      "Which 5 regions have the lowest gross margin?",
      "What are the largest expense line items this quarter?",
    ],
  },
  {
    intent: "cohort_question",
    label: "Cohort Analysis",
    description: "Analyse a group defined by acquisition date, event, or property.",
    requiresTimeRange: true,
    requiresComparison: false,
    maxConfidence: 0.91,
    exampleQuestions: [
      "What is the 12-month retention rate for customers acquired in Q1 FY2025?",
      "Show expansion revenue from the January 2024 cohort.",
      "How do customers onboarded in H1 compare to H2 cohorts?",
    ],
  },
  {
    intent: "clarification_required",
    label: "Clarification Required",
    description: "The query is ambiguous and needs more information before it can be resolved.",
    requiresTimeRange: false,
    requiresComparison: false,
    maxConfidence: 1.0,
    exampleQuestions: [
      "Show me the numbers.",
      "What happened?",
      "Tell me about revenue.",
    ],
  },
  {
    intent: "unsupported_request",
    label: "Unsupported Request",
    description: "The query cannot be answered by the semantic analytics layer.",
    requiresTimeRange: false,
    requiresComparison: false,
    maxConfidence: 1.0,
    exampleQuestions: [
      "Write me a SQL query for the revenue table.",
      "What is our stock price?",
      "Show me John's salary.",
    ],
  },
];
