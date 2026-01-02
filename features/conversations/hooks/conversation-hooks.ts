import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  listConversationsAction,
  getConversationMessagesAction,
  markConversationAsReadAction,
  assignConversationToUserAction,
  clearConversationAction,
  deleteConversationAction,
  archiveConversationAction,
  unarchiveConversationAction,
} from '../actions/conversation-actions';
import {
  sendNewMessageAction,
  retryFailedMessageAction,
} from '../actions/message-actions';
import type {
  ConversationListFilter,
  SendNewMessageInput,
  MarkAsReadInput,
  AssignConversationInput,
  ClearConversationInput,
  DeleteConversationInput,
  ArchiveConversationInput,
} from '../schemas/conversation-schema';

export function useConversations(filter: ConversationListFilter) {
  return useQuery({
    queryKey: ['conversations', filter.companyId, filter.filterType, filter.searchTerm, filter.cursor],
    queryFn: async () => {
      const result = await listConversationsAction(filter);
      if (!result.ok) throw new Error(result.error || 'Failed to load conversations');
      return result.data;
    },
    staleTime: 30000,
    gcTime: 5 * 60 * 1000,
  });
}

export function useConversationMessages(conversationId: number, companyId: number) {
  return useInfiniteQuery({
    queryKey: ['messages', conversationId],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const result = await getConversationMessagesAction({
        conversationId,
        companyId,
        cursor: pageParam,
        limit: 50,
      });
      if (!result.ok) throw new Error(result.error || 'Failed to load messages');
      return result.data;
    },
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.previousCursor : undefined),
    initialPageParam: undefined as string | undefined,
    staleTime: 10000,
  });
}

export function useSendNewMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendNewMessageInput) => {
      const result = await sendNewMessageAction(input);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversationId] });
    },
  });
}

export function useRetryFailedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: number) => {
      const result = await retryFailedMessageAction(messageId);
      if (!result.success) throw new Error(result.error);
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkAsReadInput) => {
      const result = await markConversationAsReadAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AssignConversationInput) => {
      const result = await assignConversationToUserAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useClearConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClearConversationInput) => {
      const result = await clearConversationAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['messages'] });
    },
  });
}

export function useDeleteConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: DeleteConversationInput) => {
      const result = await deleteConversationAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ArchiveConversationInput) => {
      const result = await archiveConversationAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useUnarchiveConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ArchiveConversationInput) => {
      const result = await unarchiveConversationAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
