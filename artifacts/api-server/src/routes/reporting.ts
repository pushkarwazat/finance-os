import { Router } from "express";
import { z } from "zod";

const router = Router();

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
    sections: ["Executive Summary", "Revenue & ARR Bridge", "P&L Summary", "Balance Sheet Highlights", "Cash & Liquidity", "Q2 Outlook", "Key Risks & Mitigations"],
    executiveSummary: "Q1 FY2026 results were in line with revised expectations. Revenue of $23.8M was 4.2% below original budget, driven by 3 enterprise deal slippage. ARR grew 9% QoQ to $340M. EBITDA margin of 16.2% improved 180bps vs Q4 FY2025. Cash runway remains healthy at 18.4 months.",
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
    sections: ["Executive Summary", "Full Year Results", "Revenue & ARR Bridge", "Cost Structure Review", "FY2026 Budget Overview"],
    executiveSummary: "FY2025 was a year of strong ARR growth offset by margin pressure. Total ARR reached $312M (+13.7% YoY). EBITDA margin compressed 210bps due to accelerated R&D investment.",
    exportReadyAt: "2026-01-15T12:00:00Z",
    createdAt: "2026-01-10T09:00:00Z",
  },
];

const MOCK_KPI_CARDS = [
  { title: "Total Revenue", metricSlug: "total_revenue", value: 23_800_000, format: "currency", variance: -1_100_000, variancePct: -0.044, comparisonLabel: "vs Budget $24.9M", trendDirection: "unfavourable", isMaterial: true },
  { title: "ARR", metricSlug: "arr", value: 340_000_000, format: "currency", variance: 28_000_000, variancePct: 0.090, comparisonLabel: "vs Q4 FY2025 $312M", trendDirection: "favourable", isMaterial: false },
  { title: "Gross Margin", metricSlug: "gross_margin", value: 0.638, format: "percentage", variance: -0.035, variancePct: -0.052, comparisonLabel: "vs Budget 67.3%", trendDirection: "unfavourable", isMaterial: true },
  { title: "EBITDA Margin", metricSlug: "ebitda_margin", value: 0.162, format: "percentage", variance: -0.008, variancePct: -0.047, comparisonLabel: "vs Budget 17.0%", trendDirection: "unfavourable", isMaterial: false },
  { title: "DSO", metricSlug: "dso", value: 52, format: "days", variance: 10, variancePct: 0.238, comparisonLabel: "vs Historical avg 42 days", trendDirection: "unfavourable", isMaterial: true },
  { title: "Cash Runway", metricSlug: "cash_runway_months", value: 18.4, format: "count", variance: -0.8, variancePct: -0.042, comparisonLabel: "vs Q4 FY2025 19.2 months", trendDirection: "unfavourable", isMaterial: false },
  { title: "NRR", metricSlug: "nrr", value: 1.118, format: "percentage", variance: -0.006, variancePct: -0.005, comparisonLabel: "vs Target 115%+", trendDirection: "unfavourable", isMaterial: false },
  { title: "Operating Cash Flow", metricSlug: "operating_cash_flow", value: 5_400_000, format: "currency", variance: 600_000, variancePct: 0.125, comparisonLabel: "vs Q4 FY2025 $4.8M", trendDirection: "favourable", isMaterial: false },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/reporting/dashboard", (_req, res) => {
  res.json({
    data: {
      fiscalPeriod: "2026-Q1",
      kpiCards: MOCK_KPI_CARDS,
      totalReports: MOCK_TEMPLATES.length,
      pendingApproval: MOCK_RUNS.filter((r) => r.narrativeApprovalStatus === "pending").length,
      publishedThisWeek: MOCK_RUNS.filter((r) => r.status === "published").length,
      lastRefreshedAt: "2026-04-28T07:00:00Z",
    },
  });
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
