import type { BenchmarkCase } from "../benchmarks.js";
import type {
  SemanticParsingScore,
  RetrievalRelevanceScore,
  CitationCoverageScore,
  AbstentionQualityScore,
  WorkflowCorrectnessScore,
  LatencyCostScore,
  CaseResult,
  Intent,
} from "../scores.js";

// Deterministic pseudo-random seeded by string
function seededRandom(seed: string, offset = 0): number {
  let hash = offset * 2654435761;
  for (let i = 0; i < seed.length; i++) {
    hash = Math.imul(hash ^ seed.charCodeAt(i), 2654435761);
  }
  return Math.abs(((hash >>> 0) / 0xffffffff));
}

function sr(seed: string, offset: number, min = 0, max = 1): number {
  return min + seededRandom(seed, offset) * (max - min);
}

const DOMAIN_INTENT_MAP: Record<string, Intent> = {
  metrics: "metric_lookup",
  variance: "variance_explain",
  documents: "document_qa",
  workflow: "workflow_task",
  ambiguous: "unknown",
  abstain: "unknown",
  close: "close_status",
  governance: "policy_check",
  general: "metric_lookup",
};

const DOMAIN_BASE_SCORES: Record<string, number> = {
  metrics: 0.90,
  variance: 0.87,
  documents: 0.84,
  workflow: 0.86,
  ambiguous: 0.80,
  abstain: 0.93,
  close: 0.88,
  governance: 0.85,
  general: 0.87,
};

const DIFFICULTY_MULTIPLIER: Record<string, number> = {
  easy: 1.04,
  medium: 1.0,
  hard: 0.97,
  expert: 0.93,
};

export interface ScoringOptions {
  modelId?: string;
  promptTokensOverride?: number;
  completionTokensOverride?: number;
  latencyMsOverride?: number;
  costPer1kTokens?: number;
}

export function scoreSemanticParsing(c: BenchmarkCase): SemanticParsingScore {
  const base = DOMAIN_BASE_SCORES[c.domain] ?? 0.83;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const s = c.id;
  const intentCorrect = sr(s, 1) < base * dm;
  return {
    caseId: c.id,
    recognizedIntent: intentCorrect ? (DOMAIN_INTENT_MAP[c.domain] ?? "unknown") : "unknown",
    expectedIntent: DOMAIN_INTENT_MAP[c.domain] ?? "metric_lookup",
    intentCorrect,
    extractedEntities: {},
    expectedEntities: {},
    entityPrecision: Math.min(1, sr(s, 2, 0.6, 1.0) * dm),
    entityRecall: Math.min(1, sr(s, 3, 0.55, 0.98) * dm),
    entityF1: Math.min(1, sr(s, 4, 0.58, 0.97) * dm),
    parseLatencyMs: Math.round(sr(s, 5, 40, 180)),
    intentAccuracy: intentCorrect ? Math.min(1, sr(s, 6, 0.75, 1.0)) : sr(s, 6, 0.1, 0.5),
  };
}

export function scoreRetrievalRelevance(c: BenchmarkCase): RetrievalRelevanceScore {
  const base = DOMAIN_BASE_SCORES[c.domain] ?? 0.83;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const s = c.id;
  const p1 = Math.min(1, sr(s, 10, base * 0.8, base * 1.05) * dm);
  return {
    caseId: c.id,
    query: c.input,
    retrievedDocs: Array.from({ length: 5 }, (_, i) => ({
      docId: `doc-${c.id.slice(-4)}-${i + 1}`,
      rank: i + 1,
      score: Math.max(0, p1 - i * 0.08 + sr(s, 20 + i, -0.05, 0.05)),
      isRelevant: sr(s, 30 + i) < p1 - i * 0.1,
    })),
    relevantDocIds: c.referenceDocumentIds,
    precisionAt1: p1,
    precisionAt3: Math.min(1, sr(s, 11, base * 0.7, base) * dm),
    precisionAt5: Math.min(1, sr(s, 12, base * 0.6, base * 0.95) * dm),
    recallAt3: Math.min(1, sr(s, 13, base * 0.65, base) * dm),
    recallAt5: Math.min(1, sr(s, 14, base * 0.7, base * 1.02) * dm),
    ndcgAt5: Math.min(1, sr(s, 15, base * 0.72, base) * dm),
    mrr: Math.min(1, sr(s, 16, base * 0.68, base) * dm),
    retrievalLatencyMs: Math.round(sr(s, 17, 80, 420)),
    retrievalStrategy: "hybrid",
  };
}

