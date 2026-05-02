/**
 * Request ID + Trace ID middleware
 *
 * Assigns every inbound HTTP request a unique requestId and optionally
 * propagates a distributed traceId from upstream systems (e.g. an API
 * gateway, load balancer, or OpenTelemetry collector).
 *
 * IDs are attached to:
 *  - res.locals  (accessible in route handlers via res.locals.requestId)
 *  - response headers (X-Request-Id, X-Trace-Id) for client correlation
 *
 * pino-http independently generates a request ID via genReqId in app.ts
 * and binds it to req.log automatically — no manual pino augmentation needed here.
 */

import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

declare global {
  namespace Express {
    interface Locals {
      requestId: string;
      traceId: string;
    }
  }
}

/**
 * Header names we accept from upstream systems.
 * The first match wins.
 */
const REQUEST_ID_HEADERS = ["x-request-id", "x-correlation-id", "cf-ray"] as const;
const TRACE_ID_HEADERS = ["x-trace-id", "traceparent", "x-b3-traceid"] as const;

function extractHeader(req: Request, headers: readonly string[]): string | undefined {
  for (const header of headers) {
    const value = req.headers[header];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const requestId = extractHeader(req, REQUEST_ID_HEADERS) ?? randomUUID();
  const traceId = extractHeader(req, TRACE_ID_HEADERS) ?? requestId;

  res.locals.requestId = requestId;
  res.locals.traceId = traceId;

  res.setHeader("X-Request-Id", requestId);
  res.setHeader("X-Trace-Id", traceId);

  next();
}
