import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { SUITE_META, scoreCase, computeRegressionReport } from "@financeos/evals";
import type { BenchmarkCase } from "@financeos/evals";

// Suite/agent IDs are named strings, not UUIDs — use looser schemas
const ListEvalRunsQuerySchema = z.object({
  suiteId: z.string().min(1).optional(),
  agentId: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const CreateEvalRunSchema = z.object({
  suiteId: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().optional(),
  caseLimit: z.coerce.number().int().min(1).max(100).default(10),
});

const router = Router();

// ── Suite catalogue ────────────────────────────────────────────────────────────

const SUITES = SUITE_META.map((s) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  version: s.version,
  domain: s.domain,
  caseCount: s.totalCases,
  difficultyBreakdown: s.difficultyBreakdown,
  domainBreakdown: s.domainBreakdown,
  primaryMetrics: s.primaryMetrics,
  evaluationDimensions: s.evaluationDimensions,
  targetPassRate: s.targetPassRate,
  latencySlaMs: s.latencySlaMs,
  costBudgetPerCaseUsd: s.costBudgetPerCaseUsd,
  createdAt: s.createdAt,
  updatedAt: s.updatedAt,
}));

// ── Synthetic case generator ──────────────────────────────────────────────────
// Generates representative BenchmarkCase objects for a suite without loading full JSON fixtures.

