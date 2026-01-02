"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { ConversationService } from "../services/conversation.service";
import {
  conversationListClientSchema,
  conversationIdSchema,
  conversationArchiveSchema,
  conversationAssignSchema,
  type ConversationListInput,
  type ConversationListResponse,
} from "../schemas/conversation.schema";
import { z } from "zod";

export const listConversationsAction = withAction<ConversationListInput, ConversationListResponse>(
  "conversations.list",
  async (auth, input) => {
    const result = await ConversationService.list({ ...input, companyId: auth.companyId });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: conversationListClientSchema }
);

export const markConversationReadAction = withAction<z.infer<typeof conversationIdSchema>, null>(
  "conversations.markRead",
  async (auth, input) => {
    const result = await ConversationService.markRead({ ...input, companyId: auth.companyId });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: conversationIdSchema }
);

export const archiveConversationAction = withAction<z.infer<typeof conversationArchiveSchema>, null>(
  "conversations.archive",
  async (auth, input) => {
    const result = await ConversationService.archive({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: conversationArchiveSchema }
);

export const assignConversationAction = withAction<z.infer<typeof conversationAssignSchema>, null>(
  "conversations.assign",
  async (auth, input) => {
    const result = await ConversationService.assign({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.success) return Result.fail(result.message, result.error);
    return result;
  },
  { schema: conversationAssignSchema }
);
