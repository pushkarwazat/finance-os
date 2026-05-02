import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// AP Invoice Research Agent
// Purpose: Given a vendor invoice, perform 3-way match (invoice / PO / receipt),
//          identify discrepancies, retrieve supporting contracts via RAG, draft
//          a matching memo, and recommend hold/approve/dispute actions for human
//          approval.
// ─────────────────────────────────────────────────────────────────────────────

export const APInvoiceResearchAgentConfigSchema = z.object({
  agentId: z.literal("ap-invoice-research-v1"),
  displayName: z.literal("AP Invoice Research Agent"),
  description: z.literal(
    "Performs 3-way match (invoice / PO / receipt), retrieves vendor contracts via RAG, identifies discrepancies, drafts matching memos, and recommends hold/approve/dispute actions — all require human approval before posting."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    invoiceId: z.string().describe("Internal invoice ID or vendor invoice number"),
    vendorId: z.string().optional(),
    autoMatchThresholdPct: z
      .number()
      .default(0.02)
      .describe("Percentage variance within which auto-match is proposed"),
    searchContractIndex: z
      .boolean()
      .default(true)
      .describe("Search RAG index for relevant vendor contracts and SOWs"),
  }),

  output: z.object({
    invoiceAmount: z.number(),
    poAmount: z.number().nullable(),
    receiptAmount: z.number().nullable(),
    matchStatus: z.enum(["matched", "partial_match", "mismatch", "po_not_found", "receipt_not_found"]),
    discrepancyAmount: z.number(),
    discrepancyPct: z.number(),
    contractClauses: z.array(z.string()).describe("Relevant contract clause excerpts"),
    matchingMemo: z.string(),
    recommendedAction: z.enum(["approve", "hold", "dispute", "request_credit_memo", "escalate"]),
    recommendedActionId: z.string().optional().describe("ActionRecommendation ID"),
    exceptions: z.array(z.string()),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_invoice",            // data_fetch: pull invoice details
    "fetch_purchase_order",     // data_fetch: retrieve matching PO
    "fetch_receipt",            // data_fetch: retrieve goods/services receipt
    "three_way_match",          // calculation: perform 3-way match
    "rag_search",               // rag_retrieval: search vendor contracts
    "draft_matching_memo",      // draft_generation: matching memo
    "write_audit_event",        // audit_write
  ]),

  confidenceThresholds: z.object({
    minToPublish: z.number().default(0.80),
    minToAutoApprove: z.number().default(0.97),
    abstainBelow: z.number().default(0.55),
  }),

  approvalRequirements: z.object({
    approveInvoiceRequiresHuman: z.boolean().default(true),
    disputeRequiresHuman: z.boolean().default(true),
    holdRequiresHuman: z.boolean().default(true),
    aboveUsdRequiresControllerApproval: z.number().default(25_000),
  }),

  humanHandoffTriggers: z.array(z.string()).default([
    "PO not found in system",
    "receipt not confirmed",
    "discrepancy > 5% or > $1,000",
    "vendor contract not in document index",
    "invoice flagged for duplicate payment",
    "confidence < 0.55",
  ]),
});
export type APInvoiceResearchAgentConfig = z.infer<typeof APInvoiceResearchAgentConfigSchema>;

export const AP_INVOICE_RESEARCH_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "Duplicate payment detected",
    category: "data_quality",
    severity: "critical",
    notifyRoles: ["ap_manager", "controller", "cfo"],
    autoEscalateAfterSeconds: 300,
  },
  {
    condition: "Invoice > $25k with no matching PO",
    category: "threshold_breach",
    severity: "high",
    notifyRoles: ["ap_manager", "controller"],
    autoEscalateAfterSeconds: 1800,
  },
  {
    condition: "Discrepancy > 5% between invoice and PO",
    category: "reconciliation_break",
    severity: "medium",
    notifyRoles: ["ap_manager"],
    autoEscalateAfterSeconds: 3600,
  },
];

export const AP_INVOICE_RESEARCH_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "ap_invoice_research",
  initialState: "idle",
  terminalStates: ["completed", "cancelled", "exception"],
  humanGatedStates: ["awaiting_approval", "escalated"],
  transitions: [
    { from: "idle",                     to: "loading_invoice",          trigger: "start",                 description: "Load invoice details",                       requiresHuman: false, requiresApproval: false },
    { from: "loading_invoice",          to: "searching_documents",      trigger: "invoice_loaded",        description: "Invoice loaded; search RAG for contracts",   requiresHuman: false, requiresApproval: false },
    { from: "searching_documents",      to: "matching_purchase_order",  trigger: "documents_retrieved",   description: "Docs retrieved; find matching PO",           requiresHuman: false, requiresApproval: false },
    { from: "matching_purchase_order",  to: "three_way_match",          trigger: "po_found",              description: "PO found; perform 3-way match",              requiresHuman: false, requiresApproval: false },
    { from: "matching_purchase_order",  to: "exception",                trigger: "po_not_found",          description: "PO not found — raise exception",             requiresHuman: false, requiresApproval: false },
    { from: "three_way_match",          to: "reconciling_discrepancies",trigger: "match_computed",        description: "Match computed; reconcile discrepancies",    requiresHuman: false, requiresApproval: false },
    { from: "reconciling_discrepancies",to: "drafting_memo",            trigger: "reconciliation_done",   description: "Reconciliation done; draft matching memo",   requiresHuman: false, requiresApproval: false },
    { from: "drafting_memo",            to: "awaiting_approval",        trigger: "memo_drafted",          description: "Memo drafted; request AP manager approval",  requiresHuman: false, requiresApproval: true  },
    { from: "awaiting_approval",        to: "approved",                 trigger: "approved",              description: "AP manager approved recommended action",     requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",        to: "rejected",                 trigger: "rejected",              description: "Action rejected; revise",                    requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",        to: "escalated",                trigger: "escalate",              description: "Escalated to controller",                    requiresHuman: true,  requiresApproval: false },
    { from: "approved",                 to: "completed",                trigger: "action_executed",       description: "Human executed action in AP system",         requiresHuman: true,  requiresApproval: false },
    { from: "rejected",                 to: "drafting_memo",            trigger: "revise",                description: "Agent revises recommendation",               requiresHuman: false, requiresApproval: false },
  ],
};