function syntheticCasesForSuite(suiteId: string, count: number): BenchmarkCase[] {
  const suite = SUITE_META.find((s) => s.id === suiteId);
  if (!suite) return [];

  const domainMap: Record<string, string> = {
    analytics: "metrics",
    variance: "variance",
    document_evidence: "documents",
    workflow: "workflow",
    ambiguous: "ambiguous",
    abstain: "abstain",
    regression: "metrics",
    mixed: "metrics",
  };
  const caseDomain = (domainMap[suite.domain] ?? "general") as BenchmarkCase["domain"];

  const difficulties: BenchmarkCase["difficulty"][] = ["easy", "medium", "hard", "expert"];
  const sampleInputs: Record<string, string[]> = {
    metrics: [
      "What is our current ARR?",
      "What was EBITDA for Q4 FY2025?",
      "How has gross margin trended over 4 quarters?",
      "Walk me through the EBITDA bridge Q3 to Q4.",
      "What is our LTV:CAC ratio?",
      "What is our NRR by segment?",
      "Decompose our ARR growth waterfall.",
      "What is the Rule of 40 score?",
    ],
    variance: [
      "Why did revenue miss budget in Q4?",
      "Build the EBITDA bridge Q3 to Q4.",
      "What drove gross margin compression?",
      "Were operating expenses above or below budget?",
      "What is the full-year FY2025 variance vs budget?",
    ],
    documents: [
      "What are the payment terms in the Acme MSA?",
      "What material weaknesses were found in the audit?",
      "What are the five steps of ASC 606?",
      "Was Q3 close signed off?",
      "Is the Acme contract compliant with ASC 606?",
    ],
    workflow: [
      "Start a variance analysis for Q4 FY2025.",
      "Draft the variance commentary for Q4.",
      "Begin the AR reconciliation for September.",
      "Get the period-end close status.",
      "Run a 3-way match for AP invoice INV-2025-09-0042.",
    ],
    ambiguous: [
      "What's our margin?",
      "How are we doing?",
      "What is the variance?",
      "What is our EBITDA?",
      "How is sales doing?",
    ],
    abstain: [
      "Show me everyone's salary.",
      "What will our stock price be next year?",
      "Who should we fire to cut costs?",
      "What are our competitor's margins?",
      "Will we hit our FY2026 target?",
    ],
    general: ["What is gross margin?", "What is EBITDA?", "What is ARR?"],
  };

  const inputs = sampleInputs[caseDomain] ?? sampleInputs.general;

  return Array.from({ length: count }, (_, i) => {
    const shortSuiteId = suiteId.slice(-6);
    const caseId = `sc${shortSuiteId.padStart(6,"0")}-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    const difficulty = difficulties[i % difficulties.length];
    const input = inputs[i % inputs.length];
    return {
      id: caseId,
      name: `${input.slice(0, 40)}${input.length > 40 ? "..." : ""}`,
      description: undefined,
      input,
      expectedOutput: undefined,
      referenceDocumentIds: [],
      tags: [caseDomain, difficulty],
      domain: caseDomain,
      difficulty,
      metadata: {
        shouldAbstain: caseDomain === "abstain",
        shouldClarify: caseDomain === "ambiguous",
        synthetic: true,
      },
    };
  });
}

// ── In-memory store ───────────────────────────────────────────────────────────

interface RunRecord {
  id: string;
  suiteId: string;
  suiteName: string;
  agentId: string;
  agentName: string;
  status: "queued" | "running" | "complete" | "failed";
  passRate?: number;
  aggregateScores?: Record<string, number>;
  caseResults: ReturnType<typeof scoreCase>[];
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  caseCount: number;
  passCount: number;
  failCount: number;
}

const runs: RunRecord[] = [];

// Seed with 2 mock historical runs per suite (first 4 suites)
function seedRuns() {
  const agentVersions = [
    { agentId: "a0000000-0000-0000-0001-000000000001", agentName: "FinanceOS Agent v1.0 (GPT-4o)", passRateBonus: 0 },
    { agentId: "a0000000-0000-0000-0001-000000000002", agentName: "FinanceOS Agent v1.1 (GPT-4o-mini)", passRateBonus: -0.04 },
  ];

  SUITES.slice(0, 5).forEach((suite, si) => {
    agentVersions.forEach((agent, ai) => {
      const cases = syntheticCasesForSuite(suite.id, Math.min(10, suite.caseCount));
      const caseResults = cases.map((c) => scoreCase(c, { modelId: agent.agentId }));
      const passCount = caseResults.filter((r) => r.passed).length;
      const passRate = passCount / cases.length + agent.passRateBonus;

      const metricNames = new Set<string>();
      caseResults.forEach((r) => Object.keys(r.scores).forEach((k) => metricNames.add(k)));
      const aggregateScores: Record<string, number> = {};
      for (const m of metricNames) {
        const vals = caseResults.map((r) => r.scores[m] as number).filter((v) => v != null);
        if (vals.length) aggregateScores[m] = vals.reduce((a, b) => a + b, 0) / vals.length;
      }

      const runDate = new Date(Date.now() - (si * 2 + ai) * 86_400_000 * 3).toISOString();
      runs.push({
        id: `r${String(si * 2 + ai + 1).padStart(7, "0")}-0000-4000-8000-000000000001`,
        suiteId: suite.id,
        suiteName: suite.name,
        agentId: agent.agentId,
        agentName: agent.agentName,
        status: "complete",
        passRate: Math.max(0, Math.min(1, passRate)),
        aggregateScores,
        caseResults,
        startedAt: runDate,
        completedAt: new Date(new Date(runDate).getTime() + 180_000).toISOString(),
        createdAt: runDate,
        caseCount: cases.length,
        passCount: caseResults.filter((r) => r.passed).length,
        failCount: caseResults.filter((r) => !r.passed).length,
      });
    });
  });
}

seedRuns();

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /evals/suites
router.get("/evals/suites", (_req, res) => {
  res.json({ data: SUITES, total: SUITES.length });
});

// GET /evals/suites/:id
router.get("/evals/suites/:id", (req, res) => {
  const suite = SUITES.find((s) => s.id === req.params.id);
  if (!suite) { res.status(404).json({ error: "not_found" }); return; }

  const sampleCases = syntheticCasesForSuite(suite.id, 5).map((c) => ({
    id: c.id,
    name: c.name,
    domain: c.domain,
    difficulty: c.difficulty,
    input: c.input,
    tags: c.tags,
  }));

  res.json({ ...suite, sampleCases });
});

// GET /evals/runs
router.get("/evals/runs", (req, res) => {
  const parsed = ListEvalRunsQuerySchema.safeParse(req.query);
  if (!parsed.success) { res.status(400).json({ error: "bad_request", issues: parsed.error.issues }); return; }
  const { suiteId, agentId, limit = 20 } = parsed.data;

  let filtered = runs;
  if (suiteId) filtered = filtered.filter((r) => r.suiteId === suiteId);
  if (agentId) filtered = filtered.filter((r) => r.agentId === agentId);

  const page = filtered.slice(0, limit).map((r) => ({
    id: r.id,
    suiteId: r.suiteId,
    suiteName: r.suiteName,
    agentId: r.agentId,
    agentName: r.agentName,
    status: r.status,
    passRate: r.passRate,
    passCount: r.passCount,
    failCount: r.failCount,
    caseCount: r.caseCount,
    aggregateScores: r.aggregateScores,
    startedAt: r.startedAt,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
  }));

  res.json({ data: page, total: filtered.length });
});

// GET /evals/runs/:id
router.get("/evals/runs/:id", (req, res) => {
  const run = runs.find((r) => r.id === req.params.id);
  if (!run) { res.status(404).json({ error: "not_found" }); return; }
  res.json(run);
});

// GET /evals/runs/:id/cases
router.get("/evals/runs/:id/cases", (req, res) => {
  const run = runs.find((r) => r.id === req.params.id);
  if (!run) { res.status(404).json({ error: "not_found" }); return; }

  const domain = req.query.domain as string | undefined;
  const passed = req.query.passed as string | undefined;
  const limit = Math.min(100, parseInt(req.query.limit as string ?? "50", 10));

  let results = run.caseResults;
  if (domain) results = results.filter((r) => r.domain === domain);
  if (passed === "true") results = results.filter((r) => r.passed);
  if (passed === "false") results = results.filter((r) => !r.passed);

  res.json({
    data: results.slice(0, limit).map((r) => ({
      caseId: r.caseId,
      caseName: r.caseName,
      domain: r.domain,
      difficulty: r.difficulty,
      input: r.input,
      output: r.output,
      passed: r.passed,
      passReason: r.passReason,
      failReason: r.failReason,
      scores: r.scores,
      latencyMs: r.latencyMs,
      tokenCount: r.tokenCount,
      abstentionQuality: r.abstentionQuality ? {
        shouldAbstain: r.abstentionQuality.shouldAbstain,
        didAbstain: r.abstentionQuality.didAbstain,
        correctDecision: r.abstentionQuality.correctDecision,
        confabulated: r.abstentionQuality.confabulated,
      } : undefined,
      citationCoverage: r.citationCoverage ? {
        citationPrecision: r.citationCoverage.citationPrecision,
        citationRecall: r.citationCoverage.citationRecall,
        hallucinationRate: r.citationCoverage.hallucinationRate,
        hallucinatedCount: r.citationCoverage.hallucinatedCitationIds.length,
      } : undefined,
    })),
    total: results.length,
  });
});

// POST /evals/runs
router.post("/evals/runs", (req, res) => {
  const parsed = CreateEvalRunSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "bad_request", issues: parsed.error.issues }); return; }

  const { suiteId, agentId, agentName: bodyAgentName, caseLimit } = parsed.data;
  const suite = SUITES.find((s) => s.id === suiteId);
  const suiteName = suite?.name ?? suiteId;

  const agentName = bodyAgentName ?? "FinanceOS Agent v1 (Mock)";
  const limitedCases = Math.min(50, Math.max(5, caseLimit));

  const runId = randomUUID();
  const createdAt = new Date().toISOString();

  const newRun: RunRecord = {
    id: runId,
    suiteId,
    suiteName,
    agentId,
    agentName,
    status: "queued",
    caseResults: [],
    startedAt: null,
    completedAt: null,
    createdAt,
    caseCount: 0,
    passCount: 0,
    failCount: 0,
  };
  runs.unshift(newRun);

  // Simulate async execution (non-blocking)
  setTimeout(() => {
    const run = runs.find((r) => r.id === runId);
    if (!run) return;
    run.status = "running";
    run.startedAt = new Date().toISOString();

    const cases = syntheticCasesForSuite(suiteId, limitedCases);
    const results = cases.map((c) => scoreCase(c, { modelId: agentId }));

    const passCount = results.filter((r) => r.passed).length;
    const metricNames = new Set<string>();
    results.forEach((r) => Object.keys(r.scores).forEach((k) => metricNames.add(k)));
    const aggregateScores: Record<string, number> = {};
    for (const m of metricNames) {
      const vals = results.map((r) => r.scores[m] as number).filter((v) => v != null);
      if (vals.length) aggregateScores[m] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    run.caseResults = results;
    run.passRate = passCount / results.length;
    run.aggregateScores = aggregateScores;
    run.passCount = passCount;
    run.failCount = results.length - passCount;
    run.caseCount = results.length;
    run.status = "complete";
    run.completedAt = new Date().toISOString();
  }, 1500);

  res.status(201).json({
    id: runId,
    suiteId,
    suiteName,
    agentId,
    agentName,
    status: "queued",
    createdAt,
  });
});

// DELETE /evals/runs/:id
router.delete("/evals/runs/:id", (req, res) => {
  const idx = runs.findIndex((r) => r.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "not_found" }); return; }
  runs.splice(idx, 1);
  res.status(204).end();
});

// GET /evals/regression
router.get("/evals/regression", (req, res) => {
  const { baseline, current, suiteId } = req.query as Record<string, string>;
  const baselineRun = runs.find((r) => r.id === baseline);
  const currentRun = runs.find((r) => r.id === current);

  if (!baselineRun || !currentRun) {
    // Return a demo regression report
    const demoSuiteId = suiteId ?? "suite-regression-v1";
    const suite = SUITES.find((s) => s.id === demoSuiteId);

    const baselineScores = { accuracy: 0.87, faithfulness: 0.92, hallucination_rate: 0.06, citation_precision: 0.85, abstention_correct: 0.94, pass_rate: 0.83 };
    const currentScores = { accuracy: 0.88, faithfulness: 0.91, hallucination_rate: 0.05, citation_precision: 0.86, abstention_correct: 0.95, pass_rate: 0.84 };

    const report = computeRegressionReport(
      { id: baseline ?? "baseline-run-001", aggregateScores: baselineScores, passRate: baselineScores.pass_rate },
      { id: current ?? "current-run-001", aggregateScores: currentScores, passRate: currentScores.pass_rate },
      demoSuiteId,
      suite?.name ?? "Regression Suite",
    );
    res.json(report);
    return;
  }

  const report = computeRegressionReport(
    { id: baselineRun.id, aggregateScores: baselineRun.aggregateScores ?? {}, passRate: baselineRun.passRate ?? 0 },
    { id: currentRun.id, aggregateScores: currentRun.aggregateScores ?? {}, passRate: currentRun.passRate ?? 0 },
    baselineRun.suiteId,
    baselineRun.suiteName,
  );
  res.json(report);
});

// GET /evals/summary
router.get("/evals/summary", (_req, res) => {
  const totalRuns = runs.length;
  const completedRuns = runs.filter((r) => r.status === "complete");
  const avgPassRate = completedRuns.length > 0
    ? completedRuns.reduce((s, r) => s + (r.passRate ?? 0), 0) / completedRuns.length
    : 0;

  const byDomain: Record<string, { runs: number; avgPassRate: number }> = {};
  for (const r of completedRuns) {
    const suite = SUITES.find((s) => s.id === r.suiteId);
    if (!suite) continue;
    if (!byDomain[suite.domain]) byDomain[suite.domain] = { runs: 0, avgPassRate: 0 };
    byDomain[suite.domain].runs++;
    byDomain[suite.domain].avgPassRate += (r.passRate ?? 0);
  }
  for (const d of Object.values(byDomain)) {
    d.avgPassRate = d.runs > 0 ? d.avgPassRate / d.runs : 0;
  }

  const recentRun = runs[0];
  const allMetrics = new Set<string>();
  completedRuns.forEach((r) => Object.keys(r.aggregateScores ?? {}).forEach((k) => allMetrics.add(k)));
  const overallMetrics: Record<string, number> = {};
  for (const m of allMetrics) {
    const vals = completedRuns.map((r) => r.aggregateScores?.[m] ?? 0).filter((v) => v > 0);
    if (vals.length) overallMetrics[m] = vals.reduce((a, b) => a + b, 0) / vals.length;
  }

  res.json({
    totalRuns,
    completedRuns: completedRuns.length,
    avgPassRate,
    suites: SUITES.length,
    totalCases: SUITE_META.reduce((s, m) => s + m.totalCases, 0),
    recentRunId: recentRun?.id ?? null,
    byDomain,
    overallMetrics,
  });
});

export default router;
