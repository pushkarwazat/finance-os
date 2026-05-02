import { Router } from "express";
import { z } from "zod";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_FORECAST_MODELS = [
  {
    id: "fm001",
    name: "FY2026 Revenue Rolling Forecast",
    method: "driver_based",
    grain: "quarterly",
    horizonMonths: 12,
    entityId: "consolidated",
    metricSlugs: ["total_revenue", "arr", "net_new_arr"],
    activeVersionLabel: "v3.1 — April 2026 RF",
    approvedBy: "cfo@company.com",
    approvedAt: "2026-04-03T00:00:00Z",
    status: "approved",
    isExplainabilityRequired: true,
    drivers: [
      { driverType: "pipeline", label: "Qualified pipeline", value: 62_000_000, unit: "absolute", contributionPct: 0.45, rationale: "Current CRM pipeline as of April 1, 2026", sensitivityLow: 54_000_000, sensitivityHigh: 70_000_000 },
      { driverType: "close_rate", label: "Close rate", value: 0.18, unit: "percentage", contributionPct: 0.35, rationale: "12-month trailing average close rate", sensitivityLow: 0.15, sensitivityHigh: 0.22 },
      { driverType: "churn", label: "Annual logo churn", value: 0.02, unit: "percentage", contributionPct: 0.20, rationale: "Based on FY2025 actuals", sensitivityLow: 0.015, sensitivityHigh: 0.035 },
    ],
    confidenceBands: [
      { period: "2026-Q2", low: 22_800_000, mid: 23_800_000, high: 26_100_000, confidenceLevel: 0.80 },
      { period: "2026-Q3", low: 24_200_000, mid: 26_300_000, high: 28_400_000, confidenceLevel: 0.75 },
      { period: "2026-Q4", low: 25_900_000, mid: 28_400_000, high: 31_200_000, confidenceLevel: 0.68 },
      { period: "2027-Q1", low: 27_000_000, mid: 30_100_000, high: 34_500_000, confidenceLevel: 0.58 },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
  {
    id: "fm002",
    name: "FY2026 OpEx Forecast",
    method: "driver_based",
    grain: "monthly",
    horizonMonths: 9,
    entityId: "consolidated",
    metricSlugs: ["total_opex", "r_and_d_opex", "sales_opex", "g_and_a_opex"],
    activeVersionLabel: "v2.0 — April 2026",
    approvedBy: "controller@company.com",
    approvedAt: "2026-04-03T00:00:00Z",
    status: "approved",
    isExplainabilityRequired: true,
    drivers: [
      { driverType: "headcount", label: "Net headcount adds", value: 42, unit: "count", contributionPct: 0.65, rationale: "Approved FY2026 headcount plan" },
      { driverType: "vendor_spend", label: "Vendor spend growth", value: 0.08, unit: "percentage", contributionPct: 0.25, rationale: "8% growth in vendor spend based on contract renewals" },
    ],
    confidenceBands: [
      { period: "2026-04", low: 12_800_000, mid: 13_400_000, high: 14_100_000, confidenceLevel: 0.80 },
      { period: "2026-05", low: 13_100_000, mid: 13_700_000, high: 14_400_000, confidenceLevel: 0.78 },
      { period: "2026-06", low: 13_400_000, mid: 14_000_000, high: 14_800_000, confidenceLevel: 0.75 },
    ],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-04-01T00:00:00Z",
  },
];

const MOCK_SCENARIOS = {
  fm001: {
    scenarioSetId: "ss001",
    forecastModelId: "fm001",
    name: "FY2026 Planning Scenarios",
    fiscalPeriod: "FY2026",
    approvedBy: "cfo@company.com",
    approvedAt: "2026-03-01T00:00:00Z",
    scenarios: [
      {
        id: "sc001",
        scenarioType: "baseline",
        name: "FY2026 Baseline",
        description: "Management's base case. Assumes pipeline conversion at historical 18% rate, 2% churn, stable headcount.",
        projectedRevenueUsd: 103_500_000,
        projectedEbitdaUsd: 19_200_000,
        projectedCashUsd: 48_000_000,
        projectedEbitdaMarginPct: 0.185,
        confidenceScore: 0.80,
        probabilityWeight: 0.60,
        narrativeSummary: "Baseline assumes steady pipeline conversion and controlled headcount growth. Revenue of $103.5M implies 9.8% growth over FY2025 actuals. EBITDA margin expands 180bps through operating leverage.",
      },
      {
        id: "sc002",
        scenarioType: "upside",
        name: "FY2026 Upside",
        description: "Improved pipeline execution (close rate +4pp), no incremental churn, 2 large new logos.",
        projectedRevenueUsd: 114_000_000,
        projectedEbitdaUsd: 24_600_000,
        projectedCashUsd: 56_000_000,
        projectedEbitdaMarginPct: 0.216,
        confidenceScore: 0.55,
        probabilityWeight: 0.20,
        narrativeSummary: "Upside requires outperformance in enterprise pipeline execution. Achievable but requires CSM team execution and SE capacity additions.",
      },
      {
        id: "sc003",
        scenarioType: "downside",
        name: "FY2026 Downside",
        description: "Macro softness slows enterprise close cycles, churn increases to 3.5%, 2 key deals slip to FY2027.",
        projectedRevenueUsd: 91_800_000,
        projectedEbitdaUsd: 10_400_000,
        projectedCashUsd: 34_500_000,
        projectedEbitdaMarginPct: 0.113,
        confidenceScore: 0.40,
        probabilityWeight: 0.20,
        narrativeSummary: "Downside requires immediate cost actions to protect cash runway. Management would initiate discretionary spend freeze.",
      },
    ],
    sensitivitySummary: {
      pipeline_10pct_down: { revenueImpact: -1_800_000, ebitdaImpact: -1_800_000 },
      churn_plus_1pp: { revenueImpact: -3_400_000, ebitdaImpact: -3_400_000 },
      close_rate_minus_3pp: { revenueImpact: -4_200_000, ebitdaImpact: -4_200_000 },
    },
    createdAt: "2026-02-15T00:00:00Z",
  },
};

const MOCK_FORECAST_RUNS = [
  {
    id: "fr001",
    modelId: "fm001",
    modelName: "FY2026 Revenue Rolling Forecast",
    versionLabel: "v3.1 — April 2026 RF",
    fiscalPeriod: "2026-Q2_to_2027-Q1",
    status: "approved",
    triggeredBy: "manual",
    requestedBy: "cfo@company.com",
    approvalStatus: "approved",
    approvedBy: "cfo@company.com",
    approvedAt: "2026-04-03T14:00:00Z",
    overrides: [
      {
        metricSlug: "total_revenue",
        period: "2026-Q2",
        originalValue: 24_500_000,
        overrideValue: 23_800_000,
        overrideReason: "management_judgment",
        rationale: "CFO applied conservative adjustment — 3 enterprise deals in legal review.",
        overriddenBy: "cfo@company.com",
        approvalStatus: "approved",
      },
    ],
    exceptions: [],
    createdAt: "2026-04-01T09:00:00Z",
    updatedAt: "2026-04-03T14:00:00Z",
  },
];

const MOCK_OVERRIDES = [
  {
    id: "fo001",
    forecastRunId: "fr001",
    metricSlug: "total_revenue",
    period: "2026-Q2",
    originalValue: 24_500_000,
    overrideValue: 23_800_000,
    overrideReason: "management_judgment",
    rationale: "CFO applied conservative adjustment to Q2 revenue given 3 enterprise deals still in legal review as of April 1. Original model does not account for potential further slippage.",
    overriddenBy: "cfo@company.com",
    overriddenAt: "2026-04-02T11:00:00Z",
    approvedBy: "cfo@company.com",
    approvedAt: "2026-04-03T09:00:00Z",
    requiresApproval: true,
    approvalStatus: "approved",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/forecasting/models", (_req, res) => {
  const summary = MOCK_FORECAST_MODELS.map((m) => ({
    id: m.id, name: m.name, method: m.method, grain: m.grain, horizonMonths: m.horizonMonths,
    activeVersionLabel: m.activeVersionLabel, status: m.status, approvedBy: m.approvedBy,
    approvedAt: m.approvedAt, updatedAt: m.updatedAt,
  }));
  res.json({ data: summary, total: summary.length });
});

router.get("/forecasting/models/:id", (req, res) => {
  const model = MOCK_FORECAST_MODELS.find((m) => m.id === req.params.id);
  if (!model) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Forecast model not found" });
    return;
  }
  res.json({ data: model });
});

router.get("/forecasting/models/:id/scenarios", (req, res) => {
  const scenarioSet = MOCK_SCENARIOS[req.params.id as keyof typeof MOCK_SCENARIOS];
  if (!scenarioSet) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "No scenario set for this model" });
    return;
  }
  res.json({ data: scenarioSet });
});

