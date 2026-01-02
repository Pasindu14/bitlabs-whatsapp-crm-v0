"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listConversationsAction,
  archiveConversationAction,
  assignConversationAction,
  markConversationReadAction,
} from "../actions/conversation.actions";
import type {
  ConversationListInput,
  ConversationListResponse,
} from "../schemas/conversation.schema";

const CONVERSATIONS_KEY = "conversations";

function buildConversationsKey(params: ConversationListInput) {
  return [
    CONVERSATIONS_KEY,
    {
      cursor: params.cursor,
      limit: params.limit,
      status: params.status,
      search: params.search,
      assignedTo: params.assignedTo,
      whatsappAccountId: params.whatsappAccountId,
    },
  ];
}

export function useConversations(params: ConversationListInput) {
  return useInfiniteQuery({
    queryKey: buildConversationsKey(params),
    queryFn: async ({ pageParam }) => {
      const result = await listConversationsAction({
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as ConversationListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });
}

export function useMarkConversationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const result = await markConversationReadAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useArchiveConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; archive: boolean }) => {
      const result = await archiveConversationAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, vars) => {
      toast.success(vars.archive ? "Conversation archived" : "Conversation unarchived");
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number; assignedTo: number | null }) => {
      const result = await assignConversationAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Assignment updated");
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
