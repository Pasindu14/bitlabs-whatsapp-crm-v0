import { z } from "zod";

export const conversationResponseSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  contactId: z.number().nullable().optional(),
  phoneNumber: z.string(),
  whatsappAccountId: z.number().nullable().optional(),
  lastMessageAt: z.date().or(z.string()),
  unreadCount: z.number(),
  status: z.enum(["active", "archived"]),
  assignedTo: z.number().nullable().optional(),
  createdAt: z.date().or(z.string()),
  updatedAt: z.date().or(z.string()).nullable().optional(),
});

export const conversationListClientSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  status: z.enum(["active", "archived"]).optional(),
  search: z.string().trim().max(120).optional(),
  assignedTo: z.number().optional(),
  whatsappAccountId: z.number().optional(),
});

export const conversationIdSchema = z.object({
  id: z.number().int(),
});

export const conversationAssignSchema = conversationIdSchema.extend({
  assignedTo: z.number().nullable(),
});

export const conversationArchiveSchema = conversationIdSchema.extend({
  archive: z.boolean(),
});

export const markReadSchema = conversationIdSchema;

export type ConversationResponse = z.infer<typeof conversationResponseSchema>;
export type ConversationListResponse = {
  items: ConversationResponse[];
  nextCursor: string | null;
  hasMore: boolean;
};
export type ConversationListInput = z.infer<typeof conversationListClientSchema>;
