import { z } from "zod";
import type { WorkflowType } from "../workflow/workflow-run.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";
import type { EscalationRule } from "../workflow/exception.js";
import type { ToolDefinition } from "../workflow/tool-call.js";
import {
  VARIANCE_ANALYST_CONFIG,
  VARIANCE_ANALYST_ESCALATION_RULES,
  VARIANCE_ANALYST_STATE_MACHINE,
} from "../agents/variance-analyst.js";
import {
  RECONCILIATION_ESCALATION_RULES,
  RECONCILIATION_STATE_MACHINE,
} from "../agents/reconciliation.js";
import {
  CLOSE_MANAGEMENT_ESCALATION_RULES,
  CLOSE_MANAGEMENT_STATE_MACHINE,
} from "../agents/close-management.js";
import {
  AR_COLLECTIONS_ESCALATION_RULES,
  AR_COLLECTIONS_STATE_MACHINE,
} from "../agents/ar-collections.js";
import {
  AP_INVOICE_RESEARCH_ESCALATION_RULES,
  AP_INVOICE_RESEARCH_STATE_MACHINE,
} from "../agents/ap-invoice-research.js";
import {
  POLICY_COMPLIANCE_ESCALATION_RULES,
  POLICY_COMPLIANCE_STATE_MACHINE,
} from "../agents/policy-compliance.js";

// ─────────────────────────────────────────────────────────────────────────────
// Agent registry entry
// ─────────────────────────────────────────────────────────────────────────────

export const AgentRegistryEntrySchema = z.object({
  agentId: z.string(),
  displayName: z.string(),
  description: z.string(),
  version: z.string(),
  workflowType: z.custom<WorkflowType>(),
  status: z.enum(["active", "beta", "deprecated", "disabled"]),
  requiredTools: z.array(z.string()),
  /** Which layer this agent primarily queries. */
  primaryLayer: z.enum(["semantic_analytics", "rag_retrieval", "hybrid"]),
  confidenceThresholds: z.object({
    minToPublish: z.number(),
    minToAutoApprove: z.number(),
    abstainBelow: z.number(),
  }),
  stateMachine: z.custom<StateMachineDefinition>(),
  escalationRules: z.array(z.custom<EscalationRule>()),
  /** ISO 8601 datetime of last successful health check. */
  lastHealthCheckAt: z.string().datetime().nullable(),
  averageRunDurationMs: z.number().int().optional(),
  totalRunsAllTime: z.number().int().default(0),
});
export type AgentRegistryEntry = z.infer<typeof AgentRegistryEntrySchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Shared tool catalog
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_CATALOG: ToolDefinition[] = [
  { name: "query_actuals",            displayName: "Query Actuals",              description: "Pull actuals from semantic metric layer",                  category: "semantic_analytics", hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "query_budget",             displayName: "Query Budget / Forecast",    description: "Pull budget or forecast from semantic layer",              category: "semantic_analytics", hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "compute_variance",         displayName: "Compute Variance",           description: "Calculate budget-vs-actual variance and percentages",      category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "rag_search",               displayName: "RAG Document Search",        description: "Hybrid dense+keyword search over document index",          category: "rag_retrieval",      hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "draft_commentary",         displayName: "Draft Commentary",           description: "LLM-generated variance commentary draft",                  category: "draft_generation",   hasSideEffects: false, requiresApproval: true,  inputSchema: {}, outputSchema: {} },
  { name: "draft_journal_entry",      displayName: "Draft Journal Entry",        description: "Draft a balanced journal entry for human review",          category: "draft_generation",   hasSideEffects: false, requiresApproval: true,  inputSchema: {}, outputSchema: {} },
  { name: "draft_collection_notice",  displayName: "Draft Collection Notice",    description: "Draft customer collection communication",                  category: "draft_generation",   hasSideEffects: false, requiresApproval: true,  inputSchema: {}, outputSchema: {} },
  { name: "draft_matching_memo",      displayName: "Draft Matching Memo",        description: "Draft 3-way match findings memo",                         category: "draft_generation",   hasSideEffects: false, requiresApproval: true,  inputSchema: {}, outputSchema: {} },
  { name: "draft_findings_memo",      displayName: "Draft Findings Memo",        description: "Draft compliance findings memo",                          category: "draft_generation",   hasSideEffects: false, requiresApproval: true,  inputSchema: {}, outputSchema: {} },
  { name: "draft_write_off_entry",    displayName: "Draft Write-Off Entry",      description: "Draft AR write-off journal entry — never posted automatically", category: "draft_generation", hasSideEffects: false, requiresApproval: true, inputSchema: {}, outputSchema: {} },
  { name: "draft_status_report",      displayName: "Draft Status Report",        description: "Draft period-end close status report",                    category: "draft_generation",   hasSideEffects: false, requiresApproval: true,  inputSchema: {}, outputSchema: {} },
  { name: "fetch_gl_items",           displayName: "Fetch GL Items",             description: "Pull GL transactions for account and period",              category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_subledger_items",    displayName: "Fetch Sub-ledger Items",     description: "Pull sub-ledger items for reconciliation",                 category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_ar_aging",           displayName: "Fetch AR Aging",             description: "Pull AR aging report from sub-ledger",                    category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_invoice",            displayName: "Fetch Invoice",              description: "Retrieve invoice details from AP system",                  category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_purchase_order",     displayName: "Fetch Purchase Order",       description: "Retrieve PO details for 3-way match",                     category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_receipt",            displayName: "Fetch Receipt",              description: "Retrieve goods receipt for 3-way match",                  category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_close_checklist",    displayName: "Fetch Close Checklist",      description: "Retrieve period-end close checklist",                     category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "fetch_subject",            displayName: "Fetch Subject",              description: "Retrieve the subject document or transaction",             category: "data_fetch",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "match_items",              displayName: "Match Items",                description: "Apply matching rules to GL and sub-ledger items",          category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "identify_breaks",          displayName: "Identify Breaks",            description: "Classify unmatched reconciliation items",                  category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "three_way_match",          displayName: "3-Way Match",                description: "Perform invoice / PO / receipt 3-way match",              category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "classify_customer_risk",   displayName: "Classify Customer Risk",     description: "Score customers by payment risk",                         category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "check_task_dependencies",  displayName: "Check Task Dependencies",    description: "Validate close checklist dependency graph",               category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "validate_journal_entries", displayName: "Validate Journal Entries",   description: "Check entries against policy and balance rules",           category: "validation",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "extract_requirements",     displayName: "Extract Requirements",       description: "Extract applicable policy clauses from documents",         category: "calculation",        hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "check_compliance",         displayName: "Check Compliance",           description: "Compare subject against extracted requirements",           category: "validation",         hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "request_sign_off",         displayName: "Request Sign-Off",           description: "Send sign-off notification (no accounting side effects)",  category: "notification",       hasSideEffects: false, requiresApproval: false, inputSchema: {}, outputSchema: {} },
  { name: "write_audit_event",        displayName: "Write Audit Event",          description: "Append immutable audit event to trail",                   category: "audit_write",        hasSideEffects: true,  requiresApproval: false, inputSchema: {}, outputSchema: {} },
];

