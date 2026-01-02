"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { MessageService } from "../services/message.service";
import { z } from "zod";

const sendMessageSchema = z.object({
  phoneNumber: z.string().trim().min(3),
  text: z.string().trim().min(1),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export type SendMessageResponse = {
  conversationId: number;
  messageId: string;
};

export const sendMessageAction = withAction<SendMessageInput, SendMessageResponse>(
  "messages.send",
  async (auth, input) => {
    const result = await MessageService.send({
      phoneNumber: input.phoneNumber,
      type: "text",
      content: { text: input.text },
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.success) return Result.fail(result.message, result.error);
    
    const message = result.data!;
    return Result.ok({
      conversationId: message.conversationId,
      messageId: message.messageId,
    });
  },
  { schema: sendMessageSchema }
);
