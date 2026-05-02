import { Router } from "express";
import { z } from "zod";
import { ConsolidationRunSchema } from "@financeos/agents";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — replace with real warehouse queries via SqlWarehouseAdapter
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CONSOLIDATION_RUNS: z.infer<typeof ConsolidationRunSchema>[] = [
  {
    id: "cr000001-0000-0000-0000-000000000001",
    fiscalPeriod: "2026-Q1",
    reportingCurrency: "USD",
    entityIds: ["parent_entity", "subsidiary_a", "subsidiary_b"],
    status: "approved",
    totalUnmatchedIcUsd: 0,
    totalEliminationsUsd: 4_200_000,
    consolidatedRevenueUsd: 22_400_000,
    consolidatedEbitdaUsd: 4_800_000,
    consolidatedNetIncomeUsd: 3_100_000,
    controllerApprovedBy: "controller@company.com",
    controllerApprovedAt: "2026-04-12T14:00:00Z",
    cfoSignedOffBy: "cfo@company.com",
    cfoSignedOffAt: "2026-04-14T09:00:00Z",
    runStartedAt: "2026-04-10T08:00:00Z",
    runCompletedAt: "2026-04-14T09:00:00Z",
  },
  {
    id: "cr000001-0000-0000-0000-000000000002",
    fiscalPeriod: "2026-Q2",
    reportingCurrency: "USD",
    entityIds: ["parent_entity", "subsidiary_a", "subsidiary_b"],
    status: "pending_ic_resolution",
    totalUnmatchedIcUsd: 85_000,
    totalEliminationsUsd: 0,
    runStartedAt: "2026-04-30T08:00:00Z",
  },
];

const MOCK_IC_MISMATCHES = [
  {
    id: "icm00001-0000-0000-0000-000000000001",
    runId: "cr000001-0000-0000-0000-000000000002",
    transactionType: "management_fee",
    sellerEntityId: "parent_entity",
    buyerEntityId: "subsidiary_a",
    sellerRecordedAmountUsd: 285_000,
    buyerRecordedAmountUsd: 200_000,
    mismatchAmountUsd: 85_000,
    isMaterial: true,
    description: "Management fee: parent recorded $285K; subsidiary_a recorded $200K. Timing difference suspected.",
    status: "open",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/consolidation/runs", (req, res) => {
  const QuerySchema = z.object({
    fiscalPeriod: z.string().optional(),
    status: z.enum(["draft", "pending_ic_resolution", "pending_controller", "pending_cfo", "approved", "rejected"]).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { fiscalPeriod, status, limit } = parsed.data;
  let results = MOCK_CONSOLIDATION_RUNS;
  if (fiscalPeriod) results = results.filter((r) => r.fiscalPeriod === fiscalPeriod);
  if (status) results = results.filter((r) => r.status === status);
  res.json({ data: results.slice(0, limit), total: results.length });
});

router.get("/consolidation/runs/:id", (req, res) => {
  const run = MOCK_CONSOLIDATION_RUNS.find((r) => r.id === req.params.id);
  if (!run) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Consolidation run not found" });
    return;
  }
  const mismatches = MOCK_IC_MISMATCHES.filter((m) => m.runId === run.id);
  res.json({ data: { ...run, icMismatches: mismatches } });
});

router.get("/consolidation/runs/:id/mismatches", (req, res) => {
  const mismatches = MOCK_IC_MISMATCHES.filter((m) => m.runId === req.params.id);
  res.json({ data: mismatches, total: mismatches.length });
});

router.post("/consolidation/runs", (req, res) => {
  res.status(202).json({
    message: "Consolidation run initiated",
    status: "draft",
    note: "Run is processing. IC matching will begin automatically. Check /consolidation/runs/:id for status.",
    approvalNote: "Consolidation sign-off requires dual Controller + CFO approval",
  });
});

router.post("/consolidation/runs/:id/approve", (req, res) => {
  const run = MOCK_CONSOLIDATION_RUNS.find((r) => r.id === req.params.id);
  if (!run) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Consolidation run not found" });
    return;
  }
  if (run.totalUnmatchedIcUsd > 0) {
    res.status(409).json({
      error: "unresolved_ic_mismatches",
      statusCode: 409,
      message: `Cannot approve consolidation run with unresolved IC mismatches ($${run.totalUnmatchedIcUsd.toLocaleString()})`,
    });
    return;
  }
  res.status(202).json({
    message: "Consolidation approval request accepted",
    runId: run.id,
    fiscalPeriod: run.fiscalPeriod,
    approvalAction: "consolidation.sign_off",
    note: "Dual Controller + CFO approval required",
  });
});

export default router;
