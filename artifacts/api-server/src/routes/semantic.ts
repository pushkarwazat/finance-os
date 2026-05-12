import { Router } from "express";

const router = Router();

// ── Static in-memory glossary data (derived from packages/semantic/glossary.yaml)
// In production this would be loaded from the semantic registry, but during
// scaffold phase we serve the compiled model directly from static data.

// ─────────────────────────────────────────────────────────────────────────────
// Glossary — Insurance Brokerage + DTC Pharmacy
// Domains: underwriting | brokerage | pharmacy | revenue | reserving | planning | compliance
// ─────────────────────────────────────────────────────────────────────────────
const GLOSSARY_ENTRIES = [
  // ── UNDERWRITING ────────────────────────────────────────────────────────────
  {
    term: "Gross Written Premium",
    slug: "gwp",
    domain: "underwriting",
    shortDefinition: "Total premium written by the brokerage before ceding reinsurance.",
    definition: "Gross Written Premium (GWP) is the total value of insurance premiums placed by the brokerage on behalf of clients, before any amounts are ceded to reinsurers. It is the primary volume metric for the insurance segment and reflects the full value of risk bound in the period, regardless of when it is earned.",
    formula: "SUM(policy_premium) across all lines of business in the period",
    relatedMetrics: ["earned_premium", "ceded_premium", "commission_income"],
    tags: ["insurance", "premium", "volume", "kpi", "underwriting"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Earned Premium",
    slug: "earned_premium",
    domain: "underwriting",
    shortDefinition: "Portion of written premium attributable to the expired coverage period.",
    definition: "Earned Premium is the share of Gross Written Premium that corresponds to coverage already provided during the reporting period. For a 12-month policy, 1/12 of the annual premium is earned each month. It is the denominator in Loss Ratio and Combined Ratio calculations.",
    formula: "Written Premium × (Days Elapsed / Policy Term Days)",
    relatedMetrics: ["gwp", "loss_ratio", "combined_ratio"],
    tags: ["insurance", "premium", "underwriting", "income_statement"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Loss Ratio",
    slug: "loss_ratio",
    domain: "underwriting",
    shortDefinition: "Incurred losses + LAE as a % of earned premium. Lower is better; target < 70%.",
    definition: "The Loss Ratio measures underwriting performance by comparing claims costs (incurred losses plus loss adjustment expenses) to earned premium. A ratio below 70% is considered strong for commercial lines. Deterioration is typically driven by elevated claim frequency, severity increases, or reserve strengthening. It is one of the two components of the Combined Ratio.",
    formula: "(Incurred Losses + LAE) / Earned Premium",
    relatedMetrics: ["combined_ratio", "expense_ratio", "ibnr", "earned_premium"],
    tags: ["insurance", "underwriting", "kpi", "profitability"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Combined Ratio",
    slug: "combined_ratio",
    domain: "underwriting",
    shortDefinition: "Loss Ratio + Expense Ratio. Below 100% = underwriting profit.",
    definition: "The Combined Ratio is the primary measure of overall insurance underwriting profitability. It equals the Loss Ratio plus the Expense Ratio. A Combined Ratio below 100% indicates that the insurance business is profitable before investment income. A ratio of 96.1% means $0.039 of underwriting profit per dollar of earned premium.",
    formula: "Loss Ratio + Expense Ratio",
    relatedMetrics: ["loss_ratio", "expense_ratio", "earned_premium"],
    tags: ["insurance", "underwriting", "kpi", "profitability"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Expense Ratio",
    slug: "expense_ratio",
    domain: "underwriting",
    shortDefinition: "Operating expenses (excl. claims) as a % of earned premium.",
    definition: "The Expense Ratio measures the cost of writing business as a percentage of earned premium. It includes underwriting expenses, producer commissions, policy acquisition costs, and allocated overhead. Together with the Loss Ratio, it forms the Combined Ratio. A lower expense ratio indicates greater operational efficiency.",
    formula: "(Underwriting Expenses + Acquisition Costs) / Earned Premium",
    relatedMetrics: ["combined_ratio", "loss_ratio", "commission_income"],
    tags: ["insurance", "underwriting", "efficiency", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Ceded Premium",
    slug: "ceded_premium",
    domain: "underwriting",
    shortDefinition: "Premium transferred to reinsurers in exchange for risk protection.",
    definition: "Ceded Premium is the portion of Gross Written Premium transferred to reinsurance counterparties under treaty or facultative reinsurance arrangements. It reduces net retained risk exposure but also reduces net earned premium. Net Written Premium = GWP − Ceded Premium.",
    formula: "GWP × Cession Rate (by treaty)",
    relatedMetrics: ["gwp", "net_retained_premium"],
    tags: ["insurance", "reinsurance", "premium", "risk_transfer"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  // ── BROKERAGE ───────────────────────────────────────────────────────────────
  {
    term: "Commission Income",
    slug: "commission_income",
    domain: "brokerage",
    shortDefinition: "Brokerage commissions earned from carriers, net of producer payouts.",
    definition: "Commission Income is the primary revenue line for the insurance brokerage segment. It represents gross commissions earned from insurance carriers on placed policies, less amounts paid out to producing agents and brokers. Commission rates typically range from 10–20% of premium depending on line of business. Growth is driven by GWP volume and rate increases.",
    formula: "Gross Carrier Commissions − Producer Commission Payouts",
    relatedMetrics: ["gwp", "producer_commission", "expense_ratio"],
    tags: ["insurance", "revenue", "brokerage", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Producer Commission",
    slug: "producer_commission",
    domain: "brokerage",
    shortDefinition: "Amounts paid to producing agents and sub-brokers from carrier commissions.",
    definition: "Producer Commissions are the amounts paid to retail agents, managing general agents (MGAs), and sub-brokers who source and place insurance business. Tracked as a split of gross carrier commission. Producer compensation arrangements may include contingent commissions based on loss performance, requiring clawback provisions if loss ratios deteriorate.",
    formula: "SUM(policy_producer_split_usd) for the period",
    relatedMetrics: ["commission_income", "gwp"],
    tags: ["insurance", "brokerage", "compensation", "expense"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Net Retained Premium",
    slug: "net_retained_premium",
    domain: "brokerage",
    shortDefinition: "GWP minus ceded premium — the net risk retained by the brokerage.",
    definition: "Net Retained Premium (also Net Written Premium) is the portion of Gross Written Premium that the brokerage retains after transferring risk to reinsurers via cession. It is the basis for calculating net loss ratios and net combined ratios. Higher retention means greater profit potential but also greater downside risk exposure.",
    formula: "GWP − Ceded Premium",
    relatedMetrics: ["gwp", "ceded_premium", "loss_ratio"],
    tags: ["insurance", "brokerage", "reinsurance", "net_position"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Bordereaux",
    slug: "bordereaux",
    domain: "brokerage",
    shortDefinition: "Detailed bordereaux statements from carriers confirming premium and claims activity.",
    definition: "A bordereaux (plural: bordereau) is a detailed schedule provided by insurance carriers to brokers on a periodic basis (typically monthly or quarterly), listing individual policy premiums, adjustments, cancellations, and claims activity. Carrier premium reconciliation against the brokerage's own system of record is a critical close task. Discrepancies require resolution before revenue can be finalized.",
    relatedMetrics: ["gwp", "commission_income"],
    tags: ["insurance", "brokerage", "reconciliation", "close"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  // ── PHARMACY ────────────────────────────────────────────────────────────────
  {
    term: "Monthly Rx Volume",
    slug: "rx_volume",
    domain: "pharmacy",
    shortDefinition: "Total prescriptions dispensed per month. Core volume driver for the DTC pharmacy.",
    definition: "Monthly Rx Volume is the total count of prescriptions dispensed by the DTC pharmacy in a given month. It is the primary volume metric for the pharmacy segment and drives gross revenue, drug COGS, and pharmacist labor requirements. Volume is segmented by therapy class, brand vs generic, and refill vs new prescription. Q1 FY2026: 131.2K monthly fills.",
    formula: "COUNT(dispensed_prescriptions WHERE status = 'dispensed' AND period = month)",
    relatedMetrics: ["pharmacy_gross_margin", "refill_rate", "generic_dispensing_rate"],
    tags: ["pharmacy", "volume", "kpi", "operations"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Pharmacy Gross Margin",
    slug: "pharmacy_gross_margin",
    domain: "pharmacy",
    shortDefinition: "(Net Rx Revenue − Drug COGS) / Net Rx Revenue. Target > 18%.",
    definition: "Pharmacy Gross Margin measures the profitability of the dispensing operation before operating expenses. Net Rx Revenue is gross ingredient revenue less DIR fee clawbacks and other PBM adjustments. Drug COGS includes ingredient cost (acquisition cost) and dispensing fees paid to wholesalers. Margin is highly sensitive to PBM reimbursement rates, generic substitution rates, and therapeutic mix (GLP-1s are low margin).",
    formula: "(Net Rx Revenue − Drug COGS) / Net Rx Revenue",
    relatedMetrics: ["rx_volume", "dir_fees", "generic_dispensing_rate"],
    tags: ["pharmacy", "margin", "kpi", "profitability"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Generic Dispensing Rate",
    slug: "generic_dispensing_rate",
    domain: "pharmacy",
    shortDefinition: "% of prescriptions filled with a generic drug vs brand equivalent.",
    definition: "The Generic Dispensing Rate (GDR) measures the proportion of total prescriptions filled using generic drugs versus brand-name equivalents. Generic drugs typically carry 3–5x higher margin than brands on a per-fill basis. A higher GDR improves pharmacy gross margin and signals strong clinical substitution protocols. Target: ≥ 85%. Q1 FY2026 GDR was 84.8%, below target due to GLP-1 volume growth.",
    formula: "Generic Fills / Total Fills × 100",
    relatedMetrics: ["pharmacy_gross_margin", "rx_volume"],
    tags: ["pharmacy", "clinical", "efficiency", "margin"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "DIR Fees",
    slug: "dir_fees",
    domain: "pharmacy",
    shortDefinition: "Direct and Indirect Remuneration fees clawed back by PBMs after point-of-sale.",
    definition: "DIR (Direct and Indirect Remuneration) fees are retroactive adjustments applied by Pharmacy Benefit Managers (PBMs) that reduce net pharmacy reimbursement after the point of sale. They are reconciled quarterly or annually and applied as revenue reductions. DIR fees are a significant source of pharmacy margin pressure — Q1 FY2026 saw $1.1M in DIR clawbacks from Q4 FY2025 settlements applied to revenue.",
    formula: "Gross Rx Revenue − DIR Clawbacks = Net Rx Revenue",
    relatedMetrics: ["pharmacy_gross_margin", "rx_volume"],
    tags: ["pharmacy", "pbm", "revenue_deduction", "risk"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Customer Refill Rate",
    slug: "refill_rate",
    domain: "pharmacy",
    shortDefinition: "% of eligible prescriptions refilled on schedule. Proxy for patient adherence.",
    definition: "Customer Refill Rate (Medication Adherence Rate) measures the percentage of patients who refill their prescriptions on schedule before running out. High refill rates indicate patient satisfaction, clinical adherence, and recurring pharmacy revenue. The metric is calculated over a rolling 12-month adherence period. Q1 FY2026: 74.1%. CMS star ratings programs reward pharmacies with high adherence rates.",
    formula: "Prescriptions Refilled on Schedule / Eligible Refills × 100",
    relatedMetrics: ["rx_volume", "pharmacy_gross_margin"],
    tags: ["pharmacy", "adherence", "retention", "kpi"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  // ── REVENUE ─────────────────────────────────────────────────────────────────
  {
    term: "Total Revenue",
    slug: "total_revenue",
    domain: "revenue",
    shortDefinition: "Consolidated gross revenue across the insurance brokerage and DTC pharmacy segments.",
    definition: "Total Revenue is the consolidated top-line revenue of the holding company, combining the insurance brokerage segment (commission income, fee income) and the DTC pharmacy segment (net pharmacy revenue). It is reported gross before segment eliminations and is the primary measure of overall business scale. Q1 FY2026: $98.2M, +4.3% vs Q4 FY2025.",
    formula: "Commission Income + Fee Income + Net Pharmacy Revenue",
    relatedMetrics: ["commission_income", "pharmacy_gross_margin", "budget_variance"],
    tags: ["income_statement", "top_line", "kpi", "consolidated"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Net Pharmacy Revenue",
    slug: "net_pharmacy_revenue",
    domain: "revenue",
    shortDefinition: "Gross drug dispensing revenue less DIR fees and PBM adjustments.",
    definition: "Net Pharmacy Revenue is gross ingredient reimbursement from PBMs and cash-pay patients, less all retroactive adjustments including DIR fees, price protection clawbacks, and dispensing fee adjustments. It is the revenue line used in Pharmacy Gross Margin calculations and is the primary revenue driver for the pharmacy segment.",
    formula: "Gross Ingredient Revenue − DIR Fees − PBM Adjustments",
    relatedMetrics: ["pharmacy_gross_margin", "dir_fees", "rx_volume"],
    tags: ["pharmacy", "revenue", "income_statement"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  // ── RESERVING ───────────────────────────────────────────────────────────────
  {
    term: "IBNR",
    slug: "ibnr",
    domain: "reserving",
    shortDefinition: "Incurred But Not Reported — estimated liability for claims not yet filed.",
    definition: "IBNR (Incurred But Not Reported) is the actuarial estimate of losses that have occurred but have not yet been reported to the insurer or brokerage. It represents a contingent liability on the balance sheet and must be established in accordance with actuarial standards. IBNR is a key component of Loss Ratio calculations. Strengthening IBNR increases the loss ratio; releasing it decreases the loss ratio.",
    formula: "Actuarially estimated total ultimate losses − Reported claims to date",
    relatedMetrics: ["loss_ratio", "lae", "reserve_development"],
    tags: ["insurance", "reserving", "actuarial", "liability"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Loss Adjustment Expenses",
    slug: "lae",
    domain: "reserving",
    shortDefinition: "Costs of investigating and settling claims, included in the loss ratio numerator.",
    definition: "Loss Adjustment Expenses (LAE) are all costs associated with investigating, managing, and settling insurance claims. They include allocated loss adjustment expenses (ALAE) such as defense attorney fees and expert witnesses, and unallocated loss adjustment expenses (ULAE) such as claims department overhead. LAE is included in the numerator of the Loss Ratio alongside incurred losses.",
    formula: "ALAE (per-claim defense/adjustment costs) + ULAE (claims overhead allocation)",
    relatedMetrics: ["loss_ratio", "ibnr"],
    tags: ["insurance", "reserving", "claims", "expense"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Reserve Development",
    slug: "reserve_development",
    domain: "reserving",
    shortDefinition: "Change in prior-period reserve estimates. Adverse = reserves were too low.",
    definition: "Reserve Development (also known as Prior Year Development or PYD) is the difference between ultimate loss estimates for a prior accident year as revised in the current period versus the previous estimate. Adverse development means prior reserves were insufficient (claims are worse than expected). Favorable development means prior reserves were redundant. Development patterns are monitored via loss development triangles and are a key actuarial disclosure.",
    formula: "Current Estimate of Prior Period Ultimate Losses − Prior Estimate",
    relatedMetrics: ["ibnr", "loss_ratio", "lae"],
    tags: ["insurance", "reserving", "actuarial", "prior_period"],
    certifiedBy: "CFO Office",
    lastReviewed: "2026-04-30",
  },
  // ── PLANNING ────────────────────────────────────────────────────────────────
  {
    term: "Budget Variance",
    slug: "budget_variance",
    domain: "planning",
    shortDefinition: "Actual result minus budgeted amount. Revenue: positive = favorable. Ratio: depends on direction.",
    definition: "Budget Variance is the difference between actual financial results and the approved annual operating budget. For revenue and margin metrics: positive variance is favorable. For loss ratios and expense ratios: a positive variance (actual > budget) is unfavorable. A ±5% variance is typically within tolerable range; variances exceeding materiality thresholds require CFO and Controller approval per the Material Metric Approval Policy.",
    formula: "Actual Amount − Budget Amount",
    relatedMetrics: ["total_revenue", "loss_ratio", "pharmacy_gross_margin"],
    tags: ["planning", "variance", "budget", "kpi"],
    certifiedBy: "FP&A Lead",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Forecast Accuracy",
    slug: "forecast_accuracy",
    domain: "planning",
    shortDefinition: "How closely the rolling forecast predicted actual results at period end.",
    definition: "Forecast Accuracy measures the precision of the FP&A team's rolling quarterly forecast compared to actual outcomes. Calculated as 1 − |Forecast Error %|. Best practice targets ≤ 3% error at 30 days before close. Tracked separately for the insurance segment (GWP and Loss Ratio) and pharmacy segment (Rx Volume and Margin).",
    formula: "1 − |Actual − Forecast| / Actual",
    relatedMetrics: ["budget_variance", "total_revenue"],
    tags: ["planning", "forecasting", "efficiency", "kpi"],
    certifiedBy: "FP&A Lead",
    lastReviewed: "2026-04-30",
  },
  // ── COMPLIANCE ──────────────────────────────────────────────────────────────
  {
    term: "Surplus Lines Authority",
    slug: "surplus_lines_authority",
    domain: "compliance",
    shortDefinition: "State-level license permitting the brokerage to place non-admitted insurance.",
    definition: "Surplus Lines Authority is the regulatory license granted by each state's Department of Insurance (DOI) that permits the brokerage to place insurance with non-admitted (non-licensed) carriers when admitted market capacity is unavailable. The brokerage holds surplus lines authority in 18 states. Each state has distinct premium tax, diligent search, and filing requirements. Failure to comply can result in license suspension and regulatory penalties.",
    relatedMetrics: ["gwp", "premium_tax"],
    tags: ["compliance", "regulatory", "licensing", "insurance"],
    certifiedBy: "General Counsel",
    lastReviewed: "2026-04-30",
  },
  {
    term: "Premium Tax",
    slug: "premium_tax",
    domain: "compliance",
    shortDefinition: "State-levied tax on surplus lines premiums, typically 2–5% of GWP.",
    definition: "Premium Tax is a tax imposed by each state on insurance premiums placed by surplus lines brokers operating within that state's jurisdiction. Rates vary by state, typically ranging from 2% to 5% of gross written premium. The brokerage is responsible for computing, filing, and remitting premium taxes quarterly. Correct premium tax accounting is a critical close task and is audited by state DOI examiners.",
    formula: "GWP placed in state × State Premium Tax Rate",
    relatedMetrics: ["gwp", "surplus_lines_authority"],
    tags: ["compliance", "regulatory", "tax", "insurance"],
    certifiedBy: "Controller",
    lastReviewed: "2026-04-30",
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
    { name: "underwriting", label: "Underwriting", metricCount: 6, entityCount: 5, certifiedMetrics: 5 },
    { name: "brokerage",    label: "Brokerage",    metricCount: 4, entityCount: 4, certifiedMetrics: 3 },
    { name: "pharmacy",     label: "Pharmacy",     metricCount: 5, entityCount: 5, certifiedMetrics: 5 },
    { name: "revenue",      label: "Revenue",      metricCount: 2, entityCount: 2, certifiedMetrics: 2 },
    { name: "reserving",    label: "Reserving",    metricCount: 3, entityCount: 3, certifiedMetrics: 2 },
    { name: "planning",     label: "Planning",     metricCount: 2, entityCount: 2, certifiedMetrics: 2 },
    { name: "compliance",   label: "Compliance",   metricCount: 2, entityCount: 2, certifiedMetrics: 2 },
  ];
  res.json({ data: domains });
});

export default router;
