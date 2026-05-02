#!/usr/bin/env node
/**
 * FinanceOS Eval Runner CLI
 *
 * Usage:
 *   pnpm --filter @financeos/evals run eval -- --suite analytics --limit 20
 *   pnpm --filter @financeos/evals run eval -- --suite all
 *   pnpm --filter @financeos/evals run eval:compare -- --baseline <id> --current <id>
 */

import { createRequire } from "module";
import { runEvalSuite, computeRegressionReport } from "./engine/runner.js";
import { SUITE_META } from "./suite-meta.js";
import type { BenchmarkCase } from "./benchmarks.js";

const _require = createRequire(import.meta.url);

const FIXTURE_MAP: Record<string, string> = {
  analytics: "../fixtures/analytics-suite.json",
  variance: "../fixtures/variance-suite.json",
  "document-evidence": "../fixtures/document-evidence-suite.json",
  workflow: "../fixtures/workflow-tasks-suite.json",
  ambiguous: "../fixtures/ambiguous-suite.json",
  abstain: "../fixtures/abstain-suite.json",
  regression: "../fixtures/regression-suite.json",
};

function loadFixture(name: string): { cases: BenchmarkCase[]; id: string; name: string } {
  const path = FIXTURE_MAP[name];
  if (!path) throw new Error(`Unknown suite: ${name}. Valid: ${Object.keys(FIXTURE_MAP).join(", ")}`);
  const data = _require(path);
  return data;
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
      result[key] = val;
    }
  }
  return result;
}

async function runCommand(args: Record<string, string>) {
  const suiteName = args.suite ?? "regression";
  const limit = args.limit ? parseInt(args.limit, 10) : undefined;
  const jsonOutput = args.json === "true";
  const agentId = args["agent-id"] ?? "financeos-agent-v1";
  const agentName = args["agent-name"] ?? "FinanceOS Agent v1 (Mock)";

  const suiteNames = suiteName === "all" ? Object.keys(FIXTURE_MAP) : [suiteName];

  const allRuns = [];

  for (const name of suiteNames) {
    const fixture = loadFixture(name);
    if (!jsonOutput) {
      console.log(`\n── Running suite: ${fixture.name} ──`);
      console.log(`   Cases: ${fixture.cases.length}${limit ? ` (limited to ${limit})` : ""}`);
    }

    const run = await runEvalSuite(fixture.cases, {
      suiteId: fixture.id,
      suiteName: fixture.name,
      agentId,
      agentName,
      limit,
      onProgress: jsonOutput
        ? undefined
        : (done, total, result) => {
            const icon = result.passed ? "✓" : "✗";
            const scores = Object.entries(result.scores)
              .filter(([k]) => ["accuracy", "faithfulness", "hallucination_rate"].includes(k))
              .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
              .join(" ");
            process.stdout.write(`   ${icon} [${done}/${total}] ${result.caseName.padEnd(40)} ${scores}\n`);
          },
    });

    allRuns.push(run);

    if (!jsonOutput) {
      console.log(`\n   ── Results ──`);
      console.log(`   Pass Rate:   ${((run.passRate ?? 0) * 100).toFixed(1)}%`);
      console.log(`   Duration:    ${run.startedAt && run.completedAt
        ? `${new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()}ms`
        : "N/A"}`);
      const agg = run.aggregateScores as Record<string, number> | undefined;
      if (agg) {
        console.log(`   Accuracy:    ${((agg.accuracy ?? 0) * 100).toFixed(1)}%`);
        console.log(`   Faithfulness:${((agg.faithfulness ?? 0) * 100).toFixed(1)}%`);
        console.log(`   Hallucination Rate: ${((agg.hallucination_rate ?? 0) * 100).toFixed(1)}%`);
        console.log(`   Citation Precision: ${((agg.citation_precision ?? 0) * 100).toFixed(1)}%`);
        console.log(`   Abstention Correct: ${((agg.abstention_correct ?? 0) * 100).toFixed(1)}%`);
      }
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(allRuns.length === 1 ? allRuns[0] : allRuns, null, 2));
  } else {
    console.log("\n── Eval run complete ──\n");
  }
}

async function compareCommand(args: Record<string, string>) {
  const baselineId = args.baseline;
  const currentId = args.current;
  if (!baselineId || !currentId) {
    console.error("Usage: eval:compare --baseline <runId> --current <runId>");
    process.exit(1);
  }

  console.log(`\nComparing runs:\n  Baseline: ${baselineId}\n  Current:  ${currentId}\n`);
  console.log("Note: In a production setup, runs would be loaded from a database.");
  console.log("Generating example regression report...\n");

  const report = computeRegressionReport(
    {
      id: baselineId,
      aggregateScores: { accuracy: 0.87, faithfulness: 0.91, hallucination_rate: 0.06, citation_precision: 0.84 },
      passRate: 0.83,
    },
    {
      id: currentId,
      aggregateScores: { accuracy: 0.85, faithfulness: 0.90, hallucination_rate: 0.08, citation_precision: 0.83 },
      passRate: 0.81,
    },
    "suite-regression-v1",
    "Regression Suite",
  );

  console.log(`Status: ${report.regressionDetected ? "⚠️  REGRESSION DETECTED" : "✅ STABLE"}`);
  console.log(`Summary: ${report.summary}\n`);

  const header = "Metric".padEnd(30) + "Baseline".padEnd(12) + "Current".padEnd(12) + "Delta".padEnd(12) + "Status";
  console.log(header);
  console.log("─".repeat(header.length));

  for (const check of report.checks) {
    const status = check.isRegression ? "⚠️  REGRESSED" : check.isImprovement ? "✅ IMPROVED" : "── stable";
    const baseline = check.metric.includes("hallucination") || check.metric === "latency_p95"
      ? check.baselineValue.toFixed(3)
      : `${(check.baselineValue * 100).toFixed(1)}%`;
    const current = check.metric.includes("hallucination") || check.metric === "latency_p95"
      ? check.currentValue.toFixed(3)
      : `${(check.currentValue * 100).toFixed(1)}%`;
    const delta = check.delta > 0 ? `+${check.delta.toFixed(3)}` : check.delta.toFixed(3);
    console.log(`${check.metric.padEnd(30)}${baseline.padEnd(12)}${current.padEnd(12)}${delta.padEnd(12)}${status}`);
  }

  if (report.regressionDetected) process.exit(1);
}

const rawArgs = process.argv.slice(2);
const command = rawArgs[0] ?? "run";
const args = parseArgs(rawArgs.slice(command.startsWith("--") ? 0 : 1));

if (command === "compare" || args.compare) {
  compareCommand(args).catch(console.error);
} else {
  runCommand(args).catch(console.error);
}
