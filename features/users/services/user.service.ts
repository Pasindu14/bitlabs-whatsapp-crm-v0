import { db } from "@/db/drizzle";
import { usersTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { createPerformanceLogger } from "@/lib/logger";
import { AuditLogService } from "@/lib/audit-log.service";
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { formatISO } from "date-fns";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { Buffer } from "buffer";
import type {
  UserCreateServerInput,
  UserGetServerInput,
  UserListServerInput,
  UserResponse,
  UserToggleStatusServerInput,
  UserUpdateServerInput,
  UserResetPasswordServerInput,
  UserSortField,
  SortOrder,
} from "../schemas/user.schema";

type UserRecord = UserResponse;
type DbUser = typeof usersTable.$inferSelect;
type SelectedUser = Pick<
  DbUser,
  | "id"
  | "name"
  | "email"
  | "role"
  | "companyId"
  | "isActive"
  | "startDateTime"
  | "createdAt"
  | "updatedAt"
  | "createdBy"
  | "updatedBy"
>;

const DEFAULT_LIMIT = 20;
const ADMIN_ROLE = "admin";

const BASE_SELECTION = {
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
} satisfies Record<keyof SelectedUser, unknown>;

function mapToUserRecord(row: SelectedUser): UserRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as UserRecord["role"],
    companyId: row.companyId,
    isActive: row.isActive,
    startDateTime: row.startDateTime,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt ?? null,
    createdBy: row.createdBy ?? null,
    updatedBy: row.updatedBy ?? null,
  };
}

type CursorPayload = { sortValue: string | number | null; id: number };

function encodeCursor(record: UserRecord, sortField: UserSortField): string {
  const sortValue =
    sortField === "createdAt"
      ? record.createdAt
        ? formatISO(record.createdAt)
        : null
      : record[sortField];

  return Buffer.from(
    JSON.stringify({
      sortValue,
      id: record.id,
    })
  ).toString("base64");
}

function decodeCursor(cursor?: string): CursorPayload | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString());
    if (typeof parsed?.id === "number") {
      return parsed as CursorPayload;
    }
    return null;
  } catch {
    return null;
  }
}

function buildCursorCondition(
  cursor: CursorPayload | null,
  sortField: UserSortField,
  sortOrder: SortOrder
) {
  if (!cursor) return undefined;

  const sortColumn = usersTable[sortField];
  const comparator =
    sortOrder === "asc"
      ? sql`(${sortColumn}, ${usersTable.id}) > (${cursor.sortValue}, ${cursor.id})`
      : sql`(${sortColumn}, ${usersTable.id}) < (${cursor.sortValue}, ${cursor.id})`;

  return comparator;
}

function buildOrder(sortField: UserSortField, sortOrder: SortOrder) {
  const column = usersTable[sortField];
  const direction = sortOrder === "asc" ? sql`${column} asc` : sql`${column} desc`;

  // always add id as tiebreaker
  const idDirection = sortOrder === "asc" ? sql`${usersTable.id} asc` : sql`${usersTable.id} desc`;

  return [direction, idDirection];
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

async function countActiveAdmins(companyId: number): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(usersTable)
    .where(
      and(
        eq(usersTable.companyId, companyId),
        eq(usersTable.role, ADMIN_ROLE),
        eq(usersTable.isActive, true)
      )
    );
  return Number(row?.count ?? 0);
}

