import { Router } from "express";
import { ListVarianceDriversQueryParams, ListForecastsQueryParams } from "@workspace/api-zod";
import { MOCK_VARIANCE_DRIVERS, MOCK_FORECASTS, MOCK_METRICS } from "../data/fixtures.js";

const router = Router();

const metricNameById = Object.fromEntries(MOCK_METRICS.map((m) => [m.id, m.name]));

router.get("/variance", (req, res) => {
  const parsed = ListVarianceDriversQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { metricId, period, fiscalYear, limit = 30 } = parsed.data;
  let filtered = MOCK_VARIANCE_DRIVERS;
  if (metricId) filtered = filtered.filter((d) => d.metricId === metricId);
  if (period) filtered = filtered.filter((d) => d.period === period);
  if (fiscalYear) filtered = filtered.filter((d) => d.fiscalYear === fiscalYear);
  const enriched = filtered.slice(0, limit).map((d) => ({
    ...d,
    metricName: metricNameById[d.metricId] ?? d.metricId,
  }));
  res.json({ data: enriched, total: filtered.length });
});

router.get("/variance/forecast", (req, res) => {
  const parsed = ListForecastsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400, message: parsed.error.message });
    return;
  }
  const { period, fiscalYear } = parsed.data;
  let filtered = MOCK_FORECASTS;
  if (period) filtered = filtered.filter((f) => f.period === period);
  if (fiscalYear) filtered = filtered.filter((f) => f.fiscalYear === fiscalYear);
  res.json({ data: filtered, total: filtered.length });
});

export default router;
