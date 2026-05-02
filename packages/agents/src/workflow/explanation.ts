import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Evidence source — identifies where a piece of evidence came from
// ─────────────────────────────────────────────────────────────────────────────

export const EvidenceSourceTypeSchema = z.enum([
  "rag_chunk",        // a chunk retrieved from the document index
  "metric_datapoint", // a point from the semantic metric layer
  "gl_transaction",   // a raw GL / sub-ledger line
  "calculation",      // a derived calculated value
  "external_api",     // data pulled from an external system
  "agent_inference",  // a prior agent conclusion used as input
]);
export type EvidenceSourceType = z.infer<typeof EvidenceSourceTypeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Evidence item — a single traceable piece of supporting evidence
// ─────────────────────────────────────────────────────────────────────────────

export const EvidenceItemSchema = z.object({
  id: z.string().uuid(),
  sourceType: EvidenceSourceTypeSchema,
  /** For rag_chunk: the chunk ID. For metric: the metric ID. Etc. */
  sourceId: z.string(),
  /** Human-readable label. */
  label: z.string(),
  /** Short excerpt or value summary. */
  excerpt: z.string(),
  /** Full text (collapsed by default in UI). */
  fullText: z.string().optional(),
  /** For table evidence: Markdown-formatted table. */
  markdownTable: z.string().optional(),
  /** Document / metric source title. */
  sourceTitle: z.string(),
  /** Page, section, or GL period. */
  location: z.string().optional(),
  /** Relevance score 0–1. */
  relevanceScore: z.number().min(0).max(1),
  /** Fiscal period covered. */
  fiscalPeriod: z.string().optional(),
  /** Whether this item contains sensitive / restricted data. */
  isSensitive: z.boolean().default(false),
});
export type EvidenceItem = z.infer<typeof EvidenceItemSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Explanation — the agent's full reasoning chain for a conclusion
// ─────────────────────────────────────────────────────────────────────────────

export const ReasoningStepSchema = z.object({
  stepIndex: z.number().int(),
  title: z.string(),
  observation: z.string(),
  /** Evidence IDs consulted in this step. */
  evidenceIds: z.array(z.string()).default([]),
  /** Whether this step changed the agent's conclusion. */
  pivotal: z.boolean().default(false),
});
export type ReasoningStep = z.infer<typeof ReasoningStepSchema>;

export const ExplanationSchema = z.object({
  id: z.string().uuid(),
  workflowRunId: z.string().uuid(),
  taskId: z.string().uuid(),
  agentId: z.string(),
  /** The main conclusion / answer. */
  conclusion: z.string(),
  /** Ordered chain of reasoning steps. */
  reasoningChain: z.array(ReasoningStepSchema),
  /** All evidence items surfaced. */
  evidence: z.array(EvidenceItemSchema),
  /** Confidence in the conclusion, 0–1. */
  confidence: z.number().min(0).max(1),
  confidenceTier: z.enum(["high", "medium", "low", "abstained"]),
  /** Why confidence is at this level. */
  confidenceRationale: z.string(),
  /** Assumptions made (free text list). */
  assumptions: z.array(z.string()).default([]),
  /** What the agent would need to reach a higher confidence. */
  limitationsAndGaps: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
});
export type Explanation = z.infer<typeof ExplanationSchema>;
