import { db } from "@/db/drizzle";
import { conversationsTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { formatISO } from "date-fns";
import type {
  ConversationListInput,
  ConversationListResponse,
  ConversationResponse,
} from "../schemas/conversation.schema";

const DEFAULT_LIMIT = 20;
const BASE_SELECTION = {
  id: conversationsTable.id,
  companyId: conversationsTable.companyId,
  contactId: conversationsTable.contactId,
  phoneNumber: conversationsTable.phoneNumber,
  whatsappAccountId: conversationsTable.whatsappAccountId,
  lastMessageAt: conversationsTable.lastMessageAt,
  unreadCount: conversationsTable.unreadCount,
  status: conversationsTable.status,
  assignedTo: conversationsTable.assignedTo,
  createdAt: conversationsTable.createdAt,
  updatedAt: conversationsTable.updatedAt,
} satisfies Record<keyof ConversationResponse, unknown>;

function encodeCursor(record: ConversationResponse): string {
  return Buffer.from(
    JSON.stringify({
      lastMessageAt: record.lastMessageAt ? formatISO(record.lastMessageAt as Date) : null,
      id: record.id,
    })
  ).toString("base64");
}

function decodeCursor(cursor?: string): { lastMessageAt: string | null; id: number } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString());
    if (typeof parsed.id === "number") return parsed;
    return null;
  } catch {
    return null;
  }
}

export class ConversationService {
  static async list(
    input: ConversationListInput & { companyId: number }
  ): Promise<Result<ConversationListResponse>> {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const cursor = decodeCursor(input.cursor);

    const whereParts = [eq(conversationsTable.companyId, input.companyId)] as any[];
    if (input.status) {
      whereParts.push(eq(conversationsTable.status, input.status));
    }
    if (input.assignedTo !== undefined) {
      whereParts.push(eq(conversationsTable.assignedTo, input.assignedTo));
    }
    if (input.whatsappAccountId !== undefined) {
      whereParts.push(eq(conversationsTable.whatsappAccountId, input.whatsappAccountId));
    }
    if (input.search) {
      whereParts.push(ilike(conversationsTable.phoneNumber, `%${input.search}%`));
    }

    const cursorCondition = cursor
      ? lt(
          sql`(${conversationsTable.lastMessageAt}, ${conversationsTable.id})`,
          sql`(${cursor.lastMessageAt ? cursor.lastMessageAt : null}, ${cursor.id})`
        )
      : undefined;

    const whereClause = cursorCondition
      ? and(...whereParts, cursorCondition)
      : and(...whereParts);

    const data = await db
      .select({
        ...BASE_SELECTION,
        status: conversationsTable.status,
      })
      .from(conversationsTable)
      .where(whereClause)
      .orderBy(desc(conversationsTable.lastMessageAt), desc(conversationsTable.id))
      .limit(limit + 1);

    const hasMore = data.length > limit;
    const items = (hasMore ? data.slice(0, limit) : data).map((row) => ({
      ...row,
      status: (row.status as "active" | "archived") ?? "active",
    }));
    const nextCursor = hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!) : null;

    return Result.ok({ items, nextCursor, hasMore });
  }

  static async markRead(input: { id: number; companyId: number }): Promise<Result<null>> {
    const [updated] = await db
      .update(conversationsTable)
      .set({ unreadCount: 0, updatedAt: sql`now()` })
      .where(and(eq(conversationsTable.id, input.id), eq(conversationsTable.companyId, input.companyId)))
      .returning({ id: conversationsTable.id });

    if (!updated) return Result.notFound("Conversation not found");
    return Result.ok(null);
  }

  static async archive(
    input: { id: number; companyId: number; archive: boolean; userId: number }
  ): Promise<Result<null>> {
    const [updated] = await db
      .update(conversationsTable)
      .set({
        status: input.archive ? "archived" : "active",
        updatedAt: sql`now()` as any,
      })
      .where(and(eq(conversationsTable.id, input.id), eq(conversationsTable.companyId, input.companyId)))
      .returning({ id: conversationsTable.id });

    if (!updated) return Result.notFound("Conversation not found");
    return Result.ok(null);
  }

  static async assign(
    input: { id: number; assignedTo: number | null; companyId: number; userId: number }
  ): Promise<Result<null>> {
    const [updated] = await db
      .update(conversationsTable)
      .set({ assignedTo: input.assignedTo, updatedAt: sql`now()` as any })
      .where(and(eq(conversationsTable.id, input.id), eq(conversationsTable.companyId, input.companyId)))
      .returning({ id: conversationsTable.id });

    if (!updated) return Result.notFound("Conversation not found");
    return Result.ok(null);
  }

  static async touchLastMessage(
    input: { id: number; companyId: number; timestamp: Date | string; unreadDelta?: number }
  ): Promise<Result<null>> {
    const [updated] = await db
      .update(conversationsTable)
      .set({
        lastMessageAt: input.timestamp as any,
        unreadCount: sql`${conversationsTable.unreadCount} + ${input.unreadDelta ?? 0}`,
        updatedAt: sql`now()` as any,
      })
      .where(and(eq(conversationsTable.id, input.id), eq(conversationsTable.companyId, input.companyId)))
      .returning({ id: conversationsTable.id });

    if (!updated) return Result.notFound("Conversation not found");
    return Result.ok(null);
  }
}
