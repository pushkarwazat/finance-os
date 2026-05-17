import { Router } from "express";
import { z } from "zod";
import {
  BudgetVarianceLineSchema,
  BudgetModelSummarySchema,
} from "@financeos/agents";
import { isMaterial, requiresDualApproval } from "@financeos/governance";
import { container } from "@financeos/container";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// SQL-backed budget vs actuals
// ─────────────────────────────────────────────────────────────────────────────

interface VsActualsLine {
  label: string; slug: string;
  actual: number; budget: number; variance: number; variancePct: number; isFavourable: boolean;
}
interface VsActualsResult { pl: VsActualsLine[]; divisions: VsActualsLine[]; }

let _vsCache: VsActualsResult | null = null;
let _vsFetchedAt = 0;
const VS_TTL_MS = 30 * 60_000;

async function fetchVsActualsFromSql(): Promise<VsActualsResult> {
  if (_vsCache && Date.now() - _vsFetchedAt < VS_TTL_MS) return _vsCache;

  const wh = container.get("sqlWarehouse");
  const FY = 2026;
  const run = (sql: string) => wh.executeQuery(sql, { maxRows: 50 });

  const [revRow, gpRow, opexRow, ebitdaRow, divRows] = await Promise.all([
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l2 ILIKE '01 - NET REVENUE'`),
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l1 ILIKE '01 - GROSS PROFIT'`),
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l1 ILIKE '02 - OPERATING EXPENSE'`),
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND is_ebitda ILIKE 'yes'`),
    run(`SELECT division, SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l2 ILIKE '01 - NET REVENUE' AND division NOT ILIKE 'ELIMINATION' GROUP BY division ORDER BY budget DESC`),
  ]);

  const cell = (result: typeof revRow, col: string): number => {
    const ci = result.columns.findIndex((c) => c.name === col);
    return ci >= 0 ? parseFloat(String(result.rows[0]?.[ci] ?? "0")) || 0 : 0;
  };

  const makeLine = (label: string, slug: string, actual: number, budget: number, higherIsBetter = true): VsActualsLine => {
    const variance = actual - budget;
    const variancePct = budget !== 0 ? variance / Math.abs(budget) : 0;
    return { label, slug, actual, budget, variance, variancePct, isFavourable: higherIsBetter ? variance >= 0 : variance <= 0 };
  };

  const pl: VsActualsLine[] = [
    makeLine("Total Revenue",        "revenue",     cell(revRow, "actual"),               cell(revRow, "budget")),
    makeLine("Gross Profit",         "gross_profit", cell(gpRow, "actual"),               cell(gpRow, "budget")),
    makeLine("EBITDA",               "ebitda",       cell(ebitdaRow, "actual"),            cell(ebitdaRow, "budget")),
    makeLine("Operating Expenses",   "opex",         Math.abs(cell(opexRow, "actual")),    Math.abs(cell(opexRow, "budget")), false),
  ];

  const divColIdx  = divRows.columns.findIndex((c) => c.name === "division");
  const actColIdx  = divRows.columns.findIndex((c) => c.name === "actual");
  const budColIdx  = divRows.columns.findIndex((c) => c.name === "budget");

  const divisions: VsActualsLine[] = divRows.rows.map((row) => {
    const div    = String(row[divColIdx] ?? "");
    const actual = parseFloat(String(row[actColIdx] ?? "0")) || 0;
    const budget = parseFloat(String(row[budColIdx] ?? "0")) || 0;
    const label  = div.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return makeLine(label, `div_${div.toLowerCase().replace(/\s+/g, "_")}`, actual, budget);
  });

  const result: VsActualsResult = { pl, divisions };
  _vsCache = result;
  _vsFetchedAt = Date.now();
  return result;
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — replace with real warehouse queries via SqlWarehouseAdapter
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_BUDGET_MODELS: z.infer<typeof BudgetModelSummarySchema>[] = [
  {
    id: "bm000001-0000-0000-0000-000000000001",
    versionLabel: "FY2026-OB",
    modelType: "original_budget",
    fiscalYear: 2026,
    periodsCount: 12,
    approvedBy: "cfo@company.com",
    approvedAt: "2025-11-15T00:00:00Z",
    isActive: true,
    entityIds: ["consolidated", "insurance", "pharmacy"],
    totalBudgetedRevenue: 101_000_000,
    totalBudgetedOpex: 67_000_000,
    createdAt: "2025-11-01T00:00:00Z",
  },
  {
    id: "bm000001-0000-0000-0000-000000000002",
    versionLabel: "FY2026-RF1",
    modelType: "revised_forecast",
    fiscalYear: 2026,
    periodsCount: 12,
    approvedBy: "controller@company.com",
    approvedAt: "2026-02-28T00:00:00Z",
    isActive: false,
    entityIds: ["consolidated", "insurance", "pharmacy"],
    totalBudgetedRevenue: 103_500_000,
    totalBudgetedOpex: 68_200_000,
    createdAt: "2026-02-15T00:00:00Z",
  },
];

