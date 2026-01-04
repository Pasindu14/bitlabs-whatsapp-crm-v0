import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createConversationNoteAction,
  updateConversationNoteAction,
  deleteConversationNoteAction,
  listConversationNotesAction,
  getConversationNoteAction,
  getUserNoteForConversationAction,
} from '../actions/note-actions';
import type {
  ConversationNoteCreateClientInput,
  ConversationNoteUpdateClientInput,
  ConversationNoteDeleteClientInput,
} from '../schemas/note-schema';

export const noteKeys = {
  all: ['conversations', 'notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (conversationId: number) => [...noteKeys.lists(), conversationId] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (noteId: number) => [...noteKeys.details(), noteId] as const,
  userNote: (conversationId: number) => [...noteKeys.all, 'user', conversationId] as const,
};

export function useConversationNotes(conversationId: number | null) {
  return useQuery({
    queryKey: noteKeys.list(conversationId || 0),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      const result = await listConversationNotesAction({
        conversationId,
        limit: 20,
      });
      if (!result.ok) throw new Error(result.error || 'Failed to load notes');
      return result.data;
    },
    enabled: !!conversationId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useConversationNote(noteId: number | null) {
  return useQuery({
    queryKey: noteKeys.detail(noteId || 0),
    queryFn: async () => {
      if (!noteId) throw new Error('Note ID is required');
      const result = await getConversationNoteAction({ noteId });
      if (!result.ok) throw new Error(result.error || 'Failed to load note');
      return result.data;
    },
    enabled: !!noteId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useUserNoteForConversation(conversationId: number | null) {
  return useQuery({
    queryKey: noteKeys.userNote(conversationId || 0),
    queryFn: async () => {
      if (!conversationId) throw new Error('Conversation ID is required');
      const result = await getUserNoteForConversationAction({ conversationId });
      if (!result.ok) throw new Error(result.error || 'Failed to load user note');
      return result.data;
    },
    enabled: !!conversationId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateConversationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConversationNoteCreateClientInput) => {
      const result = await createConversationNoteAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data, input) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(input.conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: noteKeys.userNote(input.conversationId),
      });
    },
  });
}

export function useUpdateConversationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ConversationNoteUpdateClientInput) => {
      const result = await updateConversationNoteAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (!data) return;
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(data.conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: noteKeys.detail(data.id),
      });
      queryClient.invalidateQueries({
        queryKey: noteKeys.userNote(data.conversationId),
      });
    },
  });
}

export function useDeleteConversationNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { noteId: number; conversationId: number }) => {
      const result = await deleteConversationNoteAction({
        noteId: input.noteId,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: noteKeys.list(variables.conversationId),
      });
      queryClient.invalidateQueries({
        queryKey: noteKeys.detail(variables.noteId),
      });
      queryClient.invalidateQueries({
        queryKey: noteKeys.userNote(variables.conversationId),
      });
    },
  });
}
