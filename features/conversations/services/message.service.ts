import { db } from "@/db/drizzle";
import {
  conversationsTable,
  messagesTable,
  contactsTable,
  whatsappAccountsTable,
} from "@/db/schema";
import { Result } from "@/lib/result";
import { and, desc, eq, lt, sql } from "drizzle-orm";
import { formatISO } from "date-fns";
import type {
  MessageListInput,
  MessageListResponse,
  MessageResponse,
  SendMessageInput,
} from "../schemas/message.schema";

const DEFAULT_LIMIT = 30;
const BASE_SELECTION = {
  id: messagesTable.id,
  companyId: messagesTable.companyId,
  conversationId: messagesTable.conversationId,
  messageId: messagesTable.messageId,
  direction: messagesTable.direction,
  type: messagesTable.type,
  content: messagesTable.content,
  status: messagesTable.status,
  timestamp: messagesTable.timestamp,
  createdAt: messagesTable.createdAt,
} satisfies Record<keyof MessageResponse, unknown>;

function encodeCursor(record: MessageResponse): string {
  return Buffer.from(
    JSON.stringify({
      timestamp: record.timestamp ? formatISO(record.timestamp as Date) : null,
      id: record.id,
    })
  ).toString("base64");
}

function decodeCursor(cursor?: string): { timestamp: string | null; id: number } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString());
    if (typeof parsed.id === "number") return parsed;
    return null;
  } catch {
    return null;
  }
}

type ConversationRow = {
  id: number;
  companyId: number;
  phoneNumber: string;
  whatsappAccountId: number | null;
  lastMessageAt: Date | string;
  unreadCount: number;
  status: string;
  contactId: number | null;
  assignedTo: number | null;
  createdAt: Date | string;
  updatedAt: Date | string | null;
};

export class MessageService {
  static async list(
    input: MessageListInput & { companyId: number }
  ): Promise<Result<MessageListResponse>> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const cursor = decodeCursor(input.cursor);

    const whereParts = [
      eq(messagesTable.companyId, input.companyId),
      eq(messagesTable.conversationId, input.conversationId),
    ];

    const cursorCondition = cursor
      ? lt(
          sql`(${messagesTable.timestamp}, ${messagesTable.id})`,
          sql`(${cursor.timestamp ? cursor.timestamp : null}, ${cursor.id})`
        )
      : undefined;

    const whereClause = cursorCondition ? and(...whereParts, cursorCondition) : and(...whereParts);

    const data = await db
      .select({
        ...BASE_SELECTION,
        direction: messagesTable.direction,
      })
      .from(messagesTable)
      .where(whereClause)
      .orderBy(desc(messagesTable.timestamp), desc(messagesTable.id))
      .limit(limit + 1);