export function scoreCitationCoverage(c: BenchmarkCase): CitationCoverageScore {
  const base = DOMAIN_BASE_SCORES[c.domain] ?? 0.83;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const s = c.id;
  const required = c.referenceDocumentIds;
  const provided = required.length > 0
    ? required.slice(0, Math.ceil(required.length * sr(s, 21, 0.5, 1.0)))
    : [];
  const hallucinated = sr(s, 22) < 0.15 * (1 - dm * 0.5)
    ? [`hallucinated-${c.id.slice(-6)}`]
    : [];
  const precision = provided.length > 0
    ? (provided.length - hallucinated.length) / (provided.length + hallucinated.length)
    : base * dm;
  const recall = required.length > 0 ? provided.length / required.length : base * dm;
  const f1 = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  return {
    caseId: c.id,
    requiredCitationIds: required,
    providedCitationIds: [...provided, ...hallucinated],
    correctCitationIds: provided,
    hallucinatedCitationIds: hallucinated,
    missingCitationIds: required.filter((r) => !provided.includes(r)),
    citationPrecision: Math.max(0, Math.min(1, precision + sr(s, 23, -0.05, 0.05) * dm)),
    citationRecall: Math.max(0, Math.min(1, recall)),
    citationF1: Math.max(0, Math.min(1, f1)),
    hallucinationRate: hallucinated.length / Math.max(1, provided.length + hallucinated.length),
    inlineCitationsPresent: sr(s, 24) < 0.8,
  } as CitationCoverageScore;
}

export function scoreAbstentionQuality(c: BenchmarkCase, shouldAbstain: boolean): AbstentionQualityScore {
  const s = c.id;
  const base = DOMAIN_BASE_SCORES[c.domain] ?? 0.83;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const correctDecisionProb = shouldAbstain
    ? (c.domain === "abstain" ? 0.94 : 0.85) * dm
    : base * dm;
  const didAbstain = shouldAbstain
    ? sr(s, 40) < correctDecisionProb
    : sr(s, 40) > 0.95;
  const correctDecision = shouldAbstain === didAbstain;
  return {
    caseId: c.id,
    shouldAbstain,
    didAbstain,
    correctDecision,
    confabulated: !didAbstain && shouldAbstain,
    falsePositive: didAbstain && !shouldAbstain,
    falseNegative: !didAbstain && shouldAbstain,
    abstentionMessage: didAbstain
      ? "I don't have sufficient information to answer this question reliably."
      : undefined,
    abstentionMessageQuality: didAbstain ? sr(s, 41, 0.7, 0.98) : undefined,
    escalatedCorrectly: shouldAbstain && didAbstain ? sr(s, 42) < 0.85 : undefined,
  };
}

export function scoreWorkflowCorrectness(c: BenchmarkCase): WorkflowCorrectnessScore {
  const s = c.id;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const stateAcc = Math.min(1, sr(s, 50, 0.65, 0.97) * dm);
  const toolPrec = Math.min(1, sr(s, 51, 0.70, 0.98) * dm);
  return {
    caseId: c.id,
    agentId: "financeos-agent-v1",
    expectedWorkflowType: c.domain,
    actualWorkflowType: c.domain,
    steps: [],
    stateAccuracy: stateAcc,
    toolPrecision: toolPrec,
    toolRecall: Math.min(1, sr(s, 52, 0.68, 0.96) * dm),
    outputTypeCorrect: sr(s, 53) < 0.9 * dm,
    escalationCorrect: sr(s, 54) < 0.88 * dm,
    draftQualityScore: Math.min(1, sr(s, 55, 0.70, 0.97) * dm),
    noAutonomousPostingViolation: true,
  };
}

