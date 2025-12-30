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

const USERS_KEY = "users";

function buildQueryKey(params: UserListInput & { search?: string }) {
  return [
    USERS_KEY,
    {
      cursor: params.cursor,
      limit: params.limit,
      search: params.search,
      isActive: params.isActive,
      role: params.role,
      sortField: params.sortField,
      sortOrder: params.sortOrder,
    },
  ];
}

export function useUsers(params: UserListInput) {
  return useInfiniteQuery({
    queryKey: buildQueryKey(params),
    queryFn: async ({ pageParam }) => {
      const result = await listUsersAction({
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.success) throw new Error(result.message);
      return result.data as UserListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (lastPage) => lastPage?.nextCursor ?? undefined,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserCreateInput) => {
      const result = await createUserAction(data);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("User created");
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserUpdateInput & { id: number }) => {
      const result = await updateUserAction(data);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success("User updated");
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useToggleUserStatus(targetActive: boolean) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const result = await toggleUserStatusAction({ ...input, isActive: targetActive });
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: () => {
      toast.success(`User ${targetActive ? "activated" : "deactivated"}`);
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
}

export function useResetUserPassword() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: number }) => {
      const result = await resetUserPasswordAction(input);
      if (!result.success) throw new Error(result.message);
      return result.data;
    },
    onSuccess: (data) => {
      if (data?.resetToken) {
        toast.success(`Reset token: ${data.resetToken}`);
      } else {
        toast.success("Password reset initiated");
      }
      queryClient.invalidateQueries({ queryKey: [USERS_KEY] });
    },
    onError: (error: Error) => toast.error(error.message),
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
