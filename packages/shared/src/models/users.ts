import { z } from "zod";
import { RoleSchema } from "./governance.js";

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: RoleSchema,
  department: z.string().optional(),
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
  lastLoginAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;
