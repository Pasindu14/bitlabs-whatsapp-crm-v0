'use server';

import { withAction } from '@/lib/server-action-helper';
import { Result } from '@/lib/result';
import { ConversationService } from '../services/conversation-service';
import {
  conversationFilterSchema,
  markAsReadSchema,
  getMessagesSchema,
  clearConversationSchema,
  deleteConversationSchema,
  archiveConversationSchema,
  assignConversationSchema,
  conversationListOutputSchema,
  messageListOutputSchema,
  type ConversationListFilter,
  type MarkAsReadInput,
  type GetMessagesInput,
  type ClearConversationInput,
  type DeleteConversationInput,
  type ArchiveConversationInput,
  type AssignConversationInput,
  type ConversationListOutput,
  type MessageListOutput,
} from '../schemas/conversation-schema';

export const listConversationsAction = withAction<ConversationListFilter, ConversationListOutput>(
  'conversations.list',
  async (auth, filter) => {
    const result = await ConversationService.listConversations(filter);
    if (!result.isOk) return result;

    const validated = conversationListOutputSchema.parse(result.data);
    return Result.ok(validated, 'Conversations loaded');
  },
  { schema: conversationFilterSchema }
);

export const getConversationMessagesAction = withAction<GetMessagesInput, MessageListOutput>(
  'conversations.getMessages',
  async (auth, input) => {
    const result = await ConversationService.getConversationMessages(
      input.conversationId,
      auth.companyId,
      input.cursor,
      input.limit
    );
    if (!result.isOk) return result;

    const validated = messageListOutputSchema.parse(result.data);
    return Result.ok(validated, 'Messages loaded');
  },
  { schema: getMessagesSchema }
);

export const markConversationAsReadAction = withAction<MarkAsReadInput, void>(
  'conversations.markAsRead',
  async (auth, input) => {
    return await ConversationService.markConversationAsRead(
      input.conversationId,
      auth.companyId
    );
  },
  { schema: markAsReadSchema }
);

export const assignConversationToUserAction = withAction<AssignConversationInput, void>(
  'conversations.assign',
  async (auth, input) => {
    return await ConversationService.assignConversationToUser(
      input.conversationId,
      auth.companyId,
      input.userId
    );
  },
  { schema: assignConversationSchema }
);

export const clearConversationAction = withAction<ClearConversationInput, void>(
  'conversations.clear',
  async (auth, input) => {
    return await ConversationService.clearConversation(
      input.conversationId,
      auth.companyId
    );
  },
  { schema: clearConversationSchema }
);

export const deleteConversationAction = withAction<DeleteConversationInput, void>(
  'conversations.delete',
  async (auth, input) => {
    return await ConversationService.deleteConversation(
      input.conversationId,
      auth.companyId
    );
  },
  { schema: deleteConversationSchema }
);

export const archiveConversationAction = withAction<ArchiveConversationInput, void>(
  'conversations.archive',
  async (auth, input) => {
    return await ConversationService.archiveConversation(
      input.conversationId,
      auth.companyId
    );
  },
  { schema: archiveConversationSchema }
);

export const unarchiveConversationAction = withAction<ArchiveConversationInput, void>(
  'conversations.unarchive',
  async (auth, input) => {
    return await ConversationService.unarchiveConversation(
      input.conversationId,
      auth.companyId
    );
  },
  { schema: archiveConversationSchema }
);
