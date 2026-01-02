import { z } from "zod";

export const messageResponseSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  conversationId: z.number(),
  messageId: z.string(),
  direction: z.enum(["inbound", "outbound"]),
  type: z.string(),
  content: z.record(z.string(), z.any()),
  status: z.string(),
  timestamp: z.date().or(z.string()),
  createdAt: z.date().or(z.string()),
});

export const messageListClientSchema = z.object({
  conversationId: z.number().int(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const sendMessageClientSchema = z
  .object({
    conversationId: z.number().int().optional(),
    phoneNumber: z.string().trim().min(3).optional(),
    type: z.enum(["text", "image", "document", "template"]),
    content: z.object({
      text: z.string().optional(),
      url: z.string().url().optional(),
      templateName: z.string().optional(),
      variables: z.record(z.string(), z.string()).optional(),
    }),
  })
  .refine(
    (val) => Boolean(val.conversationId) || Boolean(val.phoneNumber),
    "conversationId or phoneNumber is required"
  );

export type MessageResponse = z.infer<typeof messageResponseSchema>;
export type MessageListResponse = {
  items: MessageResponse[];
  nextCursor: string | null;
  hasMore: boolean;
};
export type MessageListInput = z.infer<typeof messageListClientSchema>;
export type SendMessageInput = z.infer<typeof sendMessageClientSchema>;
