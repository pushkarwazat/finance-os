# FinanceOS Eval & Benchmarking Guide

## Overview

This guide describes the evaluation harness for FinanceOS AI components. The eval system is designed to be:

- **Offline-first** — all benchmarks run without a live LLM using the mock scoring engine
- **Reproducible** — seeded deterministic mock scores for CI integration
- **Separates retrieval from answer** — retrieval relevance and answer quality are scored independently
- **Tracks abstention vs hallucination** — critical distinction for a financial AI
- **Versioned** — every fixture set and run is versioned for regression tracking

---

## Directory Structure

```
packages/evals/
├── src/
│   ├── benchmarks.ts          # Core BenchmarkCase and EvalRun schemas
│   ├── gold-answer.ts         # Gold answer schema with abstention/clarification metadata
│   ├── scores.ts              # 8 score dimension schemas + composite CaseResult
│   ├── suite-meta.ts          # 7 suite metadata definitions
│   ├── engine/
│   │   ├── mock-scorer.ts     # Deterministic mock scoring engine
│   │   └── runner.ts          # EvalRun orchestration + regression reporter
│   └── index.ts               # Barrel export
├── fixtures/
│   ├── benchmark-suite.json         # Original 5-case smoke test
│   ├── analytics-suite.json         # 100 finance analytics questions
│   ├── variance-suite.json          # 50 variance analysis questions
│   ├── document-evidence-suite.json # 50 document QA questions
│   ├── workflow-tasks-suite.json    # 25 agentic workflow tasks
│   ├── ambiguous-suite.json         # 25 prompts requiring clarification
│   ├── abstain-suite.json           # 25 prompts requiring abstention
│   └── regression-suite.json        # 25-case cross-domain regression suite
└── EVAL_GUIDE.md              # This file
```

---

## Benchmark Suites (275 Total Cases)

| Suite | Cases | Target Pass Rate | Primary Eval Dimensions |
|-------|-------|-----------------|------------------------|
| Finance Analytics | 100 | 82% | semantic_parsing, retrieval_relevance, citation_coverage, latency_cost |
| Variance Analysis | 50 | 78% | semantic_parsing, retrieval_relevance, citation_coverage, latency_cost |
| Document Evidence | 50 | 76% | retrieval_relevance, citation_coverage, latency_cost |
| Workflow Tasks | 25 | 80% | workflow_correctness, latency_cost |
| Ambiguous Prompts | 25 | 85% | semantic_parsing, abstention_quality |
| Unsupported Prompts | 25 | 90% | abstention_quality, latency_cost |
| Regression Suite | 25 | 84% | all dimensions |

---

## Score Dimensions

### 1. Semantic Parsing Score
Measures how well the system parses the query into intent + entities.
- `intentAccuracy` — was the intent (metric_lookup, variance_explain, etc.) correctly identified?
- `entityPrecision`, `entityRecall`, `entityF1` — quality of extracted entities (metric names, periods, etc.)

### 2. Retrieval Relevance Score
Measures the quality of document retrieval (separate from answer generation).
- `precisionAt1`, `precisionAt3`, `precisionAt5`
- `recallAt3`, `recallAt5`
- `ndcgAt5` — normalized discounted cumulative gain
- `mrr` — mean reciprocal rank
- Tracked separately for `bm25`, `semantic`, `hybrid` strategies

### 3. Citation Coverage Score
Measures whether the model cites the right documents.
- `citationPrecision` — fraction of provided citations that are correct
- `citationRecall` — fraction of required citations that were provided
- `citationF1` — harmonic mean
- `hallucinatedCitationIds` — citations the model invented

### 4. Abstention Quality Score
The most critical score for a financial AI. Tracks:
- `shouldAbstain` — gold label from GoldAnswer
- `didAbstain` — model decision
- `correctDecision` — `shouldAbstain === didAbstain`
- `confabulated` — **false negative: provided an answer when should have abstained (hallucination)**
- `falsePositive` — model abstained when it should have answered

### 5. Workflow Correctness Score
For agentic workflow cases:
- `stateAccuracy` — fraction of state transitions correct
- `toolPrecision`, `toolRecall` — quality of tool selections
- `noAutonomousPostingViolation` — must always be `true` (core safety constraint)

### 6. Latency & Cost Score
- `latencyMs`, `promptTokens`, `completionTokens`
- `estimatedCostUsd`
- `withinLatencySla` — defaults to 3000ms
- `withinCostBudget` — defaults to $0.05/case

---

## Running Benchmarks

### CLI (Offline Mock Engine)

```bash
# Run the regression suite with mock scorer
pnpm --filter @financeos/evals run eval -- --suite regression

# Run analytics suite, limit to 10 cases
pnpm --filter @financeos/evals run eval -- --suite analytics --limit 10

# Run all suites
pnpm --filter @financeos/evals run eval -- --suite all

# Compare two runs for regression
pnpm --filter @financeos/evals run eval:compare -- --baseline <runId> --current <runId>
```

### API (UI-driven)

The eval API at `/api/evals/` exposes:
- `GET /api/evals/suites` — list all 7 suites with metadata
- `GET /api/evals/suites/:id` — suite detail with sample cases
- `POST /api/evals/runs` — trigger a new eval run
- `GET /api/evals/runs` — list runs (filter by suiteId, agentId)
- `GET /api/evals/runs/:id` — run detail with per-case scores
- `GET /api/evals/runs/:id/cases` — case-level results
- `GET /api/evals/regression` — regression report comparing two runs
- `GET /api/evals/summary` — aggregate stats across all suites

---

## Plugging in a Live LLM

To swap the mock scorer for a real LLM:

