/**
 * GET /api/me
 *
 * Returns the currently authenticated user's profile.
 * Populated by the authenticateMiddleware on every request.
 */

import { Router } from "express";

const router = Router();

router.get("/me", (req, res) => {
  const user = res.locals.user;
  res.json({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    groups: user.groups ?? [],
    tenantId: user.tenantId,
    expiresAt: user.expiresAt,
  });
});

export default router;
