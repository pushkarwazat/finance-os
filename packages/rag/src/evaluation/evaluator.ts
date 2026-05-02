import type { RetrievalEvalCase } from "./test-cases.js";
import { RETRIEVAL_EVAL_CASES } from "./test-cases.js";
import type { DocumentAnswer } from "../citations/schema.js";

// ─────────────────────────────────────────────────────────────────────────────
// Evaluation result
// ─────────────────────────────────────────────────────────────────────────────

export interface EvalResult {
  caseId: string;
  question: string;
  passed: boolean;
  score: number;
  checks: {
    abstentionCorrect: boolean;
    documentHit: boolean;
    keywordHit: boolean;
    confidenceMet: boolean;
    tablePresent: boolean;
  };
  failReasons: string[];
  answer: DocumentAnswer;
  latencyMs: number;
}

export interface EvalSuiteResult {
  totalCases: number;
  passed: number;
  failed: number;
  passRate: number;
  avgScore: number;
  avgLatencyMs: number;
  byCategory: Record<string, { passed: number; total: number; passRate: number }>;
  results: EvalResult[];
  ranAt: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scorer — evaluates a DocumentAnswer against an EvalCase
// ─────────────────────────────────────────────────────────────────────────────

export function scoreAnswer(
  evalCase: RetrievalEvalCase,
  answer: DocumentAnswer,
  latencyMs: number
): EvalResult {
  const failReasons: string[] = [];
  const checks = {
    abstentionCorrect: false,
    documentHit: false,
    keywordHit: false,
    confidenceMet: false,
    tablePresent: false,
  };

  // ── Abstention check ──────────────────────────────────────────────────────
  if (evalCase.shouldAbstain) {
    checks.abstentionCorrect = answer.abstained;
    if (!answer.abstained) {
      failReasons.push("Expected abstention but got an answer");
    }
  } else {
    checks.abstentionCorrect = !answer.abstained;
    if (answer.abstained) {
      failReasons.push(`Unexpected abstention: ${answer.abstentionReason ?? "unknown"}`);
    }
  }

  // ── Document hit check ────────────────────────────────────────────────────
  if (evalCase.expectedDocumentIds.length > 0) {
    const citedDocIds = new Set(answer.citations.map((c) => c.documentId));
    const anyHit = evalCase.expectedDocumentIds.some((id) => citedDocIds.has(id));
    checks.documentHit = anyHit;
    if (!anyHit) {
      failReasons.push(
        `No expected document found in citations. Expected one of: [${evalCase.expectedDocumentIds.join(", ")}], got: [${[...citedDocIds].join(", ")}]`
      );
    }
  } else {
    checks.documentHit = true;
  }

  // ── Keyword hit check ─────────────────────────────────────────────────────
  if (evalCase.expectedKeywords.length > 0 && !evalCase.shouldAbstain) {
    const citedText = [
      answer.answerText ?? "",
      ...answer.citations.map((c) => c.excerpt.toLowerCase()),
    ].join(" ").toLowerCase();
    const hits = evalCase.expectedKeywords.filter((kw) => citedText.includes(kw.toLowerCase()));
    const hitRate = hits.length / evalCase.expectedKeywords.length;
    checks.keywordHit = hitRate >= 0.5;
    if (hitRate < 0.5) {
      const missed = evalCase.expectedKeywords.filter(
        (kw) => !citedText.includes(kw.toLowerCase())
      );
      failReasons.push(`Keyword hit rate ${Math.round(hitRate * 100)}% < 50%. Missed: [${missed.join(", ")}]`);
    }
  } else {
    checks.keywordHit = true;
  }

  // ── Confidence check ──────────────────────────────────────────────────────
  if (!evalCase.shouldAbstain && evalCase.minConfidence > 0) {
    checks.confidenceMet = answer.confidence >= evalCase.minConfidence;
    if (!checks.confidenceMet) {
      failReasons.push(
        `Confidence ${answer.confidence.toFixed(2)} < minimum ${evalCase.minConfidence.toFixed(2)}`
      );
    }
  } else {
    checks.confidenceMet = true;
  }

  // ── Table citation check ──────────────────────────────────────────────────
  if (evalCase.expectsTableCitation && !evalCase.shouldAbstain) {
    checks.tablePresent = answer.citations.some((c) => c.isTable);
    if (!checks.tablePresent) {
      failReasons.push("Expected at least one table citation but none were returned");
    }
  } else {
    checks.tablePresent = true;
  }

  // ── Overall score ─────────────────────────────────────────────────────────
  const checkValues = Object.values(checks);
  const score = checkValues.filter(Boolean).length / checkValues.length;
  const passed = failReasons.length === 0;

  return {
    caseId: evalCase.id,
    question: evalCase.question,
    passed,
    score,
    checks,
    failReasons,
    answer,
    latencyMs,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Eval runner
// ─────────────────────────────────────────────────────────────────────────────

export type AnswerFn = (question: string) => DocumentAnswer;

export function runEvalSuite(
  answerFn: AnswerFn,
  cases: RetrievalEvalCase[] = RETRIEVAL_EVAL_CASES,
  tagFilter?: string
): EvalSuiteResult {
  const filteredCases = tagFilter
    ? cases.filter((c) => c.tags.includes(tagFilter))
    : cases;

  const results: EvalResult[] = [];

  for (const evalCase of filteredCases) {
    const start = Date.now();
    const answer = answerFn(evalCase.question);
    const latencyMs = Date.now() - start;
    results.push(scoreAnswer(evalCase, answer, latencyMs));
  }

  const passed = results.filter((r) => r.passed).length;
  const avgScore = results.reduce((a, r) => a + r.score, 0) / results.length;
  const avgLatencyMs = Math.round(results.reduce((a, r) => a + r.latencyMs, 0) / results.length);

  // Group by category
  const byCategory: EvalSuiteResult["byCategory"] = {};
  for (const result of results) {
    const evalCase = filteredCases.find((c) => c.id === result.caseId)!;
    const cat = evalCase.category;
    if (!byCategory[cat]) byCategory[cat] = { passed: 0, total: 0, passRate: 0 };
    byCategory[cat]!.total++;
    if (result.passed) byCategory[cat]!.passed++;
  }
  for (const cat of Object.keys(byCategory)) {
    const c = byCategory[cat]!;
    c.passRate = Math.round((c.passed / c.total) * 100) / 100;
  }

  return {
    totalCases: filteredCases.length,
    passed,
    failed: filteredCases.length - passed,
    passRate: Math.round((passed / filteredCases.length) * 100) / 100,
    avgScore: Math.round(avgScore * 100) / 100,
    avgLatencyMs,
    byCategory,
    results,
    ranAt: new Date().toISOString(),
  };
}
