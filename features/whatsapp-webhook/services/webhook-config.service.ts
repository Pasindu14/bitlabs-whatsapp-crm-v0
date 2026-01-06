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
} from "../schemas/whatsapp-webhook-schema";

type WebhookConfigRecord = WebhookConfigResponse;

const BASE_SELECTION = {
  id: whatsappWebhookConfigsTable.id,
  companyId: whatsappWebhookConfigsTable.companyId,
  whatsappAccountId: whatsappWebhookConfigsTable.whatsappAccountId,
  callbackPath: whatsappWebhookConfigsTable.callbackPath,
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
      const hashedAppSecret = await bcrypt.hash(input.appSecret, 10);

      const result = await db.transaction(async (tx) => {
        const [existing] = await tx
          .select({
            id: whatsappWebhookConfigsTable.id,
            appSecret: whatsappWebhookConfigsTable.appSecret,
            callbackPath: whatsappWebhookConfigsTable.callbackPath,
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
            }
          : null;

        const [upserted] = existing
          ? await tx
              .update(whatsappWebhookConfigsTable)
              .set({
                appSecret: hashedAppSecret,
                callbackPath: input.callbackPath,
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
                appSecret: hashedAppSecret,
                callbackPath: input.callbackPath,
                createdBy: input.userId,
                updatedBy: input.userId,
              })
              .returning(BASE_SELECTION);

        const newValues = {
          callbackPath: upserted.callbackPath,
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

  static async getSecrets(
    companyId: number,
    whatsappAccountId: number
  ): Promise<Result<{ appSecret: string } | null>> {
    const perf = createPerformanceLogger("WebhookConfigService.getSecrets", {
      context: { companyId, whatsappAccountId },
    });

    try {
      const [record] = await db
        .select({
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
        appSecret: record.appSecret,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to get webhook secrets";
      perf.fail(errorMessage);
      return Result.internal("Failed to get webhook secrets");
    }
  }
}
