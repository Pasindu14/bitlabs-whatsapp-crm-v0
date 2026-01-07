import { db } from "@/db/drizzle";
import { whatsappWebhookEventLogsTable, contactsTable, conversationsTable, messagesTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { createPerformanceLogger } from "@/lib/logger";
import { and, eq, desc, sql } from "drizzle-orm";
import { createHash } from "crypto";
import { parseISO, formatISO } from "date-fns";
import bcrypt from "bcryptjs";
import { WebhookConfigService } from "./webhook-config.service";
import type {
  WebhookEventPayload,
  WebhookMessagePayload,
  WebhookStatusPayload,
  WebhookEventType,
  WebhookEventLogResponse,
} from "../schemas/whatsapp-webhook-schema";

type WebhookEventLogRecord = WebhookEventLogResponse;

const BASE_SELECTION = {
  id: whatsappWebhookEventLogsTable.id,
  companyId: whatsappWebhookEventLogsTable.companyId,
  whatsappAccountId: whatsappWebhookEventLogsTable.whatsappAccountId,
  objectId: whatsappWebhookEventLogsTable.objectId,
  eventType: whatsappWebhookEventLogsTable.eventType,
  eventTs: whatsappWebhookEventLogsTable.eventTs,
  payload: whatsappWebhookEventLogsTable.payload,
  signature: whatsappWebhookEventLogsTable.signature,
  dedupKey: whatsappWebhookEventLogsTable.dedupKey,
  processed: whatsappWebhookEventLogsTable.processed,
  processedAt: whatsappWebhookEventLogsTable.processedAt,
  isActive: whatsappWebhookEventLogsTable.isActive,
  createdAt: whatsappWebhookEventLogsTable.createdAt,
  updatedAt: whatsappWebhookEventLogsTable.updatedAt,
} satisfies Record<keyof WebhookEventLogRecord, unknown>;

export class WebhookIngestService {
  static verifySignature(
    signature: string | null,
    rawBody: string,
    appSecret: string
  ): boolean {
    if (!signature) {
      return false;
    }

    const expectedSignature = `sha256=${createHash("sha256")
      .update(rawBody)
      .update(appSecret)
      .digest("hex")}`;

    return signature === expectedSignature;
  }

  static async logEvent(
    companyId: number,
    whatsappAccountId: number,
    payload: unknown,
    signature: string | null,
    eventTs: Date
  ): Promise<Result<{ logId: number }>> {
    const perf = createPerformanceLogger("WebhookIngestService.logEvent", {
      context: { companyId, whatsappAccountId },
    });

    try {
      const parsedPayload = payload as WebhookEventPayload;
      const objectId = parsedPayload.entry?.[0]?.id ?? null;
      const eventType = WebhookIngestService.determineEventType(parsedPayload);
      const dedupKey = WebhookIngestService.generateDedupKey(parsedPayload, eventTs);

      const [inserted] = await db
        .insert(whatsappWebhookEventLogsTable)
        .values({
          companyId,
          whatsappAccountId,
          objectId,
          eventType,
          eventTs,
          payload: parsedPayload as Record<string, unknown>,
          signature,
          dedupKey,
          processed: false,
        })
        .onConflictDoNothing({
          target: [
            whatsappWebhookEventLogsTable.companyId,
            whatsappWebhookEventLogsTable.dedupKey,
          ],
        })
        .returning({ id: whatsappWebhookEventLogsTable.id });

      if (!inserted) {
        perf.complete(0);
        return Result.ok({ logId: 0 });
      }

      perf.complete(1);
      return Result.ok({ logId: inserted.id });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to log event";
      perf.fail(errorMessage);
      return Result.internal("Failed to log event");
    }
  }

  static async processEvent(logId: number): Promise<Result<void>> {
    const perf = createPerformanceLogger("WebhookIngestService.processEvent", {
      context: { logId },
    });

    try {
      const result = await db.transaction(async (tx) => {
        const [log] = await tx
          .select({
            id: whatsappWebhookEventLogsTable.id,
            companyId: whatsappWebhookEventLogsTable.companyId,
            whatsappAccountId: whatsappWebhookEventLogsTable.whatsappAccountId,
            payload: whatsappWebhookEventLogsTable.payload,
            processed: whatsappWebhookEventLogsTable.processed,
          })
          .from(whatsappWebhookEventLogsTable)
          .where(eq(whatsappWebhookEventLogsTable.id, logId))
          .limit(1);

        if (!log) {
          return null;
        }

        if (log.processed) {
          return { alreadyProcessed: true };
        }

        const payload = log.payload as WebhookEventPayload;
        const eventType = WebhookIngestService.determineEventType(payload);

        if (eventType === "message") {
          await WebhookIngestService.processMessage(
            tx,
            log.companyId,
            log.whatsappAccountId,
            payload
          );
        } else if (eventType === "status") {
          await WebhookIngestService.processStatus(
            tx,
            log.companyId,
            log.whatsappAccountId,
            payload
          );
        }

        await tx
          .update(whatsappWebhookEventLogsTable)
          .set({
            processed: true,
            processedAt: sql`now()`,
            updatedAt: sql`now()`,
          })
          .where(eq(whatsappWebhookEventLogsTable.id, logId));

        return { success: true };
      });

      if (!result) {
        perf.fail("Event log not found");
        return Result.notFound("Event log not found");
      }

      if (result.alreadyProcessed) {
        perf.complete(0);
        return Result.ok(undefined);
      }

      perf.complete(1);
      return Result.ok(undefined);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to process event";
      perf.fail(errorMessage);
      return Result.internal("Failed to process event");
    }
  }

  static async listEventLogs(
    companyId: number,
    whatsappAccountId: number,
    cursor?: string,
    limit: number = 20,
    processed?: boolean
  ): Promise<
    Result<{
      items: WebhookEventLogRecord[];
      nextCursor: string | null;
      hasMore: boolean;
    }>
  > {
    const perf = createPerformanceLogger("WebhookIngestService.listEventLogs", {
      context: { companyId, whatsappAccountId },
    });

    try {
      const parsedCursor = cursor ? JSON.parse(Buffer.from(cursor, "base64").toString()) : null;

      const companyFilter = eq(
        whatsappWebhookEventLogsTable.companyId,
        companyId
      );
      const accountFilter = eq(
        whatsappWebhookEventLogsTable.whatsappAccountId,
        whatsappAccountId
      );
      const processedFilter =
        processed !== undefined
          ? eq(whatsappWebhookEventLogsTable.processed, processed)
          : undefined;

      const baseWhere: Array<typeof companyFilter | typeof accountFilter | typeof processedFilter> = [companyFilter, accountFilter, processedFilter].filter(
        Boolean
      );

      const cursorCondition = parsedCursor
        ? sql`(${whatsappWebhookEventLogsTable.eventTs}, ${whatsappWebhookEventLogsTable.id}) < (${parsedCursor.eventTs}, ${parsedCursor.id})`
        : undefined;

      const whereClause = cursorCondition
        ? and(...baseWhere, cursorCondition)
        : and(...baseWhere);

      const data = await db
        .select(BASE_SELECTION)
        .from(whatsappWebhookEventLogsTable)
        .where(whereClause)
        .orderBy(
          desc(whatsappWebhookEventLogsTable.eventTs),
          desc(whatsappWebhookEventLogsTable.id)
        )
        .limit(limit + 1);

      const hasMore = data.length > limit;
      const items = hasMore ? data.slice(0, limit) : data;
      const nextCursor =
        hasMore && items.length > 0
          ? Buffer.from(
              JSON.stringify({
                eventTs: items[items.length - 1]!.eventTs
                  ? formatISO(items[items.length - 1]!.eventTs)
                  : null,
                id: items[items.length - 1]!.id,
              })
            ).toString("base64")
          : null;

      perf.complete(items.length);
      return Result.ok({
        items: items.map((item) => ({
          ...item,
          eventType: item.eventType as WebhookEventType,
        })),
        nextCursor,
        hasMore,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to list event logs";
      perf.fail(errorMessage);
      return Result.internal("Failed to list event logs");
    }
  }

  private static determineEventType(
    payload: WebhookEventPayload
  ): WebhookEventType {
    const firstChange = payload.entry?.[0]?.changes?.[0];
    if (!firstChange) return "other";

    if (firstChange.field === "messages") {
      return "message";
    } else if (firstChange.field === "message_template_status_update") {
      return "status";
    }

    return "other";
  }

  private static generateDedupKey(
    payload: WebhookEventPayload,
    eventTs: Date
  ): string {
    const firstEntry = payload.entry?.[0];
    const firstChange = firstEntry?.changes?.[0];

    if (firstChange?.value?.messages?.[0]?.id) {
      return `msg_${firstChange.value.messages[0].id}`;
    } else if (firstChange?.value?.statuses?.[0]?.id) {
      return `status_${firstChange.value.statuses[0].id}`;
    } else if (firstEntry?.id) {
      return `entry_${firstEntry.id}_${formatISO(eventTs)}`;
    }

    return `unknown_${formatISO(eventTs)}`;
  }

  private static async processMessage(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    companyId: number,
    whatsappAccountId: number,
    payload: WebhookEventPayload
  ): Promise<void> {
    const firstChange = payload.entry?.[0]?.changes?.[0];
    const messagePayload = firstChange?.value as WebhookMessagePayload;

    if (!messagePayload?.messages?.[0]) {
      return;
    }

    const message = messagePayload.messages[0];
    const contact = messagePayload.contacts?.[0];

    if (!contact) {
      return;
    }

    const phoneNumber = contact.wa_id;
    const contactName = contact.profile?.name ?? phoneNumber;

    const ts = new Date(parseInt(message.timestamp, 10) * 1000);

    await tx
      .insert(contactsTable)
      .values({
        companyId,
        phone: phoneNumber,
        name: contactName,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [contactsTable.companyId, contactsTable.phone],
        set: {
          name: contactName,
          updatedAt: sql`now()`,
        },
      });

    const [contactRecord] = await tx
      .select({ id: contactsTable.id })
      .from(contactsTable)
      .where(
        and(
          eq(contactsTable.companyId, companyId),
          eq(contactsTable.phone, phoneNumber)
        )
      )
      .limit(1);

    if (!contactRecord) {
      return;
    }

    const mediaUrl = message.image?.url || message.video?.url || message.audio?.url || message.document?.url || null;
    const mediaType = message.type === "image" || message.type === "video" || message.type === "audio" || message.type === "document" ? message.type : null;
    const messageContent = message.text?.body || (mediaType ? `[${mediaType}]` : "[Media]");

    await tx
      .insert(conversationsTable)
      .values({
        companyId,
        contactId: contactRecord.id,
        whatsappAccountId,
        lastMessagePreview: messageContent,
        lastMessageTime: ts,
        isActive: true,
      })
      .onConflictDoUpdate({
        target: [conversationsTable.companyId, conversationsTable.contactId, conversationsTable.whatsappAccountId],
        set: {
          lastMessagePreview: messageContent,
          lastMessageTime: ts,
          updatedAt: sql`now()`,
        },
      });

    const [conversationRecord] = await tx
      .select({ id: conversationsTable.id })
      .from(conversationsTable)
      .where(
        and(
          eq(conversationsTable.companyId, companyId),
          eq(conversationsTable.contactId, contactRecord.id)
        )
      )
      .limit(1);

    if (!conversationRecord) {
      return;
    }

    await tx.insert(messagesTable).values({
      conversationId: conversationRecord.id,
      companyId,
      contactId: contactRecord.id,
      whatsappAccountId,
      direction: "inbound",
      status: "delivered",
      content: messageContent,
      mediaUrl,
      mediaType,
      providerMessageId: message.id,
      isActive: true,
      createdAt: ts,
    });
  }

  private static async processStatus(
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    companyId: number,
    whatsappAccountId: number,
    payload: WebhookEventPayload
  ): Promise<void> {
    const firstChange = payload.entry?.[0]?.changes?.[0];
    const statusPayload = firstChange?.value as WebhookStatusPayload;

    if (!statusPayload?.statuses?.[0]) {
      return;
    }

    const status = statusPayload.statuses[0];

    await tx
      .update(messagesTable)
      .set({
        providerStatus: status.status,
        updatedAt: sql`now()`,
      })
      .where(
        and(
          eq(messagesTable.companyId, companyId),
          eq(messagesTable.providerMessageId, status.id)
        )
      );
  }
}