// ─────────────────────────────────────────────────────────────────────────────
// Static agent registry
// ─────────────────────────────────────────────────────────────────────────────

export const AGENT_REGISTRY: AgentRegistryEntry[] = [
  {
    agentId: "variance-analyst-v1",
    displayName: "Variance Analyst",
    description: VARIANCE_ANALYST_CONFIG.description,
    version: "1.0.0",
    workflowType: "variance_analysis",
    status: "active",
    requiredTools: VARIANCE_ANALYST_CONFIG.requiredTools,
    primaryLayer: "hybrid",
    confidenceThresholds: VARIANCE_ANALYST_CONFIG.confidenceThresholds,
    stateMachine: VARIANCE_ANALYST_STATE_MACHINE,
    escalationRules: VARIANCE_ANALYST_ESCALATION_RULES,
    lastHealthCheckAt: new Date().toISOString(),
    averageRunDurationMs: 4200,
    totalRunsAllTime: 142,
  },
  {
    agentId: "reconciliation-v1",
    displayName: "Reconciliation Agent",
    description: "Matches GL and sub-ledger items, identifies reconciliation breaks, drafts clearing journal entries, and routes for controller approval.",
    version: "1.0.0",
    workflowType: "reconciliation",
    status: "active",
    requiredTools: ["fetch_gl_items", "fetch_subledger_items", "match_items", "identify_breaks", "rag_search", "draft_journal_entry", "write_audit_event"],
    primaryLayer: "semantic_analytics",
    confidenceThresholds: { minToPublish: 0.80, minToAutoApprove: 0.97, abstainBelow: 0.50 },
    stateMachine: RECONCILIATION_STATE_MACHINE,
    escalationRules: RECONCILIATION_ESCALATION_RULES,
    lastHealthCheckAt: new Date().toISOString(),
    averageRunDurationMs: 6800,
    totalRunsAllTime: 89,
  },
  {
    agentId: "close-management-v1",
    displayName: "Close Management Agent",
    description: "Drives the period-end close checklist: validates entries, tracks dependencies, collects sign-offs, and escalates blockers.",
    version: "1.0.0",
    workflowType: "close_management",
    status: "active",
    requiredTools: ["fetch_close_checklist", "check_task_dependencies", "validate_journal_entries", "request_sign_off", "rag_search", "draft_status_report", "write_audit_event"],
    primaryLayer: "semantic_analytics",
    confidenceThresholds: { minToPublish: 0.85, minToAutoApprove: 0.99, abstainBelow: 0.60 },
    stateMachine: CLOSE_MANAGEMENT_STATE_MACHINE,
    escalationRules: CLOSE_MANAGEMENT_ESCALATION_RULES,
    lastHealthCheckAt: new Date().toISOString(),
    averageRunDurationMs: 9100,
    totalRunsAllTime: 34,
  },
  {
    agentId: "ar-collections-v1",
    displayName: "AR Collections Agent",
    description: "Analyses AR aging, classifies customer payment risk, drafts collection actions, and recommends write-offs — all require human approval.",
    version: "1.0.0",
    workflowType: "ar_collections",
    status: "active",
    requiredTools: ["fetch_ar_aging", "classify_customer_risk", "rag_search", "draft_collection_notice", "draft_write_off_entry", "write_audit_event"],
    primaryLayer: "hybrid",
    confidenceThresholds: { minToPublish: 0.75, minToAutoApprove: 0.98, abstainBelow: 0.45 },
    stateMachine: AR_COLLECTIONS_STATE_MACHINE,
    escalationRules: AR_COLLECTIONS_ESCALATION_RULES,
    lastHealthCheckAt: new Date().toISOString(),
    averageRunDurationMs: 5300,
    totalRunsAllTime: 67,
  },
  {
    agentId: "ap-invoice-research-v1",
    displayName: "AP Invoice Research Agent",
    description: "Performs 3-way match, retrieves vendor contracts via RAG, identifies discrepancies, and recommends hold/approve/dispute actions.",
    version: "1.0.0",
    workflowType: "ap_invoice_research",
    status: "active",
    requiredTools: ["fetch_invoice", "fetch_purchase_order", "fetch_receipt", "three_way_match", "rag_search", "draft_matching_memo", "write_audit_event"],
    primaryLayer: "rag_retrieval",
    confidenceThresholds: { minToPublish: 0.80, minToAutoApprove: 0.97, abstainBelow: 0.55 },
    stateMachine: AP_INVOICE_RESEARCH_STATE_MACHINE,
    escalationRules: AP_INVOICE_RESEARCH_ESCALATION_RULES,
    lastHealthCheckAt: new Date().toISOString(),
    averageRunDurationMs: 3700,
    totalRunsAllTime: 201,
  },
  {
    agentId: "policy-compliance-v1",
    displayName: "Policy Compliance Agent",
    description: "Checks documents and transactions against ASC 606, IFRS 15, SOX, and internal policies; drafts findings memos requiring controller review.",
    version: "1.0.0",
    workflowType: "policy_compliance",
    status: "active",
    requiredTools: ["fetch_subject", "rag_search", "extract_requirements", "check_compliance", "draft_findings_memo", "write_audit_event"],
    primaryLayer: "rag_retrieval",
    confidenceThresholds: { minToPublish: 0.75, minToAutoApprove: 0.99, abstainBelow: 0.50 },
    stateMachine: POLICY_COMPLIANCE_STATE_MACHINE,
    escalationRules: POLICY_COMPLIANCE_ESCALATION_RULES,
    lastHealthCheckAt: new Date().toISOString(),
    averageRunDurationMs: 7200,
    totalRunsAllTime: 48,
  },
];

export function getAgentById(agentId: string): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find((a) => a.agentId === agentId);
}

export function getAgentByWorkflowType(workflowType: WorkflowType): AgentRegistryEntry | undefined {
  return AGENT_REGISTRY.find((a) => a.workflowType === workflowType);
}
