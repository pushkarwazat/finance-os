import { z } from "zod";
import type { EscalationRule } from "../workflow/exception.js";
import type { StateMachineDefinition } from "../workflow/workflow-run.js";

// ─────────────────────────────────────────────────────────────────────────────
// Covenant Monitoring Agent
// Purpose: Periodic computation of debt covenant metrics, threshold comparison,
//          early-warning alerting, and waiver-process initiation drafts.
//
// Rules:
//   - Any covenant breach immediately escalates to CFO + notifies Legal.
//   - Waiver request drafts require CFO approval before sending to lender.
//   - Agent never directly communicates with external parties.
// ─────────────────────────────────────────────────────────────────────────────

export const CovenantMonitoringAgentConfigSchema = z.object({
  agentId: z.literal("covenant-monitoring-v1"),
  displayName: z.literal("Covenant Monitoring"),
  description: z.literal(
    "Computes debt covenant metrics (leverage ratio, DSCR, current ratio) on each test date, alerts on breach or watch-list proximity, and drafts waiver request documentation for CFO review."
  ),
  version: z.string().default("1.0.0"),

  input: z.object({
    testDate: z.string().describe("ISO date of the covenant test"),
    covenantIds: z.array(z.string()).default([]).describe("Empty = test all active covenants"),
    entityId: z.string().describe("Legal entity being tested"),
    watchThresholdPct: z.number().default(0.10).describe("Flag as watch if within 10% of limit"),
  }),

  output: z.object({
    testDate: z.string(),
    entityId: z.string(),
    results: z.array(
      z.object({
        covenantId: z.string(),
        covenantName: z.string(),
        metricSlug: z.string(),
        computedValue: z.number(),
        thresholdValue: z.number(),
        direction: z.enum(["max", "min"]),
        headroomAbs: z.number(),
        headroomPct: z.number(),
        status: z.enum(["compliant", "watch", "breach"]),
        requiresWaiver: z.boolean(),
        evidenceIds: z.array(z.string()),
      })
    ),
    overallStatus: z.enum(["all_compliant", "watch_list", "breach"]),
    breachCount: z.number().int(),
    watchCount: z.number().int(),
    draftWaiverRequest: z.object({
      covenantId: z.string(),
      breachedValue: z.number(),
      requiredValue: z.number(),
      proposedRemediation: z.string(),
      status: z.literal("draft"),
    }).optional().describe("Draft only — requires CFO approval before any lender contact"),
    certificationDraft: z.string().optional().describe("Draft compliance certificate for CFO sign-off"),
  }),

  requiredTools: z.array(z.string()).default([
    "fetch_covenant_definitions",
    "query_leverage_ratio",
    "query_dscr",
    "query_current_ratio",
    "query_fixed_charge_coverage",
    "compare_to_thresholds",
    "draft_waiver_request",
    "draft_compliance_certificate",
    "create_critical_alert",
  ]),
});

export type CovenantMonitoringAgentConfig = z.infer<typeof CovenantMonitoringAgentConfigSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// State machine
// ─────────────────────────────────────────────────────────────────────────────

