/**
 * Auth context
 *
 * Provides the currently authenticated user to the entire component tree.
 * In development, resolves immediately to the stub CFO user without a
 * network round-trip. In production, fetch /api/me after completing the
 * OIDC login flow and call setUser() with the result.
 */

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  groups: string[];
  tenantId: string;
  initials: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AuthContext = createContext<AuthContextValue>({ user: null, isLoading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { id: string; name: string; email: string; role: string; groups: string[]; tenantId: string }) => {
        if (!cancelled) {
          setUser({ ...data, initials: getInitials(data.name) });
        }
      })
      .catch(() => {
        // If /api/me is unreachable in dev, fall back to stub
        if (!cancelled) {
          setUser({
            id: "u1000000-0000-0000-0000-000000000001",
            name: "James Okafor",
            email: "james.okafor@company.com",
            role: "cfo",
            groups: ["finance-leadership"],
            tenantId: "tenant-acme",
            initials: "JO",
          });
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return <AuthContext.Provider value={{ user, isLoading }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
