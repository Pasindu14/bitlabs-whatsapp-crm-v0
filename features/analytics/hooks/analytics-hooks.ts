import { useQuery, useQueryClient, type UseQueryOptions } from "@tanstack/react-query";
import type {
  AccountAnalyticsListInput,
  AccountAnalyticsListResponse,
  AccountAnalyticsGetInput,
  AccountAnalyticsDetail,
} from "../schemas/analytics-schema";
import {
  listAccountAnalyticsAction,
  getAccountAnalyticsAction,
} from "../actions/analytics-actions";

const analyticsKeys = {
  all: ["analytics"] as const,
  lists: () => [...analyticsKeys.all, "list"] as const,
  list: (filters: AccountAnalyticsListInput) => [...analyticsKeys.lists(), filters] as const,
  details: () => [...analyticsKeys.all, "detail"] as const,
  detail: (accountId: number, filters?: Partial<AccountAnalyticsGetInput>) =>
    [...analyticsKeys.details(), accountId, filters] as const,
};

export function useAccountAnalytics(
  input: AccountAnalyticsListInput,
  options?: Omit<UseQueryOptions<AccountAnalyticsListResponse>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: analyticsKeys.list(input),
    queryFn: async () => {
      const result = await listAccountAnalyticsAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data ?? { accounts: [], hasMore: false, nextCursor: undefined };
    },
    ...options,
  });
}

export function useAccountAnalyticsDetail(
  input: AccountAnalyticsGetInput,
  options?: Omit<UseQueryOptions<AccountAnalyticsDetail>, "queryKey" | "queryFn">
) {
  return useQuery({
    queryKey: analyticsKeys.detail(input.whatsappAccountId, {
      startDate: input.startDate,
      endDate: input.endDate,
    }),
    queryFn: async () => {
      const result = await getAccountAnalyticsAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data ?? { receivedCount: 0, sentCount: 0, dailySeries: undefined };
    },
    enabled: !!input.whatsappAccountId,
    ...options,
  });
}

export function useInvalidateAccountAnalytics() {
  const queryClient = useQueryClient();

  return {
    invalidateList: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.lists() });
    },
    invalidateDetail: (accountId: number) => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.details() });
    },
    invalidateAll: () => {
      queryClient.invalidateQueries({ queryKey: analyticsKeys.all });
    },
  };
}