export class UserService {
  static async list(
    input: UserListServerInput
  ): Promise<Result<{ items: UserRecord[]; nextCursor: string | null; hasMore: boolean }>> {
    const perf = createPerformanceLogger("UserService.list");
    try {
      const limit = input.limit ?? DEFAULT_LIMIT;
      const cursor = decodeCursor(input.cursor);
      const sortField = input.sortField ?? "createdAt";
      const sortOrder = input.sortOrder ?? "desc";

      const baseFilters: Array<ReturnType<typeof eq> | ReturnType<typeof or>> = [
        eq(usersTable.companyId, input.companyId),
      ];

      if (input.isActive !== undefined) {
        baseFilters.push(eq(usersTable.isActive, input.isActive));
      }

      if (input.role) {
        baseFilters.push(eq(usersTable.role, input.role));
      }

      if (input.search) {
        baseFilters.push(
          or(ilike(usersTable.name, `%${input.search}%`), ilike(usersTable.email, `%${input.search}%`))
        );
      }

      const cursorCondition = buildCursorCondition(cursor, sortField, sortOrder);
      const whereClause = cursorCondition ? and(...baseFilters, cursorCondition) : and(...baseFilters);

      const data = await db
        .select(BASE_SELECTION)
        .from(usersTable)
        .where(whereClause)
        .orderBy(...buildOrder(sortField, sortOrder))
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const selected = hasMore ? data.slice(0, limit) : data;
      const items = selected.map(mapToUserRecord);
      const nextCursor =
        hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!, sortField) : null;

      perf.complete(items.length, { hasMore });
      return Result.ok({ items, nextCursor, hasMore });
    } catch (error) {
      perf.fail(error as Error);
      return Result.fail("Failed to list users", {
        code: "INTERNAL_ERROR",
        details: { message: String(error) },
      });
    }
  }

  static async get(input: UserGetServerInput): Promise<Result<UserRecord>> {
    const perf = createPerformanceLogger("UserService.get");
    try {
      const [record] = await db
        .select(BASE_SELECTION)
        .from(usersTable)
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)))
        .limit(1);

      if (!record) {
        perf.fail("not_found");
        return Result.notFound("User not found");
      }

      const mapped = mapToUserRecord(record);
      perf.complete(1, { userId: mapped.id });
      return Result.ok(mapped);
    } catch (error) {
      perf.fail(error as Error);
      return Result.fail("Failed to get user", {
        code: "INTERNAL_ERROR",
        details: { message: String(error) },
      });
    }
  }

  static async create(input: UserCreateServerInput): Promise<Result<UserRecord>> {
    const perf = createPerformanceLogger("UserService.create");
    try {
      if (input.actorRole !== ADMIN_ROLE) {
        perf.fail("forbidden");
        return Result.forbidden("Only admins can create users");
      }

      const existingByEmail = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.email, input.email)))
        .limit(1)
        .then((rows) => rows[0]);

      if (existingByEmail) {
        perf.fail("conflict_email");
        return Result.conflict("Email already exists");
      }

      const password = input.temporaryPassword || crypto.randomUUID();
      const passwordHash = await hashPassword(password);

      const [created] = await db
        .insert(usersTable)
        .values({
          name: input.name,
          email: input.email,
          role: input.role,
          passwordHash,
          companyId: input.companyId,
          isActive: input.isActive ?? true,
          startDateTime: sql`now()`,
          createdBy: input.userId,
          updatedBy: input.userId,
        })
        .returning(BASE_SELECTION);

      const mapped = mapToUserRecord(created);

      await AuditLogService.log({
        companyId: input.companyId,
        userId: input.userId,
        action: "user.create",
        resourceId: mapped.id,
      });

      perf.complete(1, { userId: mapped.id });
      return Result.ok(mapped);
    } catch (error) {
      perf.fail(error as Error);
      const message = (error as Error).message ?? String(error);
      const isConflict = message?.toLowerCase?.().includes("duplicate") || message?.includes("unique");
      if (isConflict) {
        return Result.conflict("Email already exists");
      }
      return Result.fail("Failed to create user", {
        code: "INTERNAL_ERROR",
        details: { message },
      });
    }
  }

  static async update(input: UserUpdateServerInput): Promise<Result<UserRecord>> {
    const perf = createPerformanceLogger("UserService.update");
    try {
      if (input.actorRole !== ADMIN_ROLE && input.actorRole !== "manager") {
        perf.fail("forbidden");
        return Result.forbidden("Only admins or managers can update users");
      }

      const existing = await db
        .select(BASE_SELECTION)
        .from(usersTable)
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!existing) {
        perf.fail("not_found");
        return Result.notFound("User not found");
      }

      if (input.actorRole === "manager" && existing.role === ADMIN_ROLE) {
        return Result.forbidden("Managers cannot modify admin users");
      }

      const isDemotingAdmin =
        existing.role === ADMIN_ROLE &&
        ((input.role && input.role !== ADMIN_ROLE) || input.isActive === false);

      if (isDemotingAdmin) {
        const adminCount = await countActiveAdmins(input.companyId);
        if (adminCount <= 1) {
          return Result.badRequest("Cannot demote or deactivate the last active admin");
        }
      }

      const emailToUse = input.email ?? existing.email;
      if (emailToUse !== existing.email) {
        const duplicate = await db
          .select({ id: usersTable.id })
          .from(usersTable)
          .where(
            and(
              eq(usersTable.companyId, input.companyId),
              eq(usersTable.email, emailToUse),
              sql`${usersTable.id} != ${existing.id}`
            )
          )
          .limit(1)
          .then((rows) => rows[0]);
        if (duplicate) {
          return Result.conflict("Email already exists");
        }
      }

      const [updated] = await db
        .update(usersTable)
        .set({
          name: input.name ?? existing.name,
          email: emailToUse,
          role: input.role ?? existing.role,
          isActive: input.isActive ?? existing.isActive,
          updatedBy: input.userId,
          updatedAt: sql`now()`,
        })
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)))
        .returning(BASE_SELECTION);

      if (!updated) {
        return Result.notFound("User not found");
      }

      const mapped = mapToUserRecord(updated);

      await AuditLogService.log({
        companyId: input.companyId,
        userId: input.userId,
        action: "user.update",
        resourceId: mapped.id,
      });

      perf.complete(1, { userId: mapped.id });
      return Result.ok(mapped);
    } catch (error) {
      const message = (error as Error).message ?? String(error);
      const isConflict = message?.toLowerCase?.().includes("duplicate") || message?.includes("unique");
      if (isConflict) {
        return Result.conflict("Email already exists");
      }
      return Result.fail("Failed to update user", {
        code: "INTERNAL_ERROR",
        details: { message },
      });
    }
  }

  static async toggleStatus(input: UserToggleStatusServerInput): Promise<Result<null>> {
    const perf = createPerformanceLogger("UserService.toggleStatus");
    try {
      if (input.userId === input.id) {
        return Result.badRequest("You cannot change your own status");
      }

      const existing = await db
        .select(BASE_SELECTION)
        .from(usersTable)
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)))
        .limit(1)
        .then((rows) => rows[0]);

      if (!existing) {
        return Result.notFound("User not found");
      }

      if (existing.role === ADMIN_ROLE && input.isActive === false) {
        const adminCount = await countActiveAdmins(input.companyId);
        if (adminCount <= 1) {
          return Result.badRequest("Cannot deactivate the last active admin");
        }
      }

      await db
        .update(usersTable)
        .set({
          isActive: input.isActive,
          updatedBy: input.userId,
          updatedAt: sql`now()`,
        })
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)));

      await AuditLogService.log({
        companyId: input.companyId,
        userId: input.userId,
        action: "user.toggleStatus",
        resourceId: input.id,
      });

      perf.complete(1, { userId: input.id, isActive: input.isActive });
      return Result.ok(null);
    } catch (error) {
      return Result.fail("Failed to toggle user status", {
        code: "INTERNAL_ERROR",
        details: { message: String(error) },
      });
    }
  }

  static async resetPassword(
    input: UserResetPasswordServerInput
  ): Promise<Result<{ resetToken: string }>> {
    const perf = createPerformanceLogger("UserService.resetPassword");
    try {
      const existing = await db.query.usersTable.findFirst({
        where: and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)),
      });

      if (!existing) {
        return Result.notFound("User not found");
      }

      const newPasswordHash = await hashPassword("abc@123");

      await db
        .update(usersTable)
        .set({
          passwordHash: newPasswordHash,
          updatedBy: input.userId,
          updatedAt: sql`now()`,
        })
        .where(and(eq(usersTable.companyId, input.companyId), eq(usersTable.id, input.id)));

      await AuditLogService.log({
        companyId: input.companyId,
        userId: input.userId,
        action: "user.resetPassword",
        resourceId: input.id,
      });

      perf.complete(1, { userId: input.id });
      return Result.ok({ resetToken: "abc@123" });
    } catch (error) {
      return Result.fail("Failed to reset password", {
        code: "INTERNAL_ERROR",
        details: { message: String(error) },
      });
    }
  }
}