const MOCK_VARIANCE_LINES: z.infer<typeof BudgetVarianceLineSchema>[] = [
  {
    id: "bvl00001-0000-0000-0000-000000000001",
    fiscalPeriod: "2026-Q1",
    budgetVersion: "FY2026-OB",
    entityId: "insurance",
    department: "underwriting",
    lineItemName: "Commission Income — Commercial Lines",
    budgetAmount: 9_200_000,
    actualAmount: 9_950_000,
    varianceUsd: 750_000,
    variancePct: 0.0815,
    isFavourable: true,
    isMaterial: true,
    requiresApproval: false,
    approvalStatus: "not_required",
    rootCauseDraft:
      "Commercial lines commission income beat budget by $750K (8.2%) driven by hardening market rate increases " +
      "of 9–13% on renewal book and 3 new mid-market accounts onboarded ahead of plan.",
    evidenceDocumentIds: [],
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "bvl00001-0000-0000-0000-000000000002",
    fiscalPeriod: "2026-Q1",
    budgetVersion: "FY2026-OB",
    entityId: "pharmacy",
    department: "dispensing_ops",
    lineItemName: "Pharmacy Net Revenue",
    budgetAmount: 15_800_000,
    actualAmount: 14_900_000,
    varianceUsd: -900_000,
    variancePct: -0.057,
    isFavourable: false,
    isMaterial: true,
    requiresApproval: true,
    approvalStatus: "pending",
    rootCauseDraft:
      "Pharmacy net revenue missed by $900K (5.7%) due to lower-than-expected PBM reimbursement rates " +
      "following October contract renegotiations. DIR fee adjustments of $380K were higher than modelled. " +
      "Rx volume was on-plan at 128,100 fills.",
    evidenceDocumentIds: [],
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "bvl00001-0000-0000-0000-000000000003",
    fiscalPeriod: "2026-Q1",
    budgetVersion: "FY2026-OB",
    entityId: "consolidated",
    department: "g_and_a",
    lineItemName: "G&A OpEx",
    budgetAmount: 2_100_000,
    actualAmount: 2_140_000,
    varianceUsd: 40_000,
    variancePct: 0.019,
    isFavourable: false,
    isMaterial: false,
    requiresApproval: false,
    approvalStatus: "not_required",
    evidenceDocumentIds: [],
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/budget/models", (req, res) => {
  const { fiscalYear, isActive } = req.query;
  let filtered = MOCK_BUDGET_MODELS;
  if (fiscalYear) filtered = filtered.filter((m) => m.fiscalYear === Number(fiscalYear));
  if (isActive !== undefined) filtered = filtered.filter((m) => String(m.isActive) === isActive);
  res.json({ data: filtered, total: filtered.length });
});

router.get("/budget/models/:id", (req, res) => {
  const model = MOCK_BUDGET_MODELS.find((m) => m.id === req.params.id);
  if (!model) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Budget model not found" });
    return;
  }
  res.json({ data: model });
});

router.get("/budget/variance", (req, res) => {
  const QuerySchema = z.object({
    fiscalPeriod: z.string().optional(),
    budgetVersion: z.string().optional(),
    entityId: z.string().optional(),
    materialOnly: z
      .string()
      .transform((v) => v === "true")
      .optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { fiscalPeriod, budgetVersion, entityId, materialOnly, limit } = parsed.data;
  let results = MOCK_VARIANCE_LINES;
  if (fiscalPeriod) results = results.filter((v) => v.fiscalPeriod === fiscalPeriod);
  if (budgetVersion) results = results.filter((v) => v.budgetVersion === budgetVersion);
  if (entityId) results = results.filter((v) => v.entityId === entityId);
  if (materialOnly) results = results.filter((v) => v.isMaterial);
  const summary = {
    totalLines: results.length,
    materialCount: results.filter((v) => v.isMaterial).length,
    pendingApprovalCount: results.filter((v) => v.approvalStatus === "pending").length,
    totalFavourableUsd: results.filter((v) => v.isFavourable).reduce((s, v) => s + v.varianceUsd, 0),
    totalUnfavourableUsd: results.filter((v) => !v.isFavourable).reduce((s, v) => s + v.varianceUsd, 0),
  };
  res.json({ data: results.slice(0, limit), summary, total: results.length });
});

router.get("/budget/variance/materiality", (_req, res) => {
  const stats = MOCK_VARIANCE_LINES.map((v) => ({
    lineItem: v.lineItemName,
    varianceUsd: v.varianceUsd,
    isMaterial: isMaterial("pl_variance", Math.abs(v.varianceUsd), Math.abs(v.variancePct)),
    requiresDual: requiresDualApproval("pl_variance", Math.abs(v.varianceUsd)),
  }));
  res.json({ data: stats });
});

router.post("/budget/models/:id/approve", (req, res) => {
  const model = MOCK_BUDGET_MODELS.find((m) => m.id === req.params.id);
  if (!model) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Budget model not found" });
    return;
  }
  res.status(202).json({
    message: "Budget approval request accepted",
    modelId: model.id,
    versionLabel: model.versionLabel,
    note: "Approval workflow is human-gated — a Controller or CFO must review and approve",
    approvalAction: "budget.approve",
    thresholdAmountUsd: model.totalBudgetedRevenue ?? 0,
  });
});

router.get("/budget/vs-actuals", async (_req, res, next) => {
  if (container.isStub("sqlWarehouse")) {
    res.json({ pl: [], divisions: [] });
    return;
  }
  try {
    const data = await fetchVsActualsFromSql();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

export default router;
