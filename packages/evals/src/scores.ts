import { z } from "zod";

// ── Semantic Parsing ───────────────────────────────────────────────────────────

export const IntentSchema = z.enum([
  "metric_lookup",
  "variance_explain",
  "trend_analysis",
  "document_qa",
  "policy_check",
  "workflow_task",
  "definition",
  "aggregation",
  "comparison",
  "forecast",
  "close_status",
  "reconciliation",
  "unknown",
]);
export type Intent = z.infer<typeof IntentSchema>;

export const SemanticParsingScoreSchema = z.object({
  caseId: z.string(),
  recognizedIntent: IntentSchema,
  expectedIntent: IntentSchema,
  intentCorrect: z.boolean(),
  extractedEntities: z.record(z.string(), z.string()),
  expectedEntities: z.record(z.string(), z.string()),
  entityPrecision: z.number().min(0).max(1),
  entityRecall: z.number().min(0).max(1),
  entityF1: z.number().min(0).max(1),
  parseLatencyMs: z.number().int(),
  intentAccuracy: z.number().min(0).max(1),
});
export type SemanticParsingScore = z.infer<typeof SemanticParsingScoreSchema>;

// ── Retrieval Relevance ───────────────────────────────────────────────────────

export const RetrievalHitSchema = z.object({
  docId: z.string(),
  rank: z.number().int(),
  score: z.number().min(0).max(1),
  isRelevant: z.boolean(),
});

export const RetrievalRelevanceScoreSchema = z.object({
  caseId: z.string(),
  query: z.string(),
  retrievedDocs: z.array(RetrievalHitSchema),
  relevantDocIds: z.array(z.string()),
  precisionAt1: z.number().min(0).max(1),
  precisionAt3: z.number().min(0).max(1),
  precisionAt5: z.number().min(0).max(1),
  recallAt3: z.number().min(0).max(1),
  recallAt5: z.number().min(0).max(1),
  ndcgAt5: z.number().min(0).max(1),
  mrr: z.number().min(0).max(1),
  retrievalLatencyMs: z.number().int(),
  retrievalStrategy: z.enum(["bm25", "semantic", "hybrid"]),
});
export type RetrievalRelevanceScore = z.infer<typeof RetrievalRelevanceScoreSchema>;

// ── Citation Coverage ─────────────────────────────────────────────────────────

export const CitationCoverageScoreSchema = z.object({
  caseId: z.string(),
  requiredCitationIds: z.array(z.string()),
  providedCitationIds: z.array(z.string()),
  correctCitationIds: z.array(z.string()),
  hallucinatedCitationIds: z.array(z.string()),
  missingCitationIds: z.array(z.string()),
  citationPrecision: z.number().min(0).max(1),
  citationRecall: z.number().min(0).max(1),
  citationF1: z.number().min(0).max(1),
  hallucinationRate: z.number().min(0).max(1),
  inlineCitationsPresent: z.boolean(),
});
export type CitationCoverageScore = z.infer<typeof CitationCoverageScoreSchema>;

// ── Abstention Quality ────────────────────────────────────────────────────────

export const AbstentionQualityScoreSchema = z.object({
  caseId: z.string(),
  shouldAbstain: z.boolean(),
  didAbstain: z.boolean(),
  correctDecision: z.boolean(),
  confabulated: z.boolean(),
  falsePositive: z.boolean(),
  falseNegative: z.boolean(),
  abstentionMessage: z.string().optional(),
  abstentionMessageQuality: z.number().min(0).max(1).optional(),
  escalatedCorrectly: z.boolean().optional(),
});
export type AbstentionQualityScore = z.infer<typeof AbstentionQualityScoreSchema>;

// ── Workflow Correctness ──────────────────────────────────────────────────────

export const WorkflowStepResultSchema = z.object({
  stepName: z.string(),
  expectedState: z.string(),
  actualState: z.string(),
  correct: z.boolean(),
  toolsCalledCorrectly: z.boolean(),
  outputPresent: z.boolean(),
});

