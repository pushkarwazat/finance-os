/**
 * Consistent application error types for FinanceOS.
 *
 * All thrown/returned errors must extend AppError so that
 * the error-handler middleware can serialise them uniformly.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Error codes — machine-readable, never change existing values
// ─────────────────────────────────────────────────────────────────────────────

export const ERROR_CODES = {
  // Generic
  INTERNAL: "internal_error",
  NOT_FOUND: "not_found",
  BAD_REQUEST: "bad_request",
  VALIDATION: "validation_error",
  CONFLICT: "conflict",
  RATE_LIMITED: "rate_limited",

  // Auth
  UNAUTHORIZED: "unauthorized",
  FORBIDDEN: "forbidden",
  TOKEN_EXPIRED: "token_expired",

  // Domain
  ADAPTER_UNAVAILABLE: "adapter_unavailable",
  ADAPTER_TIMEOUT: "adapter_timeout",
  ADAPTER_MISCONFIGURED: "adapter_misconfigured",
  QUERY_PARSE_FAILED: "query_parse_failed",
  ABSTENTION: "abstention",
  APPROVAL_REQUIRED: "approval_required",
  WORKFLOW_INVALID_TRANSITION: "workflow_invalid_transition",
  EVAL_RUN_NOT_FOUND: "eval_run_not_found",
  POLICY_VIOLATION: "policy_violation",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

// ─────────────────────────────────────────────────────────────────────────────
// Base error class
// ─────────────────────────────────────────────────────────────────────────────

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;
  readonly requestId?: string;

  constructor(opts: {
    code: ErrorCode;
    message: string;
    statusCode?: number;
    details?: unknown;
    requestId?: string;
    cause?: Error;
  }) {
    super(opts.message, { cause: opts.cause });
    this.name = "AppError";
    this.code = opts.code;
    this.statusCode = opts.statusCode ?? 500;
    this.details = opts.details;
    this.requestId = opts.requestId;

    // Maintain proper prototype chain in transpiled code
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: this.code,
      message: this.message,
      statusCode: this.statusCode,
      ...(this.requestId ? { requestId: this.requestId } : {}),
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Typed subclasses — one per logical category
// ─────────────────────────────────────────────────────────────────────────────

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string, requestId?: string) {
    super({
      code: ERROR_CODES.NOT_FOUND,
      message: id ? `${resource} '${id}' not found` : `${resource} not found`,
      statusCode: 404,
      requestId,
    });
    this.name = "NotFoundError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown, requestId?: string) {
    super({
      code: ERROR_CODES.VALIDATION,
      message,
      statusCode: 400,
      details,
      requestId,
    });
    this.name = "ValidationError";
  }
}

export class BadRequestError extends AppError {
  constructor(message: string, requestId?: string) {
    super({ code: ERROR_CODES.BAD_REQUEST, message, statusCode: 400, requestId });
    this.name = "BadRequestError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Authentication required", requestId?: string) {
    super({ code: ERROR_CODES.UNAUTHORIZED, message, statusCode: 401, requestId });
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Insufficient permissions", requestId?: string) {
    super({ code: ERROR_CODES.FORBIDDEN, message, statusCode: 403, requestId });
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, requestId?: string) {
    super({ code: ERROR_CODES.CONFLICT, message, statusCode: 409, requestId });
    this.name = "ConflictError";
  }
}

export class AdapterUnavailableError extends AppError {
  readonly adapterName: string;
  constructor(adapterName: string, cause?: Error, requestId?: string) {
    super({
      code: ERROR_CODES.ADAPTER_UNAVAILABLE,
      message: `Adapter '${adapterName}' is not available. Plug in a real implementation — see docs/onboarding/.`,
      statusCode: 503,
      cause,
      requestId,
    });
    this.name = "AdapterUnavailableError";
    this.adapterName = adapterName;
  }
}

export class AdapterTimeoutError extends AppError {
  constructor(adapterName: string, timeoutMs: number, requestId?: string) {
    super({
      code: ERROR_CODES.ADAPTER_TIMEOUT,
      message: `Adapter '${adapterName}' timed out after ${timeoutMs}ms`,
      statusCode: 504,
      requestId,
    });
    this.name = "AdapterTimeoutError";
  }
}

export class AbstentionError extends AppError {
  constructor(reason: string, requestId?: string) {
    super({
      code: ERROR_CODES.ABSTENTION,
      message: `Query abstained: ${reason}`,
      statusCode: 422,
      requestId,
    });
    this.name = "AbstentionError";
  }
}

export class PolicyViolationError extends AppError {
  constructor(policy: string, requestId?: string) {
    super({
      code: ERROR_CODES.POLICY_VIOLATION,
      message: `Request blocked by policy: ${policy}`,
      statusCode: 403,
      requestId,
    });
    this.name = "PolicyViolationError";
  }
}

export class WorkflowTransitionError extends AppError {
  constructor(from: string, trigger: string, requestId?: string) {
    super({
      code: ERROR_CODES.WORKFLOW_INVALID_TRANSITION,
      message: `Invalid workflow transition '${trigger}' from state '${from}'`,
      statusCode: 422,
      requestId,
    });
    this.name = "WorkflowTransitionError";
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Type guard
// ─────────────────────────────────────────────────────────────────────────────

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