### Step 1: Implement the `ScoringHarness` interface

```typescript
import type { ScoringHarness, BenchmarkCase, EvalRun } from "@financeos/evals";

class OpenAIHarness implements ScoringHarness {
  async score(caseId: string, output: string, reference?: string) {
    // Call your LLM-as-judge prompt
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: EVAL_SYSTEM_PROMPT },
        { role: "user", content: buildEvalPrompt(caseId, output, reference) }
      ]
    });
    return parseScores(response.choices[0].message.content);
  }

  async scoreAll(runId: string): Promise<EvalRun> {
    // Iterate all cases in the run and score each
  }
}
```

### Step 2: Implement the LLM under test

```typescript
async function callFinanceOSAgent(input: string): Promise<string> {
  // Call your RAG pipeline + LLM
  const chunks = await ragRetriever.retrieve(input);
  const response = await llm.generate({ input, context: chunks });
  return response.text;
}
```

### Step 3: Run the full eval

```typescript
import { runEvalSuite, SUITE_META } from "@financeos/evals";
import analyticsFixture from "./fixtures/analytics-suite.json" assert { type: "json" };

const run = await runEvalSuite(analyticsFixture.cases, {
  suiteId: "suite-analytics-v1",
  suiteName: "Finance Analytics — 100Q",
  agentId: "gpt-4o-2024-08-06",
  agentName: "GPT-4o",
  scoringOptions: {
    modelId: "gpt-4o-2024-08-06",
    costPer1kTokens: 0.0025,
  },
  onProgress: (done, total, result) => {
    console.log(`[${done}/${total}] ${result.caseName}: ${result.passed ? "PASS" : "FAIL"}`);
  }
});

console.log(`Pass Rate: ${(run.passRate * 100).toFixed(1)}%`);
console.log(`Avg Accuracy: ${(run.aggregateScores.accuracy * 100).toFixed(1)}`);
```

### Step 4: Retrieval-Separated Evaluation

For RAG systems, evaluate retrieval and answer separately:

```typescript
// Step A: Evaluate retrieval quality
const retrievalScorer = new RetrievalEvaluator(goldAnswers);
const retrievalScores = await retrievalScorer.evaluate(cases, retrievedDocs);

// Step B: Evaluate answer quality given perfect context (upper bound)
const answerScorer = new AnswerEvaluator(llmJudge);
const answerScores = await answerScorer.evaluate(cases, answers, goldAnswers);

// Step C: Evaluate answer quality given retrieval results (actual quality)
const endToEndScores = await answerScorer.evaluate(cases, answers, retrievedContext);

// Gap between B and C = retrieval contribution to answer quality
```

---

## Regression Workflow

The regression suite (25 cases) runs on every release:

```bash
# After each deploy, run regression suite and compare to baseline
BASELINE_RUN_ID="run-v2.4.0-baseline"
CURRENT_RUN_ID=$(pnpm --filter @financeos/evals run eval -- --suite regression --json | jq -r .id)

pnpm --filter @financeos/evals run eval:compare -- \
  --baseline $BASELINE_RUN_ID \
  --current $CURRENT_RUN_ID \
  --threshold 0.03
```

Regression is detected if any metric degrades by >3% from baseline. The report flags:
- `isRegression: true` for any degrading metric
- `isImprovement: true` for any improving metric
- Overall `regressionDetected: boolean` for CI gate

### CI Integration (GitHub Actions)

```yaml
- name: Run Regression Suite
  run: |
    pnpm --filter @financeos/evals run eval -- --suite regression --json > eval-results.json
    pnpm --filter @financeos/evals run eval:compare -- \
      --baseline ${{ vars.BASELINE_RUN_ID }} \
      --current-file eval-results.json \
      --fail-on-regression
```

---

## GoldAnswer Schema

Each benchmark case can have an associated `GoldAnswer`:

```typescript
{
  id: "ga-00ae...",
  caseId: "00ae0000-...",         // links to BenchmarkCase
  answer: "Gross margin is 67.3% for Q4 FY2025...",
  answerType: "factual",
  keyFacts: ["67.3%", "Q4 FY2025", "down 80bps"],
  requiredDocIds: [],             // docs that must be cited
  requiredMetricSlugs: ["gross_margin"],
  shouldAbstain: false,
  shouldClarify: false,
  confidenceFloor: 0.80,         // min acceptable confidence score
  minimumCitations: 0,           // min required citations
  maximumHallucinationRate: 0.1, // max acceptable hallucination rate
}
```

---

## Abstention vs Hallucination Policy

**This is the most important safety property for a financial AI.**

| Behavior | Description | Acceptable? |
|----------|-------------|-------------|
| Correct answer | Answers when it should, correctly | ✅ |
| Correct abstention | Abstains when it should | ✅ |
| False positive (over-abstain) | Abstains when it could answer | ⚠️ |
| **Confabulation** | **Provides wrong answer when should abstain** | ❌ Never |
| **Hallucination** | **Fabricates citations or data** | ❌ Never |

The system tracks `confabulated` and `hallucinatedCitationIds` on every run. Any case with `confabulated=true` or `hallucinationRate > 0.15` is auto-failed regardless of other scores.

---

## Adding New Benchmark Cases

1. Open the relevant fixture JSON (e.g., `fixtures/analytics-suite.json`)
2. Add a new case object following the `BenchmarkCaseSchema`
3. Use a unique UUID following the suite's ID pattern
4. Set `shouldAbstain: true` in metadata for abstain cases
5. Set `shouldClarify: true` in metadata for ambiguous cases
6. Run the regression suite to verify no conflicts

```bash
pnpm --filter @financeos/evals run typecheck
```
