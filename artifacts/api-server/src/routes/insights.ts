import { Router } from "express";
import { z } from "zod";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_INSIGHTS = [
  {
    id: "ins001",
    insightType: "anomaly",
    severity: "warning",
    status: "under_investigation",
    title: "DSO Spike: Q1 FY2026 +10 Days Above Historical Range",
    summary: "Days Sales Outstanding jumped to 52 days in Q1 FY2026, a 10-day increase above the 42-day historical average. This is a 2.4σ deviation and the highest reading in 8 quarters.",
    affectedMetricSlugs: ["dso", "ar_balance", "collections_rate"],
    affectedPeriods: ["2026-Q1"],
    financialImpactUsd: 3_200_000,
    financialImpactDescription: "Estimated $3.2M cash flow impact if DSO remains elevated through Q2.",
    rootCauseHypotheses: [
      { hypothesis: "Collections team under-staffed in Q1; 3 open roles since January", confidence: 0.82, isConfirmed: true },
      { hypothesis: "3 large enterprise customers placed payments on hold pending their own fiscal year-end", confidence: 0.75, isConfirmed: false },
    ],
    narrative: {
      executiveSummary: "DSO reached 52 days in Q1 FY2026, a 10-day spike above historical norms.",
      whatChanged: "DSO increased from 42 days (Q4 FY2025) to 52 days (Q1 FY2026), a 23.8% increase.",
      whyItChanged: "Collections team at 60% capacity due to 3 headcount vacancies + enterprise customer payment holds on $4.8M AR.",
      soWhat: "If DSO remains at 52+ days, cash conversion cycle extends, reducing free cash flow by ~$3.2M in Q2.",
      whatToDoNext: "1. Prioritize hiring of 3 open collections roles. 2. CFO to contact 3 enterprise AP contacts. 3. Review AR aging weekly through June.",
      confidence: 0.82,
      isApproved: true,
    },
    recommendationIds: ["rec001"],
    acknowledgedBy: "cfo@company.com",
    acknowledgedAt: "2026-04-04T09:00:00Z",
    createdAt: "2026-04-03T08:00:00Z",
    updatedAt: "2026-04-06T09:00:00Z",
  },
  {
    id: "ins002",
    insightType: "margin_leakage",
    severity: "warning",
    status: "open",
    title: "Gross Margin Compressed 350bps YoY: AI Infrastructure Costs Unabsorbed",
    summary: "Gross margin declined from 67.3% to 63.8% QoQ. AI model serving infrastructure costs grew 34% in Q1 while product pricing remained flat. $2.4M annualized margin leakage identified.",
    affectedMetricSlugs: ["gross_margin", "cloud_infra_cost", "total_revenue"],
    affectedPeriods: ["2026-Q1"],
    financialImpactUsd: 2_400_000,
    financialImpactDescription: "$2.4M annualized gross margin leakage at current trajectory.",
    rootCauseHypotheses: [
      { hypothesis: "AI inference costs growing faster than revenue; current pricing does not include AI compute cost pass-through.", confidence: 0.88, isConfirmed: true },
    ],
    narrative: {
      executiveSummary: "Gross margin declined 350bps QoQ to 63.8%, driven by AI infrastructure cost growth not covered by current pricing.",
      whatChanged: "Gross margin fell from 67.3% (Q4 FY2025) to 63.8% (Q1 FY2026).",
      whyItChanged: "AI model serving costs grew 34% QoQ (+$580K) as adoption of AI features accelerated. Product pricing unchanged since Q2 FY2025.",
      soWhat: "At current trajectory, gross margin will reach 60% by Q4 FY2026, below the 63% floor in the FY2026 budget.",
      whatToDoNext: "1. Pricing review for AI-heavy SKUs. 2. Negotiate AWS reserved instance pricing. 3. Evaluate model optimization.",
      confidence: 0.85,
      isApproved: false,
    },
    recommendationIds: ["rec002", "rec003"],
    createdAt: "2026-04-03T08:00:00Z",
    updatedAt: "2026-04-07T11:00:00Z",
  },
  {
    id: "ins003",
    insightType: "cost_growth",
    severity: "info",
    status: "open",
    title: "G&A Spend Concentration: Top 3 Vendors = 68% of Non-Headcount G&A",
    summary: "3 vendors account for 68% of non-headcount G&A OpEx. Two contracts up for renewal in Q3. Renegotiation opportunity: $340K-$520K annually.",
    affectedMetricSlugs: ["g_and_a_opex"],
    affectedPeriods: ["2026-Q1", "2026-Q2"],
    financialImpactUsd: 430_000,
    financialImpactDescription: "Midpoint $430K annualized savings from renegotiation.",
    rootCauseHypotheses: [],
    narrative: {
      executiveSummary: "Top-3 vendor concentration in G&A creates negotiation leverage — 2 contracts up for renewal in Q3.",
      whatChanged: "Spend concentration analysis revealed 3 vendors represent $2.8M of $4.1M annual non-headcount G&A.",
      whyItChanged: "No structural issue; this is a benchmarking insight uncovered by spend concentration analysis.",
      soWhat: "Renewal timing (Q3) creates an opportunity to renegotiate rates. Peer benchmarks suggest 12-18% cost reduction achievable.",
      whatToDoNext: "1. Initiate RFP process for the 2 contracts up for renewal. 2. Engage CFO for budget authority on switching costs.",
      confidence: 0.72,
      isApproved: false,
    },
    recommendationIds: ["rec004"],
    createdAt: "2026-04-03T08:00:00Z",
    updatedAt: "2026-04-03T08:00:00Z",
  },
];

