/**
 * ProtectedRoute
 *
 * Wraps any page that requires authentication.
 * Shows a loading spinner while the auth state resolves,
 * and a hard block screen if no user is present.
 */

import { useAuth } from "@/context/auth";

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">Authenticating…</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="text-lg font-semibold text-foreground">Access Denied</h2>
          <p className="max-w-sm text-sm text-muted-foreground">
            You must be authenticated to access FinanceOS. Contact your IT administrator
            to obtain access credentials.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