    const hasMore = data.length > limit;
    const items = (hasMore ? data.slice(0, limit) : data).map((row) => ({
      ...row,
      direction: (row.direction as "inbound" | "outbound") ?? "inbound",
      content: (row.content as Record<string, any>) ?? {},
    }));
    const nextCursor = hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!) : null;

    return Result.ok({ items, nextCursor, hasMore });
  }

  static async send(
    input: SendMessageInput & { companyId: number; userId: number }
  ): Promise<Result<MessageResponse>> {
    // 1) Load or create conversation (by id or by phone)
    let conversationId = input.conversationId;
    let convo: ConversationRow | null = null;

    if (conversationId !== undefined) {
      convo = (await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.companyId, input.companyId)
        ),
      })) as ConversationRow | null;
      if (convo) conversationId = convo.id;
    }

    const phoneNumber = convo?.phoneNumber ?? input.phoneNumber;

    if (!convo && phoneNumber) {
      // Try to find by phone
      convo = (await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.companyId, input.companyId),
          eq(conversationsTable.phoneNumber, phoneNumber)
        ),
        orderBy: desc(conversationsTable.id),
      })) as ConversationRow | null;
      if (convo) conversationId = convo.id;
    }

    if (!convo) {
      // Create with default active WA account
      const accountDefault = await db.query.whatsappAccountsTable.findFirst({
        where: and(
          eq(whatsappAccountsTable.companyId, input.companyId),
          eq(whatsappAccountsTable.isActive, true),
          eq(whatsappAccountsTable.isDefault, true)
        ),
      });
      const accountFallback =
        !accountDefault
          ? await db.query.whatsappAccountsTable.findFirst({
              where: and(
                eq(whatsappAccountsTable.companyId, input.companyId),
                eq(whatsappAccountsTable.isActive, true)
              ),
              orderBy: desc(whatsappAccountsTable.createdAt),
            })
          : null;
      const accountToUse = accountDefault ?? accountFallback;
      if (!accountToUse) {
        return Result.fail("No active WhatsApp account available");
      }

      if (!phoneNumber) {
        return Result.fail("Phone number required");
      }

      // ensure contact exists
      const existingContact = await db.query.contactsTable.findFirst({
        where: and(eq(contactsTable.companyId, input.companyId), eq(contactsTable.phoneNumber, phoneNumber)),
      });
      const contactId =
        existingContact?.id ??
        (
          await db
            .insert(contactsTable)
            .values({
              companyId: input.companyId,
              phoneNumber,
            })
            .returning({ id: contactsTable.id })
        )[0]?.id;

      const [createdConvo] = await db
        .insert(conversationsTable)
        .values({
          companyId: input.companyId,
          contactId: contactId ?? null,
          phoneNumber: phoneNumber ?? "",
          whatsappAccountId: accountToUse.id,
          lastMessageAt: sql`now()` as any,
          unreadCount: 0,
          status: "active",
        })
        .returning({
          id: conversationsTable.id,
          companyId: conversationsTable.companyId,
          phoneNumber: conversationsTable.phoneNumber,
          whatsappAccountId: conversationsTable.whatsappAccountId,
          lastMessageAt: conversationsTable.lastMessageAt,
          unreadCount: conversationsTable.unreadCount,
          status: conversationsTable.status,
          contactId: conversationsTable.contactId,
          assignedTo: conversationsTable.assignedTo,
          createdAt: conversationsTable.createdAt,
          updatedAt: conversationsTable.updatedAt,
        });
      convo = (createdConvo as ConversationRow | undefined) ?? null;
      conversationId = createdConvo?.id ?? conversationId;
    }

    if (!convo || !convo.whatsappAccountId) return Result.fail("No WhatsApp account linked");
    if (conversationId === undefined) return Result.fail("Conversation missing");

    // 2) Load WhatsApp account credentials (must be active)
    const account = await db.query.whatsappAccountsTable.findFirst({
      where: and(
        eq(whatsappAccountsTable.id, convo.whatsappAccountId),
        eq(whatsappAccountsTable.companyId, input.companyId),
        eq(whatsappAccountsTable.isActive, true)
      ),
    });
    if (!account) return Result.fail("WhatsApp account not found or inactive");

    // 3) Send via internal API route
    const apiRes = await fetch(
      new URL("/api/whatsapp/send", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          companyId: input.companyId,
          recipientPhoneNumber: convo.phoneNumber,
          text: input.content?.text ?? "",
        }),
      }
    );

    const apiData = await apiRes.json().catch(() => ({}));

    if (!apiRes.ok) {
      const errText =
        apiData && typeof apiData === "object" && "error" in apiData
          ? (apiData as any).error
          : "Failed to send message";
      return Result.fail(`WhatsApp send failed: ${errText}`);
    }

    if (apiData && typeof apiData === "object" && "success" in apiData && apiData.success === false) {
      const errText = "error" in apiData ? (apiData as any).error ?? "Unknown error" : "Unknown error";
      return Result.fail(`WhatsApp send failed: ${errText}`);
    }

    const sentMessageId =
      (apiData && typeof apiData === "object" && "messageId" in apiData && typeof apiData.messageId === "string"
        ? apiData.messageId
        : null) ?? crypto.randomUUID();

    // 4) Insert outbound message and update conversation lastMessageAt/unreadCount
    const result = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messagesTable)
        .values({
          companyId: input.companyId,
          conversationId,
          messageId: sentMessageId,
          direction: "outbound",
          type: input.type,
          content: input.content as any,
          status: "sent",
          timestamp: sql`now()` as any,
        })
        .returning({
          ...BASE_SELECTION,
          direction: messagesTable.direction,
        });

      await tx
        .update(conversationsTable)
        .set({
          lastMessageAt: sql`now()` as any,
          unreadCount: 0,
          updatedAt: sql`now()` as any,
        })
        .where(
          and(
            eq(conversationsTable.id, conversationId),
            eq(conversationsTable.companyId, input.companyId)
          )
        );

      return {
        ...message,
        direction: "outbound" as const,
        content: (message.content as Record<string, any>) ?? {},
      };
    });

    return Result.ok(result);
  }

  static async recordInbound(
    input: {
      companyId: number;
      conversationId: number;
      messageId: string;
      type: string;
      content: Record<string, unknown>;
      status?: string;
      timestamp?: Date | string;
    }
  ): Promise<Result<MessageResponse>> {
    const [message] = await db
      .insert(messagesTable)
      .values({
        companyId: input.companyId,
        conversationId: input.conversationId,
        messageId: input.messageId,
        direction: "inbound",
        type: input.type,
        content: input.content as any,
        status: input.status ?? "delivered",
        timestamp: (input.timestamp as any) ?? sql`now()` as any,
      })
      .returning({
        ...BASE_SELECTION,
        direction: messagesTable.direction,
      });

    await db
      .update(conversationsTable)
      .set({
        lastMessageAt: (input.timestamp as any) ?? sql`now()` as any,
        unreadCount: sql`${conversationsTable.unreadCount} + 1`,
        updatedAt: sql`now()` as any,
      })
      .where(and(eq(conversationsTable.id, input.conversationId), eq(conversationsTable.companyId, input.companyId)));

    return Result.ok({
      ...message,
      direction: "inbound" as const,
      content: (message.content as Record<string, any>) ?? {},
    });
  }

  static async updateStatus(
    input: { companyId: number; messageId: string; status: string }
  ): Promise<Result<null>> {
    const [updated] = await db
      .update(messagesTable)
      .set({ status: input.status, timestamp: sql`now()` as any })
      .where(and(eq(messagesTable.companyId, input.companyId), eq(messagesTable.messageId, input.messageId)))
      .returning({ id: messagesTable.id });

    if (!updated) return Result.notFound("Message not found");
    return Result.ok(null);
  }
}
