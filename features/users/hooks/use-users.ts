"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listUsersAction,
  createUserAction,
  updateUserAction,
  toggleUserStatusAction,
  resetUserPasswordAction,
} from "../actions/user.actions";
import type {
  UserCreateInput,
  UserUpdateInput,
  UserListInput,
  UserListResponse,
} from "../schemas/user.schema";
import type { SortingState } from "@tanstack/react-table";

export const userKeys = {
  all: ["users"] as const,
  lists: () => [...userKeys.all, "list"] as const,
  list: (params: UserListInput) => [...userKeys.lists(), params] as const,
  details: () => [...userKeys.all, "detail"] as const,
  detail: (id: number) => [...userKeys.details(), id] as const,
} as const;

function buildQueryKey(params: UserListInput) {
  return userKeys.list(params);
}

export function useUsers(params: UserListInput) {
  return useInfiniteQuery({
    queryKey: buildQueryKey(params),
    queryFn: async ({ pageParam }) => {
      const result = await listUsersAction({
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as UserListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserCreateInput) => {
      const result = await createUserAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
    retry: false,
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserUpdateInput & { id: number }) => {
      const result = await updateUserAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
    retry: false,
  });
}

export function useToggleUserStatus(targetActive: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const result = await toggleUserStatusAction({ ...input, isActive: targetActive });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success(`User ${targetActive ? "activated" : "deactivated"}`);
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
    retry: false,
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const result = await resetUserPasswordAction(input);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.temporaryPassword) {
        toast.success(`Temporary password: ${data.temporaryPassword}`);
      } else {
        toast.success("Password reset initiated");
      }
      queryClient.invalidateQueries({ queryKey: userKeys.all });
    },
    onError: (error: Error) => toast.error(error.message),
    retry: false,
  });
}

export function sortingStateToParams(
  sorting: SortingState | undefined
): {
  sortField?: UserListInput["sortField"];
  sortOrder?: UserListInput["sortOrder"];
} {
  if (!sorting || sorting.length === 0) return {};
  const [first] = sorting;
  if (!first) return {};
  return {
    sortField: first.id as UserListInput["sortField"],
    sortOrder: first.desc ? "desc" : "asc",
  };
}