export const WorkflowCorrectnessScoreSchema = z.object({
  caseId: z.string(),
  agentId: z.string(),
  expectedWorkflowType: z.string(),
  actualWorkflowType: z.string().optional(),
  steps: z.array(WorkflowStepResultSchema),
  stateAccuracy: z.number().min(0).max(1),
  toolPrecision: z.number().min(0).max(1),
  toolRecall: z.number().min(0).max(1),
  outputTypeCorrect: z.boolean(),
  escalationCorrect: z.boolean(),
  draftQualityScore: z.number().min(0).max(1).optional(),
  noAutonomousPostingViolation: z.boolean(),
});
export type WorkflowCorrectnessScore = z.infer<typeof WorkflowCorrectnessScoreSchema>;

// ── Latency & Cost ────────────────────────────────────────────────────────────

export const LatencyCostScoreSchema = z.object({
  caseId: z.string(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  totalTokens: z.number().int(),
  latencyMs: z.number().int(),
  latencyP50Ms: z.number().int().optional(),
  latencyP95Ms: z.number().int().optional(),
  estimatedCostUsd: z.number(),
  costPer1kTokensUsd: z.number(),
  modelId: z.string(),
  withinLatencySla: z.boolean(),
  withinCostBudget: z.boolean(),
  latencySlaMs: z.number().int().default(3000),
  costBudgetUsd: z.number().default(0.05),
});
export type LatencyCostScore = z.infer<typeof LatencyCostScoreSchema>;

// ── Composite Eval Result ─────────────────────────────────────────────────────

export const EvalDimensionSchema = z.enum([
  "semantic_parsing",
  "retrieval_relevance",
  "citation_coverage",
  "abstention_quality",
  "workflow_correctness",
  "latency_cost",
  "faithfulness",
  "accuracy",
  "coherence",
  "completeness",
]);
export type EvalDimension = z.infer<typeof EvalDimensionSchema>;

export const CaseResultSchema = z.object({
  caseId: z.string(),
  caseName: z.string(),
  domain: z.string(),
  difficulty: z.string(),
  input: z.string(),
  output: z.string().optional(),
  passed: z.boolean(),
  passReason: z.string().optional(),
  failReason: z.string().optional(),
  scores: z.record(z.string(), z.number()),
  semanticParsing: SemanticParsingScoreSchema.optional(),
  retrievalRelevance: RetrievalRelevanceScoreSchema.optional(),
  citationCoverage: CitationCoverageScoreSchema.optional(),
  abstentionQuality: AbstentionQualityScoreSchema.optional(),
  workflowCorrectness: WorkflowCorrectnessScoreSchema.optional(),
  latencyCost: LatencyCostScoreSchema.optional(),
  latencyMs: z.number().int(),
  tokenCount: z.object({ input: z.number().int(), output: z.number().int() }).optional(),
});
export type CaseResult = z.infer<typeof CaseResultSchema>;

// ── Regression ────────────────────────────────────────────────────────────────

export const RegressionCheckSchema = z.object({
  metric: z.string(),
  baselineValue: z.number(),
  currentValue: z.number(),
  delta: z.number(),
  deltaRelative: z.number(),
  regressionThreshold: z.number().default(0.05),
  isRegression: z.boolean(),
  isImprovement: z.boolean(),
});
export type RegressionCheck = z.infer<typeof RegressionCheckSchema>;

export const RegressionReportSchema = z.object({
  id: z.string(),
  suiteId: z.string(),
  suiteName: z.string(),
  baselineRunId: z.string(),
  currentRunId: z.string(),
  baselineVersion: z.string(),
  currentVersion: z.string(),
  checks: z.array(RegressionCheckSchema),
  regressionDetected: z.boolean(),
  improvementsDetected: z.boolean(),
  summary: z.string(),
  createdAt: z.string().datetime(),
});
export type RegressionReport = z.infer<typeof RegressionReportSchema>;

// ── Benchmark Suite (extended) ────────────────────────────────────────────────

export const BenchmarkSuiteMetaSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  domain: z.enum(["analytics", "variance", "document_evidence", "workflow", "ambiguous", "abstain", "regression", "mixed"]),
  totalCases: z.number().int(),
  difficultyBreakdown: z.record(z.string(), z.number()),
  domainBreakdown: z.record(z.string(), z.number()),
  primaryMetrics: z.array(z.string()),
  evaluationDimensions: z.array(EvalDimensionSchema),
  targetPassRate: z.number().min(0).max(1),
  latencySlaMs: z.number().int(),
  costBudgetPerCaseUsd: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type BenchmarkSuiteMeta = z.infer<typeof BenchmarkSuiteMetaSchema>;
