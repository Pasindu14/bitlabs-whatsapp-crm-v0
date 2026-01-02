"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { sendMessageAction, type SendMessageInput } from "../actions/send-new-message.actions";

const CONVERSATIONS_KEY = "conversations";

export function useSendMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (input: SendMessageInput) => {
      const result = await sendMessageAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      toast.success("Message sent successfully");
      queryClient.invalidateQueries({ queryKey: [CONVERSATIONS_KEY] });
      return data;
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send message");
    },
  });
}
