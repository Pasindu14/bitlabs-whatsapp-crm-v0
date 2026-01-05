import { db } from "@/db/drizzle";
import { whatsappWebhookConfigsTable, auditLogsTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { AuditLogService } from "@/lib/audit-log.service";
import { createPerformanceLogger } from "@/lib/logger";
import { and, eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import type {
  WebhookConfigUpsertServerInput,
  WebhookConfigResponse,
  WebhookConfigStatus,
} from "../schemas/whatsapp-webhook-schema";

type WebhookConfigRecord = WebhookConfigResponse;

const BASE_SELECTION = {
  id: whatsappWebhookConfigsTable.id,
  companyId: whatsappWebhookConfigsTable.companyId,
  whatsappAccountId: whatsappWebhookConfigsTable.whatsappAccountId,
  callbackPath: whatsappWebhookConfigsTable.callbackPath,
  status: whatsappWebhookConfigsTable.status,
  lastVerifiedAt: whatsappWebhookConfigsTable.lastVerifiedAt,
  isActive: whatsappWebhookConfigsTable.isActive,
  createdAt: whatsappWebhookConfigsTable.createdAt,
  updatedAt: whatsappWebhookConfigsTable.updatedAt,
} satisfies Record<keyof WebhookConfigRecord, unknown>;

export class WebhookConfigService {
  static async getByAccount(
    companyId: number,
    whatsappAccountId: number
  ): Promise<Result<WebhookConfigRecord | null>> {
    const perf = createPerformanceLogger("WebhookConfigService.getByAccount", {
      context: { companyId, whatsappAccountId },
    });

    try {
      const [record] = await db
        .select(BASE_SELECTION)
        .from(whatsappWebhookConfigsTable)
        .where(
          and(
            eq(whatsappWebhookConfigsTable.companyId, companyId),
            eq(whatsappWebhookConfigsTable.whatsappAccountId, whatsappAccountId)
          )
        )
        .limit(1);

      if (!record) {
        perf.complete(0);
        return Result.ok(null);
      }

      perf.complete(1);
      return Result.ok({
        ...record,
        status: record.status as WebhookConfigStatus,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get webhook config";
      perf.fail(errorMessage);
      return Result.internal("Failed to get webhook config");
    }
  }

  static async upsert(
    input: WebhookConfigUpsertServerInput
  ): Promise<Result<WebhookConfigRecord>> {
    const perf = createPerformanceLogger("WebhookConfigService.upsert", {
      context: { companyId: input.companyId, userId: input.userId },
    });

    try {
      const hashedVerifyToken = await bcrypt.hash(input.verifyToken, 10);
      const hashedAppSecret = await bcrypt.hash(input.appSecret, 10);

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: whatsappWebhookConfigsTable.id,
            verifyToken: whatsappWebhookConfigsTable.verifyToken,
            appSecret: whatsappWebhookConfigsTable.appSecret,
            callbackPath: whatsappWebhookConfigsTable.callbackPath,
            status: whatsappWebhookConfigsTable.status,
          })
          .from(whatsappWebhookConfigsTable)
          .where(
            and(
              eq(whatsappWebhookConfigsTable.companyId, input.companyId),
              eq(whatsappWebhookConfigsTable.whatsappAccountId, input.whatsappAccountId)
            )
          )
          .limit(1);

        const oldValues = existing
          ? {
              callbackPath: existing.callbackPath,
              status: existing.status,
            }
          : null;

        const [upserted] = existing
          ? await tx
              .update(whatsappWebhookConfigsTable)
              .set({
                verifyToken: hashedVerifyToken,
                appSecret: hashedAppSecret,
                callbackPath: input.callbackPath,
                status: input.status ?? existing.status,
                updatedBy: input.userId,
                updatedAt: sql`now()`,
              })
              .where(eq(whatsappWebhookConfigsTable.id, existing.id))
              .returning(BASE_SELECTION)
          : await tx
              .insert(whatsappWebhookConfigsTable)
              .values({
                companyId: input.companyId,
                whatsappAccountId: input.whatsappAccountId,
                verifyToken: hashedVerifyToken,
                appSecret: hashedAppSecret,
                callbackPath: input.callbackPath,
                status: input.status ?? "unverified",
                createdBy: input.userId,
                updatedBy: input.userId,
              })
              .returning(BASE_SELECTION);

        const newValues = {
          callbackPath: upserted.callbackPath,
          status: upserted.status,
        };

        await tx.insert(auditLogsTable).values({
          entityType: "webhook_config",
          entityId: upserted.id,
          companyId: input.companyId,
          action: existing ? "UPDATE_ATTEMPT" : "CREATE_ATTEMPT",
          oldValues,
          newValues,
          changedBy: input.userId,
          changeReason: existing ? "Webhook config updated" : "Webhook config created",
        });

        return { upserted, oldValues, newValues, isUpdate: !!existing };
      });

      await db.insert(auditLogsTable).values({
        entityType: "webhook_config",
        entityId: result.upserted.id,
        companyId: input.companyId,
        action: result.isUpdate ? "UPDATE_SUCCESS" : "CREATE_SUCCESS",
        oldValues: result.oldValues,
        newValues: result.newValues,
        changedBy: input.userId,
        changeReason: result.isUpdate
          ? "Webhook config updated successfully"
          : "Webhook config created successfully",
      });

      perf.complete(1);
      return Result.ok({
        ...result.upserted,
        status: result.upserted.status as WebhookConfigStatus,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to upsert webhook config";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "webhook_config",
        entityId: null,
        companyId: input.companyId,
        userId: input.userId,
        action: "UPSERT",
        error: errorMessage,
      });
      return Result.internal("Failed to upsert webhook config");
    }
  }

  static async rotateVerifyToken(
    companyId: number,
    userId: number,
    whatsappAccountId: number
  ): Promise<Result<{ token: string }>> {
    const perf = createPerformanceLogger("WebhookConfigService.rotateVerifyToken", {
      context: { companyId, userId, whatsappAccountId },
    });

    try {
      const newToken = randomBytes(32).toString("hex");
      const hashedToken = await bcrypt.hash(newToken, 10);

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: whatsappWebhookConfigsTable.id,
            verifyToken: whatsappWebhookConfigsTable.verifyToken,
            status: whatsappWebhookConfigsTable.status,
          })
          .from(whatsappWebhookConfigsTable)
          .where(
            and(
              eq(whatsappWebhookConfigsTable.companyId, companyId),
              eq(whatsappWebhookConfigsTable.whatsappAccountId, whatsappAccountId)
            )
          )
          .limit(1);

        if (!existing) {
          return null;
        }

        const oldValues = { verifyToken: "***" };

        const [updated] = await tx
          .update(whatsappWebhookConfigsTable)
          .set({
            verifyToken: hashedToken,
            status: "unverified",
            updatedBy: userId,
            updatedAt: sql`now()`,
          })
          .where(eq(whatsappWebhookConfigsTable.id, existing.id))
          .returning(BASE_SELECTION);

        const newValues = { verifyToken: "***", status: updated.status };

        await tx.insert(auditLogsTable).values({
          entityType: "webhook_config",
          entityId: updated.id,
          companyId,
          action: "ROTATE_TOKEN_ATTEMPT",
          oldValues,
          newValues,
          changedBy: userId,
          changeReason: "Webhook verify token rotated",
        });

        return { updated, oldValues, newValues };
      });

      if (!result) {
        perf.fail("Webhook config not found");
        return Result.notFound("Webhook config not found");
      }

      await db.insert(auditLogsTable).values({
        entityType: "webhook_config",
        entityId: result.updated.id,
        companyId,
        action: "ROTATE_TOKEN_SUCCESS",
        oldValues: result.oldValues,
        newValues: result.newValues,
        changedBy: userId,
        changeReason: "Webhook verify token rotated successfully",
      });

      perf.complete(1);
      return Result.ok({ token: newToken });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to rotate verify token";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "webhook_config",
        entityId: null,
        companyId,
        userId,
        action: "ROTATE_TOKEN",
        error: errorMessage,
      });
      return Result.internal("Failed to rotate verify token");
    }
  }

  static async setStatus(
    companyId: number,
    userId: number,
    whatsappAccountId: number,
    status: "verified" | "disabled"
  ): Promise<Result<WebhookConfigRecord>> {
    const perf = createPerformanceLogger("WebhookConfigService.setStatus", {
      context: { companyId, userId, whatsappAccountId, status },
    });

    try {
      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: whatsappWebhookConfigsTable.id,
            status: whatsappWebhookConfigsTable.status,
          })
          .from(whatsappWebhookConfigsTable)
          .where(
            and(
              eq(whatsappWebhookConfigsTable.companyId, companyId),
              eq(whatsappWebhookConfigsTable.whatsappAccountId, whatsappAccountId)
            )
          )
          .limit(1);

        if (!existing) {
          return null;
        }

        const oldValues = { status: existing.status };

        const [updated] = await tx
          .update(whatsappWebhookConfigsTable)
          .set({
            status,
            lastVerifiedAt: status === "verified" ? sql`now()` : undefined,
            updatedBy: userId,
            updatedAt: sql`now()`,
          })
          .where(eq(whatsappWebhookConfigsTable.id, existing.id))
          .returning(BASE_SELECTION);

        const newValues = { status: updated.status };

        await tx.insert(auditLogsTable).values({
          entityType: "webhook_config",
          entityId: updated.id,
          companyId,
          action: "SET_STATUS_ATTEMPT",
          oldValues,
          newValues,
          changedBy: userId,
          changeReason: `Webhook status set to ${status}`,
        });

        return { updated, oldValues, newValues };
      });

      if (!result) {
        perf.fail("Webhook config not found");
        return Result.notFound("Webhook config not found");
      }

      await db.insert(auditLogsTable).values({
        entityType: "webhook_config",
        entityId: result.updated.id,
        companyId,
        action: "SET_STATUS_SUCCESS",
        oldValues: result.oldValues,
        newValues: result.newValues,
        changedBy: userId,
        changeReason: `Webhook status set to ${status} successfully`,
      });

      perf.complete(1);
      return Result.ok({
        ...result.updated,
        status: result.updated.status as WebhookConfigStatus,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to set webhook status";
      perf.fail(errorMessage);
      await AuditLogService.logFailure({
        entityType: "webhook_config",
        entityId: null,
        companyId,
        userId,
        action: "SET_STATUS",
        error: errorMessage,
      });
      return Result.internal("Failed to set webhook status");
    }
  }

  static async getSecrets(
    companyId: number,
    whatsappAccountId: number
  ): Promise<Result<{ verifyToken: string; appSecret: string } | null>> {
    const perf = createPerformanceLogger("WebhookConfigService.getSecrets", {
      context: { companyId, whatsappAccountId },
    });

    try {
      const [record] = await db
        .select({
          verifyToken: whatsappWebhookConfigsTable.verifyToken,
          appSecret: whatsappWebhookConfigsTable.appSecret,
        })
        .from(whatsappWebhookConfigsTable)
        .where(
          and(
            eq(whatsappWebhookConfigsTable.companyId, companyId),
            eq(whatsappWebhookConfigsTable.whatsappAccountId, whatsappAccountId)
          )
        )
        .limit(1);

      if (!record) {
        perf.complete(0);
        return Result.ok(null);
      }

      perf.complete(1);
      return Result.ok({
        verifyToken: record.verifyToken,
        appSecret: record.appSecret,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get webhook secrets";
      perf.fail(errorMessage);
      return Result.internal("Failed to get webhook secrets");
    }
  }
}
