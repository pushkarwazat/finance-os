import { Router } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { runPipeline } from "@financeos/semantic";
import {
  INTENT_CATALOGUE,
  ANALYTICS_EXAMPLES,
  getExamplesByIntent,
  getAbstentionExamples,
  getClarificationExamples,
} from "@financeos/semantic";
import type { IntentType } from "@financeos/semantic";

const router = Router();

// ── Shared Zod input schemas ──────────────────────────────────────────────────

const ParseQuestionBody = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
});

const AnswerQuestionBody = z.object({
  question: z.string().min(1).max(2000),
  sessionId: z.string().uuid().optional(),
  /** When provided, a previously issued clarification is being resolved. */
  clarificationResolution: z
    .object({
      clarificationId: z.string().uuid(),
      contractId: z.string().uuid(),
      resolutions: z.record(z.string(), z.string()),
      useDefaults: z.boolean().default(false),
    })
    .optional(),
});

const ExamplesQueryParams = z.object({
  intent: z
    .enum([
      "metric_lookup", "trend_analysis", "variance_analysis", "comparison",
      "ranking", "cohort_question", "clarification_required", "unsupported_request",
    ])
    .optional(),
  tag: z.string().optional(),
  abstentionOnly: z.coerce.boolean().optional(),
  clarificationOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/intents
// Returns the full intent catalogue — all 8 supported intent types with
// descriptions, example questions, and capability flags.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/analytics/intents", (_req, res) => {
  res.json({
    data: INTENT_CATALOGUE,
    total: INTENT_CATALOGUE.length,
    schemaVersion: "1.0",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/examples
// Returns the canonical 100-question example library with expected parsed
// outputs. Supports filtering by intent, tag, abstention, clarification.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/analytics/examples", (req, res) => {
  const parsed = ExamplesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { intent, tag, abstentionOnly, clarificationOnly, limit, offset } = parsed.data;

  let examples = [...ANALYTICS_EXAMPLES];

  if (intent) examples = getExamplesByIntent(intent as IntentType);
  if (tag) examples = examples.filter((e) => e.expected.tags.includes(tag));
  if (abstentionOnly) examples = getAbstentionExamples();
  if (clarificationOnly) examples = getClarificationExamples();

  const total = examples.length;
  const data = examples.slice(offset, offset + limit);

  const intentCounts = ANALYTICS_EXAMPLES.reduce<Record<string, number>>((acc, ex) => {
    acc[ex.expected.intent] = (acc[ex.expected.intent] ?? 0) + 1;
    return acc;
  }, {});

  res.json({
    data,
    total,
    limit,
    offset,
    intentCounts,
    schemaVersion: "1.0",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/examples/:id
// Returns a single example by its stable ID.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/analytics/examples/:id", (req, res) => {
  const example = ANALYTICS_EXAMPLES.find((e) => e.id === req.params.id);
  if (!example) {
    res.status(404).json({ error: "not_found", message: `Example '${req.params.id}' not found.` });
    return;
  }
  res.json({ data: example });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/parse
// Parse a natural-language question into a QueryContract.
// Returns only the classification + query plan — does NOT run data retrieval.
// Use this for debugging or rendering a plan preview before executing.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/analytics/parse", (req, res) => {
  const parsed = ParseQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { question, sessionId } = parsed.data;
  const result = runPipeline(question, sessionId ?? randomUUID());

  // Return only the contract portion — no answer text, no mock data
  res.json({
    contractId: result.messageId,
    traceId: result.traceId,
    rawQuestion: result.rawQuestion,
    intent: result.intent,
    confidence: result.confidence,
    confidenceTier: result.confidenceTier,
    queryPlan: result.queryPlan,
    sourceMetrics: result.sourceMetrics,
    missingParameters: result.queryPlan ? [] : [],
    requiresClarification: !!result.clarificationRequired,
    clarificationRequired: result.clarificationRequired,
    abstained: result.abstained,
    abstentionReason: result.abstentionReason,
    abstentionMessage: result.abstentionMessage,
    pipelineTrace: result.pipelineTrace.filter(
      (s) => ["receive", "normalise", "classify_intent", "extract_entities", "resolve_metrics", "build_query_plan", "check_abstention"].includes(s.step)
    ),
    parsedAt: result.createdAt,
    schemaVersion: "1.0",
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/analytics/answer
// Full pipeline: parse → abstention check → mock data → response.
// Returns the complete AnalyticsResponse including answer text, mock data,
// assumptions, caveats, and full pipeline trace.
// ─────────────────────────────────────────────────────────────────────────────

router.post("/analytics/answer", (req, res) => {
  const parsed = AnswerQuestionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", message: parsed.error.message });
    return;
  }

  const { question, sessionId } = parsed.data;
  const result = runPipeline(question, sessionId ?? randomUUID());

  res.json(result);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/analytics/pipeline
// Returns pipeline health + capability metadata for developer inspection.
// ─────────────────────────────────────────────────────────────────────────────

router.get("/analytics/pipeline", (_req, res) => {
  res.json({
    status: "operational",
    version: "1.0.0",
    schemaVersion: "semantics.financeos.io/v1",
    contractVersion: "1.0",
    capabilities: {
      intentClassification: true,
      entityExtraction: true,
      metricResolution: true,
      queryPlanGeneration: true,
      abstentionPolicy: true,
      clarificationEngine: true,
      mockDataGeneration: true,
      liveLLMIntegration: false,
      rawSQLGeneration: false,
    },
    pipeline: [
      { step: "receive",          description: "Accept raw question string" },
      { step: "normalise",        description: "Lowercase, collapse whitespace" },
      { step: "classify_intent",  description: "Regex pattern classifier → 8 intent types" },
      { step: "extract_entities", description: "Extract metric mentions, dimensions, filters, time expressions" },
      { step: "resolve_metrics",  description: "Map synonyms → canonical semantic metric slugs" },
      { step: "build_query_plan", description: "Assemble AbstractQueryPlan (no SQL)" },
      { step: "check_abstention", description: "Evaluate AbstentionPolicy rules" },
      { step: "check_guardrails", description: "Check semantic guardrails (preliminary data, restricted metrics)" },
      { step: "fetch_mock_data",  description: "Generate deterministic mock data points" },
      { step: "format_answer",    description: "Template-based answer text generation" },
      { step: "build_response",   description: "Assemble full AnalyticsResponse with trace IDs" },
    ],
    abstentionReasons: [
      "no_semantic_coverage", "low_confidence", "policy_violation",
      "time_range_out_of_scope", "pii_detected", "unsupported_operation", "guardrail_triggered",
    ],
    supportedDomains: [
      "revenue", "subscriptions", "customers", "invoices",
      "payments", "expenses", "budget_vs_actual", "collections",
    ],
    exampleCount: ANALYTICS_EXAMPLES.length,
    updatedAt: "2025-10-01T00:00:00Z",
  });
});

export default router;
