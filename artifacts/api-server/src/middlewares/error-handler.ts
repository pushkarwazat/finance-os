/**
 * Centralised error handler middleware
 *
 * Must be registered LAST in the Express middleware chain (after all routes).
 * Translates AppError subclasses and unknown errors into consistent JSON
 * error responses matching the ErrorResponse schema in the OpenAPI spec.
 *
 * Response shape:
 *   { error: string, message: string, statusCode: number, requestId?: string, details?: unknown }
 */

import type { Request, Response, NextFunction } from "express";
import { isAppError } from "@financeos/shared";

export function errorHandlerMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = res.locals.requestId as string | undefined;
  const log = req.log ?? { error: () => {} };

  if (isAppError(err)) {
    // Structured, known error — log at warn unless 5xx
    const logFn = err.statusCode >= 500 ? log.error.bind(log) : (log as { warn?: (...args: unknown[]) => void }).warn?.bind(log) ?? log.error.bind(log);
    logFn({ err, requestId, code: err.code }, err.message);

    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      statusCode: err.statusCode,
      ...(requestId ? { requestId } : {}),
      ...(err.details ? { details: err.details } : {}),
    });
    return;
  }

  if (err instanceof SyntaxError && "body" in err) {
    // JSON parse error from express.json()
    res.status(400).json({
      error: "bad_request",
      message: "Invalid JSON in request body",
      statusCode: 400,
      ...(requestId ? { requestId } : {}),
    });
    return;
  }

  // Unknown / unhandled error — log at error level (no stack to the client)
  log.error({ err, requestId }, "Unhandled error");

  res.status(500).json({
    error: "internal_error",
    message: "An unexpected error occurred",
    statusCode: 500,
    ...(requestId ? { requestId } : {}),
  });
}
