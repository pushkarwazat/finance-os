import { z } from "zod";

export const AnswerTypeSchema = z.enum([
  "factual",
  "analytical",
  "comparative",
  "procedural",
  "definitional",
  "aggregation",
  "attribution",
  "synthesis",
]);
export type AnswerType = z.infer<typeof AnswerTypeSchema>;

export const ClarificationReasonSchema = z.enum([
  "ambiguous_period",
  "ambiguous_metric",
  "ambiguous_entity",
  "ambiguous_scope",
  "ambiguous_intent",
  "missing_context",
  "multiple_interpretations",
]);

export const AbstentionReasonSchema = z.enum([
  "out_of_scope",
  "insufficient_data",
  "data_sensitivity",
  "policy_violation",
  "no_source_document",
  "conflicting_evidence",
  "speculative_request",
  "pii_request",
  "future_state_unknown",
]);
export type AbstentionReason = z.infer<typeof AbstentionReasonSchema>;

export const GoldAnswerSchema = z.object({
  id: z.string(),
  caseId: z.string(),
  answer: z.string(),
  answerType: AnswerTypeSchema,
  keyFacts: z.array(z.string()),
  requiredDocIds: z.array(z.string()).default([]),
  requiredMetricSlugs: z.array(z.string()).default([]),
  shouldAbstain: z.boolean().default(false),
  abstentionReason: AbstentionReasonSchema.optional(),
  shouldClarify: z.boolean().default(false),
  clarificationReason: ClarificationReasonSchema.optional(),
  clarificationQuestion: z.string().optional(),
  confidenceFloor: z.number().min(0).max(1).default(0.7),
  minimumCitations: z.number().int().min(0).default(0),
  maximumHallucinationRate: z.number().min(0).max(1).default(0.1),
  evaluationNotes: z.string().optional(),
  version: z.string().default("1.0"),
  createdAt: z.string().datetime(),
});
export type GoldAnswer = z.infer<typeof GoldAnswerSchema>;
