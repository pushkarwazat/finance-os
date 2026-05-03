/**
 * Authentication middleware
 *
 * Validates the `Authorization: Bearer <token>` header on every request.
 * Populates `res.locals.user` with the authenticated user for downstream
 * route handlers and RBAC checks.
 *
 * In development mode, the special token "dev-session" is accepted and
 * maps to the built-in CFO stub user — replace with a real OIDC/JWT
 * validator in production. See docs/onboarding/06-auth-rbac.md.
 */

import { randomUUID } from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import { StubAuthProviderAdapter, type AuthenticatedUser } from "@financeos/adapters";
import { UnauthorizedError } from "@financeos/shared";

// ─────────────────────────────────────────────────────────────────────────────
// Extend Express.Locals so TypeScript knows res.locals.user is available
// ─────────────────────────────────────────────────────────────────────────────

declare global {
  namespace Express {
    interface Locals {
      user: AuthenticatedUser;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dev stub user — matches the hardcoded actor in governance mock data
// ─────────────────────────────────────────────────────────────────────────────

const DEV_USER: AuthenticatedUser = {
  id: "u1000000-0000-0000-0000-000000000001",
  email: "james.okafor@company.com",
  name: "James Okafor",
  role: "cfo",
  groups: ["finance-leadership", "cfo-office"],
  tenantId: "tenant-acme",
  expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
  claims: { department: "Finance", costCenter: "CC-001" },
};

const authProvider = new StubAuthProviderAdapter();

// ─────────────────────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────────────────────

export async function authenticateMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new UnauthorizedError(
        "Missing or malformed Authorization header. Expected: Bearer <token>",
      ),
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next(new UnauthorizedError("Empty bearer token"));
  }

  // Development shortcut — never active in production
  if (process.env.NODE_ENV === "development" && token === "dev-session") {
    res.locals.user = {
      ...DEV_USER,
      // Refresh expiry on each request so dev sessions don't expire mid-session
      expiresAt: new Date(Date.now() + 8 * 3600_000).toISOString(),
    };
    req.log?.debug({ userId: DEV_USER.id, role: DEV_USER.role }, "dev-session authenticated");
    return next();
  }

  const requestId = res.locals.requestId ?? randomUUID();
  const result = await authProvider.validateToken(token, requestId);

  if (!result.valid || !result.user) {
    req.log?.warn({ requestId, errorCode: result.errorCode }, "Token validation failed");
    return next(new UnauthorizedError(result.error ?? "Invalid or expired token"));
  }

  res.locals.user = result.user;
  req.log?.debug(
    { userId: result.user.id, role: result.user.role },
    "Request authenticated",
  );
  next();
}
