import { z } from "zod";
import type { QueryContract } from "./query-contract.js";
import type { IntentType } from "./intent.js";

// ─────────────────────────────────────────────────────────────────────────────
// Abstention reason taxonomy
// ─────────────────────────────────────────────────────────────────────────────

export const AbstentionReasonSchema = z.enum([
  /** The metrics in the query are not in the semantic layer. */
  "no_semantic_coverage",
  /** Classifier confidence is below the configured threshold. */
  "low_confidence",
  /** The request violates an explicit content policy or business guardrail. */
  "policy_violation",
  /** The requested time range extends beyond available data. */
  "time_range_out_of_scope",
  /** Personally identifiable information was detected in the query. */
  "pii_detected",
  /** The user is asking for an operation the system does not support
   *  (raw SQL, data export, model training, etc.). */
  "unsupported_operation",
  /** A semantic guardrail fired for this metric / dimension combination. */
  "guardrail_triggered",
]);
export type AbstentionReason = z.infer<typeof AbstentionReasonSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Abstention policy rule — defines one condition that can trigger abstention
// ─────────────────────────────────────────────────────────────────────────────

export const AbstentionRuleSchema = z.object({
  /** Unique rule identifier. */
  ruleId: z.string(),
  reason: AbstentionReasonSchema,
  /** Human-readable description of what this rule guards against. */
  description: z.string(),
  /**
   * Severity of the rule outcome.
   * hard — always abstain; soft — log and warn but answer.
   */
  enforcement: z.enum(["hard", "soft"]),
  /** Message template shown to the user when this rule fires. */
  messageTemplate: z.string(),
  /** Reference to documentation for this policy. */
  policyRef: z.string().optional(),
});
export type AbstentionRule = z.infer<typeof AbstentionRuleSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Abstention policy — the full set of rules evaluated for every request
// ─────────────────────────────────────────────────────────────────────────────

export const AbstentionPolicySchema = z.object({
  /** Policy version — must be incremented on any rule change. */
  version: z.string(),
  /** ISO 8601 date of last policy review. */
  lastReviewedAt: z.string(),
  /** Owner team responsible for maintaining this policy. */
  ownedBy: z.string(),
  /** Minimum confidence score required to return an answer (0 – 1). */
  minConfidenceThreshold: z.number().min(0).max(1),
  /**
   * Earliest date for which data is available.
   * Requests for earlier dates trigger time_range_out_of_scope.
   */
  dataAvailableFrom: z.string(),
  /** Individual rules. */
  rules: z.array(AbstentionRuleSchema),
});
export type AbstentionPolicy = z.infer<typeof AbstentionPolicySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Abstention evaluation result
// ─────────────────────────────────────────────────────────────────────────────

export interface AbstentionEvaluationResult {
  abstain: boolean;
  reason?: AbstentionReason;
  message?: string;
  /** The specific rule that fired, if any. */
  triggeredRuleId?: string;
  enforcement?: "hard" | "soft";
}

// ─────────────────────────────────────────────────────────────────────────────
// Production policy instance
// ─────────────────────────────────────────────────────────────────────────────

