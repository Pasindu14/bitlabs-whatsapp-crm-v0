"use client";

import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  getWebhookConfigAction,
  upsertWebhookConfigAction,
  rotateVerifyTokenAction,
  setWebhookStatusAction,
  listWebhookEventLogsAction,
} from "../actions/webhook-config.actions";
import type {
  WebhookConfigUpsertClientInput,
  WebhookEventLogListQuery,
  WebhookConfigResponse,
  WebhookEventLogListResponse,
} from "../schemas/whatsapp-webhook-schema";

const WEBHOOK_CONFIG_KEY = "webhook-config";
const WEBHOOK_EVENT_LOGS_KEY = "webhook-event-logs";

export function useWebhookConfig(whatsappAccountId: number) {
  return useQuery({
    queryKey: [WEBHOOK_CONFIG_KEY, whatsappAccountId],
    queryFn: async () => {
      const result = await getWebhookConfigAction({ whatsappAccountId });
      if (!result.ok) throw new Error(result.error);
      return result.data as WebhookConfigResponse;
    },
    enabled: !!whatsappAccountId,
  });
}

export function useUpsertWebhookConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: WebhookConfigUpsertClientInput & { whatsappAccountId: number }) => {
      const result = await upsertWebhookConfigAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      toast.success("Webhook configuration saved");
      queryClient.invalidateQueries({ queryKey: [WEBHOOK_CONFIG_KEY, variables.whatsappAccountId] });
      queryClient.invalidateQueries({ queryKey: [WEBHOOK_EVENT_LOGS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useRotateVerifyToken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (whatsappAccountId: number) => {
      const result = await rotateVerifyTokenAction({ whatsappAccountId });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, whatsappAccountId) => {
      toast.success("Verify token rotated. Save it now - it won't be shown again!");
      queryClient.invalidateQueries({ queryKey: [WEBHOOK_CONFIG_KEY, whatsappAccountId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetWebhookStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { whatsappAccountId: number; status: "verified" | "disabled" }) => {
      const result = await setWebhookStatusAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (_, variables) => {
      const message = variables.status === "verified" ? "Webhook verified" : "Webhook disabled";
      toast.success(message);
      queryClient.invalidateQueries({ queryKey: [WEBHOOK_CONFIG_KEY, variables.whatsappAccountId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useWebhookEventLogs(whatsappAccountId: number, params: WebhookEventLogListQuery) {
  return useInfiniteQuery({
    queryKey: [WEBHOOK_EVENT_LOGS_KEY, whatsappAccountId, params],
    queryFn: async ({ pageParam }) => {
      const result = await listWebhookEventLogsAction({
        whatsappAccountId,
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as WebhookEventLogListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    enabled: !!whatsappAccountId,
  });
}
