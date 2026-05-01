import { Router } from "express";
import {
  ListApprovalsQueryParams,
  DecideApprovalParams,
  DecideApprovalBody,
  ListAuditEventsQueryParams,
} from "@workspace/api-zod";
import { MOCK_APPROVALS, MOCK_AUDIT_EVENTS, MOCK_POLICIES } from "../data/fixtures.js";

const router = Router();
const approvals = MOCK_APPROVALS.map((a) => ({ ...a }));
const auditEvents = [...MOCK_AUDIT_EVENTS];

router.get("/governance/approvals", (req, res) => {
  const parsed = ListApprovalsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const { status, resourceType, limit = 30 } = parsed.data;
  let filtered = approvals;
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (resourceType) filtered = filtered.filter((a) => a.resourceType === resourceType);
  res.json({ data: filtered.slice(0, limit), total: filtered.length });
});

router.post("/governance/approvals/:id/decide", (req, res) => {
  const paramsParsed = DecideApprovalParams.safeParse(req.params);
  const bodyParsed = DecideApprovalBody.safeParse(req.body);
  if (!paramsParsed.success || !bodyParsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const idx = approvals.findIndex((a) => a.id === paramsParsed.data.id);
  if (idx === -1) {
    res.status(404).json({ error: "not_found", statusCode: 404, message: "Approval not found" });
    return;
  }
  const approval = approvals[idx];
  approval.status = bodyParsed.data.decision === "approved" ? "approved" : "rejected";
  approval.updatedAt = new Date().toISOString();
  approval.resolvedAt = new Date().toISOString();
  approvals[idx] = approval;
  auditEvents.push({
    id: crypto.randomUUID(),
    actorId: "u1000000-0000-0000-0000-000000000004",
    actorName: "James Okafor",
    actorRole: "cfo",
    action: `approval.${bodyParsed.data.decision}`,
    resourceType: approval.resourceType,
    resourceId: approval.resourceId,
    resourceLabel: approval.resourceLabel,
    timestamp: new Date().toISOString(),
    outcome: "success",
    details: { comment: bodyParsed.data.comment ?? null },
  });
  res.json(approval);
});

router.get("/governance/audit", (req, res) => {
  const parsed = ListAuditEventsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "bad_request", statusCode: 400 });
    return;
  }
  const { actorId, resourceType, action, since, limit = 50, offset = 0 } = parsed.data;
  let filtered = [...auditEvents].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  if (actorId) filtered = filtered.filter((e) => e.actorId === actorId);
  if (resourceType) filtered = filtered.filter((e) => e.resourceType === resourceType);
  if (action) filtered = filtered.filter((e) => e.action.includes(action));
  if (since) filtered = filtered.filter((e) => new Date(e.timestamp) >= new Date(since));
  const total = filtered.length;
  res.json({ data: filtered.slice(offset, offset + limit), total });
});

router.get("/governance/policies", (_req, res) => {
  res.json({ data: MOCK_POLICIES, total: MOCK_POLICIES.length });
});

export default router;
