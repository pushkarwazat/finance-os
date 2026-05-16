import { Router } from "express";
import { z } from "zod";
import { container } from "@financeos/container";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// SQL-backed KPI helpers
// ─────────────────────────────────────────────────────────────────────────────

interface KpiCard {
  title: string; metricSlug: string; value: number; format: string;
  variance: number; variancePct: number; comparisonLabel: string; trendDirection: string; isMaterial: boolean;
}

let _kpiCache: KpiCard[] | null = null;
let _kpiFetchedAt = 0;
const KPI_TTL_MS = 30 * 60_000;

async function fetchKpiCardsFromSql(): Promise<KpiCard[]> {
  if (_kpiCache && Date.now() - _kpiFetchedAt < KPI_TTL_MS) return _kpiCache;

  const wh = container.get("sqlWarehouse");
  const FY = 2026;

  const run = (sql: string) => wh.executeQuery(sql, { maxRows: 20 });

  // Run all queries in parallel
  const [revRow, divRows, gpRow, opexRow, ebitdaRow] = await Promise.all([
    // 1. Total revenue: actuals vs budget
    run(`SELECT
           SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actuals,
           SUM(CASE WHEN scenario_name ILIKE 'budget'  THEN amount::numeric ELSE 0 END) AS budget
         FROM kratos_actuals
         WHERE gaap_l2 ILIKE '01 - NET REVENUE' AND fiscal_year::integer = ${FY}`),

    // 2. Revenue by division (actuals)
    run(`SELECT division, SUM(amount::numeric) AS revenue
         FROM kratos_actuals
         WHERE gaap_l2 ILIKE '01 - NET REVENUE'
           AND scenario_name ILIKE 'actuals'
           AND fiscal_year::integer = ${FY}
           AND division NOT ILIKE 'ELIMINATION'
         GROUP BY division ORDER BY revenue DESC LIMIT 10`),

    // 3. Gross profit: actuals vs budget
    run(`SELECT
           SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actuals,
           SUM(CASE WHEN scenario_name ILIKE 'budget'  THEN amount::numeric ELSE 0 END) AS budget
         FROM kratos_actuals
         WHERE gaap_l1 ILIKE '01 - GROSS PROFIT' AND fiscal_year::integer = ${FY}`),

    // 4. Operating expenses: actuals vs budget
    run(`SELECT
           SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actuals,
           SUM(CASE WHEN scenario_name ILIKE 'budget'  THEN amount::numeric ELSE 0 END) AS budget
         FROM kratos_actuals
         WHERE gaap_l1 ILIKE '02 - OPERATING EXPENSE' AND fiscal_year::integer = ${FY}`),

    // 5. EBITDA: actuals vs budget
    run(`SELECT
           SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actuals,
           SUM(CASE WHEN scenario_name ILIKE 'budget'  THEN amount::numeric ELSE 0 END) AS budget
         FROM kratos_actuals
         WHERE is_ebitda = '1' AND fiscal_year::integer = ${FY}`),
  ]);

  const cell = (result: typeof revRow, col: string): number => {
    const ci = result.columns.findIndex((c) => c.name === col);
    return ci >= 0 ? parseFloat(String(result.rows[0]?.[ci] ?? "0")) || 0 : 0;
  };

  const variance = (actual: number, budget: number): { pct: number; label: string; direction: string } => {
    if (!budget) return { pct: 0, label: "YTD FY2026", direction: "neutral" };
    const pct = (actual - budget) / Math.abs(budget);
    return {
      pct,
      label: `vs Budget $${(budget / 1_000_000).toFixed(1)}M`,
      direction: pct >= 0 ? "favourable" : "unfavourable",
    };
  };

  const revActuals = cell(revRow, "actuals");
  const revBudget = cell(revRow, "budget");
  const gpActuals = cell(gpRow, "actuals");
  const gpBudget = cell(gpRow, "budget");
  const opexActuals = Math.abs(cell(opexRow, "actuals"));
  const opexBudget = Math.abs(cell(opexRow, "budget"));
  const ebitdaActuals = cell(ebitdaRow, "actuals");
  const ebitdaBudget = cell(ebitdaRow, "budget");

  const revV = variance(revActuals, revBudget);
  const gpV = variance(gpActuals, gpBudget);
  // For opex, spending less than budget = favourable
  const opexV = {
    pct: opexBudget ? (opexActuals - opexBudget) / Math.abs(opexBudget) : 0,
    label: opexBudget ? `vs Budget $${(opexBudget / 1_000_000).toFixed(1)}M` : "YTD FY2026",
    direction: opexBudget ? (opexActuals <= opexBudget ? "favourable" : "unfavourable") : "neutral",
  };
  const ebitdaV = variance(ebitdaActuals, ebitdaBudget);

  // Division revenue cards (top 4)
  const divColIdx = divRows.columns.findIndex((c) => c.name === "division");
  const revColIdx = divRows.columns.findIndex((c) => c.name === "revenue");
  const topDivisions = divRows.rows.slice(0, 4).map((row) => ({
    division: String(row[divColIdx] ?? "").replace(/_/g, " "),
    revenue: parseFloat(String(row[revColIdx] ?? "0")) || 0,
  }));

  const divCards: KpiCard[] = topDivisions.map((d) => ({
    title: `${d.division.charAt(0) + d.division.slice(1).toLowerCase()} Revenue`,
    metricSlug: `revenue_${d.division.toLowerCase().replace(/\s+/g, "_")}`,
    value: d.revenue,
    format: "currency",
    variance: 0,
    variancePct: 0,
    comparisonLabel: "YTD FY2026 Actuals",
    trendDirection: "neutral",
    isMaterial: false,
  }));

  const cards: KpiCard[] = [
    {
      title: "Total Revenue",
      metricSlug: "total_revenue",
      value: revActuals,
      format: "currency",
      variance: revActuals - revBudget,
      variancePct: revV.pct,
      comparisonLabel: revV.label,
      trendDirection: revV.direction,
      isMaterial: Math.abs(revV.pct) > 0.05,
    },
    {
      title: "Gross Profit",
      metricSlug: "gross_profit",
      value: gpActuals,
      format: "currency",
      variance: gpActuals - gpBudget,
      variancePct: gpV.pct,
      comparisonLabel: gpV.label,
      trendDirection: gpV.direction,
      isMaterial: Math.abs(gpV.pct) > 0.05,
    },
    {
      title: "EBITDA",
      metricSlug: "ebitda",
      value: ebitdaActuals,
      format: "currency",
      variance: ebitdaActuals - ebitdaBudget,
      variancePct: ebitdaV.pct,
      comparisonLabel: ebitdaV.label,
      trendDirection: ebitdaV.direction,
      isMaterial: Math.abs(ebitdaV.pct) > 0.05,
    },
    {
      title: "Operating Expenses",
      metricSlug: "opex",
      value: opexActuals,
      format: "currency",
      variance: opexActuals - opexBudget,
      variancePct: opexV.pct,
      comparisonLabel: opexV.label,
      trendDirection: opexV.direction,
      isMaterial: Math.abs(opexV.pct) > 0.05,
    },
    ...divCards,
  ];

  _kpiCache = cards;
  _kpiFetchedAt = Date.now();
  return cards;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_TEMPLATES = [
  { id: "rt001", name: "Executive Summary Report", reportType: "executive_summary", version: "2.1", cadence: "monthly", owner: "cfo@company.com", audience: "CFO & Finance Leadership", confidentiality: "confidential", materialityThresholdUsd: 250_000, materialityThresholdPct: 0.05, exportModes: ["pdf", "dashboard", "email_summary"], requiresApprovalBeforeDistribution: true, lastRefreshedAt: "2026-04-05T06:00:00Z" },
  { id: "rt002", name: "Board Pack Data Pack", reportType: "board_deck_data_pack", version: "1.4", cadence: "quarterly", owner: "cfo@company.com", audience: "Board of Directors", confidentiality: "board_only", materialityThresholdUsd: 1_000_000, materialityThresholdPct: 0.10, exportModes: ["pdf", "ppt_json"], requiresApprovalBeforeDistribution: true, lastRefreshedAt: "2026-04-08T09:00:00Z" },
  { id: "rt003", name: "Weekly Flash Report", reportType: "weekly_flash", version: "1.0", cadence: "weekly", owner: "controller@company.com", audience: "CFO & Finance Leadership", confidentiality: "confidential", materialityThresholdUsd: 100_000, materialityThresholdPct: 0.03, exportModes: ["email_summary", "dashboard"], requiresApprovalBeforeDistribution: false, lastRefreshedAt: "2026-04-28T07:00:00Z" },
  { id: "rt004", name: "Budget vs. Actual Report", reportType: "budget_vs_actual", version: "3.0", cadence: "monthly", owner: "controller@company.com", audience: "CFO & Finance Leadership", confidentiality: "confidential", materialityThresholdUsd: 50_000, materialityThresholdPct: 0.05, exportModes: ["pdf", "csv_extract", "dashboard"], requiresApprovalBeforeDistribution: true, lastRefreshedAt: "2026-04-05T08:00:00Z" },
  { id: "rt005", name: "Margin Waterfall Report", reportType: "margin_waterfall", version: "1.2", cadence: "monthly", owner: "cfo@company.com", audience: "CFO & Finance Leadership", confidentiality: "confidential", materialityThresholdUsd: 200_000, materialityThresholdPct: 0.05, exportModes: ["pdf", "ppt_json"], requiresApprovalBeforeDistribution: true, lastRefreshedAt: "2026-04-05T08:30:00Z" },
  { id: "rt006", name: "Cost Optimization Report", reportType: "cost_optimization", version: "1.0", cadence: "quarterly", owner: "cfo@company.com", audience: "CFO & Finance Leadership", confidentiality: "confidential", materialityThresholdUsd: 100_000, materialityThresholdPct: 0.03, exportModes: ["pdf", "dashboard"], requiresApprovalBeforeDistribution: false, lastRefreshedAt: "2026-04-05T09:00:00Z" },
];

const MOCK_RUNS = [
  { id: "rr001", templateId: "rt001", templateName: "Executive Summary Report", fiscalPeriod: "2026-Q1", status: "under_review", narrativeApprovalStatus: "pending", generatedBy: "scheduled", lastRefreshedAt: "2026-04-05T06:00:00Z", createdAt: "2026-04-05T06:00:00Z" },
  { id: "rr002", templateId: "rt002", templateName: "Board Pack Data Pack", fiscalPeriod: "2026-Q1", status: "approved", narrativeApprovalStatus: "approved", generatedBy: "manual", approvedBy: "cfo@company.com", approvedAt: "2026-04-08T14:00:00Z", lastRefreshedAt: "2026-04-08T09:00:00Z", createdAt: "2026-04-07T09:00:00Z" },
  { id: "rr003", templateId: "rt003", templateName: "Weekly Flash Report", fiscalPeriod: "2026-W17", status: "published", narrativeApprovalStatus: "not_required", generatedBy: "scheduled", lastRefreshedAt: "2026-04-28T07:00:00Z", createdAt: "2026-04-28T07:00:00Z" },
  { id: "rr004", templateId: "rt004", templateName: "Budget vs. Actual Report", fiscalPeriod: "2026-Q1", status: "published", narrativeApprovalStatus: "approved", generatedBy: "scheduled", approvedBy: "controller@company.com", approvedAt: "2026-04-06T10:00:00Z", lastRefreshedAt: "2026-04-05T08:00:00Z", createdAt: "2026-04-05T08:00:00Z" },
  { id: "rr005", templateId: "rt005", templateName: "Margin Waterfall Report", fiscalPeriod: "2026-Q1", status: "draft", narrativeApprovalStatus: "not_required", generatedBy: "manual", lastRefreshedAt: "2026-04-10T11:00:00Z", createdAt: "2026-04-10T11:00:00Z" },
];

const MOCK_BOARD_PACKS = [
  {
    id: "bp001",
    title: "Q1 FY2026 Board Pack",
    fiscalPeriod: "2026-Q1",
    preparedBy: "cfo@company.com",
    approvedBy: "cfo@company.com",
    approvedAt: "2026-04-09T16:00:00Z",
    status: "approved",
    confidentiality: "board_only",
    sections: ["Executive Summary", "Insurance Segment: GWP & Commission Bridge", "Pharmacy Segment: Rx Volume & Margin", "Consolidated P&L", "Balance Sheet & Liquidity", "Claims Reserves Update", "Q2 Outlook & Key Risks"],
    executiveSummary: "Q1 FY2026 consolidated revenue of $98.2M was $1.2M ahead of budget. The insurance segment continued to benefit from hardening market conditions — GWP reached $192.6M (+8.2% vs Q4 FY2025) and commission income of $38.5M grew 7.8% QoQ. Pharmacy Rx volume grew to 131.2K monthly fills but gross margin compressed 40bps to 17.9% due to ongoing PBM reimbursement pressure. Combined ratio of 96.1% remains below 100%, confirming underwriting profitability despite modest deterioration from the prior quarter's 94.8%.",
    exportReadyAt: "2026-04-09T16:00:00Z",
    createdAt: "2026-04-07T09:00:00Z",
  },
  {
    id: "bp002",
    title: "Q4 FY2025 Board Pack",
    fiscalPeriod: "2025-Q4",
    preparedBy: "cfo@company.com",
    approvedBy: "cfo@company.com",
    approvedAt: "2026-01-15T12:00:00Z",
    status: "published",
    confidentiality: "board_only",
    sections: ["Executive Summary", "Full Year Results", "Insurance Segment Review", "Pharmacy Segment Review", "Actuarial Reserve Summary", "FY2026 Budget Overview"],
    executiveSummary: "FY2025 was a strong year for both segments. Insurance GWP grew 10.7% to $178.4M with a combined ratio of 94.8% — the best underwriting result in five years. The pharmacy segment reached 127.4K monthly Rx fills with improved refill adherence of 73.2%. Consolidated revenue of $94.2M beat budget by $2.7M.",
    exportReadyAt: "2026-01-15T12:00:00Z",
    createdAt: "2026-01-10T09:00:00Z",
  },
];

const MOCK_KPI_CARDS = [
  { title: "Total Revenue", metricSlug: "total_revenue", value: 98_200_000, format: "currency", variance: 1_200_000, variancePct: 0.012, comparisonLabel: "vs Budget $97.0M", trendDirection: "favourable", isMaterial: false },
  { title: "Gross Written Premium", metricSlug: "gwp", value: 192_600_000, format: "currency", variance: 14_600_000, variancePct: 0.082, comparisonLabel: "vs Q4 FY2025 $178.4M", trendDirection: "favourable", isMaterial: false },
  { title: "Loss Ratio", metricSlug: "loss_ratio", value: 0.681, format: "percentage", variance: 0.009, variancePct: 0.013, comparisonLabel: "vs Q4 FY2025 67.2%", trendDirection: "unfavourable", isMaterial: false },
  { title: "Combined Ratio", metricSlug: "combined_ratio", value: 0.961, format: "percentage", variance: 0.013, variancePct: 0.014, comparisonLabel: "vs Q4 FY2025 94.8%", trendDirection: "unfavourable", isMaterial: false },
  { title: "Commission Income", metricSlug: "commission_income", value: 38_500_000, format: "currency", variance: 2_800_000, variancePct: 0.078, comparisonLabel: "vs Q4 FY2025 $35.7M", trendDirection: "favourable", isMaterial: false },
  { title: "Monthly Rx Volume", metricSlug: "rx_volume", value: 131_200, format: "count", variance: 3_800, variancePct: 0.030, comparisonLabel: "vs Q4 FY2025 127.4K", trendDirection: "favourable", isMaterial: false },
  { title: "Pharmacy Gross Margin", metricSlug: "pharmacy_gross_margin", value: 0.179, format: "percentage", variance: -0.004, variancePct: -0.022, comparisonLabel: "vs Budget 18.5%", trendDirection: "unfavourable", isMaterial: true },
  { title: "Customer Refill Rate", metricSlug: "refill_rate", value: 0.741, format: "percentage", variance: 0.009, variancePct: 0.012, comparisonLabel: "vs Q4 FY2025 73.2%", trendDirection: "favourable", isMaterial: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/reporting/dashboard", async (_req, res, next) => {
  let kpiCards = MOCK_KPI_CARDS;

  if (!container.isStub("sqlWarehouse")) {
    try {
      kpiCards = await fetchKpiCardsFromSql();
    } catch (err) {
      console.error("[reporting/dashboard] SQL KPI fetch failed, falling back to mock:", err);
    }
  }

  res.json({
    data: {
      fiscalPeriod: "FY2026 YTD",
      kpiCards,
      totalReports: MOCK_TEMPLATES.length,
      pendingApproval: MOCK_RUNS.filter((r) => r.narrativeApprovalStatus === "pending").length,
      publishedThisWeek: MOCK_RUNS.filter((r) => r.status === "published").length,
      lastRefreshedAt: new Date().toISOString(),
    },
  });
  void next;
});

router.get("/reporting/templates", (req, res) => {
  const QuerySchema = z.object({
    reportType: z.string().optional(),
    cadence: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  let filtered = MOCK_TEMPLATES;
  if (parsed.data.reportType) filtered = filtered.filter((t) => t.reportType === parsed.data.reportType);
  if (parsed.data.cadence) filtered = filtered.filter((t) => t.cadence === parsed.data.cadence);
  res.json({ data: filtered.slice(0, parsed.data.limit), total: filtered.length });
});

router.get("/reporting/templates/:id", (req, res) => {
  const template = MOCK_TEMPLATES.find((t) => t.id === req.params.id);
  if (!template) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Report template not found" });
    return;
  }
  res.json({ data: template });
});

router.get("/reporting/runs", (req, res) => {
  const QuerySchema = z.object({
    status: z.string().optional(),
    fiscalPeriod: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  let filtered = MOCK_RUNS;
  if (parsed.data.status) filtered = filtered.filter((r) => r.status === parsed.data.status);
  if (parsed.data.fiscalPeriod) filtered = filtered.filter((r) => r.fiscalPeriod === parsed.data.fiscalPeriod);
  const summary = {
    totalRuns: filtered.length,
    pendingApproval: filtered.filter((r) => r.narrativeApprovalStatus === "pending").length,
    published: filtered.filter((r) => r.status === "published").length,
    approved: filtered.filter((r) => r.status === "approved").length,
  };
  res.json({ data: filtered.slice(0, parsed.data.limit), summary, total: filtered.length });
});

router.post("/reporting/runs", (req, res) => {
  const BodySchema = z.object({
    templateId: z.string(),
    fiscalPeriod: z.string(),
    requestedBy: z.string().default("api"),
  });
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const template = MOCK_TEMPLATES.find((t) => t.id === parsed.data.templateId);
  if (!template) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Template not found" });
    return;
  }
  res.status(202).json({
    message: "Report run queued",
    run: {
      id: `rr-${Date.now()}`,
      templateId: parsed.data.templateId,
      templateName: template.name,
      fiscalPeriod: parsed.data.fiscalPeriod,
      status: "draft",
      narrativeApprovalStatus: template.requiresApprovalBeforeDistribution ? "pending" : "not_required",
      generatedBy: "manual",
      requestedBy: parsed.data.requestedBy,
      lastRefreshedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
    },
    note: "Report generation is queued. Narrative requires human review before distribution.",
  });
});

router.get("/reporting/board-packs", (_req, res) => {
  res.json({ data: MOCK_BOARD_PACKS, total: MOCK_BOARD_PACKS.length });
});

router.get("/reporting/board-packs/:id", (req, res) => {
  const bp = MOCK_BOARD_PACKS.find((b) => b.id === req.params.id);
  if (!bp) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Board pack not found" });
    return;
  }
  res.json({ data: bp });
});

router.get("/reporting/kpi-cards", (_req, res) => {
  res.json({ data: MOCK_KPI_CARDS, total: MOCK_KPI_CARDS.length });
});

export default router;
