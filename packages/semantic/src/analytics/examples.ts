import type { IntentType } from "./intent.js";
import type { FilterOperator, TimeGranularity } from "./query-contract.js";

// ─────────────────────────────────────────────────────────────────────────────
// Canonical example record
// ─────────────────────────────────────────────────────────────────────────────

export interface AnalyticsExample {
  /** Unique ID for this example (used as a stable key in tests). */
  id: string;
  /** The raw user prompt. */
  prompt: string;
  /** Expected parsed output from the pipeline. */
  expected: {
    intent: IntentType;
    /** Minimum confidence the classifier must return. */
    minConfidence: number;
    /** Metric slugs that must appear in the resolved metrics. */
    expectedMetricSlugs: string[];
    /** Dimension slugs that should appear in the query plan (if any). */
    expectedGroupBy?: string[];
    /** Whether a time range is required in the query plan. */
    requiresTimeRange: boolean;
    /** Whether the system should abstain. */
    shouldAbstain: boolean;
    /** Abstention reason if shouldAbstain is true. */
    abstentionReason?: string;
    /** Whether clarification should be required. */
    requiresClarification?: boolean;
    /** Tags for filtering examples in tests / UI. */
    tags: string[];
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// The 100-example canonical test suite
// ─────────────────────────────────────────────────────────────────────────────

export const ANALYTICS_EXAMPLES: AnalyticsExample[] = [

  // ── METRIC LOOKUP (20 examples) ──────────────────────────────────────────

  {
    id: "ml-001",
    prompt: "What is our current ARR?",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["arr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "arr"] },
  },
  {
    id: "ml-002",
    prompt: "Show me gross margin for Q3 FY2025.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: false, shouldAbstain: false, tags: ["margin"] },
  },
  {
    id: "ml-003",
    prompt: "What was MRR at the end of September?",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["mrr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "mrr"] },
  },
  {
    id: "ml-004",
    prompt: "Tell me the NRR for Q2 FY2025.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: false, shouldAbstain: false, tags: ["retention", "nrr"] },
  },
  {
    id: "ml-005",
    prompt: "What is our DSO this quarter?",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["dso"], requiresTimeRange: false, shouldAbstain: false, tags: ["ar", "dso"] },
  },
  {
    id: "ml-006",
    prompt: "Get me the burn rate for October.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["burn_rate"], requiresTimeRange: false, shouldAbstain: false, tags: ["cash_flow"] },
  },
  {
    id: "ml-007",
    prompt: "What is total revenue for FY2025 YTD?",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: false, shouldAbstain: false, tags: ["revenue"] },
  },
  {
    id: "ml-008",
    prompt: "Show net revenue for September 2025.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue"], requiresTimeRange: false, shouldAbstain: false, tags: ["revenue"] },
  },
  {
    id: "ml-009",
    prompt: "How many active customers do we have?",
    expected: { intent: "metric_lookup", minConfidence: 0.65, expectedMetricSlugs: ["active_customers"], requiresTimeRange: false, shouldAbstain: false, tags: ["customers"] },
  },
  {
    id: "ml-010",
    prompt: "What is the current AR balance?",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["ar_balance"], requiresTimeRange: false, shouldAbstain: false, tags: ["ar"] },
  },
  {
    id: "ml-011",
    prompt: "Retrieve cash collected for Q3.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["cash_collected"], requiresTimeRange: false, shouldAbstain: false, tags: ["cash_flow"] },
  },
  {
    id: "ml-012",
    prompt: "What is our collections rate this month?",
    expected: { intent: "metric_lookup", minConfidence: 0.65, expectedMetricSlugs: ["collections_rate"], requiresTimeRange: false, shouldAbstain: false, tags: ["collections"] },
  },
  {
    id: "ml-013",
    prompt: "Show bad debt exposure as of September 30.",
    expected: { intent: "metric_lookup", minConfidence: 0.65, expectedMetricSlugs: ["bad_debt_exposure"], requiresTimeRange: false, shouldAbstain: false, tags: ["collections", "risk"] },
  },
  {
    id: "ml-014",
    prompt: "What is net new ARR for Q3 FY2025?",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["net_new_arr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "arr"] },
  },
  {
    id: "ml-015",
    prompt: "Fetch customer churn rate for the quarter.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["churn_rate"], requiresTimeRange: false, shouldAbstain: false, tags: ["churn"] },
  },
  {
    id: "ml-016",
    prompt: "What is operating expense for FY2025?",
    expected: { intent: "metric_lookup", minConfidence: 0.65, expectedMetricSlugs: ["total_opex"], requiresTimeRange: false, shouldAbstain: false, tags: ["expenses"] },
  },
  {
    id: "ml-017",
    prompt: "Current gross margin please.",
    expected: { intent: "metric_lookup", minConfidence: 0.65, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: false, shouldAbstain: false, tags: ["margin"] },
  },
  {
    id: "ml-018",
    prompt: "What is the EBITDA margin for Q3?",
    expected: { intent: "metric_lookup", minConfidence: 0.60, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: false, tags: ["margin"] },
  },
  {
    id: "ml-019",
    prompt: "Show annual recurring revenue as of July 1.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["arr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "arr"] },
  },
  {
    id: "ml-020",
    prompt: "Get me monthly recurring revenue for August 2025.",
    expected: { intent: "metric_lookup", minConfidence: 0.70, expectedMetricSlugs: ["mrr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "mrr"] },
  },

  // ── TREND ANALYSIS (20 examples) ─────────────────────────────────────────

  {
    id: "ta-001",
    prompt: "How has ARR trended over the last 6 months?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["arr"], requiresTimeRange: true, shouldAbstain: false, tags: ["saas", "trend"] },
  },
  {
    id: "ta-002",
    prompt: "Show month-over-month revenue growth for FY2025.",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: true, shouldAbstain: false, tags: ["revenue", "mom"] },
  },
  {
    id: "ta-003",
    prompt: "What is the trajectory of our DSO over the last year?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["dso"], requiresTimeRange: true, shouldAbstain: false, tags: ["ar", "dso"] },
  },
  {
    id: "ta-004",
    prompt: "How has gross margin changed over the last 4 quarters?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: true, shouldAbstain: false, tags: ["margin", "qoq"] },
  },
  {
    id: "ta-005",
    prompt: "Show me the NRR trend for the past 12 months.",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: true, shouldAbstain: false, tags: ["retention"] },
  },
  {
    id: "ta-006",
    prompt: "How did churn rate evolve from Q1 to Q3 FY2025?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["churn_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["churn", "trend"] },
  },
  {
    id: "ta-007",
    prompt: "Plot MRR growth quarter over quarter for FY2025.",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["mrr"], requiresTimeRange: true, shouldAbstain: false, tags: ["saas", "qoq"] },
  },
  {
    id: "ta-008",
    prompt: "What is the trend in burn rate over the last 3 months?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["burn_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["cash_flow"] },
  },
  {
    id: "ta-009",
    prompt: "How have collections rates trended year to date?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["collections_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["collections"] },
  },
  {
    id: "ta-010",
    prompt: "Show me net new ARR by month for FY2025.",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["net_new_arr"], requiresTimeRange: true, shouldAbstain: false, tags: ["saas", "arr"] },
  },
  {
    id: "ta-011",
    prompt: "How has total revenue grown over the past 2 years?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: true, shouldAbstain: false, tags: ["revenue", "yoy"] },
  },
  {
    id: "ta-012",
    prompt: "YoY opex trend for FY2024 vs FY2025.",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["total_opex"], requiresTimeRange: true, shouldAbstain: false, tags: ["expenses", "yoy"] },
  },
  {
    id: "ta-013",
    prompt: "What is the movement in active customer count over FY2025?",
    expected: { intent: "trend_analysis", minConfidence: 0.65, expectedMetricSlugs: ["active_customers"], requiresTimeRange: true, shouldAbstain: false, tags: ["customers"] },
  },
  {
    id: "ta-014",
    prompt: "Show me the AR balance trend over the last 6 months.",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["ar_balance"], requiresTimeRange: true, shouldAbstain: false, tags: ["ar"] },
  },
  {
    id: "ta-015",
    prompt: "How has cash collected changed month over month?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["cash_collected"], requiresTimeRange: true, shouldAbstain: false, tags: ["cash_flow", "mom"] },
  },
  {
    id: "ta-016",
    prompt: "Revenue progression from Jan to Sep 2025.",
    expected: { intent: "trend_analysis", minConfidence: 0.65, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: true, shouldAbstain: false, tags: ["revenue"] },
  },
  {
    id: "ta-017",
    prompt: "What is the quarterly trend in gross margin for FY2024?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: true, shouldAbstain: false, tags: ["margin"] },
  },
  {
    id: "ta-018",
    prompt: "How has bad debt exposure trended over the past year?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["bad_debt_exposure"], requiresTimeRange: true, shouldAbstain: false, tags: ["collections", "risk"] },
  },
  {
    id: "ta-019",
    prompt: "Show me week-over-week cash collected for September.",
    expected: { intent: "trend_analysis", minConfidence: 0.65, expectedMetricSlugs: ["cash_collected"], requiresTimeRange: true, shouldAbstain: false, tags: ["cash_flow"] },
  },
  {
    id: "ta-020",
    prompt: "What was the NRR trajectory last year?",
    expected: { intent: "trend_analysis", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: true, shouldAbstain: false, tags: ["retention", "nrr"] },
  },

  // ── VARIANCE ANALYSIS (15 examples) ──────────────────────────────────────

  {
    id: "va-001",
    prompt: "Why did we miss the Q3 revenue budget?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: true, shouldAbstain: false, tags: ["variance", "budget"] },
  },
  {
    id: "va-002",
    prompt: "What caused the gross margin compression in Q3?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: true, shouldAbstain: false, tags: ["margin", "variance"] },
  },
  {
    id: "va-003",
    prompt: "Explain the $2M gap between actual and budgeted OpEx.",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["total_opex"], requiresTimeRange: true, shouldAbstain: false, tags: ["expenses", "variance"] },
  },
  {
    id: "va-004",
    prompt: "Why is DSO above target this quarter?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["dso"], requiresTimeRange: true, shouldAbstain: false, tags: ["ar", "variance"] },
  },
  {
    id: "va-005",
    prompt: "What drove the ARR miss in Q2?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["arr"], requiresTimeRange: true, shouldAbstain: false, tags: ["saas", "variance"] },
  },
  {
    id: "va-006",
    prompt: "Reason for the burn rate being above plan in September.",
    expected: { intent: "variance_analysis", minConfidence: 0.65, expectedMetricSlugs: ["burn_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["cash_flow", "variance"] },
  },
  {
    id: "va-007",
    prompt: "Why did churn increase above forecast in Q3?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["churn_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["churn", "variance"] },
  },
  {
    id: "va-008",
    prompt: "Explain the NRR shortfall vs. target for FY2025.",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: true, shouldAbstain: false, tags: ["retention", "variance"] },
  },
  {
    id: "va-009",
    prompt: "What caused the revenue beat in August?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: true, shouldAbstain: false, tags: ["revenue", "variance"] },
  },
  {
    id: "va-010",
    prompt: "Why is collections rate below 95% target this month?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["collections_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["collections", "variance"] },
  },
  {
    id: "va-011",
    prompt: "What is driving the AR balance increase versus prior quarter?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["ar_balance"], requiresTimeRange: true, shouldAbstain: false, tags: ["ar", "variance"] },
  },
  {
    id: "va-012",
    prompt: "Explain the MRR shortfall versus plan for Q3.",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["mrr"], requiresTimeRange: true, shouldAbstain: false, tags: ["saas", "variance"] },
  },
  {
    id: "va-013",
    prompt: "What caused the unfavorable budget variance in R&D spending?",
    expected: { intent: "variance_analysis", minConfidence: 0.65, expectedMetricSlugs: ["total_opex"], requiresTimeRange: true, shouldAbstain: false, tags: ["expenses", "budget"] },
  },
  {
    id: "va-014",
    prompt: "Why is our gross margin 200bps below last year?",
    expected: { intent: "variance_analysis", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: true, shouldAbstain: false, tags: ["margin", "yoy"] },
  },
  {
    id: "va-015",
    prompt: "Explain why cash collected is ahead of target in Q3.",
    expected: { intent: "variance_analysis", minConfidence: 0.65, expectedMetricSlugs: ["cash_collected"], requiresTimeRange: true, shouldAbstain: false, tags: ["cash_flow", "variance"] },
  },

  // ── COMPARISON (15 examples) ──────────────────────────────────────────────

  {
    id: "cp-001",
    prompt: "Compare EMEA vs APAC revenue for Q3.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], expectedGroupBy: ["region"], requiresTimeRange: false, shouldAbstain: false, tags: ["comparison", "regional"] },
  },
  {
    id: "cp-002",
    prompt: "How does our gross margin compare to last year?",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: false, shouldAbstain: false, tags: ["margin", "yoy"] },
  },
  {
    id: "cp-003",
    prompt: "Compare Q3 FY2025 ARR versus Q3 FY2024.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["arr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "yoy"] },
  },
  {
    id: "cp-004",
    prompt: "Enterprise vs SMB churn rate comparison.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["churn_rate"], expectedGroupBy: ["customer_tier"], requiresTimeRange: false, shouldAbstain: false, tags: ["churn", "segment"] },
  },
  {
    id: "cp-005",
    prompt: "How does current DSO compare to the 45-day target?",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["dso"], requiresTimeRange: false, shouldAbstain: false, tags: ["ar", "target"] },
  },
  {
    id: "cp-006",
    prompt: "Q2 vs Q3 revenue comparison for FY2025.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], requiresTimeRange: false, shouldAbstain: false, tags: ["revenue", "qoq"] },
  },
  {
    id: "cp-007",
    prompt: "Is burn rate higher or lower than last quarter?",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["burn_rate"], requiresTimeRange: false, shouldAbstain: false, tags: ["cash_flow"] },
  },
  {
    id: "cp-008",
    prompt: "Compare NRR across product lines.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], expectedGroupBy: ["product_line"], requiresTimeRange: false, shouldAbstain: false, tags: ["retention", "segment"] },
  },
  {
    id: "cp-009",
    prompt: "Collections rate this month versus prior month.",
    expected: { intent: "comparison", minConfidence: 0.65, expectedMetricSlugs: ["collections_rate"], requiresTimeRange: false, shouldAbstain: false, tags: ["collections", "mom"] },
  },
  {
    id: "cp-010",
    prompt: "Compare net new ARR in H1 vs H2 FY2025.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["net_new_arr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "arr"] },
  },
  {
    id: "cp-011",
    prompt: "Is gross margin better or worse than budget?",
    expected: { intent: "comparison", minConfidence: 0.65, expectedMetricSlugs: ["gross_margin"], requiresTimeRange: false, shouldAbstain: false, tags: ["margin", "budget"] },
  },
  {
    id: "cp-012",
    prompt: "Total revenue Americas versus EMEA year to date.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], expectedGroupBy: ["region"], requiresTimeRange: false, shouldAbstain: false, tags: ["revenue", "regional"] },
  },
  {
    id: "cp-013",
    prompt: "How does MRR compare to last year same period?",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["mrr"], requiresTimeRange: false, shouldAbstain: false, tags: ["saas", "yoy"] },
  },
  {
    id: "cp-014",
    prompt: "Active customers FY2024 vs FY2025.",
    expected: { intent: "comparison", minConfidence: 0.65, expectedMetricSlugs: ["active_customers"], requiresTimeRange: false, shouldAbstain: false, tags: ["customers", "yoy"] },
  },
  {
    id: "cp-015",
    prompt: "Actual versus budget OpEx for the full year.",
    expected: { intent: "comparison", minConfidence: 0.70, expectedMetricSlugs: ["total_opex"], requiresTimeRange: false, shouldAbstain: false, tags: ["expenses", "budget"] },
  },

  // ── RANKING (10 examples) ────────────────────────────────────────────────

  {
    id: "rk-001",
    prompt: "Top 10 customers by ARR.",
    expected: { intent: "ranking", minConfidence: 0.70, expectedMetricSlugs: ["arr"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "customers"] },
  },
  {
    id: "rk-002",
    prompt: "Which 5 regions have the lowest gross margin?",
    expected: { intent: "ranking", minConfidence: 0.70, expectedMetricSlugs: ["gross_margin"], expectedGroupBy: ["region"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "regional"] },
  },
  {
    id: "rk-003",
    prompt: "What are the largest expense line items this quarter?",
    expected: { intent: "ranking", minConfidence: 0.70, expectedMetricSlugs: ["total_opex"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "expenses"] },
  },
  {
    id: "rk-004",
    prompt: "Top 3 product lines by revenue in Q3.",
    expected: { intent: "ranking", minConfidence: 0.70, expectedMetricSlugs: ["total_revenue"], expectedGroupBy: ["product_line"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "revenue"] },
  },
  {
    id: "rk-005",
    prompt: "Which customers have the highest churn risk based on DSO?",
    expected: { intent: "ranking", minConfidence: 0.65, expectedMetricSlugs: ["dso"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "risk"] },
  },
  {
    id: "rk-006",
    prompt: "Bottom 5 accounts by NRR.",
    expected: { intent: "ranking", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "retention"] },
  },
  {
    id: "rk-007",
    prompt: "Largest contributors to bad debt exposure.",
    expected: { intent: "ranking", minConfidence: 0.65, expectedMetricSlugs: ["bad_debt_exposure"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "risk"] },
  },
  {
    id: "rk-008",
    prompt: "Rank sales channels by new ARR this year.",
    expected: { intent: "ranking", minConfidence: 0.65, expectedMetricSlugs: ["net_new_arr"], expectedGroupBy: ["channel"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "saas"] },
  },
  {
    id: "rk-009",
    prompt: "Top 10 invoices by outstanding amount.",
    expected: { intent: "ranking", minConfidence: 0.65, expectedMetricSlugs: ["ar_balance"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "ar"] },
  },
  {
    id: "rk-010",
    prompt: "Which departments have the worst budget variance?",
    expected: { intent: "ranking", minConfidence: 0.65, expectedMetricSlugs: ["budget_variance"], expectedGroupBy: ["department"], requiresTimeRange: false, shouldAbstain: false, tags: ["ranking", "budget"] },
  },

  // ── COHORT ANALYSIS (5 examples) ─────────────────────────────────────────

  {
    id: "co-001",
    prompt: "What is the 12-month retention rate for customers acquired in Q1 FY2025?",
    expected: { intent: "cohort_question", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: true, shouldAbstain: false, tags: ["cohort", "retention"] },
  },
  {
    id: "co-002",
    prompt: "Show expansion revenue from the January 2024 cohort.",
    expected: { intent: "cohort_question", minConfidence: 0.70, expectedMetricSlugs: ["net_new_arr"], requiresTimeRange: true, shouldAbstain: false, tags: ["cohort", "expansion"] },
  },
  {
    id: "co-003",
    prompt: "How do customers onboarded in H1 FY2025 compare to H2 cohorts in NRR?",
    expected: { intent: "cohort_question", minConfidence: 0.70, expectedMetricSlugs: ["net_revenue_retention"], requiresTimeRange: true, shouldAbstain: false, tags: ["cohort", "nrr"] },
  },
  {
    id: "co-004",
    prompt: "Churn rate for enterprise customers acquired in Q4 FY2024.",
    expected: { intent: "cohort_question", minConfidence: 0.65, expectedMetricSlugs: ["churn_rate"], requiresTimeRange: true, shouldAbstain: false, tags: ["cohort", "churn"] },
  },
  {
    id: "co-005",
    prompt: "What is the ARR retention for the March 2025 cohort at 6 months?",
    expected: { intent: "cohort_question", minConfidence: 0.65, expectedMetricSlugs: ["arr"], requiresTimeRange: true, shouldAbstain: false, tags: ["cohort", "retention"] },
  },

  // ── CLARIFICATION REQUIRED (5 examples) ──────────────────────────────────

  {
    id: "cl-001",
    prompt: "Show me the numbers.",
    expected: { intent: "clarification_required", minConfidence: 0.85, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: false, requiresClarification: true, tags: ["clarification"] },
  },
  {
    id: "cl-002",
    prompt: "What happened?",
    expected: { intent: "clarification_required", minConfidence: 0.85, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: false, requiresClarification: true, tags: ["clarification"] },
  },
  {
    id: "cl-003",
    prompt: "Tell me about it.",
    expected: { intent: "clarification_required", minConfidence: 0.85, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: false, requiresClarification: true, tags: ["clarification"] },
  },
  {
    id: "cl-004",
    prompt: "Show me some metrics.",
    expected: { intent: "clarification_required", minConfidence: 0.85, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: false, requiresClarification: true, tags: ["clarification"] },
  },
  {
    id: "cl-005",
    prompt: "Give me a few metrics to review.",
    expected: { intent: "clarification_required", minConfidence: 0.85, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: false, requiresClarification: true, tags: ["clarification"] },
  },

  // ── UNSUPPORTED / ABSTENTION (10 examples) ────────────────────────────────

  {
    id: "us-001",
    prompt: "Write me a SQL query to get the revenue from the invoices table.",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "sql"] },
  },
  {
    id: "us-002",
    prompt: "What is our stock price today?",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "market"] },
  },
  {
    id: "us-003",
    prompt: "Generate a SQL script to export all customer records.",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "sql"] },
  },
  {
    id: "us-004",
    prompt: "What is the EV/ARR multiple for our latest fundraise?",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "market"] },
  },
  {
    id: "us-005",
    prompt: "Show me John Smith's salary.",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "pii_detected", tags: ["abstention", "pii"] },
  },
  {
    id: "us-006",
    prompt: "Give me the raw data dump from the revenue table.",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "sql"] },
  },
  {
    id: "us-007",
    prompt: "What is our market capitalisation?",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "market"] },
  },
  {
    id: "us-008",
    prompt: "Create a Python script to pull all invoices from the database.",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "sql"] },
  },
  {
    id: "us-009",
    prompt: "What should I buy or sell based on our financials?",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "market"] },
  },
  {
    id: "us-010",
    prompt: "Export the entire AR aging table to CSV.",
    expected: { intent: "unsupported_request", minConfidence: 0.90, expectedMetricSlugs: [], requiresTimeRange: false, shouldAbstain: true, abstentionReason: "unsupported_operation", tags: ["abstention", "sql"] },
  },
];

// ── Convenience accessors ────────────────────────────────────────────────────

export function getExamplesByIntent(intent: IntentType): AnalyticsExample[] {
  return ANALYTICS_EXAMPLES.filter((e) => e.expected.intent === intent);
}

export function getExamplesByTag(tag: string): AnalyticsExample[] {
  return ANALYTICS_EXAMPLES.filter((e) => e.expected.tags.includes(tag));
}

export function getAbstentionExamples(): AnalyticsExample[] {
  return ANALYTICS_EXAMPLES.filter((e) => e.expected.shouldAbstain);
}

export function getClarificationExamples(): AnalyticsExample[] {
  return ANALYTICS_EXAMPLES.filter((e) => e.expected.requiresClarification);
}
