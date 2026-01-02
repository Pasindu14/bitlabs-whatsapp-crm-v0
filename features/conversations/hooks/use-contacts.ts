"use client";

import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listContactsAction, upsertContactAction } from "../actions/contact.actions";
import type {
  ContactCreateInput,
  ContactListInput,
  ContactListResponse,
  ContactUpdateInput,
} from "../schemas/contact.schema";

const CONTACTS_KEY = "contacts";

function buildContactsKey(params: ContactListInput) {
  return [
    CONTACTS_KEY,
    {
      cursor: params.cursor,
      limit: params.limit,
      search: params.search,
      tags: params.tags,
    },
  ];
}

export function useContacts(params: ContactListInput) {
  return useInfiniteQuery({
    queryKey: buildContactsKey(params),
    queryFn: async ({ pageParam }) => {
      const result = await listContactsAction({
        ...params,
        cursor: (pageParam as string | undefined) ?? params.cursor,
      });
      if (!result.ok) throw new Error(result.error);
      return result.data as ContactListResponse;
    },
    initialPageParam: params.cursor ?? undefined,
    getNextPageParam: (last) => last?.nextCursor ?? undefined,
  });
}

export function useUpsertContact() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactCreateInput | (ContactUpdateInput & { id: number })) => {
      const result = await upsertContactAction(input as any);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      toast.success("Contact saved");
      queryClient.invalidateQueries({ queryKey: [CONTACTS_KEY] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
