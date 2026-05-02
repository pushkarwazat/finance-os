import { Router } from "express";
import { z } from "zod";
import {
  BudgetVarianceLineSchema,
  BudgetModelSummarySchema,
} from "@financeos/agents";
import { isMaterial, requiresDualApproval } from "@financeos/governance";

const router = Router();

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
    entityIds: ["consolidated"],
    totalBudgetedRevenue: 48_000_000,
    totalBudgetedOpex: 32_000_000,
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
    entityIds: ["consolidated"],
    totalBudgetedRevenue: 46_500_000,
    totalBudgetedOpex: 31_000_000,
    createdAt: "2026-02-15T00:00:00Z",
  },
];

const MOCK_VARIANCE_LINES: z.infer<typeof BudgetVarianceLineSchema>[] = [
  {
    id: "bvl00001-0000-0000-0000-000000000001",
    fiscalPeriod: "2026-Q1",
    budgetVersion: "FY2026-OB",
    entityId: "consolidated",
    department: "sales",
    lineItemName: "Subscription Revenue",
    budgetAmount: 10_500_000,
    actualAmount: 9_800_000,
    varianceUsd: -700_000,
    variancePct: -0.0667,
    isFavourable: false,
    isMaterial: true,
    requiresApproval: true,
    approvalStatus: "pending",
    rootCauseDraft:
      "Revenue fell short by $700K (6.7%) primarily due to 3 enterprise deals pushed to Q2. " +
      "Professional services revenue was on-target.",
    evidenceDocumentIds: [],
    createdAt: "2026-04-05T00:00:00Z",
    updatedAt: "2026-04-05T00:00:00Z",
  },
  {
    id: "bvl00001-0000-0000-0000-000000000002",
    fiscalPeriod: "2026-Q1",
    budgetVersion: "FY2026-OB",
    entityId: "consolidated",
    department: "engineering",
    lineItemName: "R&D Headcount Cost",
    budgetAmount: 4_200_000,
    actualAmount: 3_950_000,
    varianceUsd: 250_000,
    variancePct: 0.0595,
    isFavourable: true,
    isMaterial: true,
    requiresApproval: false,
    approvalStatus: "not_required",
    rootCauseDraft:
      "R&D headcount costs were $250K favourable due to delayed backfill of 4 engineering roles. " +
      "Hiring is expected to complete by end of Q2.",
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
    budgetAmount: 1_800_000,
    actualAmount: 1_840_000,
    varianceUsd: 40_000,
    variancePct: 0.0222,
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

export default router;
