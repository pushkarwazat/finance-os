/**
 * Audit Log API
 *
 * In-memory audit log store. In production, replace the in-memory store
 * with a write-once database table (append-only) or route to your SIEM.
 *
 * GET  /api/audit-log          — query events (requires governance:read)
 * POST /api/audit-log/events   — emit an event (internal; requires governance:write or admin:full)
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { AuditEvent } from "@financeos/shared";
import { requirePermission } from "../middlewares/require-permission.js";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// In-memory store — replace with a durable backend in production
// ─────────────────────────────────────────────────────────────────────────────

const auditStore: AuditEvent[] = [
  {
    id: randomUUID(),
    actorId: "u1000000-0000-0000-0000-000000000001",
    actorName: "James Okafor",
    actorRole: "cfo",
    action: "approval.granted",
    resourceType: "ApprovalRequest",
    resourceId: randomUUID(),
    resourceLabel: "Q3 Revenue Recognition — Manual Adjustment",
    outcome: "success",
    timestamp: new Date(Date.now() - 3 * 60_000).toISOString(),
    details: { amount: 2_400_000, currency: "USD" },
  },
  {
    id: randomUUID(),
    actorId: "u2000000-0000-0000-0000-000000000002",
    actorName: "Sarah Chen",
    actorRole: "controller",
    action: "exception.created",
    resourceType: "Exception",
    resourceId: randomUUID(),
    resourceLabel: "Vendor Payment Threshold Override — Acme Supplies",
    outcome: "success",
    timestamp: new Date(Date.now() - 18 * 60_000).toISOString(),
    details: { thresholdUSD: 500_000, reason: "strategic-vendor" },
  },
  {
    id: randomUUID(),
    actorId: "u3000000-0000-0000-0000-000000000003",
    actorName: "Marcus Johnson",
    actorRole: "analyst",
    action: "report.exported",
    resourceType: "Report",
    resourceId: randomUUID(),
    resourceLabel: "Board Pack Q3 FY24",
    outcome: "success",
    timestamp: new Date(Date.now() - 45 * 60_000).toISOString(),
    details: { format: "PDF", pages: 42 },
  },
  {
    id: randomUUID(),
    actorId: "u4000000-0000-0000-0000-000000000004",
    actorName: "External API",
    actorRole: "viewer",
    action: "metrics.read",
    resourceType: "MetricSet",
    resourceId: randomUUID(),
    resourceLabel: "Gross Margin — restricted segment",
    outcome: "denied",
    timestamp: new Date(Date.now() - 2 * 3600_000).toISOString(),
    details: { reason: "insufficient-role" },
  },
];

/**
 * Append an event to the audit store.
 * Call this from route handlers when sensitive actions occur.
 */
export function emitAuditEvent(
  partial: Omit<AuditEvent, "id" | "timestamp">,
): AuditEvent {
  const event: AuditEvent = {
    ...partial,
    id: randomUUID(),
    timestamp: new Date().toISOString(),
  };
  auditStore.unshift(event);
  // Cap in-memory store at 1 000 events
  if (auditStore.length > 1_000) auditStore.splice(1_000);
  return event;
}

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

// GET /api/audit-log — query events
router.get(
  "/audit-log",
  requirePermission("governance:read"),
  (req, res) => {
    const { actorId, action, resourceType, outcome, limit, offset } = req.query;

    let events = [...auditStore];

    if (typeof actorId === "string") {
      events = events.filter((e) => e.actorId === actorId);
    }
    if (typeof action === "string") {
      events = events.filter((e) => e.action.includes(action));
    }
    if (typeof resourceType === "string") {
      events = events.filter((e) => e.resourceType === resourceType);
    }
    if (typeof outcome === "string") {
      events = events.filter((e) => e.outcome === outcome);
    }

    const total = events.length;
    const off = Number(offset ?? 0);
    const lim = Math.min(Number(limit ?? 50), 200);
    const page = events.slice(off, off + lim);

    res.json({ events: page, total, offset: off, limit: lim });
  },
);

// POST /api/audit-log/events — emit an event programmatically
router.post(
  "/audit-log/events",
  requirePermission("governance:write"),
  (req, res) => {
    const user = res.locals.user;
    const body = req.body as Partial<AuditEvent>;
    const event = emitAuditEvent({
      actorId: body.actorId ?? user.id,
      actorName: body.actorName ?? user.name,
      actorRole: body.actorRole ?? (user.role as AuditEvent["actorRole"]),
      action: body.action ?? "unknown",
      resourceType: body.resourceType ?? "Unknown",
      resourceId: body.resourceId ?? randomUUID(),
      resourceLabel: body.resourceLabel ?? "",
      outcome: body.outcome ?? "success",
      details: body.details ?? {},
    });
    res.status(201).json(event);
  },
);

export default router;
