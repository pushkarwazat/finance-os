import { Router } from "express";
import { z } from "zod";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_INSIGHTS = [
  {
    id: "ins001",
    insightType: "margin_leakage",
    severity: "warning",
    status: "under_investigation",
    title: "Pharmacy Margin Compression: PBM Reimbursement Cuts Persist into Q1 FY2026",
    summary: "Pharmacy gross margin declined from 18.3% in Q4 FY2025 to 17.9% in Q1 FY2026. Two PBM contracts renegotiated in October reduced per-fill reimbursement by $0.42 (brand) and $0.18 (generic). Annualized margin impact: $2.1M.",
    affectedMetricSlugs: ["pharmacy_gross_margin", "rx_volume", "total_revenue"],
    affectedPeriods: ["2025-Q4", "2026-Q1"],
    financialImpactUsd: 2_100_000,
    financialImpactDescription: "Estimated $2.1M annualized margin reduction if PBM rates are not renegotiated by contract renewal date.",
    rootCauseHypotheses: [
      { hypothesis: "CVS Caremark and Express Scripts renegotiated at lower reimbursement rates in October 2025; new rates took full effect in Q1.", confidence: 0.91, isConfirmed: true },
      { hypothesis: "DIR fee clawbacks increased due to performance metric misses on two PBM contracts.", confidence: 0.74, isConfirmed: false },
    ],
    narrative: {
      executiveSummary: "Pharmacy gross margin compressed 40bps QoQ to 17.9%, driven by lower PBM reimbursement rates in effect since October.",
      whatChanged: "Pharmacy gross margin fell from 18.3% (Q4 FY2025) to 17.9% (Q1 FY2026), a 40bps decline.",
      whyItChanged: "Two PBM contracts (CVS Caremark, Express Scripts) were renegotiated at lower reimbursement rates. Effective rate decrease of ~$0.42/brand fill and $0.18/generic fill. Generic dispensing rate improved to 84.2% (+250bps), partially offsetting the impact.",
      soWhat: "At current trajectory, pharmacy gross margin will compress to ~17.5% by Q3 FY2026 unless PBM rates are renegotiated or generic dispensing rate improves further.",
      whatToDoNext: "1. Engage PBM account managers for OptumRx renewal negotiation (contract up in Q3). 2. Review DIR fee performance metrics — target improvement to reduce clawbacks. 3. Expand generic substitution program to push dispensing rate above 86%.",
      confidence: 0.88,
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
    insightType: "anomaly",
    severity: "warning",
    status: "open",
    title: "Combined Ratio Uptick: Q1 FY2026 at 96.1% vs Q4 FY2025 94.8%",
    summary: "Combined ratio increased 130bps QoQ to 96.1%, driven by a 90bps increase in the loss ratio. Three large commercial liability claims filed in January account for $4.2M in new reserves. No CAT event — this is attritional loss development.",
    affectedMetricSlugs: ["combined_ratio", "loss_ratio", "gwp"],
    affectedPeriods: ["2026-Q1"],
    financialImpactUsd: 4_200_000,
    financialImpactDescription: "$4.2M in new reserves on three commercial liability claims; development uncertain.",
    rootCauseHypotheses: [
      { hypothesis: "Three new large commercial liability claims (>$500K each) filed in January, increasing attritional loss development.", confidence: 0.86, isConfirmed: true },
      { hypothesis: "Expense ratio increased 40bps due to Q1 producer onboarding costs for new mid-market accounts.", confidence: 0.79, isConfirmed: false },
    ],
    narrative: {
      executiveSummary: "Combined ratio rose to 96.1% in Q1 FY2026 from 94.8% in Q4 FY2025, still below 100% but trending in the wrong direction.",
      whatChanged: "Loss ratio increased from 67.2% to 68.1%. Expense ratio increased from 27.6% to 28.0%.",
      whyItChanged: "Three commercial liability claims filed in January total $4.2M in new reserve requirements. No CAT involvement — purely attritional. Producer onboarding for 3 new mid-market accounts added $640K in Q1 commission costs not in the original budget.",
      soWhat: "Combined ratio remains below 100% (profitable on underwriting basis), but claims development on the three large accounts warrants monitoring. If any of the three claims develop adversely, the loss ratio could breach 70% in Q2.",
      whatToDoNext: "1. Actuarial to review large-loss development on all three claims weekly. 2. Underwriting to assess if any of the three accounts warrant coverage review at next renewal. 3. CFO to be briefed if any single claim reserve exceeds $2M.",
      confidence: 0.83,
      isApproved: false,
    },
    recommendationIds: ["rec002"],
    createdAt: "2026-04-03T08:00:00Z",
    updatedAt: "2026-04-07T11:00:00Z",
  },
  {
    id: "ins003",
    insightType: "cost_growth",
    severity: "info",
    status: "open",
    title: "Producer Commission Concentration: Top 5 Producers = 61% of Brokerage GWP",
    summary: "5 producers account for 61% of gross written premium. Two of the top 5 are at contract renewal in Q3 and have received recruiting inquiries from competitor brokerages. Retention risk: $43M GWP.",
    affectedMetricSlugs: ["gwp", "commission_income"],
    affectedPeriods: ["2026-Q1", "2026-Q2"],
    financialImpactUsd: 8_600_000,
    financialImpactDescription: "Estimated $8.6M annual commission income at risk if the two top producers are not retained.",
    rootCauseHypotheses: [],
    narrative: {
      executiveSummary: "High GWP concentration in top 5 producers creates retention risk — two are at contract renewal in Q3.",
      whatChanged: "Concentration analysis shows top-5 producers now represent 61% of GWP, up from 54% in Q4 FY2024.",
      whyItChanged: "Successful new account wins by top producers drove concentration higher. This is a commercial success, but creates key-person and retention risk.",
      soWhat: "If two top producers (combined $43M GWP) were to leave, commission income would fall by ~$8.6M annually, requiring 2+ years to replace at current new business pace.",
      whatToDoNext: "1. CEO and CFO to conduct retention conversations with top-5 producers before Q3 contract renewals. 2. Review compensation structure relative to market. 3. Evaluate producer equity/profit-sharing program to improve retention.",
      confidence: 0.78,
      isApproved: false,
    },
    recommendationIds: ["rec003"],
    createdAt: "2026-04-03T08:00:00Z",
    updatedAt: "2026-04-03T08:00:00Z",
  },
];

const MOCK_RECOMMENDATIONS = [
  {
    id: "rec001",
    insightId: "ins001",
    category: "renegotiate_contract",
    title: "Renegotiate OptumRx PBM Contract Before Q3 Renewal — Target 8–12% Rate Recovery",
    summary: "OptumRx contract renews in Q3 FY2026. Leverage improved generic dispensing rate (84.2%) and Rx volume growth (+7.1% YoY) to negotiate higher reimbursement rates. Target: recover 80–120bps of pharmacy gross margin.",
    businessRationale: "PBM reimbursement cuts from October 2025 are the primary driver of pharmacy margin compression. The OptumRx renewal is the next leverage point. Improved performance metrics strengthen the negotiating position.",
    urgency: "high",
    status: "pending_review",
    confidence: 0.81,
    impactEstimate: { annualizedSavingsUsd: 1_600_000, netImpactUsd: 1_540_000, implementationCostUsd: 60_000, paybackPeriodMonths: 1, confidenceLevel: "high" },
    nextActions: ["CFO to engage OptumRx account manager by May 1", "Pharmacy ops to prepare volume and adherence performance data for negotiation", "Legal to review termination clauses in current contract", "Finance to model impact scenarios at 5%, 8%, 12% rate improvement"],
    recommendedOwner: "cfo@company.com",
    requiresApproval: true,
    affectedMetricSlugs: ["pharmacy_gross_margin", "rx_volume", "total_revenue"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
  {
    id: "rec002",
    insightId: "ins002",
    category: "improve_pricing_discipline",
    title: "Implement Large-Loss Early-Warning Protocol for Commercial Liability Claims",
    summary: "Establish a $250K reserve threshold trigger for immediate actutarial review and CFO notification on commercial liability claims to prevent adverse development surprise.",
    businessRationale: "Three Q1 claims totaling $4.2M in new reserves were not flagged until month-end close. Earlier identification allows faster coverage review and reinsurance recoverable assessment.",
    urgency: "high",
    status: "pending_review",
    confidence: 0.87,
    impactEstimate: { annualizedSavingsUsd: 0, oneTimeSavingsUsd: 800_000, netImpactUsd: 750_000, implementationCostUsd: 50_000, paybackPeriodMonths: 3, confidenceLevel: "medium" },
    nextActions: ["Claims and Actuarial to define large-loss protocol by April 30", "CFO to approve $250K auto-notification threshold", "IT to configure claims system alerts", "Monthly large-loss review meeting to be added to close calendar"],
    recommendedOwner: "controller@company.com",
    requiresApproval: true,
    affectedMetricSlugs: ["combined_ratio", "loss_ratio"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
  {
    id: "rec003",
    insightId: "ins003",
    category: "renegotiate_contract",
    title: "Launch Producer Retention Program Before Q3 Contract Renewals",
    summary: "Introduce a producer equity participation plan or long-term incentive structure for the top-5 producers ahead of Q3 contract renewals to secure $43M+ GWP and ~$8.6M annual commission income.",
    businessRationale: "Top-5 producers now represent 61% of GWP — up from 54% a year ago. Two are at renewal in Q3 with confirmed competitor recruiting inquiries. The cost of a retention plan is far lower than the revenue risk.",
    urgency: "high",
    status: "pending_review",
    confidence: 0.78,
    impactEstimate: { annualizedSavingsUsd: 0, revenueUpliftUsd: 8_600_000, netImpactUsd: 7_900_000, implementationCostUsd: 700_000, paybackPeriodMonths: 1, confidenceLevel: "medium" },
    nextActions: ["CEO and CFO to hold retention conversations with the two at-risk producers by May 15", "HR to benchmark producer compensation vs. peer brokerages", "Legal to draft producer long-term incentive plan term sheet by June 1", "Board to be briefed on key-person concentration risk"],
    recommendedOwner: "cfo@company.com",
    requiresApproval: true,
    affectedMetricSlugs: ["gwp", "commission_income", "total_revenue"],
    createdAt: "2026-04-03T08:05:00Z",
    updatedAt: "2026-04-03T08:05:00Z",
  },
];

const MOCK_WATCHLIST = [
  { id: "wl001", metricSlug: "pharmacy_gross_margin", addedBy: "cfo@company.com", reason: "PBM rate compression — monitoring until OptumRx renegotiation completes in Q3", currentValue: 0.179, alertLevel: "warning", lastCheckedAt: "2026-04-28T07:00:00Z", addedAt: "2026-04-03T09:00:00Z" },
  { id: "wl002", metricSlug: "combined_ratio", addedBy: "cfo@company.com", reason: "Three large commercial liability claims in Q1 — monitoring for adverse reserve development", thresholdBreachValue: 1.00, currentValue: 0.961, alertLevel: "watch", lastCheckedAt: "2026-04-28T07:00:00Z", addedAt: "2026-04-03T09:00:00Z" },
  { id: "wl003", metricSlug: "loss_ratio", addedBy: "controller@company.com", reason: "Standard monitoring; alert if loss ratio breaches 70% in any rolling quarter", thresholdBreachValue: 0.70, currentValue: 0.681, alertLevel: "watch", lastCheckedAt: "2026-04-28T07:00:00Z", addedAt: "2026-01-01T00:00:00Z" },
];

const MOCK_ALERTS = [
  { id: "ba001", alertType: "margin_leakage", title: "Pharmacy Gross Margin Below 18% Budget Floor", description: "Q1 pharmacy gross margin of 17.9% is below the 18% operating floor in the FY2026 budget. PBM reimbursement rate cuts are the confirmed driver.", severity: "warning", metricSlugs: ["pharmacy_gross_margin"], requiresAction: true, actionDeadline: "2026-05-01T00:00:00Z", assignedTo: "cfo@company.com", isResolved: false, createdAt: "2026-04-03T08:00:00Z" },
  { id: "ba002", alertType: "anomaly_detected", title: "Combined Ratio Uptick — Q1 at 96.1% vs Q4 94.8%", description: "Three new commercial liability claims filed in January added $4.2M in reserves. Combined ratio increased 130bps QoQ. Still below 100% but trending adversely.", severity: "warning", metricSlugs: ["combined_ratio", "loss_ratio"], requiresAction: true, assignedTo: "controller@company.com", isResolved: false, createdAt: "2026-04-03T08:00:00Z" },
];

const MOCK_MARGIN_LEAKAGE = [
  { id: "ml001", period: "2026-Q1", category: "pbm_reimbursement", description: "PBM reimbursement rate reductions compressing pharmacy gross margin", annualizedLeakageUsd: 2_100_000, rootCause: "CVS Caremark and Express Scripts renegotiated at lower rates in October 2025; OptumRx contract renewal opportunity in Q3", recoveryPotentialUsd: 1_600_000, confidence: 0.88 },
  { id: "ml002", period: "2026-Q1", category: "claims_reserve_development", description: "Three large commercial liability claims adding attritional reserve pressure", annualizedLeakageUsd: 4_200_000, rootCause: "Attritional large-loss development in commercial liability book; no CAT exposure", recoveryPotentialUsd: 800_000, confidence: 0.74 },
];

const MOCK_COST_REDUCTION = [
  { id: "cr001", category: "renegotiate_contract", lineItem: "PBM Reimbursement — OptumRx Renewal", department: "dispensing_ops", currentAnnualSpendUsd: 0, benchmarkSpendUsd: 0, potentialSavingsUsd: 1_600_000, potentialSavingsPct: 0.087, implementation: "medium_term", confidence: 0.81 },
  { id: "cr002", category: "reduce_service_delivery_cost", lineItem: "Generic Substitution Uplift Program", department: "dispensing_ops", currentAnnualSpendUsd: 120_000, benchmarkSpendUsd: 120_000, potentialSavingsUsd: 480_000, potentialSavingsPct: 0.26, implementation: "quick_win", confidence: 0.76 },
  { id: "cr003", category: "reduce_non_core_overhead", lineItem: "Producer Commission Structure Optimization", department: "underwriting", currentAnnualSpendUsd: 18_000_000, benchmarkSpendUsd: 16_800_000, potentialSavingsUsd: 1_200_000, potentialSavingsPct: 0.067, implementation: "medium_term", confidence: 0.65 },
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

// Dynamic route last — must come after all static single-segment paths
router.get("/insights/:id", (req, res) => {
  const insight = MOCK_INSIGHTS.find((i) => i.id === req.params.id);
  if (!insight) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Insight not found" });
    return;
  }
  res.json({ data: insight });
});

export default router;
