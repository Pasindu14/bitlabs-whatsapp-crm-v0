import { and, desc, eq, gte, ilike, lte, lt, or, SQL } from "drizzle-orm";
import { db } from "@/db/drizzle";
import { messagesTable, whatsappAccountsTable } from "@/db/schema";
import { createPerformanceLogger } from "@/lib/logger";
import { Result } from "@/lib/result";
import type {
  AccountAnalyticsGetServerInput,
  AccountAnalyticsListServerInput,
  AccountAnalyticsListResponse,
  AccountAnalyticsDetail,
} from "../schemas/analytics-schema";

function encodeCursor(whatsappAccountId: number, receivedCount: number): string {
  return Buffer.from(`${whatsappAccountId}:${receivedCount}`).toString("base64");
}

function decodeCursor(cursor?: string): { whatsappAccountId: number; receivedCount: number } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const [whatsappAccountId, receivedCount] = decoded.split(":").map(Number);
    return { whatsappAccountId, receivedCount };
  } catch {
    return null;
  }
}

export class AnalyticsService {
  static async list(input: AccountAnalyticsListServerInput): Promise<Result<AccountAnalyticsListResponse>> {
    const logger = createPerformanceLogger("AnalyticsService.list", {
      context: { companyId: input.companyId, limit: input.limit },
    });

    try {
      const fetchLimit = input.limit + 1;
      const cursorDecoded = decodeCursor(input.cursor);

      const whereClauses: SQL<unknown>[] = [
        eq(whatsappAccountsTable.companyId, input.companyId),
      ];

      if (input.status === "active") {
        whereClauses.push(eq(whatsappAccountsTable.isActive, true));
      } else if (input.status === "inactive") {
        whereClauses.push(eq(whatsappAccountsTable.isActive, false));
      }

      if (input.accountId) {
        whereClauses.push(eq(whatsappAccountsTable.id, input.accountId));
      }

      if (input.searchTerm) {
        const searchCondition = or(
          ilike(whatsappAccountsTable.name, `%${input.searchTerm}%`),
          ilike(whatsappAccountsTable.phoneNumberId, `%${input.searchTerm}%`)
        );
        if (searchCondition) whereClauses.push(searchCondition);
      }

      const dateFilter: SQL<unknown>[] = [];
      if (input.startDate) {
        dateFilter.push(gte(messagesTable.createdAt, input.startDate));
      }
      if (input.endDate) {
        dateFilter.push(lte(messagesTable.createdAt, input.endDate));
      }

      const cursorCondition = cursorDecoded
        ? lt(whatsappAccountsTable.id, cursorDecoded.whatsappAccountId)
        : undefined;

      if (cursorCondition) {
        whereClauses.push(cursorCondition);
      }

      const accounts = await db.query.whatsappAccountsTable.findMany({
        where: and(...whereClauses),
        orderBy: [desc(whatsappAccountsTable.id)],
        limit: fetchLimit,
        columns: {
          id: true,
          name: true,
          phoneNumberId: true,
          isActive: true,
        },
      });

      const accountIds = accounts.map((a) => a.id);
      let analyticsData: Record<number, { receivedCount: number; sentCount: number }> = {};

      if (accountIds.length > 0) {
        const messageFilters: SQL<unknown>[] = [
          eq(messagesTable.companyId, input.companyId),
          eq(messagesTable.whatsappAccountId, accountIds[0]),
          eq(messagesTable.isActive, true),
        ];

        if (accountIds.length > 1) {
          const accountFilter = or(...accountIds.map((id) => eq(messagesTable.whatsappAccountId, id)));
          if (accountFilter) messageFilters[1] = accountFilter;
        }

        if (dateFilter.length > 0) {
          const dateCondition = and(...dateFilter);
          if (dateCondition) messageFilters.push(dateCondition);
        }

        const messages = await db.query.messagesTable.findMany({
          where: and(...messageFilters),
          columns: {
            whatsappAccountId: true,
            direction: true,
          },
        });

        analyticsData = messages.reduce((acc, msg) => {
          const accountId = msg.whatsappAccountId;
          if (accountId && !acc[accountId]) {
            acc[accountId] = { receivedCount: 0, sentCount: 0 };
          }
          if (accountId && msg.direction === "inbound") {
            acc[accountId].receivedCount++;
          } else if (accountId && msg.direction === "outbound") {
            acc[accountId].sentCount++;
          }
          return acc;
        }, {} as Record<number, { receivedCount: number; sentCount: number }>);
      }

      const items = accounts
        .slice(0, input.limit)
        .map((account) => ({
          whatsappAccountId: account.id,
          name: account.name,
          phone: account.phoneNumberId,
          receivedCount: analyticsData[account.id]?.receivedCount || 0,
          sentCount: analyticsData[account.id]?.sentCount || 0,
          isActive: account.isActive,
        }))
        .sort((a, b) => b.receivedCount - a.receivedCount || b.whatsappAccountId - a.whatsappAccountId);

      const hasMore = accounts.length > input.limit;
      const nextCursor = hasMore && accounts[input.limit]
        ? encodeCursor(accounts[input.limit].id, 0)
        : undefined;

      logger.complete(items.length);
      return Result.ok(
        {
          accounts: items,
          nextCursor,
          hasMore,
        },
        "Analytics loaded"
      );
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to load analytics");
    }
  }

  static async getByAccount(input: AccountAnalyticsGetServerInput): Promise<Result<AccountAnalyticsDetail>> {
    const logger = createPerformanceLogger("AnalyticsService.getByAccount", {
      context: { companyId: input.companyId, whatsappAccountId: input.whatsappAccountId },
    });

    try {
      const messageFilters: SQL<unknown>[] = [
        eq(messagesTable.companyId, input.companyId),
        eq(messagesTable.whatsappAccountId, input.whatsappAccountId),
        eq(messagesTable.isActive, true),
      ];

      if (input.startDate) {
        messageFilters.push(gte(messagesTable.createdAt, input.startDate));
      }
      if (input.endDate) {
        messageFilters.push(lte(messagesTable.createdAt, input.endDate));
      }

      const messages = await db.query.messagesTable.findMany({
        where: and(...messageFilters),
        columns: {
          direction: true,
          createdAt: true,
        },
        orderBy: [desc(messagesTable.createdAt)],
      });

      const receivedCount = messages.filter((m) => m.direction === "inbound").length;
      const sentCount = messages.filter((m) => m.direction === "outbound").length;

      const dailySeries: Array<{ date: string; received: number; sent: number }> = [];

      if (messages.length > 0) {
        const dailyMap = new Map<string, { received: number; sent: number }>();
        messages.forEach((msg) => {
          const dateKey = msg.createdAt.toISOString().split("T")[0];
          if (!dailyMap.has(dateKey)) {
            dailyMap.set(dateKey, { received: 0, sent: 0 });
          }
          const entry = dailyMap.get(dateKey)!;
          if (msg.direction === "inbound") {
            entry.received++;
          } else if (msg.direction === "outbound") {
            entry.sent++;
          }
        });
        dailySeries.push(
          ...Array.from(dailyMap.entries())
            .map(([date, counts]) => ({ date, ...counts }))
            .sort((a, b) => a.date.localeCompare(b.date))
        );
      }

      logger.complete(messages.length);
      return Result.ok(
        {
          receivedCount,
          sentCount,
          dailySeries,
        },
        "Account analytics loaded"
      );
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to load account analytics");
    }
  }
}