const MOCK_RECOMMENDATIONS = [
  {
    id: "rec001",
    insightId: "ins001",
    category: "improve_collections",
    title: "Accelerate Collections Hiring & Introduce Early Payment Incentive",
    summary: "Fill 3 open collections roles by May 31 and implement a 1.5% early payment discount for $500K+ invoices to recover $3.2M+ in delayed AR.",
    businessRationale: "DSO at 52 days vs. 42-day historical norm is eroding free cash flow. Root cause is dual: headcount gap + enterprise holds. Both addressable in Q2.",
    urgency: "high",
    status: "pending_review",
    confidence: 0.82,
    impactEstimate: { annualizedSavingsUsd: 0, oneTimeSavingsUsd: 3_200_000, netImpactUsd: 3_155_000, implementationCostUsd: 45_000, paybackPeriodMonths: 1, confidenceLevel: "high" },
    nextActions: ["HR to post 3 collections specialist roles by April 15", "CFO to personally contact top 3 AR accounts (>$1M)", "Finance to model early payment discount NPV by April 18", "Set weekly AR aging review cadence"],
    recommendedOwner: "controller@company.com",
    requiresApproval: true,
    affectedMetricSlugs: ["dso", "collections_rate", "ar_balance", "free_cash_flow"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
  {
    id: "rec002",
    insightId: "ins002",
    category: "improve_pricing_discipline",
    title: "Reprice AI-Intensive SKUs to Recover Cloud Infrastructure Cost Margin",
    summary: "Introduce AI usage-based pricing tier or 10% list price increase on AI-heavy SKUs to recover $2.4M+ annual gross margin leakage.",
    businessRationale: "AI model serving costs grew 34% QoQ but product pricing unchanged for 3 quarters.",
    urgency: "high",
    status: "pending_review",
    confidence: 0.75,
    impactEstimate: { annualizedSavingsUsd: 0, revenueUpliftUsd: 2_800_000, marginImprovementPpt: 2.8, netImpactUsd: 2_680_000, implementationCostUsd: 120_000, paybackPeriodMonths: 6, confidenceLevel: "medium" },
    nextActions: ["Product and Sales to model customer-level price sensitivity by May 1", "CFO to review competitive pricing benchmarks", "AWS account team to present reserved instance pricing options"],
    recommendedOwner: "cfo@company.com",
    requiresApproval: true,
    affectedMetricSlugs: ["gross_margin", "total_revenue", "cloud_infra_cost"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
  {
    id: "rec003",
    insightId: "ins002",
    category: "reduce_service_delivery_cost",
    title: "Optimize AI Inference Stack: Shift 40% of Queries to Smaller Models",
    summary: "Route low-complexity AI queries (40% of volume) to a smaller, cheaper model tier to reduce inference cost by $360K-$540K annually.",
    businessRationale: "40% of AI requests are routine and do not require frontier model capability. Smaller models are 85-90% cheaper.",
    urgency: "medium",
    status: "pending_review",
    confidence: 0.68,
    impactEstimate: { annualizedSavingsUsd: 450_000, netImpactUsd: 370_000, implementationCostUsd: 80_000, paybackPeriodMonths: 3, confidenceLevel: "medium" },
    nextActions: ["Engineering to classify query complexity distribution by April 30", "ML team to benchmark smaller model accuracy on low-complexity queries", "CTO approval for inference routing architecture change"],
    recommendedOwner: "cto@company.com",
    requiresApproval: true,
    affectedMetricSlugs: ["gross_margin", "cloud_infra_cost"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
  {
    id: "rec004",
    insightId: "ins003",
    category: "renegotiate_contract",
    title: "Renegotiate Top-3 G&A Vendor Contracts at Upcoming Renewal",
    summary: "2 of 3 high-concentration G&A vendor contracts renew in Q3 FY2026. Target 12-18% cost reduction, saving $340K-$520K annually.",
    businessRationale: "Top-3 vendors represent 68% of non-headcount G&A. Renewal timing creates leverage.",
    urgency: "medium",
    status: "pending_review",
    confidence: 0.72,
    impactEstimate: { annualizedSavingsUsd: 430_000, netImpactUsd: 405_000, implementationCostUsd: 25_000, confidenceLevel: "medium" },
    nextActions: ["CFO to identify contract renewal dates and terms by April 20", "Procurement to issue RFP to 2 alternative vendors by May 1", "Legal to review contract exit clauses by April 25"],
    recommendedOwner: "controller@company.com",
    requiresApproval: false,
    affectedMetricSlugs: ["g_and_a_opex", "ebitda"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
];

const MOCK_WATCHLIST = [
  { id: "wl001", metricSlug: "dso", addedBy: "cfo@company.com", reason: "DSO spike in Q1 — monitoring until returns to <45 days", currentValue: 52, alertLevel: "warning", lastCheckedAt: "2026-04-28T07:00:00Z", addedAt: "2026-04-03T09:00:00Z" },
  { id: "wl002", metricSlug: "gross_margin", addedBy: "cfo@company.com", reason: "Margin compression from AI infra costs — monitoring until pricing change implemented", thresholdBreachValue: 0.63, currentValue: 0.638, alertLevel: "watch", lastCheckedAt: "2026-04-28T07:00:00Z", addedAt: "2026-04-03T09:00:00Z" },
  { id: "wl003", metricSlug: "burn_rate", addedBy: "controller@company.com", reason: "Standard monitoring; alert if monthly burn exceeds $5.5M", thresholdBreachValue: 5_500_000, currentValue: 4_800_000, alertLevel: "watch", lastCheckedAt: "2026-04-28T07:00:00Z", addedAt: "2026-01-01T00:00:00Z" },
];

const MOCK_ALERTS = [
  { id: "ba001", alertType: "anomaly_detected", title: "DSO 10-Day Spike Confirmed", description: "DSO confirmed at 52 days in Q1 FY2026. Root cause analysis complete. Awaiting CFO action on collections hiring.", severity: "warning", metricSlugs: ["dso"], requiresAction: true, actionDeadline: "2026-04-15T00:00:00Z", assignedTo: "controller@company.com", isResolved: false, createdAt: "2026-04-03T08:00:00Z" },
  { id: "ba002", alertType: "metric_breach", title: "Gross Margin Below 64% Floor", description: "Q1 gross margin of 63.8% is below the 64% operating floor set in the FY2026 budget.", severity: "warning", metricSlugs: ["gross_margin"], requiresAction: true, assignedTo: "cfo@company.com", isResolved: false, createdAt: "2026-04-03T08:00:00Z" },
];

const MOCK_MARGIN_LEAKAGE = [
  { id: "ml001", period: "2026-Q1", category: "cloud_infrastructure", description: "AI inference costs growing 34% QoQ without pricing offset", annualizedLeakageUsd: 2_400_000, rootCause: "AI product pricing has not been updated to reflect infrastructure cost growth", recoveryPotentialUsd: 2_200_000, confidence: 0.85 },
  { id: "ml002", period: "2026-Q1", category: "collections_cycle", description: "Extended DSO reducing net cash flow contribution of AR", annualizedLeakageUsd: 3_200_000, rootCause: "Under-staffed collections team increasing invoice aging", recoveryPotentialUsd: 3_000_000, confidence: 0.80 },
];

const MOCK_COST_REDUCTION = [
  { id: "cr001", category: "renegotiate_contract", lineItem: "G&A Vendor Contracts (Top 3)", department: "g_and_a", currentAnnualSpendUsd: 2_800_000, benchmarkSpendUsd: 2_380_000, potentialSavingsUsd: 430_000, potentialSavingsPct: 0.154, implementation: "medium_term", confidence: 0.72 },
  { id: "cr002", category: "reduce_service_delivery_cost", lineItem: "AI Inference Infrastructure", department: "engineering", currentAnnualSpendUsd: 1_900_000, benchmarkSpendUsd: 1_450_000, potentialSavingsUsd: 450_000, potentialSavingsPct: 0.237, implementation: "medium_term", confidence: 0.68 },
  { id: "cr003", category: "reduce_non_core_overhead", lineItem: "SaaS Tool Sprawl (Non-Core Tools)", department: "g_and_a", currentAnnualSpendUsd: 820_000, benchmarkSpendUsd: 600_000, potentialSavingsUsd: 220_000, potentialSavingsPct: 0.268, implementation: "quick_win", confidence: 0.80 },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/insights/feed", (req, res) => {
  const QuerySchema = z.object({
    severity: z.string().optional(),
    status: z.string().optional(),
    insightType: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  let filtered = MOCK_INSIGHTS;
  if (parsed.data.severity) filtered = filtered.filter((i) => i.severity === parsed.data.severity);
  if (parsed.data.status) filtered = filtered.filter((i) => i.status === parsed.data.status);
  if (parsed.data.insightType) filtered = filtered.filter((i) => i.insightType === parsed.data.insightType);
  const summary = {
    total: filtered.length,
    critical: filtered.filter((i) => i.severity === "critical").length,
    warning: filtered.filter((i) => i.severity === "warning").length,
    totalFinancialImpactUsd: filtered.reduce((s, i) => s + (i.financialImpactUsd ?? 0), 0),
    openCount: filtered.filter((i) => i.status === "open" || i.status === "under_investigation").length,
  };
  res.json({ data: filtered.slice(0, parsed.data.limit), summary, total: filtered.length });
});

router.get("/insights/:id", (req, res) => {
  const insight = MOCK_INSIGHTS.find((i) => i.id === req.params.id);
  if (!insight) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Insight not found" });
    return;
  }
  res.json({ data: insight });
});

router.get("/insights/recommendations/feed", (req, res) => {
  const QuerySchema = z.object({
    status: z.string().optional(),
    urgency: z.string().optional(),
    category: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  let filtered = MOCK_RECOMMENDATIONS;
  if (parsed.data.status) filtered = filtered.filter((r) => r.status === parsed.data.status);
  if (parsed.data.urgency) filtered = filtered.filter((r) => r.urgency === parsed.data.urgency);
  if (parsed.data.category) filtered = filtered.filter((r) => r.category === parsed.data.category);
  const summary = {
    total: filtered.length,
    pendingReview: filtered.filter((r) => r.status === "pending_review").length,
    highUrgency: filtered.filter((r) => r.urgency === "high" || r.urgency === "immediate").length,
    totalNetImpactUsd: filtered.reduce((s, r) => s + (r.impactEstimate.netImpactUsd ?? 0), 0),
  };
  res.json({ data: filtered.slice(0, parsed.data.limit), summary, total: filtered.length });
});

router.get("/insights/recommendations/:id", (req, res) => {
  const rec = MOCK_RECOMMENDATIONS.find((r) => r.id === req.params.id);
  if (!rec) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Recommendation not found" });
    return;
  }
  res.json({ data: rec });
});

router.patch("/insights/recommendations/:id/review", (req, res) => {
  const BodySchema = z.object({
    action: z.enum(["approve", "reject", "defer"]),
    reviewedBy: z.string(),
    comment: z.string().optional(),
  });
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const rec = MOCK_RECOMMENDATIONS.find((r) => r.id === req.params.id);
  if (!rec) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Recommendation not found" });
    return;
  }
  const statusMap: Record<string, string> = { approve: "approved", reject: "rejected", defer: "deferred" };
  res.status(202).json({
    message: `Recommendation ${parsed.data.action}d`,
    recommendation: { ...rec, status: statusMap[parsed.data.action], reviewedBy: parsed.data.reviewedBy, reviewedAt: new Date().toISOString() },
  });
});

router.get("/insights/watchlist", (_req, res) => {
  res.json({ data: MOCK_WATCHLIST, total: MOCK_WATCHLIST.length });
});

router.get("/insights/alerts", (_req, res) => {
  const open = MOCK_ALERTS.filter((a) => !a.isResolved);
  res.json({ data: MOCK_ALERTS, summary: { total: MOCK_ALERTS.length, open: open.length, requiresAction: open.filter((a) => a.requiresAction).length }, total: MOCK_ALERTS.length });
});

router.get("/insights/margin-leakage", (_req, res) => {
  const totalLeakage = MOCK_MARGIN_LEAKAGE.reduce((s, m) => s + m.annualizedLeakageUsd, 0);
  const totalRecovery = MOCK_MARGIN_LEAKAGE.reduce((s, m) => s + m.recoveryPotentialUsd, 0);
  res.json({ data: MOCK_MARGIN_LEAKAGE, summary: { totalAnnualizedLeakageUsd: totalLeakage, totalRecoveryPotentialUsd: totalRecovery, count: MOCK_MARGIN_LEAKAGE.length }, total: MOCK_MARGIN_LEAKAGE.length });
});

router.get("/insights/cost-reduction", (_req, res) => {
  const totalSavings = MOCK_COST_REDUCTION.reduce((s, c) => s + c.potentialSavingsUsd, 0);
  const quickWins = MOCK_COST_REDUCTION.filter((c) => c.implementation === "quick_win");
  res.json({
    data: MOCK_COST_REDUCTION,
    summary: {
      totalPotentialSavingsUsd: totalSavings,
      quickWinCount: quickWins.length,
      quickWinSavingsUsd: quickWins.reduce((s, c) => s + c.potentialSavingsUsd, 0),
      count: MOCK_COST_REDUCTION.length,
    },
    total: MOCK_COST_REDUCTION.length,
  });
});

export default router;
