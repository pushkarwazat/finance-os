# Onboarding: Auth & RBAC Adapter

**Interface:** `AuthProviderAdapter` (`packages/adapters/src/auth-provider.ts`)  
**DI key:** `authProvider`  
**Current stub:** `StubAuthProviderAdapter` — accepts all tokens, allows all actions

> ⚠️ **Security critical.** The stub grants admin access to all requests.
> You MUST replace it before exposing any data in production.

---

## What this adapter does

1. **`validateToken()`** — Validates a bearer JWT on every inbound request,
   returning the authenticated user with their FinanceOS role.

2. **`authorize()`** — Checks whether a user's role is allowed to perform
   a specific action on a resource. The decision is always written to the
   audit log.

3. **`getUserById()` / `getUserByEmail()`** — Look up users for workflow
   approval routing (e.g. "which controller do I route this approval to?").

4. **`getUsersByRole()`** — Return all users with a given role for bulk
   approval assignment.

---

## FinanceOS role model

Roles are defined in `packages/shared/src/models/governance.ts`.

| Role | Default permissions |
|---|---|
| `viewer` | metrics:read, documents:read, close:read |
| `analyst` | Above + metrics:write, documents:write, ask:write |
| `finance_manager` | Above + workflows:write, close:write |
| `operator` | Above + workflows:approve |
| `controller` | Above + close:approve, governance:write |
| `cfo` | Above + metrics:approve, governance:simulate |
| `auditor` | governance:read, audit:read (read-only) |
| `admin` | admin:full |

Roles are mapped from IdP groups in your adapter implementation.

---

## Supported identity providers

| Provider | Protocol | Notes |
|---|---|---|
| Auth0 | OIDC / JWT | Most common, excellent docs |
| Okta | OIDC / SAML | Enterprise standard |
| Azure AD / Entra ID | OIDC | Required for Microsoft shops |
| AWS Cognito | OIDC | Good for AWS-native deployments |
| Clerk | OIDC | Easy for SaaS products |
| Custom OIDC | OIDC | Any standards-compliant IdP |

---

## Implementation steps (Auth0)

### 1. Install `jose` for JWT validation

```bash
pnpm --filter @workspace/api-server add jose
```

### 2. Create your adapter

```typescript
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AuthProviderAdapter, AuthenticatedUser, TokenValidationResult } from "@financeos/adapters";

// Map Auth0 groups → FinanceOS roles
const GROUP_TO_ROLE: Record<string, string> = {
  "financeos-admin": "admin",
  "financeos-cfo": "cfo",
  "financeos-controller": "controller",
  "financeos-analyst": "analyst",
  "financeos-viewer": "viewer",
};

export class Auth0AuthProviderAdapter implements AuthProviderAdapter {
  readonly name = "auth0";
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly audience: string;
  private readonly issuer: string;

  constructor(opts: { domain: string; audience: string }) {
    this.audience = opts.audience;
    this.issuer = `https://${opts.domain}/`;
    this.jwks = createRemoteJWKSet(new URL(`https://${opts.domain}/.well-known/jwks.json`));
  }

  async validateToken(token: string, requestId?: string): Promise<TokenValidationResult> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        audience: this.audience,
        issuer: this.issuer,
      });

      const groups: string[] = (payload["https://financeos.io/groups"] as string[]) ?? [];
      const role = groups.map(g => GROUP_TO_ROLE[g]).find(Boolean) ?? "viewer";

      const user: AuthenticatedUser = {
        id: payload.sub!,
        email: payload.email as string,
        name: payload.name as string ?? payload.email as string,
        role,
        groups,
        tenantId: payload["https://financeos.io/tenantId"] as string ?? "default",
        expiresAt: new Date((payload.exp ?? 0) * 1000).toISOString(),
        claims: payload as Record<string, unknown>,
      };

      return { valid: true, user };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const errorCode = msg.includes("expired") ? "expired" as const
        : msg.includes("signature") ? "invalid_signature" as const
        : "malformed" as const;
      return { valid: false, errorCode, error: msg };
    }
  }

  async authorize(request) {
    const { user, permission } = request;
    // Delegate to the RBAC package
    const { hasPermission } = await import("@financeos/governance");
    const allowed = hasPermission(user.role as any, permission.action as any);
    return {
      allowed,
      reason: allowed
        ? `Role '${user.role}' has permission '${permission.action}'`
        : `Role '${user.role}' does not have permission '${permission.action}'`,
      policiesEvaluated: ["RBAC_POLICIES"],
    };
  }

  async getUserById(_id: string) {
    // TODO: call Auth0 Management API GET /api/v2/users/{id}
    return { found: false };
  }

  async getUserByEmail(_email: string) {
    // TODO: call Auth0 Management API GET /api/v2/users-by-email
    return { found: false };
  }

  async getUsersByRole(_role: string) {
    // TODO: call Auth0 Management API with group filter
    return [];
  }

  async healthCheck() {
    const t = Date.now();
    try {
      // Fetch JWKS as a connectivity check
      await fetch(`${this.issuer}.well-known/jwks.json`);
      return { available: true, latencyMs: Date.now() - t };
    } catch (err) {
      return { available: false, error: String(err) };
    }
  }
}
```

### 3. Register in the DI container

```typescript
container.register("authProvider", new Auth0AuthProviderAdapter({
  domain: process.env.AUTH0_DOMAIN!,          // e.g. "yourco.auth0.com"
  audience: process.env.AUTH0_AUDIENCE!,       // e.g. "https://api.financeos.yourco.com"
}));
```

### 4. Add the auth middleware to Express

In `artifacts/api-server/src/app.ts`, after `requestIdMiddleware`:

```typescript
// Auth middleware (add after requestId, before routes)
app.use(async (req, res, next) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "unauthorized", message: "Missing bearer token", statusCode: 401 });
  }
  const result = await container.get("authProvider").validateToken(token, res.locals.requestId);
  if (!result.valid) {
    return res.status(401).json({ error: result.errorCode ?? "unauthorized", message: result.error, statusCode: 401 });
  }
  res.locals.user = result.user;
  next();
});
```

---

## SAML / Enterprise SSO

For SAML-based enterprise SSO (Okta, ADFS), use `node-saml` to validate
assertions and then issue your own short-lived JWTs. The Auth0 adapter
above still works downstream — Auth0 supports SAML federation.

---

## Production checklist

- [ ] Never log bearer tokens — `X-Request-Id` is sufficient for correlation
- [ ] Validate `aud` and `iss` claims strictly in JWT verification
- [ ] Cache JWKS with a 1-hour TTL (jose does this automatically)
- [ ] Rotate Auth0 client secrets quarterly
- [ ] Enable Auth0 Anomaly Detection (brute force, breached passwords)
- [ ] Map IdP groups → FinanceOS roles in your IdP (not in code)
- [ ] Write all `authorize()` calls to the audit log (use `AuditLogEvent`)
- [ ] Set token expiry ≤ 1 hour with refresh token rotation
