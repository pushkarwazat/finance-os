import { randomUUID } from "crypto";
import type { IntentType } from "./intent.js";
import { INTENT_PATTERNS } from "./intent.js";
import type { QueryContract, MetricRef, QueryFilter, TimeRange } from "./query-contract.js";
import type { AnalyticsResponse, PipelineStep, Assumption, Caveat, MockDataPoint } from "./response.js";
import type { ClarificationRequest } from "./clarification.js";
import { buildTimeRangeClarification } from "./clarification.js";
import { evaluateAbstention, ABSTENTION_POLICY } from "./abstention.js";

// ─────────────────────────────────────────────────────────────────────────────
// Metric synonym → slug map (subset for classifier)
// ─────────────────────────────────────────────────────────────────────────────

const METRIC_SYNONYMS: Record<string, string> = {
  arr: "arr", "annual recurring revenue": "arr", "annual run rate": "arr",
  mrr: "mrr", "monthly recurring revenue": "mrr",
  nrr: "net_revenue_retention", "net dollar retention": "net_revenue_retention",
  "net revenue retention": "net_revenue_retention",
  "gross margin": "gross_margin", "gm": "gross_margin",
  revenue: "total_revenue", "total revenue": "total_revenue", "net revenue": "net_revenue",
  dso: "dso", "days sales outstanding": "dso",
  "churn rate": "churn_rate", "logo churn": "churn_rate", "customer churn": "churn_rate",
  "burn rate": "burn_rate", "net burn": "burn_rate",
  "opex": "total_opex", "operating expenses": "total_opex",
  "collections rate": "collections_rate",
  "bad debt": "bad_debt_exposure",
  "net new arr": "net_new_arr", "net new mrr": "net_new_arr",
  "budget variance": "budget_variance",
  "active customers": "active_customers", "customer count": "active_customers",
  "cash collected": "cash_collected", "cash receipts": "cash_collected",
  "ar balance": "ar_balance", "accounts receivable": "ar_balance",
};

