import { db } from "@/db/drizzle";
import { contactsTable } from "@/db/schema";
import { Result } from "@/lib/result";
import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm";
import { formatISO } from "date-fns";
import type {
  ContactCreateInput,
  ContactListInput,
  ContactResponse,
  ContactUpdateInput,
} from "../schemas/contact.schema";

const DEFAULT_LIMIT = 20;
const BASE_SELECTION = {
  id: contactsTable.id,
  companyId: contactsTable.companyId,
  phoneNumber: contactsTable.phoneNumber,
  name: contactsTable.name,
  email: contactsTable.email,
  notes: contactsTable.notes,
  tags: contactsTable.tags,
  createdAt: contactsTable.createdAt,
  updatedAt: contactsTable.updatedAt,
} satisfies Record<keyof ContactResponse, unknown>;

function encodeCursor(record: ContactResponse): string {
  return Buffer.from(
    JSON.stringify({
      createdAt: record.createdAt ? formatISO(record.createdAt as Date) : null,
      id: record.id,
    })
  ).toString("base64");
}

function decodeCursor(cursor?: string): { createdAt: string | null; id: number } | null {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64").toString());
    if (typeof parsed.id === "number") return parsed;
    return null;
  } catch {
    return null;
  }
}

export class ContactService {
  static async list(
    input: ContactListInput & { companyId: number }
  ): Promise<
    Result<{
      items: ContactResponse[];
      nextCursor: string | null;
      hasMore: boolean;
    }>
  > {
    const limit = input.limit ?? DEFAULT_LIMIT;
    const cursor = decodeCursor(input.cursor);

    const whereParts = [eq(contactsTable.companyId, input.companyId)] as any[];

    if (input.search) {
      whereParts.push(
        or(
          ilike(contactsTable.phoneNumber, `%${input.search}%`),
          ilike(contactsTable.name, `%${input.search}%`)
        )
      );
    }

    if (input.tags && input.tags.length > 0) {
      whereParts.push(sql`${contactsTable.tags} \\?\\| ${input.tags}` as unknown as ReturnType<typeof and>);
    }

    const cursorCondition = cursor
      ? lt(
          sql`(${contactsTable.createdAt}, ${contactsTable.id})`,
          sql`(${cursor.createdAt ? cursor.createdAt : null}, ${cursor.id})`
        )
      : undefined;

    const whereClause = cursorCondition
      ? and(...whereParts, cursorCondition)
      : and(...whereParts);

    const data = await db
      .select({
        ...BASE_SELECTION,
        tags: contactsTable.tags,
      })
      .from(contactsTable)
      .where(whereClause)
      .orderBy(desc(contactsTable.createdAt), desc(contactsTable.id))
      .limit(limit + 1);

    const hasMore = data.length > limit;
    const items = (hasMore ? data.slice(0, limit) : data).map((row) => ({
      ...row,
      tags: (row.tags as string[] | null | undefined) ?? null,
    }));
    const nextCursor = hasMore && items.length > 0 ? encodeCursor(items[items.length - 1]!) : null;

    return Result.ok({ items, nextCursor, hasMore });
  }

  static async upsert(
    input: (ContactCreateInput | ContactUpdateInput) & { companyId: number; userId: number }
  ): Promise<Result<ContactResponse>> {
    const isUpdate = "id" in input && typeof (input as ContactUpdateInput).id === "number";

    if (isUpdate) {
      const updateInput = input as ContactUpdateInput & { companyId: number; userId: number };
      const existing = await db.query.contactsTable.findFirst({
        where: and(eq(contactsTable.id, updateInput.id), eq(contactsTable.companyId, updateInput.companyId)),
      });
      if (!existing) return Result.notFound("Contact not found");

      const phoneToUse = updateInput.phoneNumber ?? existing.phoneNumber;
      const existingByPhone = await db.query.contactsTable.findFirst({
        where: and(eq(contactsTable.companyId, updateInput.companyId), eq(contactsTable.phoneNumber, phoneToUse)),
      });
      if (existingByPhone && existingByPhone.id !== existing.id) {
        return Result.conflict("Phone number already exists for this company");
      }

      const [updated] = await db
        .update(contactsTable)
        .set({
          phoneNumber: phoneToUse,
          name: updateInput.name ?? existing.name,
          email: updateInput.email ?? existing.email,
          notes: updateInput.notes ?? existing.notes,
          tags: updateInput.tags ?? (existing.tags as string[] | null | undefined),
          updatedAt: sql`now()` as any,
        })
        .where(and(eq(contactsTable.id, updateInput.id), eq(contactsTable.companyId, updateInput.companyId)))
        .returning({
          ...BASE_SELECTION,
          tags: contactsTable.tags,
        });

      if (!updated) return Result.notFound("Contact not found");
      return Result.ok({
        ...updated,
        tags: (updated.tags as string[] | null | undefined) ?? null,
      });
    }

    const createInput = input as ContactCreateInput & { companyId: number; userId: number };

    const existingByPhone = await db.query.contactsTable.findFirst({
      where: and(eq(contactsTable.companyId, createInput.companyId), eq(contactsTable.phoneNumber, createInput.phoneNumber)),
    });
    if (existingByPhone) {
      return Result.conflict("Phone number already exists for this company");
    }

    const [created] = await db
      .insert(contactsTable)
      .values({
        companyId: createInput.companyId,
        phoneNumber: createInput.phoneNumber,
        name: createInput.name,
        email: createInput.email,
        notes: createInput.notes,
        tags: createInput.tags,
      })
      .returning({
        ...BASE_SELECTION,
        tags: contactsTable.tags,
      });

    return Result.ok({
      ...created,
      tags: (created.tags as string[] | null | undefined) ?? null,
    });
  }
}
