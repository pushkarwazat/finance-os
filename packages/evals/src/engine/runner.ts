import type { BenchmarkCase, EvalRun } from "../benchmarks.js";
import { scoreCase, type ScoringOptions } from "./mock-scorer.js";
import type { CaseResult } from "../scores.js";

export interface RunOptions {
  suiteId: string;
  suiteName: string;
  agentId: string;
  agentName: string;
  runId?: string;
  limit?: number;
  scoringOptions?: ScoringOptions;
  onProgress?: (completed: number, total: number, result: CaseResult) => void;
}

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export async function runEvalSuite(
  cases: BenchmarkCase[],
  opts: RunOptions
): Promise<EvalRun & { caseResults: CaseResult[] }> {
  const runId = opts.runId ?? uuid();
  const startedAt = new Date().toISOString();
  const limited = opts.limit ? cases.slice(0, opts.limit) : cases;

  const caseResults: CaseResult[] = [];
  for (let i = 0; i < limited.length; i++) {
    const c = limited[i];
    const result = scoreCase(c, {
      ...opts.scoringOptions,
      shouldAbstain: c.domain === "abstain" || (c.metadata?.shouldAbstain as boolean),
    });
    caseResults.push(result);
    opts.onProgress?.(i + 1, limited.length, result);
  }

  const completedAt = new Date().toISOString();
  const passCount = caseResults.filter((r) => r.passed).length;
  const passRate = caseResults.length > 0 ? passCount / caseResults.length : 0;

  const metricNames = new Set<string>();
  caseResults.forEach((r) => Object.keys(r.scores).forEach((k) => metricNames.add(k)));

  const aggregateScores: Record<string, number> = {};
  for (const metric of metricNames) {
    const values = caseResults.map((r) => r.scores[metric]).filter((v) => v !== undefined);
    if (values.length > 0) {
      aggregateScores[metric as never] = values.reduce((a, b) => a + b, 0) / values.length;
    }
  }

  // Also compute domain breakdown
  const domainPassRates: Record<string, { pass: number; total: number }> = {};
  for (const r of caseResults) {
    if (!domainPassRates[r.domain]) domainPassRates[r.domain] = { pass: 0, total: 0 };
    domainPassRates[r.domain].total++;
    if (r.passed) domainPassRates[r.domain].pass++;
  }

  const evalRun: EvalRun = {
    id: runId,
    suiteId: opts.suiteId,
    suiteName: opts.suiteName,
    agentId: opts.agentId,
    agentName: opts.agentName,
    status: "complete",
    results: caseResults.map((r) => ({
      caseId: r.caseId,
      caseName: r.caseName,
      output: r.output ?? "",
      scores: aggregateScores as never,
      latencyMs: r.latencyMs,
      citationIds: r.citationCoverage?.correctCitationIds ?? [],
      passed: r.passed,
    })),
    aggregateScores: aggregateScores as never,
    passRate,
    startedAt,
    completedAt,
    createdAt: startedAt,
  };

  return { ...evalRun, caseResults };
}

export function computeRegressionReport(
  baselineRun: { id: string; aggregateScores: Record<string, number>; passRate: number },
  currentRun: { id: string; aggregateScores: Record<string, number>; passRate: number },
  suiteId: string,
  suiteName: string,
  threshold = 0.03
) {
  const allMetrics = new Set([
    ...Object.keys(baselineRun.aggregateScores),
    ...Object.keys(currentRun.aggregateScores),
    "pass_rate",
  ]);

  const checks = Array.from(allMetrics).map((metric) => {
    const baseline = metric === "pass_rate" ? baselineRun.passRate : (baselineRun.aggregateScores[metric] ?? 0);
    const current = metric === "pass_rate" ? currentRun.passRate : (currentRun.aggregateScores[metric] ?? 0);
    const delta = current - baseline;
    const deltaRelative = baseline !== 0 ? delta / baseline : 0;
    const isLatencyMetric = metric.includes("latency") || metric === "latency_p95";
    const isHallucinationMetric = metric.includes("hallucination");
    const isRegression = isLatencyMetric || isHallucinationMetric
      ? delta > threshold
      : delta < -threshold;
    return {
      metric,
      baselineValue: baseline,
      currentValue: current,
      delta,
      deltaRelative,
      regressionThreshold: threshold,
      isRegression,
      isImprovement: !isRegression && Math.abs(delta) > threshold / 2,
    };
  });

  const regressionDetected = checks.some((c) => c.isRegression);
  const improvementsDetected = checks.some((c) => c.isImprovement);
  const regressions = checks.filter((c) => c.isRegression).map((c) => c.metric);
  const improvements = checks.filter((c) => c.isImprovement).map((c) => c.metric);

  return {
    id: uuid(),
    suiteId,
    suiteName,
    baselineRunId: baselineRun.id,
    currentRunId: currentRun.id,
    baselineVersion: "baseline",
    currentVersion: "current",
    checks,
    regressionDetected,
    improvementsDetected,
    summary: regressionDetected
      ? `REGRESSION DETECTED: ${regressions.join(", ")} degraded by >${(threshold * 100).toFixed(0)}%.`
      : improvementsDetected
      ? `IMPROVEMENT: ${improvements.join(", ")} improved by >${(threshold * 50).toFixed(0)}%.`
      : `STABLE: No significant regressions or improvements detected.`,
    createdAt: new Date().toISOString(),
  };
}
