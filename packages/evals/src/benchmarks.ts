import { z } from "zod";

export const EvalMetricSchema = z.enum([
  "accuracy",
  "faithfulness",
  "relevance",
  "coherence",
  "completeness",
  "hallucination_rate",
  "citation_precision",
  "citation_recall",
  "f1",
  "bleu",
  "rouge",
  "latency_p50",
  "latency_p95",
]);
export type EvalMetric = z.infer<typeof EvalMetricSchema>;

export const BenchmarkCaseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().optional(),
  input: z.string(),
  expectedOutput: z.string().optional(),
  referenceDocumentIds: z.array(z.string().uuid()).default([]),
  tags: z.array(z.string()).default([]),
  domain: z.enum(["metrics", "variance", "documents", "close", "governance", "general", "workflow", "ambiguous", "abstain"]),
  difficulty: z.enum(["easy", "medium", "hard", "expert"]),
  metadata: z.record(z.string(), z.unknown()).default({}),
});
export type BenchmarkCase = z.infer<typeof BenchmarkCaseSchema>;

export const BenchmarkSuiteSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  cases: z.array(BenchmarkCaseSchema),
  targetAgentId: z.string().uuid().optional(),
  metrics: z.array(EvalMetricSchema),
  version: z.string(),
  createdAt: z.string().datetime(),
});
export type BenchmarkSuite = z.infer<typeof BenchmarkSuiteSchema>;

export const EvalRunSchema = z.object({
  id: z.string().uuid(),
  suiteId: z.string().uuid(),
  suiteName: z.string(),
  agentId: z.string().uuid(),
  agentName: z.string(),
  status: z.enum(["queued", "running", "complete", "failed"]),
  results: z.array(
    z.object({
      caseId: z.string().uuid(),
      caseName: z.string(),
      output: z.string(),
      scores: z.record(EvalMetricSchema, z.number()),
      latencyMs: z.number().int(),
      citationIds: z.array(z.string().uuid()).default([]),
      passed: z.boolean(),
    })
  ),
  aggregateScores: z.record(EvalMetricSchema, z.number()).optional(),
  passRate: z.number().min(0).max(1).optional(),
  startedAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type EvalRun = z.infer<typeof EvalRunSchema>;

export interface ScoringHarness {
  score(caseId: string, output: string, reference?: string): Promise<Record<string, number>>;
  scoreAll(runId: string): Promise<EvalRun>;
}
