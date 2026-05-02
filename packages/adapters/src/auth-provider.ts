/**
 * Auth & RBAC Provider Adapter Interface
 *
 * Abstracts the identity provider and authorization layer
 * (Auth0, Okta, Azure AD / Entra ID, Cognito, Clerk, a custom SAML/OIDC
 * provider, etc.) and the RBAC engine.
 *
 * TODO: Replace the stub with a real auth provider connector.
 * See: docs/onboarding/06-auth-rbac.md
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthenticatedUser {
  /** Stable user ID from the identity provider. */
  id: string;
  email: string;
  name: string;
  /** Canonical FinanceOS role resolved from IdP groups/claims. */
  role: string;
  /** Raw IdP groups for advanced RBAC rules. */
  groups?: string[];
  /** Tenant this user belongs to. */
  tenantId: string;
  /** ISO 8601 token expiry. */
  expiresAt: string;
  /** Additional claims from the IdP JWT. */
  claims?: Record<string, unknown>;
}

export interface TokenValidationResult {
  valid: boolean;
  user?: AuthenticatedUser;
  /** Machine-readable error code if invalid. */
  errorCode?: "expired" | "invalid_signature" | "revoked" | "malformed" | "unknown";
  error?: string;
}

export interface Permission {
  /** Action in "resource:verb" format, e.g. "metrics:read". */
  action: string;
  /** Optional resource scope (e.g. specific tenantId or document type). */
  scope?: string;
}

export interface AuthorizationRequest {
  user: AuthenticatedUser;
  permission: Permission;
  /** Arbitrary resource context (fiscalPeriod, documentId, etc.). */
  resourceContext?: Record<string, unknown>;
}

export interface AuthorizationResult {
  allowed: boolean;
  /** Why this decision was made — written to the audit log. */
  reason: string;
  /** Policies that were evaluated. */
  policiesEvaluated?: string[];
}

export interface UserLookupResult {
  found: boolean;
  user?: AuthenticatedUser;
}

export interface AuthProviderHealthStatus {
  available: boolean;
  latencyMs?: number;
  providerVersion?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Adapter interface
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthProviderAdapter {
  readonly name: string;

  /**
   * Validate a bearer token (JWT or opaque) and return the authenticated user.
   * Called on every request by the auth middleware.
   */
  validateToken(token: string, requestId?: string): Promise<TokenValidationResult>;

  /**
   * Check whether a user is authorised to perform an action.
   * The result is written to the audit log regardless of outcome.
   */
  authorize(request: AuthorizationRequest): Promise<AuthorizationResult>;

  /**
   * Look up a user by their stable ID (used in workflow/approval contexts).
   */
  getUserById(id: string): Promise<UserLookupResult>;

  /**
   * Look up a user by email address.
   */
  getUserByEmail(email: string): Promise<UserLookupResult>;

  /**
   * Return all users with a given role (used for approval routing).
   */
  getUsersByRole(role: string, tenantId?: string): Promise<AuthenticatedUser[]>;

  /**
   * Health check — called by /healthz.
   */
  healthCheck(): Promise<AuthProviderHealthStatus>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Stub — replace with real connector in production
// TODO: Implement Auth0Adapter, OktaAdapter, AzureAdAdapter, ClerkAdapter, etc.
// ─────────────────────────────────────────────────────────────────────────────

const STUB_USER: AuthenticatedUser = {
  id: "00000000-0000-0000-0000-000000000001",
  email: "stub@financeos.local",
  name: "Stub User",
  role: "admin",
  tenantId: "tenant-stub",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

export class StubAuthProviderAdapter implements AuthProviderAdapter {
  readonly name = "stub-auth-provider";

  async validateToken(_token: string, _requestId?: string): Promise<TokenValidationResult> {
    // TODO: Validate real JWT/opaque token. See docs/onboarding/06-auth-rbac.md
    // WARNING: This stub accepts any token. Never use in production.
    return { valid: true, user: STUB_USER };
  }

  async authorize(_request: AuthorizationRequest): Promise<AuthorizationResult> {
    // TODO: Check real RBAC policy. See docs/onboarding/06-auth-rbac.md
    // WARNING: This stub allows all actions. Never use in production.
    return { allowed: true, reason: "StubAuthProviderAdapter: all actions allowed (stub)" };
  }

  async getUserById(_id: string): Promise<UserLookupResult> {
    return { found: true, user: STUB_USER };
  }

  async getUserByEmail(_email: string): Promise<UserLookupResult> {
    return { found: true, user: STUB_USER };
  }

  async getUsersByRole(_role: string): Promise<AuthenticatedUser[]> {
    return [STUB_USER];
  }

  async healthCheck(): Promise<AuthProviderHealthStatus> {
    return { available: false, error: "StubAuthProviderAdapter: no real auth provider configured. See docs/onboarding/06-auth-rbac.md" };
  }
}