export const ABSTENTION_POLICY: AbstentionPolicy = {
  version: "1.2.0",
  lastReviewedAt: "2025-10-01",
  ownedBy: "CFO Office / Data Engineering",
  minConfidenceThreshold: 0.35,
  dataAvailableFrom: "2022-01-01",
  rules: [
    {
      ruleId: "NO_COVERAGE_001",
      reason: "no_semantic_coverage",
      description: "Query references metrics that are not registered in the semantic layer.",
      enforcement: "hard",
      messageTemplate:
        "The metric(s) you asked about are not available in the FinanceOS semantic layer. " +
        "If you believe this is an error, please contact the Data Engineering team to add coverage.",
      policyRef: "https://docs.financeos.io/semantic/coverage",
    },
    {
      ruleId: "LOW_CONF_001",
      reason: "low_confidence",
      description: "Query classifier confidence is below the 35% minimum threshold.",
      enforcement: "hard",
      messageTemplate:
        "I'm not confident I understood your question correctly (confidence: {confidence}%). " +
        "Could you rephrase? Alternatively, browse the Glossary to find the exact metric name.",
    },
    {
      ruleId: "PII_001",
      reason: "pii_detected",
      description: "Query contains personal identifiers (name + salary, SSN, etc.).",
      enforcement: "hard",
      messageTemplate:
        "This query appears to reference personal information. " +
        "FinanceOS Analytics does not provide access to individual-level personal data. " +
        "For HR analytics, please use the People Analytics platform.",
    },
    {
      ruleId: "UNSUPPORTED_SQL_001",
      reason: "unsupported_operation",
      description: "User is requesting raw SQL generation or data export.",
      enforcement: "hard",
      messageTemplate:
        "Generating raw SQL is outside the scope of the FinanceOS Analytics assistant. " +
        "All analysis is conducted through the semantic layer to ensure data governance. " +
        "For direct database access, please submit a request via the Data Warehouse portal.",
    },
    {
      ruleId: "UNSUPPORTED_MARKET_001",
      reason: "unsupported_operation",
      description: "Query asks about capital markets data (stock price, valuation, etc.).",
      enforcement: "hard",
      messageTemplate:
        "FinanceOS Analytics covers internal financial metrics only. " +
        "Capital markets data (stock price, market cap, EV/ARR multiples) is not available here.",
    },
    {
      ruleId: "TIME_SCOPE_001",
      reason: "time_range_out_of_scope",
      description: "Requested time range predates available data (before 2022-01-01).",
      enforcement: "hard",
      messageTemplate:
        "Historical data is only available from January 2022 onwards. " +
        "Your requested period ({requestedStart}) falls outside the available range.",
    },
    {
      ruleId: "GUARDRAIL_PRELIM_001",
      reason: "guardrail_triggered",
      description: "Preliminary financial figures — data has not been reviewed by the Controller.",
      enforcement: "soft",
      messageTemplate:
        "The data you are viewing for the current period contains preliminary figures " +
        "that have not yet been reviewed by the Controller. Treat these as estimates.",
    },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Evaluator — deterministic check against the policy
// ─────────────────────────────────────────────────────────────────────────────

const PII_PATTERNS = [
  /\b(salary|compensation|pay|ssn|social security|credit card|password)\s+(of|for|belonging)\b/i,
  /\b(how much (does|did|is)\s+\w+\s+(make|earn|paid))\b/i,
];

const UNSUPPORTED_PATTERNS = [
  /\b(write|generate|produce|create|export).{0,30}\b(sql|query|script|code)\b/i,
  /\b(sql query|raw sql|sql script|sql code|sql statement)\b/i,
  /\braw\s+(data|sql|table|export|dump)\b/i,
  /\b(stock price|share price|market cap|ev\/arr|valuation multiple)\b/i,
  /\b(buy|sell|trade|invest|position)\b/i,
];

export function evaluateAbstention(
  intent: IntentType,
  contract: Pick<QueryContract, "confidence" | "queryPlan" | "normalisedQuestion">,
  policy: AbstentionPolicy = ABSTENTION_POLICY
): AbstentionEvaluationResult {
  const q = contract.normalisedQuestion;

  // ── intent-based short-circuits ──────────────────────────────────────────
  if (intent === "unsupported_request") {
    const sqlRule = policy.rules.find((r) => r.ruleId === "UNSUPPORTED_SQL_001")!;
    const mktRule = policy.rules.find((r) => r.ruleId === "UNSUPPORTED_MARKET_001")!;
    const marketMatch = /\b(stock price|share price|market cap|valuation)\b/i.test(q);
    const activeRule = marketMatch ? mktRule : sqlRule;
    return {
      abstain: true,
      reason: "unsupported_operation",
      message: activeRule.messageTemplate,
      triggeredRuleId: activeRule.ruleId,
      enforcement: "hard",
    };
  }

  // ── PII detection ─────────────────────────────────────────────────────────
  if (PII_PATTERNS.some((p) => p.test(q))) {
    const rule = policy.rules.find((r) => r.ruleId === "PII_001")!;
    return {
      abstain: true,
      reason: "pii_detected",
      message: rule.messageTemplate,
      triggeredRuleId: "PII_001",
      enforcement: "hard",
    };
  }

  // ── Unsupported operation ─────────────────────────────────────────────────
  if (UNSUPPORTED_PATTERNS.some((p) => p.test(q))) {
    const rule = policy.rules.find((r) => r.ruleId === "UNSUPPORTED_SQL_001")!;
    return {
      abstain: true,
      reason: "unsupported_operation",
      message: rule.messageTemplate,
      triggeredRuleId: "UNSUPPORTED_SQL_001",
      enforcement: "hard",
    };
  }

  // ── Low confidence ────────────────────────────────────────────────────────
  if (contract.confidence < policy.minConfidenceThreshold) {
    const rule = policy.rules.find((r) => r.ruleId === "LOW_CONF_001")!;
    return {
      abstain: true,
      reason: "low_confidence",
      message: rule.messageTemplate.replace(
        "{confidence}",
        Math.round(contract.confidence * 100).toString()
      ),
      triggeredRuleId: "LOW_CONF_001",
      enforcement: "hard",
    };
  }

  // ── Time range out of scope ───────────────────────────────────────────────
  const start = contract.queryPlan.timeRange?.start;
  if (start && start < policy.dataAvailableFrom) {
    const rule = policy.rules.find((r) => r.ruleId === "TIME_SCOPE_001")!;
    return {
      abstain: true,
      reason: "time_range_out_of_scope",
      message: rule.messageTemplate.replace("{requestedStart}", start),
      triggeredRuleId: "TIME_SCOPE_001",
      enforcement: "hard",
    };
  }

  return { abstain: false };
}