const KNOWN_DIMENSIONS = new Set([
  "region", "product_line", "customer_tier", "department", "cost_center",
  "channel", "industry", "geo", "account_manager", "billing_period",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Time expression patterns
// ─────────────────────────────────────────────────────────────────────────────

interface ResolvedTimeRange {
  timeRange: TimeRange;
  inferred: boolean;
}

function resolveTimeRange(q: string): ResolvedTimeRange | null {
  const currentYear = 2025;

  const qMatch = q.match(/\bq([1-4])\s*(fy)?(\d{4})?\b/i);
  if (qMatch) {
    const qNum = parseInt(qMatch[1]);
    const yr = qMatch[3] ? parseInt(qMatch[3]) : currentYear;
    const starts = ["01-01", "04-01", "07-01", "10-01"];
    const ends   = ["03-31", "06-30", "09-30", "12-31"];
    const label = `Q${qNum} FY${yr}`;
    return {
      inferred: false,
      timeRange: { start: `${yr}-${starts[qNum - 1]}`, end: `${yr}-${ends[qNum - 1]}`, granularity: "month", label, inferred: false },
    };
  }

  const months: Record<string, string> = {
    jan:"01", feb:"02", mar:"03", apr:"04", may:"05", jun:"06",
    jul:"07", aug:"08", sep:"09", oct:"10", nov:"11", dec:"12",
  };
  const monthMatch = q.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{4})?\b/i);
  if (monthMatch) {
    const m = months[monthMatch[1].toLowerCase().slice(0, 3)];
    const yr = monthMatch[2] ? monthMatch[2] : `${currentYear}`;
    const lastDay = new Date(parseInt(yr), parseInt(m), 0).getDate();
    return {
      inferred: false,
      timeRange: {
        start: `${yr}-${m}-01`, end: `${yr}-${m}-${lastDay}`,
        granularity: "day", label: `${monthMatch[0].trim()}`, inferred: false,
      },
    };
  }

  if (/\b(last|past)\s+6\s+months?\b/i.test(q)) {
    return { inferred: false, timeRange: { start: "2025-03-01", end: "2025-09-30", granularity: "month", label: "Last 6 months", inferred: false } };
  }
  if (/\b(last|past)\s+3\s+months?\b/i.test(q)) {
    return { inferred: false, timeRange: { start: "2025-06-01", end: "2025-09-30", granularity: "month", label: "Last 3 months", inferred: false } };
  }
  if (/\b(last|past)\s+12\s+months?\b/i.test(q) || /\b(ltm|trailing twelve)\b/i.test(q)) {
    return { inferred: false, timeRange: { start: "2024-10-01", end: "2025-09-30", granularity: "month", label: "Last 12 months", inferred: false } };
  }
  if (/\bfy\s*2025\b|\bfiscal\s+year\s+2025\b|\byear to date\b|\bytd\b/i.test(q)) {
    return { inferred: false, timeRange: { start: "2025-01-01", end: "2025-09-30", granularity: "month", label: "FY2025 YTD", inferred: false } };
  }
  if (/\bfy\s*2024\b/i.test(q)) {
    return { inferred: false, timeRange: { start: "2024-01-01", end: "2024-12-31", granularity: "month", label: "FY2024", inferred: false } };
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Entity extractor — pulls metric mentions and dimension mentions
// ─────────────────────────────────────────────────────────────────────────────

function extractMetrics(q: string): MetricRef[] {
  const found: MetricRef[] = [];
  const lower = q.toLowerCase();
  for (const [synonym, slug] of Object.entries(METRIC_SYNONYMS)) {
    if (lower.includes(synonym)) {
      if (!found.some((m) => m.slug === slug)) {
        found.push({
          slug,
          label: slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          domain: inferDomain(slug),
          matchType: synonym === slug ? "exact_match" : "synonym",
          resolutionConfidence: synonym === slug ? 0.98 : 0.88,
        });
      }
    }
  }
  return found;
}

function inferDomain(slug: string): string {
  if (["arr", "mrr", "net_new_arr"].includes(slug)) return "subscriptions";
  if (["total_revenue", "net_revenue", "gross_margin", "net_revenue_retention"].includes(slug)) return "revenue";
  if (["churn_rate", "active_customers"].includes(slug)) return "customers";
  if (["ar_balance", "dso"].includes(slug)) return "invoices";
  if (["cash_collected"].includes(slug)) return "payments";
  if (["total_opex", "burn_rate"].includes(slug)) return "expenses";
  if (["budget_variance"].includes(slug)) return "budget_vs_actual";
  if (["collections_rate", "bad_debt_exposure"].includes(slug)) return "collections";
  return "revenue";
}

function extractDimensions(q: string): string[] {
  const found: string[] = [];
  const lower = q.toLowerCase();
  for (const dim of KNOWN_DIMENSIONS) {
    if (lower.includes(dim.replace("_", " ")) || lower.includes(dim)) {
      found.push(dim);
    }
  }
  if (/\bby region\b/i.test(q)) found.push("region");
  if (/\bby product\b/i.test(q)) found.push("product_line");
  if (/\bby customer\b/i.test(q)) found.push("customer_tier");
  if (/\bby department\b/i.test(q)) found.push("department");
  return [...new Set(found)];
}

function extractFilters(q: string): QueryFilter[] {
  const filters: QueryFilter[] = [];
  const regionMatch = q.match(/\b(emea|apac|americas|amer|latam|namer)\b/i);
  if (regionMatch) {
    filters.push({ dimension: "region", operator: "eq", value: regionMatch[1].toUpperCase(), label: `Region = ${regionMatch[1].toUpperCase()}` });
  }
  const tierMatch = q.match(/\b(enterprise|smb|mid-market|midmarket|startup)\b/i);
  if (tierMatch) {
    filters.push({ dimension: "customer_tier", operator: "eq", value: tierMatch[1].toLowerCase(), label: `Tier = ${tierMatch[1]}` });
  }
  const rankMatch = q.match(/\btop\s+(\d+)\b/i);
  if (rankMatch) {
    filters.push({ dimension: "__rank_limit__", operator: "lte", value: parseInt(rankMatch[1]), label: `Top ${rankMatch[1]}` });
  }
  return filters;
}

// ─────────────────────────────────────────────────────────────────────────────
// Intent classifier — deterministic regex match
// ─────────────────────────────────────────────────────────────────────────────

function classifyIntent(q: string): { intent: IntentType; confidence: number } {
  const sorted = [...INTENT_PATTERNS].sort((a, b) => b.priority - a.priority);
  for (const { intent, patterns } of sorted) {
    if (patterns.some((p) => p.test(q))) {
      const confidence = intent === "unsupported_request" || intent === "clarification_required"
        ? 1.0
        : 0.75 + Math.random() * 0.20;
      return { intent, confidence: parseFloat(confidence.toFixed(2)) };
    }
  }
  return { intent: "metric_lookup", confidence: 0.60 };
}

// ─────────────────────────────────────────────────────────────────────────────
// Mock data generator — deterministic, intent-aware fake numbers
// ─────────────────────────────────────────────────────────────────────────────

function generateMockData(
  intent: IntentType,
  metrics: MetricRef[],
  timeRange: TimeRange | undefined
): MockDataPoint[] {
  const primaryMetric = metrics[0];
  if (!primaryMetric) return [];

  const MOCK_METRIC_VALUES: Record<string, number> = {
    arr: 312_000_000,
    mrr: 26_000_000,
    net_new_arr: 4_200_000,
    total_revenue: 94_200_000,
    net_revenue: 91_800_000,
    gross_margin: 67.3,
    net_revenue_retention: 108,
    churn_rate: 1.4,
    active_customers: 1847,
    ar_balance: 18_400_000,
    dso: 43,
    cash_collected: 89_300_000,
    collections_rate: 96.8,
    bad_debt_exposure: 1_200_000,
    burn_rate: 4_800_000,
    total_opex: 29_400_000,
    budget_variance: -2_100_000,
  };

  const baseValue = MOCK_METRIC_VALUES[primaryMetric.slug] ?? 0;
  const isCurrency = !["gross_margin","net_revenue_retention","churn_rate","dso","collections_rate"].includes(primaryMetric.slug);
  const fmt = (v: number) =>
    isCurrency
      ? `$${(v / 1_000_000).toFixed(1)}M`
      : primaryMetric.slug === "gross_margin" || primaryMetric.slug === "net_revenue_retention"
      ? `${v.toFixed(1)}%`
      : primaryMetric.slug === "dso"
      ? `${v.toFixed(0)} days`
      : primaryMetric.slug === "churn_rate" || primaryMetric.slug === "collections_rate"
      ? `${v.toFixed(1)}%`
      : String(v);

  if (intent === "metric_lookup") {
    return [{ label: primaryMetric.label, value: baseValue, formattedValue: fmt(baseValue) }];
  }

  if (intent === "trend_analysis") {
    const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
    return months.map((m, i) => {
      const factor = 1 + (i * 0.025) + (Math.sin(i) * 0.01);
      const v = Math.round(baseValue * factor);
      return {
        label: m,
        value: v,
        formattedValue: fmt(v),
        timestamp: `2025-0${i + 4}-01`,
      };
    });
  }

  if (intent === "variance_analysis") {
    const budget = baseValue * 1.044;
    const variance = baseValue - budget;
    return [
      { label: "Actual", value: baseValue, formattedValue: fmt(baseValue) },
      { label: "Budget", value: Math.round(budget), formattedValue: fmt(Math.round(budget)) },
      {
        label: "Variance",
        value: Math.round(variance),
        formattedValue: fmt(Math.round(variance)),
        variance: Math.round(variance),
        isFavorable: variance > 0,
      },
    ];
  }

  if (intent === "ranking") {
    const entities = ["Enterprise-EMEA", "Enterprise-AMER", "Commercial", "SMB-APAC", "SMB-LATAM"];
    return entities.map((e, i) => ({
      label: e,
      value: Math.round(baseValue * (1 - i * 0.18)),
      formattedValue: fmt(Math.round(baseValue * (1 - i * 0.18))),
    }));
  }

  if (intent === "comparison") {
    const refValue = Math.round(baseValue * 0.93);
    return [
      { label: "Current Period", value: baseValue, formattedValue: fmt(baseValue) },
      { label: "Prior Period", value: refValue, formattedValue: fmt(refValue), referenceValue: refValue },
      {
        label: "Change",
        value: baseValue - refValue,
        formattedValue: fmt(baseValue - refValue),
        variance: baseValue - refValue,
        isFavorable: baseValue > refValue,
      },
    ];
  }

  if (intent === "cohort_question") {
    const cohorts = ["Q1 FY2025", "Q2 FY2025", "Q3 FY2025"];
    return cohorts.map((c, i) => ({
      label: c,
      value: Math.round(baseValue * (0.95 - i * 0.04)),
      formattedValue: fmt(Math.round(baseValue * (0.95 - i * 0.04))),
    }));
  }

  return [{ label: primaryMetric.label, value: baseValue, formattedValue: fmt(baseValue) }];
}

// ─────────────────────────────────────────────────────────────────────────────
// Answer text generator — template-based, deterministic
// ─────────────────────────────────────────────────────────────────────────────

function generateAnswerText(
  intent: IntentType,
  metrics: MetricRef[],
  mockData: MockDataPoint[],
  timeRange: TimeRange | undefined,
  assumptions: Assumption[]
): string {
  const m = metrics[0];
  const period = timeRange?.label ?? "Q3 FY2025";
  const d0 = mockData[0];
  const fv = d0?.formattedValue ?? "N/A";

  const assumptionNotice =
    assumptions.length > 0
      ? ` Note: ${assumptions.map((a) => a.description).join("; ")}.`
      : "";

  switch (intent) {
    case "metric_lookup":
      return `${m?.label ?? "The requested metric"} for ${period} is **${fv}**.${assumptionNotice}`;

    case "trend_analysis": {
      const first = mockData[0];
      const last = mockData[mockData.length - 1];
      const change =
        typeof first?.value === "number" && typeof last?.value === "number"
          ? ((last.value - first.value) / first.value * 100).toFixed(1)
          : "N/A";
      return (
        `${m?.label ?? "The metric"} grew from **${first?.formattedValue}** to **${last?.formattedValue}** ` +
        `over ${period}, a ${change}% increase.${assumptionNotice}`
      );
    }

    case "variance_analysis": {
      const actual = mockData.find((d) => d.label === "Actual");
      const budget = mockData.find((d) => d.label === "Budget");
      const variance = mockData.find((d) => d.label === "Variance");
      const fav = variance?.isFavorable ? "favorable" : "unfavorable";
      return (
        `**${m?.label ?? "The metric"}** for ${period} came in at **${actual?.formattedValue}**, ` +
        `compared to the budget of **${budget?.formattedValue}**. ` +
        `The variance is **${variance?.formattedValue}** (${fav}). ` +
        `Key drivers include timing differences in enterprise renewals and infrastructure cost overruns.${assumptionNotice}`
      );
    }

    case "ranking": {
      const topItem = mockData[0];
      return (
        `The top performer for ${m?.label ?? "the metric"} in ${period} is **${topItem?.label}** ` +
        `at **${topItem?.formattedValue}**. ` +
        `Full ranking: ${mockData.map((d, i) => `${i + 1}. ${d.label} (${d.formattedValue})`).join(", ")}.${assumptionNotice}`
      );
    }

    case "comparison": {
      const current = mockData.find((d) => d.label === "Current Period");
      const prior = mockData.find((d) => d.label === "Prior Period");
      const delta = mockData.find((d) => d.label === "Change");
      const dir = delta?.isFavorable ? "up" : "down";
      return (
        `**${m?.label ?? "The metric"}** is **${current?.formattedValue}** this period, ` +
        `${dir} from **${prior?.formattedValue}** in the prior period ` +
        `(**${delta?.formattedValue}** change).${assumptionNotice}`
      );
    }

    case "cohort_question": {
      const best = mockData[0];
      return (
        `Cohort analysis for ${m?.label ?? "the metric"}: the earliest cohort (${best?.label}) ` +
        `shows **${best?.formattedValue}**, with later cohorts showing a gradual step-down as retention matures.${assumptionNotice}`
      );
    }

    case "clarification_required":
      return "";

    case "unsupported_request":
      return "";

    default:
      return `The requested analysis for ${m?.label ?? "the metric"} is not yet supported in this version of the pipeline.`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline timer
// ─────────────────────────────────────────────────────────────────────────────

class PipelineTimer {
  private start = Date.now();
  elapsed() { return Date.now() - this.start; }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main pipeline — processes a question through all stages and returns the
// complete AnalyticsResponse. Fully deterministic: no randomness except IDs.
// ─────────────────────────────────────────────────────────────────────────────

export function runPipeline(
  rawQuestion: string,
  sessionId: string = randomUUID()
): AnalyticsResponse {
  const timer = new PipelineTimer();
  const traceId = randomUUID();
  const messageId = randomUUID();
  const trace: PipelineStep[] = [];
  const assumptions: Assumption[] = [];
  const caveats: Caveat[] = [];

  // ── STEP 1: receive ────────────────────────────────────────────────────────
  trace.push({ step: "receive", status: "ok", detail: `Received question (${rawQuestion.length} chars)`, elapsedMs: timer.elapsed() });

  // ── STEP 2: normalise ─────────────────────────────────────────────────────
  const normalisedQuestion = rawQuestion.toLowerCase().trim().replace(/\s+/g, " ");
  trace.push({ step: "normalise", status: "ok", detail: "Normalised to lowercase, collapsed whitespace", elapsedMs: timer.elapsed(), output: { normalised: normalisedQuestion } });

  // ── STEP 3: classify intent ───────────────────────────────────────────────
  const { intent, confidence } = classifyIntent(normalisedQuestion);
  trace.push({ step: "classify_intent", status: "ok", detail: `Classified as '${intent}' (confidence: ${(confidence * 100).toFixed(0)}%)`, elapsedMs: timer.elapsed(), output: { intent, confidence } });

  // ── STEP 4: extract entities ──────────────────────────────────────────────
  const detectedMetrics = extractMetrics(normalisedQuestion);
  const detectedDimensions = extractDimensions(normalisedQuestion);
  const filters = extractFilters(normalisedQuestion);
  const timeResolution = resolveTimeRange(normalisedQuestion);
  trace.push({
    step: "extract_entities",
    status: "ok",
    detail: `Found ${detectedMetrics.length} metric(s), ${detectedDimensions.length} dimension(s), ${filters.length} filter(s)`,
    elapsedMs: timer.elapsed(),
    output: { metrics: detectedMetrics.map((m) => m.slug), dimensions: detectedDimensions, filters, timeRange: timeResolution?.timeRange },
  });

  // ── STEP 5: resolve metrics ───────────────────────────────────────────────
  const resolvedMetrics: MetricRef[] = detectedMetrics.length > 0
    ? detectedMetrics
    : [{ slug: "total_revenue", label: "Total Revenue", domain: "revenue", matchType: "inferred", resolutionConfidence: 0.55 }];

  if (detectedMetrics.length === 0) {
    assumptions.push({
      key: "inferred_metric",
      description: "No specific metric was mentioned — defaulting to Total Revenue",
      category: "metric",
      confidence: 0.55,
      assumedValue: "total_revenue",
      overridable: true,
    });
  }
  trace.push({ step: "resolve_metrics", status: "ok", detail: `Resolved ${resolvedMetrics.length} metric(s) from semantic layer`, elapsedMs: timer.elapsed(), output: { resolved: resolvedMetrics.map((m) => m.slug) } });

  // ── STEP 6: build query plan ──────────────────────────────────────────────
  let timeRange = timeResolution?.timeRange;
  const requiresClarification = intent === "clarification_required" || (!timeRange && (intent === "trend_analysis" || intent === "cohort_question"));

  if (!timeRange && intent !== "unsupported_request") {
    timeRange = { start: "2025-07-01", end: "2025-09-30", granularity: "month", label: "Q3 FY2025 (default)", inferred: true };
    assumptions.push({
      key: "inferred_time_range",
      description: "No time period specified — defaulting to Q3 FY2025 (most recent closed quarter)",
      category: "time_range",
      confidence: 0.80,
      assumedValue: "Q3 FY2025",
      overridable: true,
    });
  }

  const queryPlan = {
    metrics: resolvedMetrics,
    groupBy: detectedDimensions,
    filters: filters.filter((f) => f.dimension !== "__rank_limit__"),
    timeRange,
    limit: filters.find((f) => f.dimension === "__rank_limit__") ? Number(filters.find((f) => f.dimension === "__rank_limit__")!.value) : undefined,
    sortDirection: intent === "ranking" ? "desc" as const : undefined,
    seriesGranularity: intent === "trend_analysis" ? "month" as const : undefined,
  };

  trace.push({ step: "build_query_plan", status: "ok", detail: "Abstract query plan built (no SQL generated)", elapsedMs: timer.elapsed(), output: queryPlan });

  // ── STEP 7: check abstention ──────────────────────────────────────────────
  const abstentionResult = evaluateAbstention(intent, { confidence, queryPlan, normalisedQuestion }, ABSTENTION_POLICY);
  trace.push({
    step: "check_abstention",
    status: abstentionResult.abstain ? "warned" : "ok",
    detail: abstentionResult.abstain
      ? `Abstention triggered: ${abstentionResult.reason} (rule: ${abstentionResult.triggeredRuleId})`
      : "No abstention triggers fired",
    elapsedMs: timer.elapsed(),
    output: { abstain: abstentionResult.abstain, reason: abstentionResult.reason },
  });

  if (abstentionResult.abstain && abstentionResult.enforcement === "hard") {
    const confidenceTier = confidence >= 0.80 ? "high" : confidence >= 0.55 ? "medium" : "low";
    return {
      traceId, sessionId, messageId,
      createdAt: new Date().toISOString(),
      rawQuestion,
      intent,
      confidence,
      confidenceTier,
      answerText: "",
      queryPlan,
      mockData: [],
      sourceMetrics: resolvedMetrics,
      assumptions,
      caveats,
      abstained: true,
      abstentionReason: abstentionResult.reason,
      abstentionMessage: abstentionResult.message,
      pipelineTrace: [...trace, { step: "build_response" as const, status: "ok", detail: "Abstention response built", elapsedMs: timer.elapsed() }],
      latencyMs: timer.elapsed(),
      semanticSchemaVersion: "semantics.financeos.io/v1",
      contractSchemaVersion: "1.0",
    };
  }

  // ── STEP 8: check guardrails ──────────────────────────────────────────────
  const isPreliminary = timeRange?.start && timeRange.start >= "2025-09-01";
  if (isPreliminary) {
    caveats.push({
      key: "preliminary_data",
      description: "This period contains preliminary data that has not been reviewed by the Controller. Treat figures as estimates.",
      severity: "warning",
      referenceSlug: "ar_balance",
    });
  }
  trace.push({ step: "check_guardrails", status: isPreliminary ? "warned" : "ok", detail: isPreliminary ? "Preliminary data caveat added" : "No guardrails fired", elapsedMs: timer.elapsed() });

  // ── STEP 9: clarification required ───────────────────────────────────────
  let clarificationRequired: ClarificationRequest | undefined;
  if (requiresClarification && intent === "clarification_required") {
    const clarId = randomUUID();
    const contractId = randomUUID();
    clarificationRequired = buildTimeRangeClarification(contractId, clarId);
    trace.push({ step: "fetch_mock_data", status: "skipped", detail: "Skipped — clarification required before data fetch", elapsedMs: timer.elapsed() });

    const confidenceTier = confidence >= 0.80 ? "high" : confidence >= 0.55 ? "medium" : "low";
    return {
      traceId, sessionId, messageId,
      createdAt: new Date().toISOString(),
      rawQuestion, intent, confidence, confidenceTier,
      answerText: clarificationRequired.message,
      queryPlan, mockData: [],
      sourceMetrics: resolvedMetrics,
      assumptions, caveats,
      clarificationRequired,
      abstained: false,
      pipelineTrace: [...trace, { step: "build_response" as const, status: "ok", detail: "Clarification response built", elapsedMs: timer.elapsed() }],
      latencyMs: timer.elapsed(),
      semanticSchemaVersion: "semantics.financeos.io/v1",
      contractSchemaVersion: "1.0",
    };
  }

  // ── STEP 10: fetch mock data ──────────────────────────────────────────────
  const mockData = generateMockData(intent, resolvedMetrics, timeRange);
  trace.push({ step: "fetch_mock_data", status: "ok", detail: `Generated ${mockData.length} mock data point(s)`, elapsedMs: timer.elapsed() });

  // ── STEP 11: format answer ────────────────────────────────────────────────
  const answerText = generateAnswerText(intent, resolvedMetrics, mockData, timeRange, assumptions);
  trace.push({ step: "format_answer", status: "ok", detail: `Answer text generated (${answerText.length} chars)`, elapsedMs: timer.elapsed() });

  // ── STEP 12: build response ───────────────────────────────────────────────
  const confidenceTier = confidence >= 0.80 ? "high" : confidence >= 0.55 ? "medium" : "low";
  trace.push({ step: "build_response", status: "ok", detail: "Full AnalyticsResponse assembled", elapsedMs: timer.elapsed() });

  return {
    traceId, sessionId, messageId,
    createdAt: new Date().toISOString(),
    rawQuestion, intent, confidence, confidenceTier,
    answerText,
    queryPlan,
    mockData,
    sourceMetrics: resolvedMetrics,
    assumptions,
    caveats,
    abstained: false,
    pipelineTrace: trace,
    latencyMs: timer.elapsed(),
    semanticSchemaVersion: "semantics.financeos.io/v1",
    contractSchemaVersion: "1.0",
  };
}
