import { Router } from "express";
import { ListVarianceDriversQueryParams, ListForecastsQueryParams } from "@workspace/api-zod";
import { MOCK_VARIANCE_DRIVERS, MOCK_FORECASTS, MOCK_METRICS } from "../data/fixtures.js";
import { container } from "@financeos/container";

const router = Router();

const metricNameById = Object.fromEntries(MOCK_METRICS.map((m) => [m.id, m.name]));

// ─────────────────────────────────────────────────────────────────────────────
// SQL-backed variance analysis
// ─────────────────────────────────────────────────────────────────────────────

interface VarianceLine {
  label: string; slug: string;
  actual: number; budget: number; variance: number; variancePct: number; isFavourable: boolean;
}
interface PeriodRow { period: number; label: string; actual: number; budget: number; variance: number; }
interface VarianceAnalysis { summary: VarianceLine[]; divisions: VarianceLine[]; departments: VarianceLine[]; periods: PeriodRow[]; }

let _analysisCache: VarianceAnalysis | null = null;
let _analysisFetchedAt = 0;
const ANALYSIS_TTL_MS = 30 * 60_000;

const PERIOD_LABELS: Record<number, string> = {
  1: "Jul 25", 2: "Aug 25", 3: "Sep 25", 4: "Oct 25",
  5: "Nov 25", 6: "Dec 25", 7: "Jan 26", 8: "Feb 26",
  9: "Mar 26", 10: "Apr 26", 11: "May 26", 12: "Jun 26",
};

async function fetchVarianceAnalysis(): Promise<VarianceAnalysis> {
  if (_analysisCache && Date.now() - _analysisFetchedAt < ANALYSIS_TTL_MS) return _analysisCache;

  const wh = container.get("sqlWarehouse");
  const FY = 2026;
  const run = (sql: string) => wh.executeQuery(sql, { maxRows: 100 });

  const [revRow, gpRow, opexRow, ebitdaRow, divRows, deptRows, periodRows] = await Promise.all([
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l2 ILIKE '01 - NET REVENUE'`),
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l1 ILIKE '01 - GROSS PROFIT'`),
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l1 ILIKE '02 - OPERATING EXPENSE'`),
    run(`SELECT SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND is_ebitda ILIKE 'yes'`),
    run(`SELECT division, SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l2 ILIKE '01 - NET REVENUE' AND division NOT ILIKE 'ELIMINATION' GROUP BY division ORDER BY ABS(SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) - SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END)) DESC`),
    run(`SELECT department_name, SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND is_net_income ILIKE 'yes' AND gaap_l1 NOT ILIKE '04 - STATISTICAL' GROUP BY department_name HAVING ABS(SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) - SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END)) > 500000 ORDER BY ABS(SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) - SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END)) DESC LIMIT 15`),
    run(`SELECT (fiscal_period::integer % 100) AS period_num, SUM(CASE WHEN scenario_name ILIKE 'actuals' THEN amount::numeric ELSE 0 END) AS actual, SUM(CASE WHEN scenario_name ILIKE 'budget' THEN amount::numeric ELSE 0 END) AS budget FROM kratos_actuals WHERE fiscal_year::integer = ${FY} AND gaap_l2 ILIKE '01 - NET REVENUE' GROUP BY (fiscal_period::integer % 100) ORDER BY (fiscal_period::integer % 100)`),
  ]);

  const cell = (result: typeof revRow, col: string): number => {
    const ci = result.columns.findIndex((c) => c.name === col);
    return ci >= 0 ? parseFloat(String(result.rows[0]?.[ci] ?? "0")) || 0 : 0;
  };
  const makeLine = (label: string, slug: string, actual: number, budget: number, higherIsBetter = true): VarianceLine => {
    const variance = actual - budget;
    const variancePct = budget !== 0 ? variance / Math.abs(budget) : 0;
    return { label, slug, actual, budget, variance, variancePct, isFavourable: higherIsBetter ? variance >= 0 : variance <= 0 };
  };

  const summary: VarianceLine[] = [
    makeLine("Total Revenue",      "revenue",      cell(revRow, "actual"),             cell(revRow, "budget")),
    makeLine("Gross Profit",       "gross_profit", cell(gpRow, "actual"),              cell(gpRow, "budget")),
    makeLine("EBITDA",             "ebitda",       cell(ebitdaRow, "actual"),          cell(ebitdaRow, "budget")),
    makeLine("Operating Expenses", "opex",         Math.abs(cell(opexRow, "actual")),  Math.abs(cell(opexRow, "budget")), false),
  ];

  const idx = (rows: typeof divRows, name: string) => rows.columns.findIndex((c) => c.name === name);
  const divisions: VarianceLine[] = divRows.rows.map((row) => {
    const div = String(row[idx(divRows, "division")] ?? "");
    const actual = parseFloat(String(row[idx(divRows, "actual")] ?? "0")) || 0;
    const budget = parseFloat(String(row[idx(divRows, "budget")] ?? "0")) || 0;
    return makeLine(div.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), `div_${div.toLowerCase().replace(/\s+/g, "_")}`, actual, budget);
  });

  const departments: VarianceLine[] = deptRows.rows.map((row) => {
    const dept = String(row[idx(deptRows, "department_name")] ?? "");
    const actual = parseFloat(String(row[idx(deptRows, "actual")] ?? "0")) || 0;
    const budget = parseFloat(String(row[idx(deptRows, "budget")] ?? "0")) || 0;
    return makeLine(dept, `dept_${dept.toLowerCase().replace(/\s+/g, "_")}`, actual, budget);
  });

  const periods: PeriodRow[] = periodRows.rows.map((row) => {
    const period = parseInt(String(row[idx(periodRows, "period_num")] ?? "0")) || 0;
    const actual = parseFloat(String(row[idx(periodRows, "actual")] ?? "0")) || 0;
    const budget = parseFloat(String(row[idx(periodRows, "budget")] ?? "0")) || 0;
    return { period, label: PERIOD_LABELS[period] ?? `P${period}`, actual, budget, variance: actual - budget };
  });

  const result: VarianceAnalysis = { summary, divisions, departments, periods };
  _analysisCache = result;
  _analysisFetchedAt = Date.now();
  return result;
}

router.get("/variance/analysis", async (_req, res, next) => {
  if (container.isStub("sqlWarehouse")) {
    res.json({ summary: [], divisions: [], departments: [], periods: [] });
    return;
  }
  try {
    res.json(await fetchVarianceAnalysis());
  } catch (err) {
    next(err);
  }
});

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
