import { Router } from "express";
import { z } from "zod";
import {
  CashPositionSnapshotSchema,
  CovenantTestResultSchema,
} from "@financeos/agents";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Mock data — replace with real warehouse queries via SqlWarehouseAdapter
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_CASH_POSITIONS: z.infer<typeof CashPositionSnapshotSchema>[] = [
  {
    id: "cp000001-0000-0000-0000-000000000001",
    asOfDate: "2026-05-01",
    entityId: "consolidated",
    totalUnrestrictedCashUsd: 38_500_000,
    totalRestrictedCashUsd: 2_000_000,
    shortTermInvestmentsUsd: 5_000_000,
    runwayMonths: 14.2,
    netMonthlyBurnUsd: 2_710_000,
    alertLevel: "ok",
    computedAt: "2026-05-01T06:00:00Z",
  },
  {
    id: "cp000001-0000-0000-0000-000000000002",
    asOfDate: "2026-04-01",
    entityId: "consolidated",
    totalUnrestrictedCashUsd: 41_200_000,
    totalRestrictedCashUsd: 2_000_000,
    shortTermInvestmentsUsd: 5_000_000,
    runwayMonths: 15.1,
    netMonthlyBurnUsd: 2_730_000,
    alertLevel: "ok",
    computedAt: "2026-04-01T06:00:00Z",
  },
];

const MOCK_COVENANT_TESTS: z.infer<typeof CovenantTestResultSchema>[] = [
  {
    id: "ct000001-0000-0000-0000-000000000001",
    covenantId: "cov-001",
    covenantName: "Net Leverage Ratio ≤ 4.0x",
    testDate: "2026-03-31",
    metricSlug: "net_leverage_ratio",
    currentValue: 1.8,
    thresholdValue: 4.0,
    headroomAbs: 2.2,
    headroomPct: 0.55,
    status: "compliant",
    requiresWaiver: false,
  },
  {
    id: "ct000001-0000-0000-0000-000000000002",
    covenantId: "cov-002",
    covenantName: "DSCR ≥ 1.25x",
    testDate: "2026-03-31",
    metricSlug: "dscr",
    currentValue: 2.4,
    thresholdValue: 1.25,
    headroomAbs: 1.15,
    headroomPct: 0.92,
    status: "compliant",
    requiresWaiver: false,
  },
  {
    id: "ct000001-0000-0000-0000-000000000003",
    covenantId: "cov-003",
    covenantName: "Current Ratio ≥ 1.2x",
    testDate: "2026-03-31",
    metricSlug: "current_ratio",
    currentValue: 1.35,
    thresholdValue: 1.2,
    headroomAbs: 0.15,
    headroomPct: 0.125,
    status: "watch",
    requiresWaiver: false,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

router.get("/treasury/positions", (req, res) => {
  const QuerySchema = z.object({
    entityId: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(90).default(30),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { entityId, limit } = parsed.data;
  let results = MOCK_CASH_POSITIONS;
  if (entityId) results = results.filter((p) => p.entityId === entityId);
  const latest = results[0];
  res.json({
    data: results.slice(0, limit),
    latest: latest ?? null,
    alertLevel: latest?.alertLevel ?? "ok",
    total: results.length,
  });
});

router.get("/treasury/positions/latest", (req, res) => {
  const entityId = typeof req.query.entityId === "string" ? req.query.entityId : "consolidated";
  const pos = MOCK_CASH_POSITIONS.find((p) => p.entityId === entityId);
  if (!pos) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "No cash position found for entity" });
    return;
  }
  res.json({ data: pos });
});

router.get("/treasury/covenants", (req, res) => {
  const QuerySchema = z.object({
    status: z.enum(["compliant", "watch", "breach"]).optional(),
    testDate: z.string().optional(),
  });
  const parsed = QuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { status, testDate } = parsed.data;
  let results = MOCK_COVENANT_TESTS;
  if (status) results = results.filter((c) => c.status === status);
  if (testDate) results = results.filter((c) => c.testDate === testDate);
  const summary = {
    totalCovenants: results.length,
    compliantCount: results.filter((c) => c.status === "compliant").length,
    watchCount: results.filter((c) => c.status === "watch").length,
    breachCount: results.filter((c) => c.status === "breach").length,
    overallStatus:
      results.some((c) => c.status === "breach")
        ? "breach"
        : results.some((c) => c.status === "watch")
        ? "watch_list"
        : "all_compliant",
  };
  res.json({ data: results, summary, total: results.length });
});

router.get("/treasury/covenants/:id", (req, res) => {
  const test = MOCK_COVENANT_TESTS.find((c) => c.id === req.params.id);
  if (!test) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Covenant test not found" });
    return;
  }
  res.json({ data: test });
});

router.post("/treasury/sweep-instructions", (req, res) => {
  res.status(202).json({
    message: "Sweep instruction draft accepted for review",
    status: "draft",
    note: "All sweep instructions are drafts only. Dual Controller + CFO approval required above $1M. No bank action taken without human execution in the treasury portal.",
    approvalAction: "treasury.sweep_instruction",
  });
});

export default router;
