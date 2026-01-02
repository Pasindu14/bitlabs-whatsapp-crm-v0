"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { MessageService } from "../services/message.service";
import {
  messageListClientSchema,
  sendMessageClientSchema,
  type MessageListInput,
  type MessageListResponse,
  type MessageResponse,
  type SendMessageInput,
} from "../schemas/message.schema";

export const listMessagesAction = withAction<MessageListInput, MessageListResponse>(
  "messages.list",
  async (auth, input) => {
    const result = await MessageService.list({ ...input, companyId: auth.companyId });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: messageListClientSchema }
);

export const sendMessageAction = withAction<SendMessageInput, MessageResponse>(
  "messages.send",
  async (auth, input) => {
    const result = await MessageService.send({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: sendMessageClientSchema }
);
