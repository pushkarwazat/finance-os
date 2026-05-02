/**
 * Health check endpoints
 *
 * GET /api/healthz        — liveness probe (fast, no external calls)
 * GET /api/healthz/ready  — readiness probe (checks all adapter slots)
 *
 * Kubernetes / ECS liveness:   GET /api/healthz        → 200 always (process is alive)
 * Kubernetes / ECS readiness:  GET /api/healthz/ready  → 200 ok | 503 degraded/down
 *
 * TODO: Wire container.healthCheckAll() once real adapters are registered.
 * See docs/onboarding/ for each adapter setup guide.
 */

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const START_TIME = Date.now();

// ─────────────────────────────────────────────────────────────────────────────
// Liveness — confirms the process is running, no external I/O
// ─────────────────────────────────────────────────────────────────────────────

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// ─────────────────────────────────────────────────────────────────────────────
// Readiness — probes all 6 adapter slots via the DI container
// ─────────────────────────────────────────────────────────────────────────────

router.get("/healthz/ready", async (req, res) => {
  const requestId = res.locals.requestId as string | undefined;

  // TODO: Register real adapters in index.ts before deploying.
  // See docs/onboarding/ for each adapter. Stub adapters report connected:false.
  let adapterHealth: Record<string, {
    ok: boolean; name: string; stub: boolean; latencyMs?: number; error?: string;
  }> = {};

  try {
    const { container } = await import("@financeos/container");
    adapterHealth = await container.healthCheckAll();
  } catch (err) {
    req.log.error({ err, requestId }, "healthCheckAll failed — container unavailable");
  }

  const keys = Object.keys(adapterHealth);
  const allOk = keys.length > 0 && keys.every((k) => adapterHealth[k].ok);
  const anyStub = keys.some((k) => adapterHealth[k].stub);
  const status = allOk ? "ok" : anyStub ? "degraded" : "down";

  res.status(allOk ? 200 : 503).json({
    status,
    version: process.env.npm_package_version ?? "0.0.0",
    uptimeSeconds: Math.floor((Date.now() - START_TIME) / 1000),
    requestId,
    note: anyStub
      ? "One or more adapters are stubs — see docs/onboarding/ to wire real connectors."
      : undefined,
    dependencies: adapterHealth,
  });
});

export default router;
