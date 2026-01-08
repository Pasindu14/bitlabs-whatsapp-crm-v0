import { and, desc, eq, ilike, lt, or, SQL } from "drizzle-orm";
import { db } from "@/db/drizzle";
import {
  contactsTable,
  conversationsTable,
  ordersTable,
} from "@/db/schema";
import { createPerformanceLogger } from "@/lib/logger";
import { Result } from "@/lib/result";
import type {
  OrderCreateServerInput,
  OrderDeactivateInput,
  OrderGetByIdInput,
  OrderListInput,
  OrderResponse,
  OrderUpdateServerInput,
  OrderUpdateStatusServerInput,
  OrderStatus,
} from "../schemas/order-schema";

const TERMINAL_STATUSES: OrderStatus[] = ["delivered", "cancelled"];

function encodeCursor(createdAt: Date, id: number) {
  return Buffer.from(`${createdAt.getTime()}:${id}`).toString("base64");
}

function decodeCursor(cursor?: string) {
  if (!cursor) return undefined;
  const decoded = Buffer.from(cursor, "base64").toString("utf-8");
  const [ts, id] = decoded.split(":");
  const createdAtNum = Number(ts);
  const idNum = Number(id);
  if (Number.isNaN(createdAtNum) || Number.isNaN(idNum)) return undefined;
  return { createdAt: new Date(createdAtNum), id: idNum };
}

export class OrderService {
  static async create(input: OrderCreateServerInput): Promise<Result<OrderResponse>> {
    const logger = createPerformanceLogger("OrderService.create", {
      context: {
        companyId: input.companyId,
        contactId: input.contactId,
        conversationId: input.conversationId ?? null,
      },
    });
    try {
      const contact = await db.query.contactsTable.findFirst({
        where: and(eq(contactsTable.id, input.contactId), eq(contactsTable.companyId, input.companyId)),
      });

      if (!contact) {
        logger.fail(new Error("Contact not found"));
        return Result.fail("Contact not found");
      }

      if (input.conversationId) {
        const conversation = await db.query.conversationsTable.findFirst({
          where: and(eq(conversationsTable.id, input.conversationId), eq(conversationsTable.companyId, input.companyId)),
        });
        if (!conversation) {
          logger.fail(new Error("Conversation not found"));
          return Result.fail("Conversation not found");
        }
      }

      const status: OrderStatus = input.status ?? "draft";

      const [created] = await db
        .insert(ordersTable)
        .values({
          companyId: input.companyId,
          contactId: input.contactId,
          conversationId: input.conversationId || null,
          createdBy: input.userId,
          updatedBy: input.userId,
          contactNameSnapshot: contact.name ?? "",
          contactPhoneSnapshot: contact.phone,
          customerName: input.customerName,
          customerPhone: input.customerPhone,
          deliveryAddress: input.deliveryAddress,
          orderDescription: input.orderDescription,
          status,
          notes: input.notes ?? null,
          isActive: true,
        })
        .returning({
          id: ordersTable.id,
          companyId: ordersTable.companyId,
          contactId: ordersTable.contactId,
          conversationId: ordersTable.conversationId,
          createdBy: ordersTable.createdBy,
          updatedBy: ordersTable.updatedBy,
          contactNameSnapshot: ordersTable.contactNameSnapshot,
          contactPhoneSnapshot: ordersTable.contactPhoneSnapshot,
          customerName: ordersTable.customerName,
          customerPhone: ordersTable.customerPhone,
          deliveryAddress: ordersTable.deliveryAddress,
          orderDescription: ordersTable.orderDescription,
          status: ordersTable.status,
          notes: ordersTable.notes,
          isActive: ordersTable.isActive,
          createdAt: ordersTable.createdAt,
          updatedAt: ordersTable.updatedAt,
        });

      logger.complete(1);
      return Result.ok(created as unknown as OrderResponse, "Order created");
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to create order");
    }
  }

