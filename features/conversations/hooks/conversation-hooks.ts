import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import {
  listConversationsAction,
  getConversationMessagesAction,
  getConversationAction,
  markConversationAsReadAction,
  assignConversationToUserAction,
  clearConversationAction,
  deleteConversationAction,
  archiveConversationAction,
  unarchiveConversationAction,
  getWhatsAppMessageHistoryAction,
} from '../actions/conversation-actions';
import {
  sendNewMessageAction,
  retryFailedMessageAction,
} from '../actions/message-actions';
import type {
  ConversationListFilter,
  SendNewMessageInput,
  SendMessageWithImageInput,
  GetMessagesInput,
  GetConversationInput,
  UpdateContactNameInput,
  ClearConversationInput,
  DeleteConversationInput,
  ArchiveConversationInput,
  AssignConversationInput,
  MarkAsReadInput,
  GetWhatsAppMessageHistoryInput,
} from '../schemas/conversation-schema';

export const conversationKeys = {
  all: ['conversations'] as const,
  lists: () => [...conversationKeys.all, 'list'] as const,
  list: (filter: ConversationListFilter) => [...conversationKeys.lists(), filter] as const,
  details: () => [...conversationKeys.all, 'detail'] as const,
  detail: (id: number) => [...conversationKeys.details(), id] as const,
};

export const messageKeys = {
  all: ['messages'] as const,
  lists: () => [...messageKeys.all, 'list'] as const,
  list: (conversationId: number) => [...messageKeys.lists(), conversationId] as const,
  details: () => [...messageKeys.all, 'detail'] as const,
  detail: (id: number) => [...messageKeys.details(), id] as const,
  whatsappHistory: (phoneNumberId: string) => [...messageKeys.all, 'whatsapp-history', phoneNumberId] as const,
};

export function useConversations(filter: ConversationListFilter) {
  return useQuery({
    queryKey: conversationKeys.list(filter),
    queryFn: async () => {
      const result = await listConversationsAction(filter);
      if (!result.ok) throw new Error(result.error || 'Failed to load conversations');
      return result.data;
    },
    enabled: true,
    staleTime: 60000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useConversationMessages(conversationId: number) {
  return useInfiniteQuery({
    queryKey: messageKeys.list(conversationId),
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const result = await getConversationMessagesAction({
        conversationId,
        cursor: pageParam,
        limit: 50,
      });
      if (!result.ok) throw new Error(result.error || 'Failed to load messages');
      return result.data;
    },
    getNextPageParam: (lastPage) => (lastPage?.hasMore ? lastPage.previousCursor : undefined),
    initialPageParam: undefined as string | undefined,
    staleTime: 5000,
    refetchOnWindowFocus: true,
    refetchInterval: 5000,
  });
}

export function useConversation(conversationId: number | null) {
  return useQuery({
    queryKey: conversationKeys.detail(conversationId || 0),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      const result = await getConversationAction({ conversationId });
      if (!result.ok) throw new Error(result.error || 'Failed to load conversation');
      return result.data;
    },
    enabled: !!conversationId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useSendNewMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SendMessageWithImageInput) => {
      const result = await sendNewMessageAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      if (data?.success && data.conversationId) {
        queryClient.invalidateQueries({ queryKey: messageKeys.list(data.conversationId) });
      }
    },
    retry: false,
  });
}

export function useRetryFailedMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (messageId: number) => {
      const result = await retryFailedMessageAction(messageId);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.success && data.conversationId) {
        queryClient.invalidateQueries({ queryKey: messageKeys.list(data.conversationId) });
        queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      }
    },
    retry: false,
  });
}

export function useMarkConversationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: MarkAsReadInput) => {
      const result = await markConversationAsReadAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      queryClient.setQueryData(conversationKeys.detail(input.conversationId), (old: any) => {
        if (!old) return old;
        return { ...old, unreadCount: 0 };
      });
    },
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
    retry: false,
  });
}

export function useClearConversation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ClearConversationInput) => {
      const result = await clearConversationAction(input);
      if (!result.ok) throw new Error(result.error);
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
      queryClient.invalidateQueries({ queryKey: messageKeys.list(input.conversationId) });
    },
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
    retry: false,
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
      queryClient.invalidateQueries({ queryKey: conversationKeys.lists() });
    },
    retry: false,
  });
}

export function useWhatsAppMessageHistory(whatsappAccountId: number | null) {
  return useQuery({
    queryKey: messageKeys.whatsappHistory(whatsappAccountId?.toString() || ''),
    queryFn: async () => {
      if (!whatsappAccountId) {
        throw new Error('whatsappAccountId is required');
      }

      const result = await getWhatsAppMessageHistoryAction({
        whatsappAccountId,
        limit: 50,
      });

      if (!result.ok) {
        throw new Error(result.error || 'Failed to fetch message history');
      }

      return result.data;
    },
    enabled: !!whatsappAccountId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}
