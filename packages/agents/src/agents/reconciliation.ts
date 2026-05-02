import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Reconciliation Agent
// Purpose: Match GL items to sub-ledger items, identify unreconciled breaks,
//          draft proposed clearing entries, and route for controller approval.
//          Never autonomously posts clearing entries.
// ─────────────────────────────────────────────────────────────────────────────

export const ReconciliationAgentConfigSchema = z.object({
  agentId: z.literal("reconciliation-v1"),
  displayName: z.literal("Reconciliation Agent"),
  description: z.literal(
    "Matches GL and sub-ledger items, identifies reconciliation breaks, drafts clearing journal entries, and routes for controller approval before any posting."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    accountCode: z.string().describe("GL account to reconcile"),
    period: z.string().describe("Accounting period (e.g. Sep-2025)"),
    matchingTolerance: z.number().default(0.01).describe("Acceptable rounding difference in USD"),
    autoMatchRules: z
      .array(z.string())
      .default(["exact_amount", "exact_reference", "invoice_number"])
      .describe("Rules to apply for automatic matching"),
  }),

  output: z.object({
    matchedItems: z.number().int(),
    unmatchedGlItems: z.number().int(),
    unmatchedSubledgerItems: z.number().int(),
    totalBreakAmount: z.number(),
    breaksByCategory: z.record(z.string(), z.number()),
    proposedClearingEntries: z.array(z.string()).describe("ActionRecommendation IDs for clearing JEs"),
    exceptions: z.array(z.string()),
    reconciliationStatus: z.enum(["clean", "in_progress", "breaks_require_action", "escalated"]),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_gl_items",           // data_fetch: pull GL transactions for account/period
    "fetch_subledger_items",    // data_fetch: pull sub-ledger items
    "match_items",              // calculation: apply matching rules
    "identify_breaks",          // calculation: classify unmatched items
    "rag_search",               // rag_retrieval: search contracts/invoices for supporting docs
    "draft_journal_entry",      // draft_generation: draft clearing JE
    "write_audit_event",        // audit_write
  ]),

  confidenceThresholds: z.object({
    minToPublish: z.number().default(0.80),
    minToAutoApprove: z.number().default(0.97),
    abstainBelow: z.number().default(0.50),
  }),

  approvalRequirements: z.object({
    breakAboveUsd: z.number().default(0).describe("All breaks require human review; no auto-post"),
    requiredRole: z.string().default("controller"),
    secondaryApprovalAboveUsd: z.number().default(100_000).describe("CFO approval required above $100k"),
  }),

  humanHandoffTriggers: z.array(z.string()).default([
    "total break > $100k",
    "break exists for > 30 days",
    "supporting document not found in RAG index",
    "confidence < 0.50 on any proposed entry",
    "items involve intercompany accounts",
  ]),
});
export type ReconciliationAgentConfig = z.infer<typeof ReconciliationAgentConfigSchema>;

export const RECONCILIATION_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "Total reconciliation break exceeds $100k",
    category: "reconciliation_break",
    severity: "high",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 3600,
  },
  {
    condition: "Break item aged > 30 days",
    category: "reconciliation_break",
    severity: "medium",
    notifyRoles: ["controller"],
    autoEscalateAfterSeconds: 86400,
  },
  {
    condition: "No supporting document found for break item",
    category: "data_quality",
    severity: "high",
    notifyRoles: ["controller", "accounts_payable"],
    autoEscalateAfterSeconds: 3600,
  },
];

export const RECONCILIATION_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "reconciliation",
  initialState: "idle",
  terminalStates: ["completed", "cancelled", "exception"],
  humanGatedStates: ["awaiting_approval", "escalated"],
  transitions: [
    { from: "idle",                      to: "loading_gl_items",            trigger: "start",                 description: "Load GL transactions for period",            requiresHuman: false, requiresApproval: false },
    { from: "loading_gl_items",          to: "loading_subledger_items",     trigger: "gl_loaded",             description: "GL loaded; load sub-ledger",                 requiresHuman: false, requiresApproval: false },
    { from: "loading_subledger_items",   to: "matching_items",              trigger: "subledger_loaded",      description: "Sub-ledger loaded; run matching rules",      requiresHuman: false, requiresApproval: false },
    { from: "matching_items",            to: "identifying_breaks",          trigger: "matching_complete",     description: "Matching complete; classify breaks",         requiresHuman: false, requiresApproval: false },
    { from: "identifying_breaks",        to: "generating_recommendations",  trigger: "breaks_classified",     description: "Breaks classified; draft clearing entries",  requiresHuman: false, requiresApproval: false },
    { from: "generating_recommendations",to: "awaiting_approval",           trigger: "drafts_ready",          description: "Drafts ready; request controller approval",  requiresHuman: false, requiresApproval: true  },
    { from: "awaiting_approval",         to: "approved",                    trigger: "approved",              description: "Controller approved proposed entries",       requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",         to: "rejected",                    trigger: "rejected",              description: "Entries rejected; revise",                  requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_approval",         to: "escalated",                   trigger: "escalate",              description: "Escalated due to break size",                requiresHuman: true,  requiresApproval: false },
    { from: "approved",                  to: "completed",                   trigger: "entries_posted",        description: "Human posted entries in source system",      requiresHuman: true,  requiresApproval: false },
    { from: "rejected",                  to: "generating_recommendations",  trigger: "revise",                description: "Agent revises proposals",                    requiresHuman: false, requiresApproval: false },
    { from: "identifying_breaks",        to: "exception",                   trigger: "exception_raised",      description: "Data integrity exception",                   requiresHuman: false, requiresApproval: false },
  ],
};