  static async update(input: OrderUpdateServerInput): Promise<Result<OrderResponse>> {
    const logger = createPerformanceLogger("OrderService.update", {
      context: { companyId: input.companyId, orderId: input.orderId },
    });
    try {
      const updateData: Record<string, unknown> = {
        updatedBy: input.userId,
        updatedAt: new Date(),
      };

      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
      if (input.deliveryAddress !== undefined) updateData.deliveryAddress = input.deliveryAddress;
      if (input.orderDescription !== undefined) updateData.orderDescription = input.orderDescription;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const [updated] = await db
        .update(ordersTable)
        .set(updateData)
        .where(and(eq(ordersTable.id, input.orderId), eq(ordersTable.companyId, input.companyId), eq(ordersTable.isActive, true)))
        .returning({
          id: ordersTable.id,
          companyId: ordersTable.companyId,
          contactId: ordersTable.contactId,
          conversationId: ordersTable.conversationId,
          createdBy: ordersTable.createdBy,
          updatedBy: ordersTable.updatedBy,
          contactNameSnapshot: ordersTable.contactNameSnapshot,
          contactPhoneSnapshot: ordersTable.contactPhoneSnapshot,
          customerName: ordersTable.customerName,
          customerPhone: ordersTable.customerPhone,
          deliveryAddress: ordersTable.deliveryAddress,
          orderDescription: ordersTable.orderDescription,
          status: ordersTable.status,
          notes: ordersTable.notes,
          isActive: ordersTable.isActive,
          createdAt: ordersTable.createdAt,
          updatedAt: ordersTable.updatedAt,
        });

      if (!updated) {
        logger.fail(new Error("Order not found"));
        return Result.fail("Order not found", { code: "NOT_FOUND" });
      }

      logger.complete(1);
      return Result.ok(updated as unknown as OrderResponse, "Order updated");
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to update order");
    }
  }

  static async updateStatus(input: OrderUpdateStatusServerInput): Promise<Result<OrderResponse>> {
    const logger = createPerformanceLogger("OrderService.updateStatus", {
      context: { companyId: input.companyId, orderId: input.orderId, status: input.status },
    });
    try {
      const existing = await db.query.ordersTable.findFirst({
        where: and(eq(ordersTable.id, input.orderId), eq(ordersTable.companyId, input.companyId)),
      });

      if (!existing) {
        logger.fail(new Error("Order not found"));
        return Result.fail("Order not found", { code: "NOT_FOUND" });
      }

      if (TERMINAL_STATUSES.includes(existing.status as OrderStatus) && existing.status !== input.status) {
        logger.fail(new Error("Cannot transition from terminal status"));
        return Result.fail("Cannot transition from a delivered/cancelled order");
      }

      const [updated] = await db
        .update(ordersTable)
        .set({
          status: input.status,
          isActive: input.status === "cancelled" ? false : existing.isActive,
          updatedBy: input.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(ordersTable.id, input.orderId), eq(ordersTable.companyId, input.companyId)))
        .returning({
          id: ordersTable.id,
          companyId: ordersTable.companyId,
          contactId: ordersTable.contactId,
          conversationId: ordersTable.conversationId,
          createdBy: ordersTable.createdBy,
          updatedBy: ordersTable.updatedBy,
          contactNameSnapshot: ordersTable.contactNameSnapshot,
          contactPhoneSnapshot: ordersTable.contactPhoneSnapshot,
          customerName: ordersTable.customerName,
          customerPhone: ordersTable.customerPhone,
          deliveryAddress: ordersTable.deliveryAddress,
          orderDescription: ordersTable.orderDescription,
          status: ordersTable.status,
          notes: ordersTable.notes,
          isActive: ordersTable.isActive,
          createdAt: ordersTable.createdAt,
          updatedAt: ordersTable.updatedAt,
        });

      logger.complete(1);
      return Result.ok(updated as unknown as OrderResponse, "Order status updated");
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to update order status");
    }
  }

