'use server';

import { createPerformanceLogger } from '@/lib/logger';
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

export async function listConversationsAction(
  filter: ConversationListFilter
): Promise<{ ok: boolean; data?: ConversationListOutput; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.listConversations', {
    context: {
      companyId: filter.companyId,
      filterType: filter.filterType,
      includeArchived: filter.includeArchived,
    },
  });
  try {
    const validatedFilter = conversationFilterSchema.parse(filter);

    const result = await ConversationService.listConversations(validatedFilter);

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    const validated = conversationListOutputSchema.parse(result.data);
    logger.complete(validated.conversations.length);
    return { ok: true, data: validated };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to list conversations',
    };
  }
}

export async function getConversationMessagesAction(
  input: GetMessagesInput
): Promise<{ ok: boolean; data?: MessageListOutput; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.getConversationMessages', {
    context: {
      conversationId: input.conversationId,
      limit: input.limit,
    },
  });
  try {
    const validatedInput = getMessagesSchema.parse(input);

    const result = await ConversationService.getConversationMessages(
      validatedInput.conversationId,
      validatedInput.cursor,
      validatedInput.limit
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    const validated = messageListOutputSchema.parse(result.data);
    logger.complete(validated.messages.length);
    return { ok: true, data: validated };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to get messages',
    };
  }
}

export async function markConversationAsReadAction(
  input: MarkAsReadInput
): Promise<{ ok: boolean; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.markConversationAsRead', {
    context: {
      conversationId: input.conversationId,
    },
  });
  try {
    const validatedInput = markAsReadSchema.parse(input);

    const result = await ConversationService.markConversationAsRead(
      validatedInput.conversationId
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    logger.complete();
    return { ok: true };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to mark as read',
    };
  }
}

export async function assignConversationToUserAction(
  input: AssignConversationInput
): Promise<{ ok: boolean; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.assignConversationToUser', {
    context: { conversationId: input.conversationId, userId: input.userId },
  });
  try {
    const validatedInput = assignConversationSchema.parse(input);

    const result = await ConversationService.assignConversationToUser(
      validatedInput.conversationId,
      validatedInput.userId
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    logger.complete();
    return { ok: true };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to assign conversation',
    };
  }
}

export async function clearConversationAction(
  input: ClearConversationInput
): Promise<{ ok: boolean; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.clearConversation', {
    context: { conversationId: input.conversationId },
  });
  try {
    const validatedInput = clearConversationSchema.parse(input);

    const result = await ConversationService.clearConversation(
      validatedInput.conversationId
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    logger.complete();
    return { ok: true };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to clear conversation',
    };
  }
}

export async function deleteConversationAction(
  input: DeleteConversationInput
): Promise<{ ok: boolean; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.deleteConversation', {
    context: { conversationId: input.conversationId },
  });
  try {
    const validatedInput = deleteConversationSchema.parse(input);

    const result = await ConversationService.deleteConversation(
      validatedInput.conversationId
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    logger.complete();
    return { ok: true };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to delete conversation',
    };
  }
}

export async function archiveConversationAction(
  input: ArchiveConversationInput
): Promise<{ ok: boolean; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.archiveConversation', {
    context: { conversationId: input.conversationId },
  });
  try {
    const validatedInput = archiveConversationSchema.parse(input);

    const result = await ConversationService.archiveConversation(
      validatedInput.conversationId
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    logger.complete();
    return { ok: true };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to archive conversation',
    };
  }
}

export async function unarchiveConversationAction(
  input: ArchiveConversationInput
): Promise<{ ok: boolean; error?: string }> {
  const logger = createPerformanceLogger('ConversationActions.unarchiveConversation', {
    context: { conversationId: input.conversationId },
  });
  try {
    const validatedInput = archiveConversationSchema.parse(input);

    const result = await ConversationService.unarchiveConversation(
      validatedInput.conversationId
    );

    if (!result.success) {
      logger.fail(result.error);
      return { ok: false, error: result.error };
    }

    logger.complete();
    return { ok: true };
  } catch (error) {
    logger.fail(error as Error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Failed to unarchive conversation',
    };
  }
}
