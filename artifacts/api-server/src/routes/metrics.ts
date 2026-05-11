import { Router } from "express";
import {
  ListMetricsQueryParams,
  GetMetricSummaryQueryParams,
  GetMetricParams,
} from "@workspace/api-zod";
import {
  MOCK_METRICS,
} from "../data/fixtures.js";

const router = Router();

router.get("/metrics", (req, res) => {
  const parsed = ListMetricsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { category, period, fiscalYear, limit = 50, offset = 0 } = parsed.data;
  let filtered = MOCK_METRICS;
  if (category) filtered = filtered.filter((m) => m.category === category);
  if (period) filtered = filtered.filter((m) => m.period === period);
  if (fiscalYear) filtered = filtered.filter((m) => m.fiscalYear === fiscalYear);
  const total = filtered.length;
  const data = filtered.slice(offset, offset + limit);
  res.json({ data, total, limit, offset });
});

router.get("/metrics/summary", (req, res) => {
  const parsed = GetMetricSummaryQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { period = "Q1", fiscalYear = 2026 } = parsed.data;
  const filtered = MOCK_METRICS.filter(
    (m) => m.period === period && m.fiscalYear === fiscalYear
  );
  const byCategory: Record<string, number> = {};
  for (const m of filtered) {
    byCategory[m.category] = (byCategory[m.category] ?? 0) + 1;
  }
  const favorable = filtered.filter((m) => (m.variancePct ?? 0) >= 0).length;
  const unfavorable = filtered.filter((m) => (m.variancePct ?? 0) < 0).length;
  res.json({
    totalMetrics: filtered.length,
    byCategory,
    favorableVariances: favorable,
    unfavorableVariances: unfavorable,
    period,
    fiscalYear,
  });
});

router.get("/metrics/:id", (req, res) => {
  const parsed = GetMetricParams.safeParse(req.params);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const metric = MOCK_METRICS.find((m) => m.id === parsed.data.id);
  if (!metric) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Metric not found" });
    return;
  }
  res.json(metric);
});

export default router;
