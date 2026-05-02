import { randomUUID } from "node:crypto";
import type { WorkflowRun, WorkflowType } from "../workflow/workflow-run.js";
import type { ApprovalStep } from "../workflow/approval-step.js";
import type { Exception } from "../workflow/exception.js";
import type { ActionRecommendation } from "../workflow/action.js";
import type { Explanation, EvidenceItem } from "../workflow/explanation.js";
import type { ToolCall } from "../workflow/tool-call.js";
import { getAgentByWorkflowType } from "../registry/registry.js";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory stores (swap for DB in production)
// ─────────────────────────────────────────────────────────────────────────────

const runs = new Map<string, WorkflowRun>();
const approvals = new Map<string, ApprovalStep>();
const exceptions = new Map<string, Exception>();
const actions = new Map<string, ActionRecommendation>();
const explanations = new Map<string, Explanation>();
const toolCalls = new Map<string, ToolCall>();

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function makeEvidence(count: number, label: string): EvidenceItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    sourceType: i % 2 === 0 ? ("rag_chunk" as const) : ("metric_datapoint" as const),
    sourceId: `src-${randomUUID().slice(0, 8)}`,
    label: `${label} — evidence ${i + 1}`,
    excerpt: `Relevant data excerpt ${i + 1} for ${label}`,
    sourceTitle: i % 2 === 0 ? "Q3 FY2025 Financial Close Memorandum" : "Semantic Metric Layer",
    relevanceScore: parseFloat((0.7 + Math.random() * 0.3).toFixed(2)),
    fiscalPeriod: "Q3 FY2025",
    isSensitive: false,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic mock run data per workflow type
// ─────────────────────────────────────────────────────────────────────────────

interface MockRunSpec {
  title: string;
  fiscalPeriod: string;
  status: WorkflowRun["status"];
  currentState: string;
  confidence: number;
  outputSummary: string;
  hasApprovals: boolean;
  hasExceptions: boolean;
  exceptionSeverity?: Exception["severity"];
  toolCount: number;
}

