import { Result } from "@/lib/result";
import { createPerformanceLogger } from "@/lib/logger";
import { AuditLogService } from "@/lib/audit-log.service";
import { db } from "@/db/drizzle";
import { usersTable, auditLogsTable } from "@/db/schema";
import { eq, and, desc, asc, or, sql } from "drizzle-orm";
import type {
  UserCreateServerInput,
  UserUpdateServerInput,
  UserListServerInput,
  UserGetServerInput,
  UserToggleStatusServerInput,
  UserResetPasswordServerInput,
  UserResponse,
  UserListResponse,
} from "../schemas/user.schema";

export class UserService {
  static async create(
    data: UserCreateServerInput
  ): Promise<Result<UserResponse>> {
    const perf = createPerformanceLogger("UserService.create", {
      context: { companyId: data.companyId, userId: data.userId },
    });

    try {
      const existingUser = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.companyId, data.companyId),
            eq(usersTable.email, data.email)
          )
        )
        .limit(1);

      if (existingUser.length > 0) {
        perf.fail("Email already exists in company");
        return Result.conflict("A user with this email already exists");
      }

      const passwordHash = await UserService.hashPassword(data.temporaryPassword);

      const result = await db.transaction(async (tx) => {
        const [newUser] = await tx
          .insert(usersTable)
          .values({
            name: data.name,
            email: data.email,
            role: data.role,
            passwordHash,
            companyId: data.companyId,
            createdBy: data.userId,
            updatedBy: data.userId,
            isActive: data.isActive ?? true,
          })
          .returning({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            role: usersTable.role,
            companyId: usersTable.companyId,
            isActive: usersTable.isActive,
            startDateTime: usersTable.startDateTime,
            createdAt: usersTable.createdAt,
            updatedAt: usersTable.updatedAt,
            createdBy: usersTable.createdBy,
            updatedBy: usersTable.updatedBy,
          });

        await tx.insert(auditLogsTable).values({
          entityType: "user",
          entityId: newUser.id,
          companyId: data.companyId,
          action: "CREATE_ATTEMPT",
          oldValues: null,
          newValues: {
            name: newUser.name,
            email: newUser.email,
            role: newUser.role,
            isActive: newUser.isActive,
          },
          changedBy: data.userId,
          changeReason: "User created",
        });

        return newUser;
      });

      const userResponse: UserResponse = {
        ...result,
        role: result.role as UserResponse["role"],
      };

      await db.insert(auditLogsTable).values({
        entityType: "user",
        entityId: result.id,
        companyId: data.companyId,
        action: "CREATE_SUCCESS",
        oldValues: null,
        newValues: {
          name: result.name,
          email: result.email,
          role: result.role,
          isActive: result.isActive,
        },
        changedBy: data.userId,
        changeReason: "User created successfully",
      });

      perf.complete(1);
      return Result.ok(userResponse, "User created successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create user";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "user",
        entityId: null,
        companyId: data.companyId,
        userId: data.userId,
        action: "CREATE_FAILED",
        error: errorMessage,
      });
      return Result.internal("Failed to create user");
    }
  }

  static async update(
    data: UserUpdateServerInput
  ): Promise<Result<UserResponse>> {
    const perf = createPerformanceLogger("UserService.update", {
      context: { companyId: data.companyId, userId: data.userId, targetId: data.id },
    });

    try {
      const [existingUser] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          isActive: usersTable.isActive,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, data.id),
            eq(usersTable.companyId, data.companyId)
          )
        )
        .limit(1);

      if (!existingUser) {
        perf.fail("User not found");
        return Result.notFound("User not found");
      }

      if (data.email && data.email !== existingUser.email) {
        const emailConflict = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.companyId, data.companyId),
              eq(usersTable.email, data.email),
              sql`${usersTable.id} != ${data.id}`
            )
          )
          .limit(1);

        if (emailConflict.length > 0) {
          perf.fail("Email already exists in company");
          return Result.conflict("A user with this email already exists");
        }
      }

      const updateData: {
        name?: string;
        email?: string;
        role?: UserResponse["role"];
        isActive?: boolean;
        updatedBy: number;
        updatedAt: Date;
      } = {
        updatedBy: data.userId,
        updatedAt: new Date(),
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.email !== undefined) updateData.email = data.email;
      if (data.role !== undefined) updateData.role = data.role;
      if (data.isActive !== undefined) updateData.isActive = data.isActive;

      const oldValues = {
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive,
      };

      const result = await db.transaction(async (tx) => {
        const [updatedUser] = await tx
          .update(usersTable)
          .set(updateData)
          .where(eq(usersTable.id, data.id))
          .returning({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            role: usersTable.role,
            companyId: usersTable.companyId,
            isActive: usersTable.isActive,
            startDateTime: usersTable.startDateTime,
            createdAt: usersTable.createdAt,
            updatedAt: usersTable.updatedAt,
            createdBy: usersTable.createdBy,
            updatedBy: usersTable.updatedBy,
          });

        const newValues: {
          name?: string;
          email?: string;
          role?: string;
          isActive?: boolean;
        } = {};
        if (data.name !== undefined) newValues.name = data.name;
        if (data.email !== undefined) newValues.email = data.email;
        if (data.role !== undefined) newValues.role = data.role;
        if (data.isActive !== undefined) newValues.isActive = data.isActive;

        await tx.insert(auditLogsTable).values({
          entityType: "user",
          entityId: updatedUser.id,
          companyId: data.companyId,
          action: "UPDATE_ATTEMPT",
          oldValues,
          newValues,
          changedBy: data.userId,
          changeReason: "User updated",
        });

        return updatedUser;
      });

      const userResponse: UserResponse = {
        ...result,
        role: result.role as UserResponse["role"],
      };

      const finalNewValues: {
        name?: string;
        email?: string;
        role?: string;
        isActive?: boolean;
      } = {};
      if (data.name !== undefined) finalNewValues.name = data.name;
      if (data.email !== undefined) finalNewValues.email = data.email;
      if (data.role !== undefined) finalNewValues.role = data.role;
      if (data.isActive !== undefined) finalNewValues.isActive = data.isActive;

      await db.insert(auditLogsTable).values({
        entityType: "user",
        entityId: result.id,
        companyId: data.companyId,
        action: "UPDATE_SUCCESS",
        oldValues,
        newValues: finalNewValues,
        changedBy: data.userId,
        changeReason: "User updated successfully",
      });

      perf.complete(1);
      return Result.ok(userResponse, "User updated successfully");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update user";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "user",
        entityId: data.id,
        companyId: data.companyId,
        userId: data.userId,
        action: "UPDATE_FAILED",
        error: errorMessage,
      });
      return Result.internal("Failed to update user");
    }
  }

  static async getById(
    data: UserGetServerInput
  ): Promise<Result<UserResponse>> {
    const perf = createPerformanceLogger("UserService.getById", {
      context: { companyId: data.companyId, userId: data.id },
    });

    try {
      const [user] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          companyId: usersTable.companyId,
          isActive: usersTable.isActive,
          startDateTime: usersTable.startDateTime,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
          createdBy: usersTable.createdBy,
          updatedBy: usersTable.updatedBy,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, data.id),
            eq(usersTable.companyId, data.companyId)
          )
        )
        .limit(1);

      if (!user) {
        perf.fail("User not found");
        return Result.notFound("User not found");
      }

      const userResponse: UserResponse = {
        ...user,
        role: user.role as UserResponse["role"],
      };

      perf.complete(1);
      return Result.ok(userResponse);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get user";
      perf.fail(errorMessage);
      return Result.internal("Failed to get user");
    }
  }

  static async list(
    data: UserListServerInput
  ): Promise<Result<UserListResponse>> {
    const perf = createPerformanceLogger("UserService.list", {
      context: { companyId: data.companyId },
    });

    try {
      const fetchLimit = data.limit + 1;
      const conditions = [eq(usersTable.companyId, data.companyId)];

      if (data.isActive !== undefined) {
        conditions.push(eq(usersTable.isActive, data.isActive));
      } else {
        conditions.push(eq(usersTable.isActive, true));
      }

      if (data.role) {
        conditions.push(eq(usersTable.role, data.role));
      }

      if (data.search) {
        const searchTerm = `%${data.search}%`;
        conditions.push(
          or(
            sql`${usersTable.name} ILIKE ${searchTerm}`,
            sql`${usersTable.email} ILIKE ${searchTerm}`
          )!
        );
      }

      let orderByClause;
      const sortField = data.sortField;
      const sortOrder = data.sortOrder;

      if (sortField === "createdAt") {
        orderByClause = sortOrder === "asc"
          ? asc(usersTable.createdAt)
          : desc(usersTable.createdAt);
      } else if (sortField === "name") {
        orderByClause = sortOrder === "asc"
          ? asc(usersTable.name)
          : desc(usersTable.name);
      } else if (sortField === "email") {
        orderByClause = sortOrder === "asc"
          ? asc(usersTable.email)
          : desc(usersTable.email);
      } else {
        orderByClause = sortOrder === "asc"
          ? asc(usersTable.role)
          : desc(usersTable.role);
      }

      const users = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          companyId: usersTable.companyId,
          isActive: usersTable.isActive,
          startDateTime: usersTable.startDateTime,
          createdAt: usersTable.createdAt,
          updatedAt: usersTable.updatedAt,
          createdBy: usersTable.createdBy,
          updatedBy: usersTable.updatedBy,
        })
        .from(usersTable)
        .where(and(...conditions))
        .orderBy(orderByClause, desc(usersTable.id))
        .limit(fetchLimit);

      const hasMore = users.length > data.limit;
      const items = hasMore ? users.slice(0, data.limit) : users;

      const typedItems: UserResponse[] = items.map((item) => ({
        ...item,
        role: item.role as UserResponse["role"],
      }));

      let nextCursor = null;
      if (hasMore && typedItems.length > 0) {
        const lastItem = typedItems[typedItems.length - 1];
        const cursorData = {
          id: lastItem.id,
          [sortField]: lastItem[sortField as keyof typeof lastItem],
        };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
      }

      perf.complete(typedItems.length);
      return Result.ok({
        items: typedItems,
        nextCursor,
        hasMore,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to list users";
      perf.fail(errorMessage);
      return Result.internal("Failed to list users");
    }
  }

  static async toggleStatus(
    data: UserToggleStatusServerInput
  ): Promise<Result<UserResponse>> {
    const perf = createPerformanceLogger("UserService.toggleStatus", {
      context: { companyId: data.companyId, userId: data.userId, targetId: data.id },
    });

    try {
      const [existingUser] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
          role: usersTable.role,
          isActive: usersTable.isActive,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, data.id),
            eq(usersTable.companyId, data.companyId)
          )
        )
        .limit(1);

      if (!existingUser) {
        perf.fail("User not found");
        return Result.notFound("User not found");
      }

      if (existingUser.isActive === data.isActive) {
        perf.fail("User already has the requested status");
        return Result.badRequest("User already has the requested status");
      }

      const oldValues = { isActive: existingUser.isActive };

      const result = await db.transaction(async (tx) => {
        const [updatedUser] = await tx
          .update(usersTable)
          .set({
            isActive: data.isActive,
            updatedBy: data.userId,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, data.id))
          .returning({
            id: usersTable.id,
            name: usersTable.name,
            email: usersTable.email,
            role: usersTable.role,
            companyId: usersTable.companyId,
            isActive: usersTable.isActive,
            startDateTime: usersTable.startDateTime,
            createdAt: usersTable.createdAt,
            updatedAt: usersTable.updatedAt,
            createdBy: usersTable.createdBy,
            updatedBy: usersTable.updatedBy,
          });

        await tx.insert(auditLogsTable).values({
          entityType: "user",
          entityId: updatedUser.id,
          companyId: data.companyId,
          action: "TOGGLE_STATUS_ATTEMPT",
          oldValues,
          newValues: { isActive: updatedUser.isActive },
          changedBy: data.userId,
          changeReason: data.isActive ? "User activated" : "User deactivated",
        });

        return updatedUser;
      });

      const userResponse: UserResponse = {
        ...result,
        role: result.role as UserResponse["role"],
      };

      await db.insert(auditLogsTable).values({
        entityType: "user",
        entityId: result.id,
        companyId: data.companyId,
        action: "TOGGLE_STATUS_SUCCESS",
        oldValues,
        newValues: { isActive: result.isActive },
        changedBy: data.userId,
        changeReason: data.isActive ? "User activated successfully" : "User deactivated successfully",
      });

      perf.complete(1);
      return Result.ok(
        userResponse,
        data.isActive ? "User activated successfully" : "User deactivated successfully"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to toggle user status";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "user",
        entityId: data.id,
        companyId: data.companyId,
        userId: data.userId,
        action: "TOGGLE_STATUS_FAILED",
        error: errorMessage,
      });
      return Result.internal("Failed to toggle user status");
    }
  }

  static async resetPassword(
    data: UserResetPasswordServerInput
  ): Promise<Result<{ id: number; temporaryPassword: string }>> {
    const perf = createPerformanceLogger("UserService.resetPassword", {
      context: { companyId: data.companyId, userId: data.userId, targetId: data.id },
    });

    try {
      const [existingUser] = await db
        .select({
          id: usersTable.id,
          name: usersTable.name,
          email: usersTable.email,
        })
        .from(usersTable)
        .where(
          and(
            eq(usersTable.id, data.id),
            eq(usersTable.companyId, data.companyId)
          )
        )
        .limit(1);

      if (!existingUser) {
        perf.fail("User not found");
        return Result.notFound("User not found");
      }

      const temporaryPassword = UserService.generateTemporaryPassword();
      const passwordHash = await UserService.hashPassword(temporaryPassword);

      const result = await db.transaction(async (tx) => {
        await tx
          .update(usersTable)
          .set({
            passwordHash,
            updatedBy: data.userId,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.id, data.id));

        await tx.insert(auditLogsTable).values({
          entityType: "user",
          entityId: existingUser.id,
          companyId: data.companyId,
          action: "RESET_PASSWORD_ATTEMPT",
          oldValues: null,
          newValues: { email: existingUser.email },
          changedBy: data.userId,
          changeReason: "Password reset requested",
        });

        return { id: existingUser.id, temporaryPassword };
      });

      await db.insert(auditLogsTable).values({
        entityType: "user",
        entityId: result.id,
        companyId: data.companyId,
        action: "RESET_PASSWORD_SUCCESS",
        oldValues: null,
        newValues: { email: existingUser.email },
        changedBy: data.userId,
        changeReason: "Password reset successfully",
      });

      perf.complete(1);
      return Result.ok(
        result,
        "Password reset successfully"
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to reset password";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "user",
        entityId: data.id,
        companyId: data.companyId,
        userId: data.userId,
        action: "RESET_PASSWORD_FAILED",
        error: errorMessage,
      });
      return Result.internal("Failed to reset password");
    }
  }

  private static async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  private static generateTemporaryPassword(): string {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    const passwordLength = 16;
    const array = new Uint32Array(passwordLength);
    crypto.getRandomValues(array);
    return Array.from(array, (x) => chars[x % chars.length]).join("");
  }
}