export const COVENANT_MONITORING_STATE_MACHINE: StateMachineDefinition = {
  workflowType: "covenant_monitoring",
  initialState: "idle",
  terminalStates: ["complete"],
  humanGatedStates: [
    "awaiting_cfo_waiver_approval",
    "awaiting_controller_acknowledgement",
    "awaiting_cfo_certification",
    "error",
  ],
  transitions: [
    { from: "idle",                              to: "computing_metrics",                  trigger: "START_COVENANT_TEST",       description: "Begin covenant test run",                             requiresHuman: false, requiresApproval: false },
    { from: "computing_metrics",                 to: "evaluating_thresholds",              trigger: "METRICS_COMPUTED",          description: "Metrics computed; evaluate thresholds",               requiresHuman: false, requiresApproval: false },
    { from: "computing_metrics",                 to: "error",                              trigger: "COMPUTE_FAILED",            description: "Metric computation failed",                           requiresHuman: false, requiresApproval: false },
    { from: "evaluating_thresholds",             to: "escalating_breach",                  trigger: "BREACH_DETECTED",           description: "CRITICAL: covenant breach detected — escalate",       requiresHuman: false, requiresApproval: false },
    { from: "evaluating_thresholds",             to: "drafting_watch_report",              trigger: "WATCH_DETECTED",            description: "Watch-list metric detected; draft report",            requiresHuman: false, requiresApproval: false },
    { from: "evaluating_thresholds",             to: "drafting_certificate",               trigger: "ALL_COMPLIANT",             description: "All compliant; draft certification",                  requiresHuman: false, requiresApproval: false },
    { from: "escalating_breach",                 to: "drafting_waiver_request",            trigger: "ESCALATION_SENT",           description: "Escalation sent; draft waiver request",               requiresHuman: false, requiresApproval: false },
    { from: "drafting_waiver_request",           to: "awaiting_cfo_waiver_approval",       trigger: "DRAFT_READY",               description: "Waiver draft ready for CFO",                          requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_cfo_waiver_approval",      to: "complete",                           trigger: "WAIVER_APPROVED",           description: "CFO approved waiver; process complete",               requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_cfo_waiver_approval",      to: "drafting_waiver_request",            trigger: "WAIVER_REJECTED",           description: "CFO rejected waiver; revise",                         requiresHuman: true,  requiresApproval: false },
    { from: "drafting_watch_report",             to: "awaiting_controller_acknowledgement",trigger: "REPORT_READY",              description: "Watch report ready; Controller acknowledgement",      requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_controller_acknowledgement",to: "drafting_certificate",              trigger: "ACKNOWLEDGED",              description: "Controller acknowledged; draft certificate",           requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_controller_acknowledgement",to: "escalating_breach",                 trigger: "ESCALATE_TO_CFO",           description: "Controller escalated to CFO",                         requiresHuman: true,  requiresApproval: false },
    { from: "drafting_certificate",              to: "awaiting_cfo_certification",         trigger: "CERTIFICATE_READY",         description: "Certificate ready for CFO sign-off",                  requiresHuman: true,  requiresApproval: false },
    { from: "awaiting_cfo_certification",        to: "complete",                           trigger: "CERTIFIED",                 description: "CFO certified compliance; complete",                  requiresHuman: true,  requiresApproval: true  },
    { from: "awaiting_cfo_certification",        to: "computing_metrics",                  trigger: "CERTIFICATION_REJECTED",    description: "Certification rejected; recompute",                   requiresHuman: true,  requiresApproval: false },
    { from: "error",                             to: "computing_metrics",                  trigger: "RETRY",                     description: "Retry",                                               requiresHuman: true,  requiresApproval: false },
    { from: "error",                             to: "complete",                           trigger: "ABORT",                     description: "Abort",                                               requiresHuman: true,  requiresApproval: false },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Escalation rules
// ─────────────────────────────────────────────────────────────────────────────

export const COVENANT_ESCALATION_RULES: EscalationRule[] = [
  {
    condition: "covenant status == breach — immediate CFO and Legal notification required",
    category: "threshold_breach",
    severity: "critical",
    notifyRoles: ["controller", "cfo"],
    autoEscalateAfterSeconds: 3600,
  },
  {
    condition: "covenant headroom_pct < 10% — added to watch list, Controller acknowledgement required",
    category: "threshold_breach",
    severity: "medium",
    notifyRoles: ["finance_manager", "controller"],
    autoEscalateAfterSeconds: 86400,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Covenant compliance report schema
// ─────────────────────────────────────────────────────────────────────────────

export const CovenantComplianceReportSchema = z.object({
  id: z.string().uuid(),
  testDate: z.string(),
  entityId: z.string(),
  overallStatus: z.enum(["all_compliant", "watch_list", "breach"]),
  results: z.array(
    z.object({
      covenantId: z.string(),
      covenantName: z.string(),
      metricSlug: z.string(),
      computedValue: z.number(),
      thresholdValue: z.number(),
      headroomPct: z.number(),
      status: z.enum(["compliant", "watch", "breach"]),
    })
  ),
  certifiedBy: z.string().optional(),
  certifiedAt: z.string().datetime().optional(),
  waiverRequestedFor: z.array(z.string()).default([]),
  reportDocumentId: z.string().uuid().optional(),
  createdAt: z.string().datetime(),
});
export type CovenantComplianceReport = z.infer<typeof CovenantComplianceReportSchema>;