const MOCK_RUN_SPECS: Record<WorkflowType, MockRunSpec> = {
  variance_analysis: {
    title: "Q3 FY2025 Variance Analysis — Revenue & OpEx",
    fiscalPeriod: "Q3 FY2025",
    status: "awaiting_approval",
    currentState: "awaiting_approval",
    confidence: 0.88,
    outputSummary:
      "Revenue $2.41M (+3.2% vs budget). OpEx $1.84M (+7.8% — $134k unfavourable driven by S&M headcount additions in Aug). Gross margin 61.8% vs 63.1% budget. 2 material variances require controller sign-off.",
    hasApprovals: true,
    hasExceptions: false,
    toolCount: 6,
  },
  reconciliation: {
    title: "Sep-2025 Accounts Receivable Reconciliation — AR Control Account",
    fiscalPeriod: "Sep-2025",
    status: "running",
    currentState: "matching_items",
    confidence: 0.91,
    outputSummary: "GL balance $4,218,440. Sub-ledger balance $4,201,230. Unreconciled break: $17,210 across 3 items. In progress.",
    hasApprovals: false,
    hasExceptions: false,
    toolCount: 3,
  },
  close_management: {
    title: "Q3 FY2025 Period-End Close — September 2025",
    fiscalPeriod: "Sep-2025",
    status: "awaiting_human",
    currentState: "sign_off_required",
    confidence: 0.94,
    outputSummary:
      "38/42 tasks complete. 4 pending sign-offs (Controller, CFO). SOX ITGC controls: PASS. Revenue recognition: PASS. 1 JE requires materiality review ($285k accrual reversal).",
    hasApprovals: true,
    hasExceptions: true,
    exceptionSeverity: "medium",
    toolCount: 7,
  },
  ar_collections: {
    title: "AR Collections — Sep-2025 Aging Review",
    fiscalPeriod: "Sep-2025",
    status: "completed",
    currentState: "completed",
    confidence: 0.82,
    outputSummary:
      "DSO: 47 days. Past-due balance: $891,200. 3 customers classified high-risk (91+ days). 1 write-off candidate: Acme Corp $52,400. 12 collection notices drafted and approved.",
    hasApprovals: false,
    hasExceptions: false,
    toolCount: 5,
  },
  ap_invoice_research: {
    title: "AP 3-Way Match — AWS Invoice INV-2025-09-0042",
    fiscalPeriod: "Sep-2025",
    status: "awaiting_approval",
    currentState: "awaiting_approval",
    confidence: 0.95,
    outputSummary:
      "Invoice: $84,234.10 vs PO: $81,000.00. Discrepancy: $3,234.10 (3.99%). Contract allows up to 5% usage overage. Recommendation: APPROVE with note to procurement team.",
    hasApprovals: true,
    hasExceptions: false,
    toolCount: 6,
  },
  policy_compliance: {
    title: "ASC 606 Compliance Review — Master Service Agreement Acme Software",
    fiscalPeriod: "Q3 FY2025",
    status: "completed",
    currentState: "completed",
    confidence: 0.79,
    outputSummary:
      "2 findings: (1) MEDIUM — variable consideration constraint not documented for milestone #3; (2) LOW — SSP update overdue by 18 days. Findings memo approved by controller.",
    hasApprovals: false,
    hasExceptions: true,
    exceptionSeverity: "medium",
    toolCount: 5,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Build a complete mock WorkflowRun from a spec
// ─────────────────────────────────────────────────────────────────────────────

function buildMockRun(workflowType: WorkflowType, overrides: Partial<MockRunSpec> = {}): WorkflowRun {
  const agent = getAgentByWorkflowType(workflowType)!;
  const spec = { ...MOCK_RUN_SPECS[workflowType], ...overrides };
  const runId = randomUUID();
  const createdAt = new Date(Date.now() - 1000 * 60 * 30).toISOString();
  const startedAt = new Date(Date.now() - 1000 * 60 * 25).toISOString();
  const completedAt = spec.status === "completed" ? new Date(Date.now() - 1000 * 60 * 5).toISOString() : null;

  // Build state history
  const sm = agent.stateMachine;
  const stateHistory = sm.transitions
    .slice(0, 3)
    .map((t, i) => ({
      fromState: t.from,
      toState: t.to,
      trigger: t.trigger,
      occurredAt: new Date(Date.now() - 1000 * 60 * (25 - i * 5)).toISOString(),
      actor: i === 0 ? "system" : "agent",
      note: t.description,
    }));

  // Build tool calls
  const toolCallIds: string[] = [];
  for (let i = 0; i < spec.toolCount; i++) {
    const tc: ToolCall = {
      id: randomUUID(),
      taskId: randomUUID(),
      workflowRunId: runId,
      toolName: agent.requiredTools[i % agent.requiredTools.length],
      category: "semantic_analytics",
      input: { period: spec.fiscalPeriod },
      output: { result: "mock_output" },
      status: "succeeded",
      cached: false,
      latencyMs: 80 + Math.floor(Math.random() * 200),
      startedAt: new Date(Date.now() - 1000 * 60 * (20 - i * 2)).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * (20 - i * 2 - 0.5)).toISOString(),
      evidenceIds: [],
    };
    toolCalls.set(tc.id, tc);
    toolCallIds.push(tc.id);
  }

  // Build approval steps
  const approvalStepIds: string[] = [];
  if (spec.hasApprovals) {
    const ap: ApprovalStep = {
      id: randomUUID(),
      workflowRunId: runId,
      actionId: randomUUID(),
      gateId: "controller_sign_off",
      displayName: "Controller Sign-Off",
      description: "Controller must review and approve the agent's recommendation before any action is taken.",
      requiredLevel: "controller",
      requiredRoles: ["controller", "senior_accountant"],
      status: "pending",
      decidedBy: null,
      decision: null,
      autoApproved: false,
      materialityAmount: 134_000,
      materialityThreshold: 50_000,
      evidenceIds: [],
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      createdAt,
      decidedAt: null,
    };
    approvals.set(ap.id, ap);
    approvalStepIds.push(ap.id);
  }

  // Build exceptions
  const exceptionIds: string[] = [];
  if (spec.hasExceptions) {
    const ex: Exception = {
      id: randomUUID(),
      workflowRunId: runId,
      agentId: agent.agentId,
      severity: spec.exceptionSeverity ?? "medium",
      category: "threshold_breach",
      status: "open",
      title: spec.exceptionSeverity === "medium" ? "Variance exceeds materiality threshold" : "Compliance finding requires review",
      description:
        workflowType === "close_management"
          ? "Journal entry $285,000 accrual reversal exceeds $250k notification threshold. Controller review required."
          : "ASC 606 variable consideration constraint not documented for contract milestone #3.",
      evidenceIds: [],
      accounts: workflowType === "close_management" ? ["6200", "2100"] : [],
      notifiedRoles: ["controller"],
      resolvedBy: null,
      waivedBy: null,
      raisedAt: new Date(Date.now() - 1000 * 60 * 10).toISOString(),
      acknowledgedAt: null,
      resolvedAt: null,
    };
    exceptions.set(ex.id, ex);
    exceptionIds.push(ex.id);
  }

  // Build explanation
  const evidence = makeEvidence(3, spec.title);
  const explanation: Explanation = {
    id: randomUUID(),
    workflowRunId: runId,
    taskId: randomUUID(),
    agentId: agent.agentId,
    conclusion: spec.outputSummary,
    reasoningChain: [
      {
        stepIndex: 0,
        title: "Data Collection",
        observation: `Fetched actuals and reference data for ${spec.fiscalPeriod} from ${agent.primaryLayer === "hybrid" ? "semantic layer and document index" : agent.primaryLayer === "rag_retrieval" ? "document index" : "semantic analytics layer"}.`,
        evidenceIds: [evidence[0].id],
        pivotal: false,
      },
      {
        stepIndex: 1,
        title: "Analysis",
        observation: `Applied ${agent.workflowType.replace("_", " ")} logic. ${spec.outputSummary.split(".")[0]}.`,
        evidenceIds: [evidence[1].id],
        pivotal: true,
      },
      {
        stepIndex: 2,
        title: "Conclusion",
        observation: "Based on analysis, drafted recommendation for human review.",
        evidenceIds: [evidence[2].id],
        pivotal: false,
      },
    ],
    evidence,
    confidence: spec.confidence,
    confidenceTier: spec.confidence >= 0.85 ? "high" : spec.confidence >= 0.70 ? "medium" : "low",
    confidenceRationale: `${Math.round(spec.confidence * 100)}% confidence based on data completeness and agreement across sources.`,
    assumptions: ["All source data is current as of run time", `Fiscal period: ${spec.fiscalPeriod}`],
    limitationsAndGaps: spec.confidence < 0.90 ? ["Some historical comparative data unavailable"] : [],
    createdAt: now(),
  };
  explanations.set(explanation.id, explanation);

  // Build action recommendations
  const actionIds: string[] = [];
  if (spec.status === "awaiting_approval" || spec.status === "completed") {
    const actionType =
      workflowType === "variance_analysis" ? ("post_journal_entry" as const) :
      workflowType === "reconciliation" ? ("post_journal_entry" as const) :
      workflowType === "close_management" ? ("sign_off_close_step" as const) :
      workflowType === "ar_collections" ? ("send_collection_notice" as const) :
      workflowType === "ap_invoice_research" ? ("approve_invoice" as const) :
      ("flag_policy_exception" as const);

    const action: ActionRecommendation = {
      id: randomUUID(),
      workflowRunId: runId,
      taskId: randomUUID(),
      agentId: agent.agentId,
      actionType,
      status: spec.status === "completed" ? "approved" : "pending_review",
      title: spec.outputSummary.split(".")[0],
      rationale: spec.outputSummary,
      confidence: spec.confidence,
      requiresApproval: true,
      approvalStepId: approvalStepIds[0],
      amountUsd:
        workflowType === "ap_invoice_research" ? 84234.10 :
        workflowType === "ar_collections" ? 52400 :
        workflowType === "variance_analysis" ? 134000 :
        undefined,
      accounts: [],
      evidenceIds: evidence.map((e) => e.id),
      policyReferences:
        workflowType === "policy_compliance" ? ["ASC 606-10-32-11", "Internal Policy Rev-2023-04"] : [],
      approvedBy: spec.status === "completed" ? "J. Davies (Controller)" : null,
      approvedAt: spec.status === "completed" ? new Date(Date.now() - 1000 * 60 * 5).toISOString() : null,
      executedBy: null,
      executedAt: null,
      createdAt,
      updatedAt: now(),
    };
    actions.set(action.id, action);
    actionIds.push(action.id);
  }

  const run: WorkflowRun = {
    id: runId,
    workflowType,
    agentId: agent.agentId,
    title: spec.title,
    status: spec.status,
    currentState: spec.currentState,
    availableTransitions:
      sm.transitions
        .filter((t) => t.from === spec.currentState)
        .map((t) => t.trigger),
    stateHistory,
    taskIds: [],
    toolCallIds,
    approvalStepIds,
    exceptionIds,
    actionIds,
    explanationIds: [explanation.id],
    auditTrail: stateHistory.map((t, i) => ({
      id: randomUUID(),
      workflowRunId: runId,
      eventType: i === 0 ? "workflow_started" : "state_transition",
      actor: t.actor,
      summary: `${t.fromState} → ${t.toState} (${t.trigger})`,
      detail: { trigger: t.trigger },
      evidenceIds: [],
      occurredAt: t.occurredAt,
    })),
    awaitingHuman: spec.status === "awaiting_human" || spec.status === "awaiting_approval",
    humanHandoffReason: spec.status === "awaiting_approval" ? "Pending controller sign-off" : undefined,
    tenantId: "tenant-demo-001",
    requestedBy: "J. Davies",
    fiscalPeriod: spec.fiscalPeriod,
    inputPayload: { fiscalPeriod: spec.fiscalPeriod },
    outputSummary: spec.status === "completed" ? spec.outputSummary : undefined,
    confidence: spec.status === "completed" ? spec.confidence : undefined,
    startedAt,
    completedAt,
    failedAt: null,
    createdAt,
    updatedAt: now(),
  };

  runs.set(runId, run);
  return run;
}

// ─────────────────────────────────────────────────────────────────────────────
// Seed all 6 demo runs once at module load
// ─────────────────────────────────────────────────────────────────────────────

export let SEEDED_RUNS: WorkflowRun[] = [];

export function seedDemoRuns(): void {
  if (SEEDED_RUNS.length > 0) return;
  const types: WorkflowType[] = [
    "variance_analysis",
    "reconciliation",
    "close_management",
    "ar_collections",
    "ap_invoice_research",
    "policy_compliance",
  ];
  SEEDED_RUNS = types.map((t) => buildMockRun(t));
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

export function listRuns(): WorkflowRun[] {
  return Array.from(runs.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function getRun(id: string): WorkflowRun | undefined {
  return runs.get(id);
}

export function listApprovals(status?: ApprovalStep["status"]): ApprovalStep[] {
  const all = Array.from(approvals.values());
  return status ? all.filter((a) => a.status === status) : all;
}

export function getApproval(id: string): ApprovalStep | undefined {
  return approvals.get(id);
}

export function decideApproval(
  id: string,
  decision: "approved" | "rejected",
  decidedBy: string,
  note?: string
): ApprovalStep | undefined {
  const ap = approvals.get(id);
  if (!ap) return undefined;
  ap.status = decision;
  ap.decision = decision;
  ap.decidedBy = decidedBy;
  ap.decisionNote = note;
  ap.decidedAt = now();
  approvals.set(id, ap);

  // Update the associated run status
  const run = Array.from(runs.values()).find((r) => r.approvalStepIds.includes(id));
  if (run) {
    run.status = decision === "approved" ? "completed" : "running";
    run.awaitingHuman = decision !== "approved";
    run.updatedAt = now();
    if (decision === "approved") {
      run.currentState = "approved";
      run.outputSummary = run.outputSummary ?? "Approved by " + decidedBy;
    }
    runs.set(run.id, run);
  }

  return ap;
}

export function listExceptions(status?: Exception["status"]): Exception[] {
  const all = Array.from(exceptions.values());
  return status ? all.filter((e) => e.status === status) : all;
}

export function getException(id: string): Exception | undefined {
  return exceptions.get(id);
}

export function resolveException(
  id: string,
  resolvedBy: string,
  note: string,
  waive = false
): Exception | undefined {
  const ex = exceptions.get(id);
  if (!ex) return undefined;
  ex.status = waive ? "waived" : "resolved";
  ex.resolvedBy = resolvedBy;
  if (waive) {
    ex.waivedBy = resolvedBy;
    ex.waiverRationale = note;
  } else {
    ex.resolutionNote = note;
  }
  ex.resolvedAt = now();
  exceptions.set(id, ex);
  return ex;
}

export function listActions(): ActionRecommendation[] {
  return Array.from(actions.values());
}

export function getExplanation(id: string): Explanation | undefined {
  return explanations.get(id);
}

export function getToolCall(id: string): ToolCall | undefined {
  return toolCalls.get(id);
}

export function createRun(workflowType: WorkflowType, payload: Record<string, unknown>): WorkflowRun {
  const run = buildMockRun(workflowType, {
    status: "running",
    currentState: getAgentByWorkflowType(workflowType)!.stateMachine.transitions[0].to,
  });
  run.inputPayload = payload;
  runs.set(run.id, run);
  return run;
}

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator routing logic
// ─────────────────────────────────────────────────────────────────────────────

export interface OrchestratorRouting {
  layer: "semantic_analytics" | "rag_retrieval" | "hybrid";
  agentId: string | null;
  workflowType: WorkflowType | null;
  rationale: string;
  suggestedTools: string[];
}

export function routeRequest(query: string, context: Record<string, unknown>): OrchestratorRouting {
  const lower = query.toLowerCase();
  const ragKeywords = ["contract", "policy", "document", "invoice", "memo", "clause", "sox", "asc 606", "ifrs", "compliance", "audit"];
  const semanticKeywords = ["variance", "budget", "forecast", "actual", "metric", "revenue", "opex", "margin", "headcount", "kpi"];

  const ragScore = ragKeywords.filter((k) => lower.includes(k)).length;
  const semanticScore = semanticKeywords.filter((k) => lower.includes(k)).length;

  if (ragScore > 0 && semanticScore > 0) {
    return {
      layer: "hybrid",
      agentId: "variance-analyst-v1",
      workflowType: "variance_analysis",
      rationale: `Query references both document context (${ragScore} RAG signals) and metric data (${semanticScore} semantic signals). Routing to hybrid layer.`,
      suggestedTools: ["rag_search", "query_actuals", "compute_variance"],
    };
  }

  if (ragScore > semanticScore) {
    const docWorkflow: WorkflowType = lower.includes("invoice") ? "ap_invoice_research" :
      lower.includes("compliance") || lower.includes("policy") || lower.includes("sox") || lower.includes("asc 606") ? "policy_compliance" :
      "policy_compliance";
    return {
      layer: "rag_retrieval",
      agentId: `${docWorkflow.replace(/_/g, "-")}-v1`,
      workflowType: docWorkflow,
      rationale: `Query is document-focused (${ragScore} RAG signals). Routing to RAG retrieval layer.`,
      suggestedTools: ["rag_search", "fetch_subject"],
    };
  }

  const metricWorkflow: WorkflowType = lower.includes("reconcil") ? "reconciliation" :
    lower.includes("close") || lower.includes("sign") ? "close_management" :
    lower.includes("collection") || lower.includes("aging") || lower.includes("receivable") ? "ar_collections" :
    "variance_analysis";
  return {
    layer: "semantic_analytics",
    agentId: `${metricWorkflow.replace(/_/g, "-")}-v1`,
    workflowType: metricWorkflow,
    rationale: `Query is metric-focused (${semanticScore} semantic signals). Routing to semantic analytics layer.`,
    suggestedTools: ["query_actuals", "compute_variance"],
  };
}