  static async deactivate(input: OrderDeactivateInput): Promise<Result<{ success: boolean }>> {
    const logger = createPerformanceLogger("OrderService.deactivate", {
      context: { companyId: input.companyId, orderId: input.orderId },
    });
    try {
      const [updated] = await db
        .update(ordersTable)
        .set({
          isActive: false,
          status: "cancelled",
          updatedBy: input.userId,
          updatedAt: new Date(),
        })
        .where(and(eq(ordersTable.id, input.orderId), eq(ordersTable.companyId, input.companyId)))
        .returning({ id: ordersTable.id });

      if (!updated) {
        logger.fail(new Error("Order not found"));
        return Result.fail("Order not found", { code: "NOT_FOUND" });
      }

      logger.complete(1);
      return Result.ok({ success: true }, "Order deactivated");
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to deactivate order");
    }
  }

  static async getById(input: OrderGetByIdInput): Promise<Result<OrderResponse>> {
    const logger = createPerformanceLogger("OrderService.getById", {
      context: { companyId: input.companyId, orderId: input.orderId },
    });
    try {
      const result = await db.query.ordersTable.findFirst({
        where: and(eq(ordersTable.id, input.orderId), eq(ordersTable.companyId, input.companyId)),
      });

      if (!result) {
        logger.fail(new Error("Order not found"));
        return Result.fail("Order not found", { code: "NOT_FOUND" });
      }

      logger.complete(1);
      return Result.ok(result as unknown as OrderResponse, "Order found");
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to fetch order");
    }
  }

  static async list(input: OrderListInput): Promise<Result<{ orders: OrderResponse[]; nextCursor?: string; hasMore: boolean }>> {
    const logger = createPerformanceLogger("OrderService.list", {
      context: {
        companyId: input.companyId,
        status: input.status ?? null,
        limit: input.limit,
        cursor: input.cursor ?? null,
      },
    });
    try {
      const fetchLimit = input.limit + 1;
      const cursorDecoded = decodeCursor(input.cursor);

      const whereClauses: SQL<unknown>[] = [
        eq(ordersTable.companyId, input.companyId),
      ];
      if (input.status) whereClauses.push(eq(ordersTable.status, input.status));
      if (input.contactId) whereClauses.push(eq(ordersTable.contactId, input.contactId));
      if (input.conversationId) whereClauses.push(eq(ordersTable.conversationId, input.conversationId));

      if (cursorDecoded) {
        const cursorCondition = or(
          lt(ordersTable.createdAt, cursorDecoded.createdAt),
          and(eq(ordersTable.createdAt, cursorDecoded.createdAt), lt(ordersTable.id, cursorDecoded.id))
        );
        if (cursorCondition) whereClauses.push(cursorCondition);
      }

      if (input.searchTerm) {
        const term = `%${input.searchTerm.toLowerCase()}%`;
        const searchCondition = or(
          ilike(ordersTable.customerName, term),
          ilike(ordersTable.orderDescription, term),
          ilike(ordersTable.contactNameSnapshot, term),
          ilike(ordersTable.contactPhoneSnapshot, term)
        );
        if (searchCondition) whereClauses.push(searchCondition);
      }

      const results = await db.query.ordersTable.findMany({
        where: and(...whereClauses),
        orderBy: [desc(ordersTable.createdAt), desc(ordersTable.id)],
        limit: fetchLimit,
      });

      const hasMore = results.length > input.limit;
      const items = hasMore ? results.slice(0, input.limit) : results;
      const nextCursor = hasMore
        ? encodeCursor(items[items.length - 1].createdAt, items[items.length - 1].id)
        : undefined;

      logger.complete(items.length);
      return Result.ok({ orders: items as unknown as OrderResponse[], nextCursor, hasMore }, "Orders loaded");
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal("Failed to list orders");
    }
  }
}