router.get("/forecasting/runs", (req, res) => {
  const QuerySchema = z.object({
    modelId: z.string().optional(),
    status: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  let filtered = MOCK_FORECAST_RUNS;
  if (parsed.data.modelId) filtered = filtered.filter((r) => r.modelId === parsed.data.modelId);
  if (parsed.data.status) filtered = filtered.filter((r) => r.status === parsed.data.status);
  res.json({ data: filtered.slice(0, parsed.data.limit), total: filtered.length });
});

router.post("/forecasting/runs", (req, res) => {
  const BodySchema = z.object({
    modelId: z.string(),
    versionId: z.string().optional(),
    fiscalPeriod: z.string(),
    requestedBy: z.string().default("api"),
  });
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const model = MOCK_FORECAST_MODELS.find((m) => m.id === parsed.data.modelId);
  if (!model) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Forecast model not found" });
    return;
  }
  res.status(202).json({
    message: "Forecast run queued",
    run: {
      id: `fr-${Date.now()}`,
      modelId: parsed.data.modelId,
      modelName: model.name,
      fiscalPeriod: parsed.data.fiscalPeriod,
      status: "draft",
      approvalStatus: "not_required",
      triggeredBy: "manual",
      requestedBy: parsed.data.requestedBy,
      createdAt: new Date().toISOString(),
    },
    note: "Forecast run queued. Driver-based model requires explainability review before approval.",
  });
});

router.get("/forecasting/scenarios/compare", (req, res) => {
  const QuerySchema = z.object({ modelId: z.string().default("fm001") });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const scenarioSet = MOCK_SCENARIOS[parsed.data.modelId as keyof typeof MOCK_SCENARIOS];
  if (!scenarioSet) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "No scenarios found" });
    return;
  }
  const scenarios = scenarioSet.scenarios;
  const baseline = scenarios.find((s) => s.scenarioType === "baseline");
  const upside = scenarios.find((s) => s.scenarioType === "upside");
  const downside = scenarios.find((s) => s.scenarioType === "downside");

  res.json({
    data: {
      modelId: parsed.data.modelId,
      scenarios,
      comparison: {
        revenueRange: { low: downside?.projectedRevenueUsd, mid: baseline?.projectedRevenueUsd, high: upside?.projectedRevenueUsd },
        ebitdaRange: { low: downside?.projectedEbitdaUsd, mid: baseline?.projectedEbitdaUsd, high: upside?.projectedEbitdaUsd },
        ebitdaMarginRange: { low: downside?.projectedEbitdaMarginPct, mid: baseline?.projectedEbitdaMarginPct, high: upside?.projectedEbitdaMarginPct },
        probabilityWeightedRevenue:
          (baseline?.projectedRevenueUsd ?? 0) * (baseline?.probabilityWeight ?? 0) +
          (upside?.projectedRevenueUsd ?? 0) * (upside?.probabilityWeight ?? 0) +
          (downside?.projectedRevenueUsd ?? 0) * (downside?.probabilityWeight ?? 0),
      },
      sensitivitySummary: scenarioSet.sensitivitySummary,
    },
  });
});

router.get("/forecasting/overrides", (_req, res) => {
  res.json({ data: MOCK_OVERRIDES, total: MOCK_OVERRIDES.length });
});

export default router;
