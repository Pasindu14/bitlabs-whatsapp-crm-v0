import { z } from "zod";

export const USER_ROLES = ["admin", "manager", "agent", "viewer"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_SORT_FIELDS = ["createdAt", "name", "email", "role"] as const;
export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export const SORT_ORDER = ["asc", "desc"] as const;
export type SortOrder = (typeof SORT_ORDER)[number];

const emailField = z.string().email().max(255).trim().toLowerCase();
const nameField = z.string().min(2).max(120).trim();

export const userCreateClientSchema = z.object({
  name: nameField,
  email: emailField,
  role: z.enum(USER_ROLES),
  temporaryPassword: z.string().min(12).max(255),
  isActive: z.boolean().optional(),
});
export type UserCreateInput = z.infer<typeof userCreateClientSchema>;

export const userUpdateClientSchema = userCreateClientSchema.partial().extend({
  role: z.enum(USER_ROLES).optional(),
  isActive: z.boolean().optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateClientSchema>;

export const userListClientSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  search: z.string().max(120).trim().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(USER_ROLES).optional(),
  sortField: z.enum(USER_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDER).default("desc"),
});
export type UserListInput = z.infer<typeof userListClientSchema>;

export const userResetPasswordClientSchema = z.object({
  id: z.number().int(),
});
export type UserResetPasswordInput = z.infer<
  typeof userResetPasswordClientSchema
>;

export const userCreateServerSchema = userCreateClientSchema.extend({
  companyId: z.number().int(),
  userId: z.number().int(),
  actorRole: z.enum(USER_ROLES),
});
export type UserCreateServerInput = z.infer<typeof userCreateServerSchema>;

export const userUpdateServerSchema = userUpdateClientSchema.extend({
  id: z.number().int(),
  companyId: z.number().int(),
  userId: z.number().int(),
  actorRole: z.enum(USER_ROLES),
});
export type UserUpdateServerInput = z.infer<typeof userUpdateServerSchema>;

export const userListServerSchema = userListClientSchema.extend({
  companyId: z.number().int(),
});
export type UserListServerInput = z.infer<typeof userListServerSchema>;

export const userGetClientSchema = z.object({
  id: z.number().int(),
});
export type UserGetClientInput = z.infer<typeof userGetClientSchema>;

export const userGetServerSchema = userGetClientSchema.extend({
  companyId: z.number().int(),
});
export type UserGetServerInput = z.infer<typeof userGetServerSchema>;

export const userToggleStatusServerSchema = z.object({
  id: z.number().int(),
  isActive: z.boolean(),
  companyId: z.number().int(),
  userId: z.number().int(),
  actorRole: z.enum(USER_ROLES),
});
export type UserToggleStatusServerInput = z.infer<
  typeof userToggleStatusServerSchema
>;

export const userToggleStatusClientSchema = z.object({
  id: z.number().int(),
  isActive: z.boolean(),
});
export type UserToggleStatusClientInput = z.infer<
  typeof userToggleStatusClientSchema
>;

export const userResetPasswordServerSchema =
  userResetPasswordClientSchema.extend({
    companyId: z.number().int(),
    userId: z.number().int(),
    actorRole: z.enum(USER_ROLES),
  });
export type UserResetPasswordServerInput = z.infer<
  typeof userResetPasswordServerSchema
>;

export const userResponseSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  role: z.enum(USER_ROLES),
  companyId: z.number().int(),
  isActive: z.boolean(),
  startDateTime: z.date(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  createdBy: z.number().int().nullable(),
  updatedBy: z.number().int().nullable(),
});
export type UserResponse = z.infer<typeof userResponseSchema>;

export const userListResponseSchema = z.object({
  items: z.array(userResponseSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type UserListResponse = z.infer<typeof userListResponseSchema>;
