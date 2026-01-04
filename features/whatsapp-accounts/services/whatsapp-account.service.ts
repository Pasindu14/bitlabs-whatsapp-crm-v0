import { db } from "@/db/drizzle";
import { whatsappAccountsTable, auditLogsTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { AuditLogService } from "@/lib/audit-log.service";
import { createPerformanceLogger } from "@/lib/logger";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { formatISO } from "date-fns";
import type {
  WhatsappAccountCreateServerInput,
  WhatsappAccountListServerInput,
  WhatsappAccountUpdateServerInput,
  WhatsappAccountSetDefaultInput,
  WhatsappAccountGetInput,
  WhatsappAccountResponse,
} from "../schemas/whatsapp-account.schema";

type WhatsappAccountRecord = WhatsappAccountResponse;

const DEFAULT_LIMIT = 20;
const BASE_SELECTION = {
  id: whatsappAccountsTable.id,
  companyId: whatsappAccountsTable.companyId,
  name: whatsappAccountsTable.name,
  phoneNumberId: whatsappAccountsTable.phoneNumberId,
  businessAccountId: whatsappAccountsTable.businessAccountId,
  webhookUrl: whatsappAccountsTable.webhookUrl,
  isActive: whatsappAccountsTable.isActive,
  isDefault: whatsappAccountsTable.isDefault,
  createdAt: whatsappAccountsTable.createdAt,
  updatedAt: whatsappAccountsTable.updatedAt,
  createdBy: whatsappAccountsTable.createdBy,
  updatedBy: whatsappAccountsTable.updatedBy,
} satisfies Record<keyof WhatsappAccountRecord, unknown>;

function encodeCursor(record: WhatsappAccountRecord): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: record.createdAt ? formatISO(record.createdAt) : null,
      id: record.id,
    })
  ).toString("base64");
}