export function scoreLatencyCost(c: BenchmarkCase, opts: ScoringOptions = {}): LatencyCostScore {
  const s = c.id;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const modelId = opts.modelId ?? "gpt-4o-2024-08-06";
  const baseCost = opts.costPer1kTokens ?? 0.0025;
  const baseLatency = c.difficulty === "easy" ? 400 : c.difficulty === "medium" ? 800 : c.difficulty === "hard" ? 1400 : 2200;
  const latency = opts.latencyMsOverride ?? Math.round(baseLatency + sr(s, 60, -200, 400) / dm);
  const promptTokens = opts.promptTokensOverride ?? Math.round(sr(s, 61, 200, 1200) * (1 / dm));
  const completionTokens = opts.completionTokensOverride ?? Math.round(sr(s, 62, 80, 600));
  const total = promptTokens + completionTokens;
  const cost = (total / 1000) * baseCost;
  return {
    caseId: c.id,
    promptTokens,
    completionTokens,
    totalTokens: total,
    latencyMs: latency,
    estimatedCostUsd: cost,
    costPer1kTokensUsd: baseCost,
    modelId,
    withinLatencySla: latency < 3000,
    withinCostBudget: cost < 0.05,
    latencySlaMs: 3000,
    costBudgetUsd: 0.05,
  };
}

export function scoreCase(
  c: BenchmarkCase,
  opts: ScoringOptions & { shouldAbstain?: boolean } = {}
): CaseResult {
  const base = DOMAIN_BASE_SCORES[c.domain] ?? 0.83;
  const dm = DIFFICULTY_MULTIPLIER[c.difficulty] ?? 1.0;
  const s = c.id;

  const semanticParsing = scoreSemanticParsing(c);
  const retrievalRelevance = scoreRetrievalRelevance(c);
  const citationCoverage = scoreCitationCoverage(c);
  const shouldAbstain = opts.shouldAbstain ?? (c.domain === "abstain");
  const abstentionQuality = scoreAbstentionQuality(c, shouldAbstain);
  const workflowCorrectness = c.domain === "workflow" ? scoreWorkflowCorrectness(c) : undefined;
  const latencyCost = scoreLatencyCost(c, opts);

  // Wider range produces realistic pass/fail variation across difficulty levels
  const accuracy = Math.min(1, sr(s, 70, base * 0.80, base * 1.04) * dm);
  const faithfulness = Math.min(1, sr(s, 71, base * 0.80, base * 1.04) * dm);
  const relevance = Math.min(1, sr(s, 72, base * 0.80, base * 1.03) * dm);
  const coherence = Math.min(1, sr(s, 73, base * 0.80, base * 1.03) * dm);
  const completeness = Math.min(1, sr(s, 74, base * 0.74, base * 1.02) * dm);
  // Direct seeded hallucination: 1-14%, scaling up with difficulty
  const hallucinationRate = Math.min(0.14, sr(s, 75, 0.01, 0.13) / dm);

  const scores: Record<string, number> = {
    accuracy,
    faithfulness,
    relevance,
    coherence,
    completeness,
    hallucination_rate: hallucinationRate,
    citation_precision: citationCoverage.citationPrecision,
    citation_recall: citationCoverage.citationRecall,
    retrieval_ndcg: retrievalRelevance.ndcgAt5,
    semantic_intent_accuracy: semanticParsing.intentAccuracy,
    abstention_correct: abstentionQuality.correctDecision ? 1 : 0,
    latency_p95: latencyCost.latencyMs,
  };

  if (workflowCorrectness) {
    scores.workflow_state_accuracy = workflowCorrectness.stateAccuracy;
    scores.workflow_tool_precision = workflowCorrectness.toolPrecision;
  }

  // Threshold relative to base — higher-performing domains pass more cases
  const passThreshold = c.domain === "abstain" ? 0.80 : base * 0.86;
  const compositeScore = (accuracy + faithfulness + relevance + coherence) / 4;
  const passed = compositeScore >= passThreshold && hallucinationRate < 0.15;

  return {
    caseId: c.id,
    caseName: c.name,
    domain: c.domain,
    difficulty: c.difficulty,
    input: c.input,
    output: c.expectedOutput
      ? `[MOCK] ${c.expectedOutput}`
      : `[MOCK] Simulated response for "${c.input.substring(0, 60)}..."`,
    passed,
    passReason: passed ? `Composite score ${compositeScore.toFixed(2)} ≥ ${passThreshold}` : undefined,
    failReason: !passed ? `Composite score ${compositeScore.toFixed(2)} < ${passThreshold} or hallucination rate ${hallucinationRate.toFixed(2)} ≥ 0.15` : undefined,
    scores,
    semanticParsing,
    retrievalRelevance,
    citationCoverage,
    abstentionQuality,
    workflowCorrectness,
    latencyCost,
    latencyMs: latencyCost.latencyMs,
    tokenCount: { input: latencyCost.promptTokens, output: latencyCost.completionTokens },
  };
}
