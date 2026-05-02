/**
 * Structured logging contracts for FinanceOS.
 *
 * Every service/package that needs logging MUST import from here, not from
 * pino directly. This ensures a consistent field schema across all log lines.
 *
 * Adapter implementations should inject a Logger instance via the DI container
 * (see packages/container) rather than creating their own.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Logger interface — decoupled from pino, mockable in tests
// ─────────────────────────────────────────────────────────────────────────────

export interface LogContext {
  /** Correlation ID that spans a full user request. */
  requestId?: string;
  /** Distributed trace ID for cross-service correlation (e.g. OpenTelemetry). */
  traceId?: string;
  /** Which adapter produced this log line. */
  adapterName?: string;
  /** Which AI model handled this call. */
  modelId?: string;
  /** Tenant isolating this request. */
  tenantId?: string;
  /** Duration in milliseconds for timed operations. */
  durationMs?: number;
  /** Any extra key-value pairs (avoid sensitive data). */
  [key: string]: unknown;
}

export interface Logger {
  trace(context: LogContext, message: string): void;
  debug(context: LogContext, message: string): void;
  info(context: LogContext, message: string): void;
  warn(context: LogContext, message: string): void;
  error(context: LogContext & { err?: Error }, message: string): void;
  fatal(context: LogContext & { err?: Error }, message: string): void;
  child(bindings: LogContext): Logger;
}

// ─────────────────────────────────────────────────────────────────────────────
// Standard log event shapes — import these as types in route handlers/adapters
// ─────────────────────────────────────────────────────────────────────────────

export interface RequestLogEvent extends LogContext {
  requestId: string;
  method: string;
  path: string;
  statusCode?: number;
  durationMs?: number;
  userAgent?: string;
}

export interface AdapterCallEvent extends LogContext {
  adapterName: string;
  operation: string;
  durationMs: number;
  success: boolean;
  errorCode?: string;
}

export interface LlmCallEvent extends LogContext {
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  durationMs: number;
  cached: boolean;
  hallucinationRisk?: "low" | "medium" | "high";
}

export interface EvalRunEvent extends LogContext {
  suiteId: string;
  runId: string;
  caseCount: number;
  passCount: number;
  failCount: number;
  passRate: number;
  durationMs: number;
}

export interface WorkflowTransitionEvent extends LogContext {
  workflowRunId: string;
  workflowType: string;
  fromState: string;
  toState: string;
  trigger: string;
  actor: string;
}

export interface AuditLogEvent extends LogContext {
  eventType: string;
  actorId: string;
  actorRole: string;
  resourceType: string;
  resourceId: string;
  action: string;
  outcome: "allowed" | "denied" | "abstained";
}

// ─────────────────────────────────────────────────────────────────────────────
// No-op logger — use in tests or when no real logger is injected
// ─────────────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

export const noopLogger: Logger = {
  trace: noop,
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,
  fatal: noop,
  child: () => noopLogger,
};

// ─────────────────────────────────────────────────────────────────────────────
// Redacted field list — never log these
// ─────────────────────────────────────────────────────────────────────────────

export const REDACTED_FIELDS = [
  "password",
  "secret",
  "token",
  "apiKey",
  "api_key",
  "authorization",
  "cookie",
  "ssn",
  "credit_card",
  "private_key",
] as const;

export type RedactedField = (typeof REDACTED_FIELDS)[number];
