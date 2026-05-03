/**
 * RBAC permission guard middleware factory
 *
 * Returns an Express middleware that checks whether the authenticated user's
 * role has the specified permission. Call this after `authenticateMiddleware`.
 *
 * Usage:
 *   router.get("/sensitive", requirePermission("metrics:approve"), handler)
 */

import type { Request, Response, NextFunction } from "express";
import { hasPermission } from "@financeos/governance";
import type { Permission, Role } from "@financeos/shared";
import { ForbiddenError } from "@financeos/shared";

export function requirePermission(permission: Permission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = res.locals.user;

    if (!user) {
      return next(new ForbiddenError("No authenticated user on request"));
    }

    if (!hasPermission(user.role as Role, permission)) {
      req.log?.warn(
        { userId: user.id, role: user.role, requiredPermission: permission },
        "Permission denied",
      );
      return next(
        new ForbiddenError(
          `Role '${user.role}' does not have permission '${permission}'`,
        ),
      );
    }

    next();
  };
}
