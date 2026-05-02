import { Router } from "express";
import type { ApprovalStep, Exception, WorkflowType } from "@financeos/agents";
import {
  seedDemoRuns,
  listRuns,
  getRun,
  createRun,
  listApprovals,
  getApproval,
  decideApproval,
  listExceptions,
  getException,
  resolveException,
  listActions,
  getExplanation,
  routeRequest,
  AGENT_REGISTRY,
  TOOL_CATALOG,
} from "@financeos/agents";

const router = Router();

// Seed demo data once on first import
seedDemoRuns();

// ─────────────────────────────────────────────────────────────────────────────
// Workflow runs
// ─────────────────────────────────────────────────────────────────────────────

router.get("/workflows/runs", (req, res) => {
  const { workflowType, status, limit = "20", offset = "0" } = req.query as Record<string, string>;
  let runs = listRuns();
  if (workflowType) runs = runs.filter((r) => r.workflowType === workflowType);
  if (status) runs = runs.filter((r) => r.status === status);
  const total = runs.length;
  const data = runs.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ data, total, limit: Number(limit), offset: Number(offset) });
});

router.get("/workflows/runs/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) { res.status(404).json({ error: "not_found", statusCode: 404 }); return; }

  // Hydrate explanations
  const explanations = run.explanationIds.map((id) => getExplanation(id)).filter(Boolean);
  res.json({ ...run, explanations });
});

router.post("/workflows/runs", (req, res) => {
  const { workflowType, payload = {} } = req.body as { workflowType: WorkflowType; payload?: Record<string, unknown> };
  if (!workflowType) {
    res.status(400).json({ error: "workflowType is required", statusCode: 400 });
    return;
  }
  const run = createRun(workflowType, payload);
  res.status(201).json(run);
});

// ─────────────────────────────────────────────────────────────────────────────
// Approvals
// ─────────────────────────────────────────────────────────────────────────────

router.get("/workflows/approvals", (req, res) => {
  const { status } = req.query as Record<string, string>;
  const data = listApprovals(status as ApprovalStep["status"] | undefined);
  res.json({ data, total: data.length });
});

router.get("/workflows/approvals/:id", (req, res) => {
  const ap = getApproval(req.params.id);
  if (!ap) { res.status(404).json({ error: "not_found", statusCode: 404 }); return; }
  res.json(ap);
});

router.post("/workflows/approvals/:id/decide", (req, res) => {
  const { decision, decidedBy = "system", note } = req.body as {
    decision: "approved" | "rejected";
    decidedBy?: string;
    note?: string;
  };
  if (!decision || !["approved", "rejected"].includes(decision)) {
    res.status(400).json({ error: "decision must be 'approved' or 'rejected'", statusCode: 400 });
    return;
  }
  const ap = decideApproval(req.params.id, decision, decidedBy, note);
  if (!ap) { res.status(404).json({ error: "not_found", statusCode: 404 }); return; }
  res.json(ap);
});

// ─────────────────────────────────────────────────────────────────────────────
// Exceptions
// ─────────────────────────────────────────────────────────────────────────────

router.get("/workflows/exceptions", (req, res) => {
  const { status, severity } = req.query as Record<string, string>;
  let data = listExceptions(status as Exception["status"] | undefined);
  if (severity) data = data.filter((e) => e.severity === severity);
  res.json({ data, total: data.length });
});

router.get("/workflows/exceptions/:id", (req, res) => {
  const ex = getException(req.params.id);
  if (!ex) { res.status(404).json({ error: "not_found", statusCode: 404 }); return; }
  res.json(ex);
});

router.post("/workflows/exceptions/:id/resolve", (req, res) => {
  const { resolvedBy = "system", note = "", waive = false } = req.body as {
    resolvedBy?: string;
    note?: string;
    waive?: boolean;
  };
  const ex = resolveException(req.params.id, resolvedBy, note, waive);
  if (!ex) { res.status(404).json({ error: "not_found", statusCode: 404 }); return; }
  res.json(ex);
});

// ─────────────────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────────────────

router.get("/workflows/actions", (_req, res) => {
  const data = listActions();
  res.json({ data, total: data.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// Agent registry
// ─────────────────────────────────────────────────────────────────────────────

router.get("/workflows/agents", (_req, res) => {
  res.json({ data: AGENT_REGISTRY, total: AGENT_REGISTRY.length });
});

router.get("/workflows/agents/:agentId", (req, res) => {
  const agent = AGENT_REGISTRY.find((a) => a.agentId === req.params.agentId);
  if (!agent) { res.status(404).json({ error: "not_found", statusCode: 404 }); return; }
  res.json(agent);
});

router.get("/workflows/tools", (_req, res) => {
  res.json({ data: TOOL_CATALOG, total: TOOL_CATALOG.length });
});

// ─────────────────────────────────────────────────────────────────────────────
// Orchestrator routing
// ─────────────────────────────────────────────────────────────────────────────

router.post("/workflows/orchestrate", (req, res) => {
  const { query, context = {} } = req.body as { query: string; context?: Record<string, unknown> };
  if (!query) {
    res.status(400).json({ error: "query is required", statusCode: 400 });
    return;
  }
  const routing = routeRequest(query, context);
  res.json(routing);
});

export default router;
