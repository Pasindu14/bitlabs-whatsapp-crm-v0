import { db } from "@/db/drizzle";
import { whatsappAccountsTable } from "@/db/schema";
import { Result } from "@/lib/result";
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

    return Result.ok({ items, nextCursor, hasMore });
  }

  static async get(
    input: WhatsappAccountGetInput
  ): Promise<Result<WhatsappAccountRecord>> {
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
      return Result.notFound("WhatsApp account not found");
    }

    return Result.ok(record);
  }

  static async create(
    input: WhatsappAccountCreateServerInput
  ): Promise<Result<WhatsappAccountRecord>> {
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

      return inserted;
    });

    return Result.ok(result);
  }

  static async update(
    input: WhatsappAccountUpdateServerInput
  ): Promise<Result<WhatsappAccountRecord>> {
    const result = await db.transaction(async (tx) => {
      const existing = await tx.query.whatsappAccountsTable.findFirst({
        where: and(
          eq(whatsappAccountsTable.companyId, input.companyId),
          eq(whatsappAccountsTable.id, input.id)
        ),
      });
      if (!existing) {
        return null;
      }

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

      return updated;
    });

    if (!result) {
      return Result.notFound("WhatsApp account not found");
    }

    return Result.ok(result);
  }

  static async setDefault(
    input: WhatsappAccountSetDefaultInput
  ): Promise<Result<null>> {
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

      return true;
    });

    if (!updated) {
      return Result.notFound("WhatsApp account not found");
    }

    return Result.ok(null);
  }

  static async deactivate(
    input: WhatsappAccountSetDefaultInput
  ): Promise<Result<null>> {
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

    if (!updated) {
      return Result.notFound("WhatsApp account not found");
    }

    return Result.ok(null);
  }

  static async activate(
    input: WhatsappAccountSetDefaultInput
  ): Promise<Result<null>> {
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

    if (!updated) {
      return Result.notFound("WhatsApp account not found");
    }

    return Result.ok(null);
  }
}
