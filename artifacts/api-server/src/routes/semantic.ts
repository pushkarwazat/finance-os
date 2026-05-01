import { Router } from "express";

const router = Router();

// ── Static in-memory glossary data (derived from packages/semantic/glossary.yaml)
// In production this would be loaded from the semantic registry, but during
// scaffold phase we serve the compiled model directly from static data.

const GLOSSARY_ENTRIES = [
  {
    term: "Total Revenue",
    slug: "total_revenue",
    domain: "revenue",
    shortDefinition: "Gross revenue recognized in the period before any deductions.",
    definition: "Total Revenue is the top line of the income statement. It represents all revenue recognized under ASC 606 in the reporting period, including subscription, professional services, usage-based, and support revenue. It is measured before discounts, credits, or returns.",
    formula: "SUM(gross_amount_usd) WHERE status != 'voided'",
    relatedMetrics: ["net_revenue", "gross_margin"],
    tags: ["income_statement", "kpi", "top_line"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Net Revenue",
    slug: "net_revenue",
    domain: "revenue",
    shortDefinition: "Revenue after discounts, credits, and returns.",
    definition: "Net Revenue equals Total Revenue minus all customer deductions: contractual discounts, credit memos, and product returns. It is the basis for Gross Margin calculation.",
    formula: "SUM(net_amount_usd) WHERE status NOT IN ('voided', 'reversed')",
    relatedMetrics: ["gross_margin", "total_revenue"],
    tags: ["income_statement", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Gross Margin",
    slug: "gross_margin",
    domain: "revenue",
    shortDefinition: "(Net Revenue - COGS) / Net Revenue. Measures profitability of core product.",
    definition: "Gross Margin measures how much revenue remains after direct costs (COGS) are removed. For SaaS companies, COGS typically includes hosting, customer support, and third-party software. Best-in-class SaaS targets ≥ 70% gross margin.",
    formula: "(net_revenue - cogs) / net_revenue × 100",
    relatedMetrics: ["net_revenue", "total_revenue"],
    tags: ["margin", "income_statement", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Net Revenue Retention",
    slug: "net_revenue_retention",
    domain: "revenue",
    shortDefinition: "Revenue retained + expanded from existing customers. NRR > 100% means cohort is growing.",
    definition: "Net Revenue Retention (NRR), also called Net Dollar Retention, measures the percentage of recurring revenue retained from existing customers after accounting for expansions, contractions, and churn. NRR > 100% indicates expansion revenue outweighs churn.",
    formula: "(Beginning ARR + Expansion - Contraction - Churn) / Beginning ARR",
    relatedMetrics: ["arr", "customer_churn_rate"],
    tags: ["saas", "retention", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Annual Recurring Revenue",
    slug: "arr",
    domain: "subscriptions",
    shortDefinition: "Annualized value of all active subscription contracts at period end.",
    definition: "ARR represents the annualized value of contracted recurring revenue. It is a point-in-time snapshot taken at the end of each month. ARR excludes one-time fees, professional services, and variable usage revenue.",
    formula: "SUM(mrr_usd WHERE status = 'active') × 12",
    relatedMetrics: ["mrr", "net_new_arr", "net_revenue_retention"],
    tags: ["saas", "recurring_revenue", "kpi", "tier_1"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Monthly Recurring Revenue",
    slug: "mrr",
    domain: "subscriptions",
    shortDefinition: "Total monthly subscription value of all active contracts.",
    definition: "MRR is the normalized monthly value of all active subscription contracts. Annual subscriptions are divided by 12. MRR is the basis for ARR (MRR × 12) and the waterfall analysis (new, expansion, contraction, churn).",
    formula: "SUM(mrr_usd WHERE status = 'active')",
    relatedMetrics: ["arr", "net_new_arr"],
    tags: ["saas", "recurring_revenue", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Net New ARR",
    slug: "net_new_arr",
    domain: "subscriptions",
    shortDefinition: "Change in ARR during the period across all movement types.",
    definition: "Net New ARR equals the sum of all ARR movements in a period: New ARR + Expansion ARR - Contraction ARR - Churned ARR + Reactivation ARR. Positive = ARR base grew. The primary indicator of business momentum.",
    formula: "(new_mrr + expansion_mrr + reactivation_mrr - contraction_mrr - churned_mrr) × 12",
    relatedMetrics: ["arr", "mrr"],
    tags: ["saas", "growth", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "AR Balance",
    slug: "ar_balance",
    domain: "invoices",
    shortDefinition: "Total billed but uncollected amounts from customers.",
    definition: "Accounts Receivable (AR) Balance is the sum of all outstanding invoice amounts that have been billed but not yet collected from customers. AR appears as a current asset on the balance sheet.",
    formula: "SUM(open_amount_usd WHERE status IN ('sent', 'partial', 'overdue'))",
    relatedMetrics: ["dso", "collections_rate"],
    tags: ["ar", "balance_sheet", "cash_flow"],
    certifiedBy: "Controller",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Days Sales Outstanding",
    slug: "dso",
    domain: "invoices",
    shortDefinition: "Average days to collect payment after invoicing.",
    definition: "DSO measures how many days on average it takes to collect payment after an invoice is issued. A lower DSO indicates faster collections and better cash flow. Computed as: (AR Balance / Revenue) × Days in Period. Target: ≤ 45 days for Net 30 terms.",
    formula: "(AR Balance / Total Revenue) × Days in Period",
    relatedMetrics: ["ar_balance", "cash_collected"],
    tags: ["ar", "efficiency", "cash_flow", "kpi"],
    certifiedBy: "Controller",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Collections Rate",
    slug: "collections_rate",
    domain: "collections",
    shortDefinition: "Percentage of billed amounts successfully collected in the period.",
    definition: "Collections Rate measures how effectively the AR team converts billed invoices into cash. Calculated as cash collected divided by total invoiced amount. A rate below 90% indicates a collections process issue. Best-in-class: > 97%.",
    formula: "Cash Collected / Total Invoiced Amount",
    relatedMetrics: ["cash_collected", "ar_balance"],
    tags: ["ar", "collections", "efficiency", "kpi"],
    certifiedBy: "Controller",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Bad Debt Exposure",
    slug: "bad_debt_exposure",
    domain: "collections",
    shortDefinition: "AR more than 90 days past due — highest write-off risk.",
    definition: "Bad Debt Exposure is the total AR balance that is more than 90 days past due. These amounts require a bad-debt reserve provision per GAAP and are likely to require write-off or legal escalation.",
    formula: "SUM(balance_usd WHERE aging_bucket = '90+')",
    relatedMetrics: ["ar_balance", "collections_rate"],
    tags: ["ar", "risk", "collections"],
    lastReviewed: "2025-10-01",
  },
  {
    term: "Burn Rate",
    slug: "burn_rate",
    domain: "expenses",
    shortDefinition: "Net monthly cash outflow (OpEx minus cash collected from customers).",
    definition: "Burn Rate is the rate at which a company spends cash each month. Net Burn = Total Operating Expenses - Cash Collected. Gross Burn = Total Operating Expenses only. Burn Rate drives runway calculation: Cash / Monthly Net Burn = Months of Runway.",
    formula: "Total OpEx - Cash Collected",
    relatedMetrics: ["total_opex", "cash_collected"],
    tags: ["cash_flow", "expenses", "runway", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Total OpEx",
    slug: "total_opex",
    domain: "expenses",
    shortDefinition: "Sum of all operating expenses excluding cost of revenue.",
    definition: "Total Operating Expenses (OpEx) covers all expenses required to run the business excluding COGS. Includes R&D, Sales & Marketing, and G&A. Used for operational efficiency ratios and budget vs. actual analysis.",
    formula: "SUM(amount_usd WHERE account_type = 'expense' AND is_capex = false)",
    relatedMetrics: ["burn_rate", "rd_ratio"],
    tags: ["expenses", "income_statement", "p_and_l"],
    certifiedBy: "Controller",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Budget Variance",
    slug: "budget_variance",
    domain: "budget_vs_actual",
    shortDefinition: "Actual result minus budgeted amount. Positive = favorable.",
    definition: "Budget Variance is the difference between actual financial results and the approved budget. For revenue: positive is favorable. For expenses: negative is favorable. Sign convention: Actual - Budget. A ±5% variance is typically within acceptable tolerance.",
    formula: "Actual Amount - Budget Amount",
    relatedMetrics: ["budget_attainment"],
    tags: ["planning", "variance", "budget", "kpi"],
    certifiedBy: "FP&A Lead",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Active Customers",
    slug: "active_customers",
    domain: "customers",
    shortDefinition: "Count of customer accounts with active status at period end.",
    definition: "Active Customers is the count of distinct customer accounts with status = 'active' at the end of the reporting period. Customers in trial, churned, or suspended states are excluded. This is a point-in-time count, not a period average.",
    formula: "COUNT(DISTINCT customer_id WHERE status = 'active' AND snapshot_date = period_end)",
    relatedMetrics: ["customer_churn_rate", "new_customers"],
    tags: ["customers", "kpi", "retention"],
    certifiedBy: "Revenue Ops",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Customer Churn Rate",
    slug: "churn_rate",
    domain: "customers",
    shortDefinition: "Percentage of customers lost in the period.",
    definition: "Customer Churn Rate (Logo Churn) measures the percentage of active customers at the start of the period who cancelled by period end. It does not account for revenue impact — for that, use NRR instead.",
    formula: "Churned Customers / Beginning-of-Period Active Customers",
    relatedMetrics: ["active_customers", "net_revenue_retention"],
    tags: ["customers", "churn", "kpi", "retention"],
    certifiedBy: "Revenue Ops",
    lastReviewed: "2025-10-01",
  },
  {
    term: "Cash Collected",
    slug: "cash_collected",
    domain: "payments",
    shortDefinition: "Actual cash received from customers (cleared payments only).",
    definition: "Cash Collected is the total value of cleared payment transactions received from customers in the period. Distinct from recognized revenue (which follows ASC 606 timing). Used for treasury forecasting and burn rate calculation.",
    formula: "SUM(amount_usd WHERE status = 'cleared')",
    relatedMetrics: ["collections_rate", "dso"],
    tags: ["cash_flow", "treasury", "ar", "kpi"],
    certifiedBy: "Controller",
    lastReviewed: "2025-10-01",
  },
];

// ── GET /api/semantic/glossary ────────────────────────────────────────────────
router.get("/semantic/glossary", (req, res) => {
  const { domain, search, tag, certified } = req.query as Record<string, string>;

  let entries = [...GLOSSARY_ENTRIES];

  if (domain) {
    entries = entries.filter((e) => e.domain === domain);
  }
  if (search) {
    const lower = search.toLowerCase();
    entries = entries.filter(
      (e) =>
        e.term.toLowerCase().includes(lower) ||
        e.shortDefinition.toLowerCase().includes(lower) ||
        e.tags.some((t) => t.includes(lower))
    );
  }
  if (tag) {
    entries = entries.filter((e) => e.tags.includes(tag));
  }
  if (certified === "true") {
    entries = entries.filter((e) => e.certifiedBy);
  }

  res.json({
    data: entries,
    total: entries.length,
    domains: [...new Set(GLOSSARY_ENTRIES.map((e) => e.domain))],
    allTags: [...new Set(GLOSSARY_ENTRIES.flatMap((e) => e.tags))],
  });
});

// ── GET /api/semantic/glossary/:slug ─────────────────────────────────────────
router.get("/semantic/glossary/:slug", (req, res) => {
  const entry = GLOSSARY_ENTRIES.find((e) => e.slug === req.params.slug);
  if (!entry) {
    res.status(404).json({ error: "not_found", message: `Glossary entry '${req.params.slug}' not found.` });
    return;
  }
  res.json({ data: entry });
});

// ── GET /api/semantic/domains ─────────────────────────────────────────────────
router.get("/semantic/domains", (_req, res) => {
  const domains = [
    { name: "revenue", label: "Revenue", metricCount: 5, entityCount: 4, certifiedMetrics: 4 },
    { name: "customers", label: "Customers", metricCount: 3, entityCount: 2, certifiedMetrics: 2 },
    { name: "invoices", label: "Invoices & AR", metricCount: 2, entityCount: 2, certifiedMetrics: 2 },
    { name: "payments", label: "Payments", metricCount: 2, entityCount: 2, certifiedMetrics: 2 },
    { name: "expenses", label: "Expenses", metricCount: 3, entityCount: 3, certifiedMetrics: 2 },
    { name: "budget_vs_actual", label: "Budget vs Actual", metricCount: 2, entityCount: 2, certifiedMetrics: 1 },
    { name: "collections", label: "Collections", metricCount: 2, entityCount: 2, certifiedMetrics: 1 },
    { name: "subscriptions", label: "Subscriptions", metricCount: 3, entityCount: 2, certifiedMetrics: 3 },
  ];
  res.json({ data: domains });
});

export default router;
