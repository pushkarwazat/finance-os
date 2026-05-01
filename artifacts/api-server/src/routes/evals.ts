import { Router } from "express";
import { randomUUID } from "crypto";
import {
  ListEvalRunsQueryParams,
  CreateEvalRunBody,
} from "@workspace/api-zod";

const router = Router();

const MOCK_SUITE = {
  id: "60000000-0000-0001-0000-000000000001",
  name: "FinanceOS Core QA Suite",
  description:
    "Foundational benchmark covering metric analysis, variance explanation, and document QA.",
  caseCount: 5,
  metrics: [
    "accuracy",
    "faithfulness",
    "relevance",
    "hallucination_rate",
    "citation_precision",
    "latency_p95",
  ],
  version: "1.0.0",
  createdAt: "2025-01-15T00:00:00Z",
};

const MOCK_EVAL_RUN = {
  id: "70000000-0000-0001-0000-000000000001",
  suiteId: MOCK_SUITE.id,
  suiteName: MOCK_SUITE.name,
  agentId: "a0000000-0000-0000-0000-000000000099",
  agentName: "FinanceOS Analyst Agent v1",
  status: "complete" as const,
  passRate: 0.8,
  aggregateScores: {
    accuracy: 0.84,
    faithfulness: 0.91,
    relevance: 0.88,
    hallucination_rate: 0.07,
    citation_precision: 0.82,
    latency_p95: 1240,
  },
  results: [
    {
      caseId: "80000000-0001-0000-0000-000000000001",
      caseName: "Gross Margin Definition",
      output:
        "Gross margin is calculated as (Revenue - COGS) / Revenue. For Q4 FY2025, the gross margin is 67.3%, down 80bps from 68.1% in Q3.",
      scores: { accuracy: 0.92, faithfulness: 0.95, relevance: 0.94, hallucination_rate: 0.02 },
      latencyMs: 423,
      passed: true,
    },
    {
      caseId: "80000000-0002-0000-0000-000000000001",
      caseName: "Revenue Variance Q4 Explanation",
      output:
        "Revenue missed budget by $4.2M primarily due to three delayed enterprise renewals (-$3.1M) and lower PS volume (-$1.1M).",
      scores: { accuracy: 0.88, faithfulness: 0.93, relevance: 0.9, hallucination_rate: 0.04 },
      latencyMs: 612,
      passed: true,
    },
    {
      caseId: "80000000-0003-0000-0000-000000000001",
      caseName: "EBITDA Bridge Walk",
      output:
        "EBITDA declined from $18.2M to $15.7M, driven by revenue shortfall (-$4.2M), partially offset by headcount savings (+$1.3M) and lower travel (+$0.4M).",
      scores: { accuracy: 0.85, faithfulness: 0.89, relevance: 0.87, hallucination_rate: 0.08 },
      latencyMs: 854,
      passed: true,
    },
    {
      caseId: "80000000-0004-0000-0000-000000000001",
      caseName: "Audit Report Citation",
      output:
        "No material weaknesses were found. A significant deficiency in revenue recognition timing controls was identified and management committed to remediation.",
      scores: { accuracy: 0.9, faithfulness: 0.96, relevance: 0.91, citation_precision: 0.88 },
      latencyMs: 743,
      passed: true,
    },
    {
      caseId: "80000000-0005-0000-0000-000000000001",
      caseName: "Close Checklist Status",
      output:
        "Intercompany reconciliation, Revenue recognition review, and Tax provision are still open. Bank rec and fixed assets are complete.",
      scores: { accuracy: 0.76, faithfulness: 0.81, relevance: 0.78, hallucination_rate: 0.12 },
      latencyMs: 380,
      passed: false,
    },
  ],
  startedAt: "2025-01-28T10:00:00Z",
  completedAt: "2025-01-28T10:12:00Z",
  createdAt: "2025-01-28T10:00:00Z",
};

const runs = [MOCK_EVAL_RUN];

router.get("/evals/suites", (_req, res) => {
  res.json({ data: [MOCK_SUITE], total: 1 });
});

router.get("/evals/runs", (req, res) => {
  const parsed = ListEvalRunsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const { suiteId, agentId, limit = 20 } = parsed.data;
  let filtered = runs;
  if (suiteId) filtered = filtered.filter((r) => r.suiteId === suiteId);
  if (agentId) filtered = filtered.filter((r) => r.agentId === agentId);
  res.json({ data: filtered.slice(0, limit), total: filtered.length });
});

router.post("/evals/runs", (req, res) => {
  const parsed = CreateEvalRunBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const newRun = {
    ...MOCK_EVAL_RUN,
    id: randomUUID(),
    suiteId: parsed.data.suiteId,
    agentId: parsed.data.agentId,
    status: "queued" as const,
    passRate: undefined,
    aggregateScores: undefined,
    results: [],
    startedAt: null,
    completedAt: null,
    createdAt: new Date().toISOString(),
  };
  runs.push(newRun as typeof MOCK_EVAL_RUN);
  res.status(201).json(newRun);
});

export default router;
