/**
 * Session bootstrap
 *
 * Patches global `fetch` to inject the session Authorization header on
 * every outbound request so all API calls — including those made by raw
 * fetch inside page components — are authenticated without modifying
 * each call site.
 *
 * In development, this sends the `dev-session` token accepted by the
 * Express authenticate middleware. Replace with a real OIDC token
 * getter (e.g. from Clerk, Auth0, or Okta) before going to production.
 */

export const DEV_SESSION_TOKEN = "dev-session";

let _token: string = DEV_SESSION_TOKEN;

/** Override the session token at runtime (e.g. after OIDC login). */
export function setSessionToken(token: string): void {
  _token = token;
}

/** Return the current session token. */
export function getSessionToken(): string {
  return _token;
}

/**
 * Monkey-patches `window.fetch` once to inject `Authorization: Bearer <token>`
 * on every request that doesn't already carry an Authorization header.
 * Safe to call multiple times — only patches once.
 */
let _patched = false;
export function initSession(): void {
  if (typeof window === "undefined" || _patched) return;
  _patched = true;

  const _original = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const headers = new Headers(init.headers);
    if (!headers.has("authorization")) {
      headers.set("authorization", `Bearer ${getSessionToken()}`);
    }
    return _original(input, { ...init, headers });
  };
}
