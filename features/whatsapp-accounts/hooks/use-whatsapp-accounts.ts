"use client";

import { useInfiniteQuery, useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listWhatsappAccountsAction,
  createWhatsappAccountAction,
  updateWhatsappAccountAction,
  setDefaultWhatsappAccountAction,
  activateWhatsappAccountAction,
  deactivateWhatsappAccountAction,
} from "../actions/whatsapp-account.actions";
import type {
  WhatsappAccountCreateInput,
  WhatsappAccountUpdateInput,
  WhatsappAccountListInput,
  WhatsappAccountListResponse,
} from "../schemas/whatsapp-account.schema";
import type { SortingState } from "@tanstack/react-table";

const WHATSAPP_ACCOUNTS_KEY = "whatsapp-accounts";

export { WHATSAPP_ACCOUNTS_KEY };

function buildQueryKey(params: WhatsappAccountListInput & { search?: string }) {
  return [
    WHATSAPP_ACCOUNTS_KEY,
    {
      cursor: params.cursor,
      limit: params.limit,
      search: params.search,
      isActive: params.isActive,
      sortField: params.sortField,
      sortOrder: params.sortOrder,
    },
  ];
}

export function useWhatsappAccounts(params: WhatsappAccountListInput) {
  return useInfiniteQuery({
    queryKey: buildQueryKey(params),
    queryFn: async ({ pageParam }) => {
      const result = await listWhatsappAccountsAction({
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as WhatsappAccountListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
  });
}

export function useCreateWhatsappAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: WhatsappAccountCreateInput) => {
      const result = await createWhatsappAccountAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("WhatsApp account created");
      queryClient.invalidateQueries({ queryKey: [WHATSAPP_ACCOUNTS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateWhatsappAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: WhatsappAccountUpdateInput & { id: number }) => {
      const result = await updateWhatsappAccountAction(data as any);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("WhatsApp account updated");
      queryClient.invalidateQueries({ queryKey: [WHATSAPP_ACCOUNTS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useSetDefaultWhatsappAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const result = await setDefaultWhatsappAccountAction({ id });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Default account set");
      queryClient.invalidateQueries({ queryKey: [WHATSAPP_ACCOUNTS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useToggleWhatsappAccount(active: boolean) {
  const queryClient = useQueryClient();
  const action = active ? deactivateWhatsappAccountAction : activateWhatsappAccountAction;
  const label = active ? "deactivated" : "activated";
  return useMutation({
    mutationFn: async (id: number) => {
      const result = await action({ id });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success(`WhatsApp account ${label}`);
      queryClient.invalidateQueries({ queryKey: [WHATSAPP_ACCOUNTS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function sortingStateToParams(sorting: SortingState | undefined): {
  sortField?: WhatsappAccountListInput["sortField"];
  sortOrder?: WhatsappAccountListInput["sortOrder"];
} {
  if (!sorting || sorting.length === 0) return {};
  const [first] = sorting;
  return {
    sortField: (first.id === "name" ? "name" : "createdAt") as WhatsappAccountListInput["sortField"],
    sortOrder: (first.desc ? "desc" : "asc") as WhatsappAccountListInput["sortOrder"],
  };
}

export function useDefaultWhatsappAccount() {
  return useQuery({
    queryKey: [WHATSAPP_ACCOUNTS_KEY, "default"],
    queryFn: async () => {
      const result = await listWhatsappAccountsAction({
        isActive: true,
        limit: 100,
        sortField: "createdAt",
        sortOrder: "desc",
      });
      if (!result.ok) throw new Error(result.error);
      const defaultAccount = result.data?.items?.find((acc) => acc.isDefault);
      return defaultAccount || result.data?.items?.[0] || null;
    },
    staleTime: 300000,
    refetchOnWindowFocus: false,
  });
}
