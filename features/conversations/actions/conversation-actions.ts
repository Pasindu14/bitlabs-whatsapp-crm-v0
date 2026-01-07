'use server';

import { withAction } from '@/lib/server-action-helper';
import { Result } from '@/lib/result';
import { ConversationService } from '../services/conversation-service';
import {
  conversationFilterSchema,
  markAsReadSchema,
  getMessagesSchema,
  getConversationSchema,
  updateContactNameSchema,
  clearConversationSchema,
  deleteConversationSchema,
  archiveConversationSchema,
  assignConversationSchema,
  conversationListOutputSchema,
  messageListOutputSchema,
  getWhatsAppMessageHistorySchema,
  type ConversationListFilter,
  type MarkAsReadInput,
  type GetMessagesInput,
  type GetConversationInput,
  type UpdateContactNameInput,
  type ClearConversationInput,
  type DeleteConversationInput,
  type ArchiveConversationInput,
  type AssignConversationInput,
  type ConversationListOutput,
  type MessageListOutput,
  type ConversationResponse,
  type ContactResponse,
  type GetWhatsAppMessageHistoryInput,
} from '../schemas/conversation-schema';

export const listConversationsAction = withAction<ConversationListFilter, ConversationListOutput>(
  'conversations.list',
  async (auth, filter) => {
    const result = await ConversationService.listConversations(auth.companyId, filter);
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

export const getConversationAction = withAction<GetConversationInput, ConversationResponse>(
  'conversations.get',
  async (auth, input) => {
    const result = await ConversationService.getConversation(
      input.conversationId,
      auth.companyId
    );
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Conversation loaded');
  },
  { schema: getConversationSchema }
);

export const updateContactNameAction = withAction<UpdateContactNameInput, ContactResponse>(
  'conversations.updateContactName',
  async (auth, input) => {
    const result = await ConversationService.updateContactName(
      input.contactId,
      auth.companyId,
      input.name
    );
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Contact name updated');
  },
  { schema: updateContactNameSchema }
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

export const getWhatsAppMessageHistoryAction = withAction<GetWhatsAppMessageHistoryInput, unknown>(
  'conversations.getWhatsAppMessageHistory',
  async (auth, input) => {
    const result = await ConversationService.getWhatsAppMessageHistory(
      input.whatsappAccountId,
      auth.companyId,
      input.limit,
      input.before,
      input.after
    );
    if (!result.isOk) return result;

    return Result.ok(result.data, 'WhatsApp message history loaded');
  },
  { schema: getWhatsAppMessageHistorySchema }
);
