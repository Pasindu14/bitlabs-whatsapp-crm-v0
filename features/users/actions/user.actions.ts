"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { UserService } from "../services/user.service";
import {
  userCreateClientSchema,
  userGetServerSchema,
  userListClientSchema,
  userResetPasswordClientSchema,
  userToggleStatusClientSchema,
  userUpdateClientSchema,
  USER_ROLES,
  type UserRole,
  type UserListResponse,
  type UserResponse,
} from "../schemas/user.schema";
import { z } from "zod";
import type { AuthSession } from "@/lib/server-action-helper";

type ListInput = z.infer<typeof userListClientSchema>;
type CreateInput = z.infer<typeof userCreateClientSchema>;
type UpdateInput = z.infer<typeof userUpdateClientSchema> & { id: number };
type ToggleInput = z.infer<typeof userToggleStatusClientSchema>;
type ResetPasswordInput = z.infer<typeof userResetPasswordClientSchema>;

function resolveActorRole(auth: AuthSession): Result<UserRole> {
  const role = auth.role;
  if (role && USER_ROLES.includes(role as UserRole)) {
    return Result.ok(role as UserRole);
  }
  return Result.forbidden("Role is required");
}

export const listUsersAction = withAction<ListInput, UserListResponse>(
  "users.list",
  async (auth, input) => {
    const result = await UserService.list({
      ...input,
      companyId: auth.companyId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: userListClientSchema }
);

export const getUserAction = withAction<z.infer<typeof userGetServerSchema>, UserResponse>(
  "users.get",
  async (auth, input) => {
    const result = await UserService.get({
      ...input,
      companyId: auth.companyId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: userGetServerSchema }
);

export const createUserAction = withAction<CreateInput, UserResponse>(
  "users.create",
  async (auth, input) => {
    const actorRole = resolveActorRole(auth);
    if (!actorRole.success || !actorRole.data) {
      return Result.fail(actorRole.message, actorRole.error);
    }
    const role = actorRole.data;

    const result = await UserService.create({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
      actorRole: role,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: userCreateClientSchema }
);

export const updateUserAction = withAction<UpdateInput, UserResponse>(
  "users.update",
  async (auth, input) => {
    const actorRole = resolveActorRole(auth);
    if (!actorRole.success || !actorRole.data) {
      return Result.fail(actorRole.message, actorRole.error);
    }
    const role = actorRole.data;

    const result = await UserService.update({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
      actorRole: role,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  {
    schema: userUpdateClientSchema.extend({
      id: z.number().int(),
    }),
  }
);

export const toggleUserStatusAction = withAction<ToggleInput, null>(
  "users.toggleStatus",
  async (auth, input) => {
    const actorRole = resolveActorRole(auth);
    if (!actorRole.success || !actorRole.data) {
      return Result.fail(actorRole.message, actorRole.error);
    }
    const role = actorRole.data;

    const result = await UserService.toggleStatus({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
      actorRole: role,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: userToggleStatusClientSchema.extend({ id: z.number().int() }) }
);

export const resetUserPasswordAction = withAction<ResetPasswordInput, { resetToken: string }>(
  "users.resetPassword",
  async (auth, input) => {
    const actorRole = resolveActorRole(auth);
    if (!actorRole.success || !actorRole.data) {
      return Result.fail(actorRole.message, actorRole.error);
    }
    const role = actorRole.data;

    const result = await UserService.resetPassword({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
      actorRole: role,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  {
    schema: userResetPasswordClientSchema.extend({ id: z.number().int() }),
  }
);
