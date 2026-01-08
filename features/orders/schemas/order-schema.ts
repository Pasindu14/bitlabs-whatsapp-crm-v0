import { z } from "zod";

export const ORDER_STATUSES = [
  "draft",
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const orderStatusSchema = z.enum(ORDER_STATUSES);

export const orderCreateClientSchema = z.object({
  contactId: z.number().int().positive(),
  conversationId: z.number().int().positive().optional(),
  customerName: z.string().min(1).max(255).trim(),
  customerPhone: z.string().min(1).max(50).trim(),
  deliveryAddress: z.string().min(1).max(2000).trim(),
  orderDescription: z.string().min(1).max(4000).trim(),
  status: orderStatusSchema,
  notes: z.string().max(4000).trim().optional(),
});

export type OrderCreateClientInput = z.infer<typeof orderCreateClientSchema>;

export const orderCreateServerSchema = orderCreateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type OrderCreateServerInput = z.infer<typeof orderCreateServerSchema>;

export const orderUpdateClientSchema = z.object({
  orderId: z.number().int().positive(),
  customerName: z.string().min(1).max(255).trim().optional(),
  customerPhone: z.string().min(1).max(50).trim().optional(),
  deliveryAddress: z.string().min(1).max(2000).trim().optional(),
  orderDescription: z.string().min(1).max(4000).trim().optional(),
  notes: z.string().max(4000).trim().optional(),
});

export type OrderUpdateClientInput = z.infer<typeof orderUpdateClientSchema>;

export const orderUpdateServerSchema = orderUpdateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type OrderUpdateServerInput = z.infer<typeof orderUpdateServerSchema>;

export const orderUpdateStatusSchema = z.object({
  orderId: z.number().int().positive(),
  status: orderStatusSchema,
}).extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type OrderUpdateStatusInput = z.infer<typeof orderUpdateStatusSchema>;

export const orderDeactivateSchema = z.object({
  orderId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type OrderDeactivateInput = z.infer<typeof orderDeactivateSchema>;

export const orderGetByIdSchema = z.object({
  orderId: z.number().int().positive(),
  companyId: z.number().int().positive(),
});

export type OrderGetByIdInput = z.infer<typeof orderGetByIdSchema>;

export const orderListSchema = z.object({
  companyId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  status: orderStatusSchema.optional(),
  searchTerm: z.string().trim().max(255).optional(),
  contactId: z.number().int().positive().optional(),
  conversationId: z.number().int().positive().optional(),
});

export type OrderListInput = z.infer<typeof orderListSchema>;

export const orderResponseSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  contactId: z.number().int(),
  conversationId: z.number().int().nullable(),
  createdBy: z.number().int(),
  updatedBy: z.number().int().nullable(),
  contactNameSnapshot: z.string(),
  contactPhoneSnapshot: z.string(),
  customerName: z.string(),
  customerPhone: z.string(),
  deliveryAddress: z.string(),
  orderDescription: z.string(),
  status: orderStatusSchema,
  notes: z.string().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export type OrderResponse = z.infer<typeof orderResponseSchema>;

export const orderListResponseSchema = z.object({
  orders: z.array(orderResponseSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type OrderListResponse = z.infer<typeof orderListResponseSchema>;
