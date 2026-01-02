import { db } from "@/db/drizzle";
import { conversationsTable, messagesTable } from "@/db/schema";
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
    // Insert outbound message and update conversation lastMessageAt/unreadCount
    const result = await db.transaction(async (tx) => {
      const [message] = await tx
        .insert(messagesTable)
        .values({
          companyId: input.companyId,
          conversationId: input.conversationId,
          messageId: crypto.randomUUID(),
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
        .where(and(eq(conversationsTable.id, input.conversationId), eq(conversationsTable.companyId, input.companyId)));

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