function decodeCursor(cursor?: string): { createdAt: string | null; id: number } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString());
    if (typeof parsed.id === "number") {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export class WhatsappAccountService {
  static async list(
    input: WhatsappAccountListServerInput
  ): Promise<
    Result<{
      items: WhatsappAccountRecord[];
      nextCursor: string | null;
      hasMore: boolean;
    }>
  > {
    const perf = createPerformanceLogger("WhatsappAccountService.list", {
      context: { companyId: input.companyId },
    });

    try {
      const limit = input.limit ?? DEFAULT_LIMIT;
      const cursor = decodeCursor(input.cursor);

      const companyFilter = eq(whatsappAccountsTable.companyId, input.companyId);
      const activeFilter = eq(
        whatsappAccountsTable.isActive,
        input.isActive ?? true
      );

      const searchFilter = input.search
        ? or(
            ilike(whatsappAccountsTable.name, `%${input.search}%`),
            ilike(whatsappAccountsTable.phoneNumberId, `%${input.search}%`)
          )
        : undefined;

      const baseWhere = [companyFilter, activeFilter, searchFilter].filter(
        Boolean
      ) as any[];

      const cursorCondition = cursor
        ? lt(
            sql`(${whatsappAccountsTable.createdAt}, ${whatsappAccountsTable.id})`,
            sql`(${cursor.createdAt ? cursor.createdAt : null}, ${cursor.id})`
          )
        : undefined;

      const whereClause = cursorCondition
        ? and(...baseWhere, cursorCondition)
        : and(...baseWhere);

      const data = await db
        .select(BASE_SELECTION)
        .from(whatsappAccountsTable)
        .where(whereClause)
        .orderBy(
          desc(whatsappAccountsTable.createdAt),
          desc(whatsappAccountsTable.id)
        )
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, limit) : data;
      const nextCursor =
        hasMore && items.length > 0
          ? encodeCursor(items[items.length - 1]!)
          : null;

      perf.complete(items.length);
      return Result.ok({ items, nextCursor, hasMore });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to list WhatsApp accounts";
      perf.fail(errorMessage);
      return Result.internal("Failed to list WhatsApp accounts");
    }
  }

  static async get(
    input: WhatsappAccountGetInput
  ): Promise<Result<WhatsappAccountRecord>> {
    const perf = createPerformanceLogger("WhatsappAccountService.get", {
      context: { companyId: input.companyId, id: input.id },
    });

    try {
      const [record] = await db
        .select(BASE_SELECTION)
        .from(whatsappAccountsTable)
        .where(
          and(
            eq(whatsappAccountsTable.companyId, input.companyId),
            eq(whatsappAccountsTable.id, input.id)
          )
        )
        .limit(1);

      if (!record) {
        perf.fail("WhatsApp account not found");
        return Result.notFound("WhatsApp account not found");
      }

      perf.complete(1);
      return Result.ok(record);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get WhatsApp account";
      perf.fail(errorMessage);
      return Result.internal("Failed to get WhatsApp account");
    }
  }

  static async create(
    input: WhatsappAccountCreateServerInput
  ): Promise<Result<WhatsappAccountRecord>> {
    const perf = createPerformanceLogger("WhatsappAccountService.create", {
      context: { companyId: input.companyId, userId: input.userId },
    });

    try {
      const result = await db.transaction(async (tx) => {
        if (input.isDefault) {
          await tx
            .update(whatsappAccountsTable)
            .set({ isDefault: false })
            .where(eq(whatsappAccountsTable.companyId, input.companyId));
        }

        const [inserted] = await tx
          .insert(whatsappAccountsTable)
          .values({
            companyId: input.companyId,
            name: input.name,
            phoneNumberId: input.phoneNumberId,
            businessAccountId: input.businessAccountId,
            accessToken: input.accessToken,
            webhookUrl: input.webhookUrl,
            isDefault: input.isDefault ?? false,
            createdBy: input.userId,
            updatedBy: input.userId,
          })
          .returning(BASE_SELECTION);

        await tx.insert(auditLogsTable).values({
          entityType: "whatsapp_account",
          entityId: inserted.id,
          companyId: input.companyId,
          action: "CREATE_ATTEMPT",
          oldValues: null,
          newValues: {
            name: inserted.name,
            phoneNumberId: inserted.phoneNumberId,
            businessAccountId: inserted.businessAccountId,
            isDefault: inserted.isDefault,
            isActive: inserted.isActive,
          },
          changedBy: input.userId,
          changeReason: "WhatsApp account created",
        });

        return inserted;
      });

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: result.id,
        companyId: input.companyId,
        action: "CREATE_SUCCESS",
        oldValues: null,
        newValues: {
          name: result.name,
          phoneNumberId: result.phoneNumberId,
          businessAccountId: result.businessAccountId,
          isDefault: result.isDefault,
          isActive: result.isActive,
        },
        changedBy: input.userId,
        changeReason: "WhatsApp account created successfully",
      });

      perf.complete(1);
      return Result.ok(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to create WhatsApp account";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "whatsapp_account",
        entityId: null,
        companyId: input.companyId,
        userId: input.userId,
        action: "CREATE",
        error: errorMessage,
      });
      return Result.internal("Failed to create WhatsApp account");
    }
  }

  static async update(
    input: WhatsappAccountUpdateServerInput
  ): Promise<Result<WhatsappAccountRecord>> {
    const perf = createPerformanceLogger("WhatsappAccountService.update", {
      context: { companyId: input.companyId, userId: input.userId, targetId: input.id },
    });

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: whatsappAccountsTable.id,
            name: whatsappAccountsTable.name,
            phoneNumberId: whatsappAccountsTable.phoneNumberId,
            businessAccountId: whatsappAccountsTable.businessAccountId,
            accessToken: whatsappAccountsTable.accessToken,
            webhookUrl: whatsappAccountsTable.webhookUrl,
            isDefault: whatsappAccountsTable.isDefault,
            isActive: whatsappAccountsTable.isActive,
          })
          .from(whatsappAccountsTable)
          .where(
            and(
              eq(whatsappAccountsTable.companyId, input.companyId),
              eq(whatsappAccountsTable.id, input.id)
            )
          )
          .limit(1);

        if (!existing) {
          return null;
        }

        const oldValues = {
          name: existing.name,
          phoneNumberId: existing.phoneNumberId,
          businessAccountId: existing.businessAccountId,
          webhookUrl: existing.webhookUrl,
          isDefault: existing.isDefault,
          isActive: existing.isActive,
        };

        if (input.isDefault) {
          await tx
            .update(whatsappAccountsTable)
            .set({ isDefault: false })
            .where(eq(whatsappAccountsTable.companyId, input.companyId));
        }

        const [updated] = await tx
          .update(whatsappAccountsTable)
          .set({
            name: input.name ?? existing.name,
            phoneNumberId: input.phoneNumberId ?? existing.phoneNumberId,
            businessAccountId:
              input.businessAccountId ?? existing.businessAccountId,
            accessToken: input.accessToken ?? existing.accessToken,
            webhookUrl: input.webhookUrl ?? existing.webhookUrl,
            isDefault: input.isDefault ?? existing.isDefault,
            isActive: input.isActive ?? existing.isActive,
            updatedBy: input.userId,
            updatedAt: sql`now()`,
          })
          .where(eq(whatsappAccountsTable.id, input.id))
          .returning(BASE_SELECTION);

        const newValues: Record<string, unknown> = {};
        if (input.name !== undefined) newValues.name = input.name;
        if (input.phoneNumberId !== undefined) newValues.phoneNumberId = input.phoneNumberId;
        if (input.businessAccountId !== undefined) newValues.businessAccountId = input.businessAccountId;
        if (input.webhookUrl !== undefined) newValues.webhookUrl = input.webhookUrl;
        if (input.isDefault !== undefined) newValues.isDefault = input.isDefault;
        if (input.isActive !== undefined) newValues.isActive = input.isActive;

        await tx.insert(auditLogsTable).values({
          entityType: "whatsapp_account",
          entityId: updated.id,
          companyId: input.companyId,
          action: "UPDATE_ATTEMPT",
          oldValues,
          newValues,
          changedBy: input.userId,
          changeReason: "WhatsApp account updated",
        });

        return { updated, oldValues, newValues };
      });

      if (!result) {
        perf.fail("WhatsApp account not found");
        return Result.notFound("WhatsApp account not found");
      }

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: result.updated.id,
        companyId: input.companyId,
        action: "UPDATE_SUCCESS",
        oldValues: result.oldValues,
        newValues: result.newValues,
        changedBy: input.userId,
        changeReason: "WhatsApp account updated successfully",
      });

      perf.complete(1);
      return Result.ok(result.updated);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to update WhatsApp account";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "whatsapp_account",
        entityId: input.id,
        companyId: input.companyId,
        userId: input.userId,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal("Failed to update WhatsApp account");
    }
  }

  static async setDefault(
    input: WhatsappAccountSetDefaultInput
  ): Promise<Result<null>> {
    const perf = createPerformanceLogger("WhatsappAccountService.setDefault", {
      context: { companyId: input.companyId, userId: input.userId, targetId: input.id },
    });

    try {
      const updated = await db.transaction(async (tx) => {
        const existing = await tx.query.whatsappAccountsTable.findFirst({
          where: and(
            eq(whatsappAccountsTable.companyId, input.companyId),
            eq(whatsappAccountsTable.id, input.id)
          ),
        });
        if (!existing) {
          return false;
        }

        const oldValues = { isDefault: existing.isDefault };

        await tx
          .update(whatsappAccountsTable)
          .set({ isDefault: false })
          .where(eq(whatsappAccountsTable.companyId, input.companyId));

        await tx
          .update(whatsappAccountsTable)
          .set({
            isDefault: true,
            updatedBy: input.userId,
            updatedAt: sql`now()`,
          })
          .where(eq(whatsappAccountsTable.id, input.id));

        await tx.insert(auditLogsTable).values({
          entityType: "whatsapp_account",
          entityId: input.id,
          companyId: input.companyId,
          action: "SET_DEFAULT_ATTEMPT",
          oldValues,
          newValues: { isDefault: true },
          changedBy: input.userId,
          changeReason: "Set as default WhatsApp account",
        });

        return true;
      });

      if (!updated) {
        perf.fail("WhatsApp account not found");
        return Result.notFound("WhatsApp account not found");
      }

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: input.id,
        companyId: input.companyId,
        action: "SET_DEFAULT_SUCCESS",
        oldValues: { isDefault: false },
        newValues: { isDefault: true },
        changedBy: input.userId,
        changeReason: "Set as default WhatsApp account successfully",
      });

      perf.complete(1);
      return Result.ok(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to set default WhatsApp account";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "whatsapp_account",
        entityId: input.id,
        companyId: input.companyId,
        userId: input.userId,
        action: "SET_DEFAULT",
        error: errorMessage,
      });
      return Result.internal("Failed to set default WhatsApp account");
    }
  }

  static async deactivate(
    input: WhatsappAccountSetDefaultInput
  ): Promise<Result<null>> {
    const perf = createPerformanceLogger("WhatsappAccountService.deactivate", {
      context: { companyId: input.companyId, userId: input.userId, targetId: input.id },
    });

    try {
      const [existing] = await db
        .select({ id: whatsappAccountsTable.id, isActive: whatsappAccountsTable.isActive })
        .from(whatsappAccountsTable)
        .where(
          and(
            eq(whatsappAccountsTable.companyId, input.companyId),
            eq(whatsappAccountsTable.id, input.id)
          )
        )
        .limit(1);

      if (!existing) {
        perf.fail("WhatsApp account not found");
        return Result.notFound("WhatsApp account not found");
      }

      const oldValues = { isActive: existing.isActive };

      const [updated] = await db
        .update(whatsappAccountsTable)
        .set({
          isActive: false,
          updatedBy: input.userId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(whatsappAccountsTable.companyId, input.companyId),
            eq(whatsappAccountsTable.id, input.id)
          )
        )
        .returning(BASE_SELECTION);

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: updated.id,
        companyId: input.companyId,
        action: "DEACTIVATE_ATTEMPT",
        oldValues,
        newValues: { isActive: false },
        changedBy: input.userId,
        changeReason: "WhatsApp account deactivated",
      });

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: updated.id,
        companyId: input.companyId,
        action: "DEACTIVATE_SUCCESS",
        oldValues,
        newValues: { isActive: false },
        changedBy: input.userId,
        changeReason: "WhatsApp account deactivated successfully",
      });

      perf.complete(1);
      return Result.ok(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to deactivate WhatsApp account";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "whatsapp_account",
        entityId: input.id,
        companyId: input.companyId,
        userId: input.userId,
        action: "DEACTIVATE",
        error: errorMessage,
      });
      return Result.internal("Failed to deactivate WhatsApp account");
    }
  }

  static async activate(
    input: WhatsappAccountSetDefaultInput
  ): Promise<Result<null>> {
    const perf = createPerformanceLogger("WhatsappAccountService.activate", {
      context: { companyId: input.companyId, userId: input.userId, targetId: input.id },
    });

    try {
      const [existing] = await db
        .select({ id: whatsappAccountsTable.id, isActive: whatsappAccountsTable.isActive })
        .from(whatsappAccountsTable)
        .where(
          and(
            eq(whatsappAccountsTable.companyId, input.companyId),
            eq(whatsappAccountsTable.id, input.id)
          )
        )
        .limit(1);

      if (!existing) {
        perf.fail("WhatsApp account not found");
        return Result.notFound("WhatsApp account not found");
      }

      const oldValues = { isActive: existing.isActive };

      const [updated] = await db
        .update(whatsappAccountsTable)
        .set({
          isActive: true,
          updatedBy: input.userId,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(whatsappAccountsTable.companyId, input.companyId),
            eq(whatsappAccountsTable.id, input.id)
          )
        )
        .returning(BASE_SELECTION);

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: updated.id,
        companyId: input.companyId,
        action: "ACTIVATE_ATTEMPT",
        oldValues,
        newValues: { isActive: true },
        changedBy: input.userId,
        changeReason: "WhatsApp account activated",
      });

      await db.insert(auditLogsTable).values({
        entityType: "whatsapp_account",
        entityId: updated.id,
        companyId: input.companyId,
        action: "ACTIVATE_SUCCESS",
        oldValues,
        newValues: { isActive: true },
        changedBy: input.userId,
        changeReason: "WhatsApp account activated successfully",
      });

      perf.complete(1);
      return Result.ok(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to activate WhatsApp account";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "whatsapp_account",
        entityId: input.id,
        companyId: input.companyId,
        userId: input.userId,
        action: "ACTIVATE",
        error: errorMessage,
      });
      return Result.internal("Failed to activate WhatsApp account");
    }
  }
}
