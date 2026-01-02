"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listMessagesAction, sendMessageAction } from "../actions/message.actions";
import type {
  MessageListInput,
  MessageListResponse,
  SendMessageInput,
} from "../schemas/message.schema";

const MESSAGES_KEY = "messages";

function buildMessagesKey(params: MessageListInput) {
  return [
    MESSAGES_KEY,
    {
      conversationId: params.conversationId,
      cursor: params.cursor,
      limit: params.limit,
    },
  ];
}

export function useMessages(params: MessageListInput & { enabled?: boolean }) {
  return useInfiniteQuery({
    queryKey: buildMessagesKey(params),
    enabled: params.enabled ?? true,
    queryFn: async ({ pageParam }) => {
      const result = await listMessagesAction({
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as MessageListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
    staleTime: 5_000,
  });
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const result = await sendMessageAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (msg, vars) => {
      toast.success("Message sent");
      queryClient.invalidateQueries({
        queryKey: [MESSAGES_KEY, { conversationId: vars.conversationId }],
        exact: false,
      });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
