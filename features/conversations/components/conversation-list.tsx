"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { useConversations, useMarkConversationRead } from "../hooks/use-conversations";
import type { ConversationResponse } from "../schemas/conversation.schema";
import { ConversationListItem } from "./conversation-list-item";

interface ConversationListProps {
  selectedId: number | null;
  onSelect: (id: number) => void;
  onSelectConversation?: (c: ConversationResponse) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filters: {
    status?: "active" | "archived";
    assignedTo?: number | null;
    whatsappAccountId?: number | null;
  };
}

export function ConversationList({
  selectedId,
  onSelect,
  onSelectConversation,
  search,
  onSearchChange,
  filters,
}: ConversationListProps) {
  const { data, isLoading, isFetching, isFetchingNextPage, fetchNextPage, hasNextPage, refetch, isError } =
    useConversations({
      cursor: undefined,
      limit: 20,
      search: search || undefined,
      status: filters.status,
      assignedTo: filters.assignedTo ?? undefined,
      whatsappAccountId: filters.whatsappAccountId ?? undefined,
    });

  const markRead = useMarkConversationRead();

  useEffect(() => {
    if (selectedId) {
      markRead.mutate({ id: selectedId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const items = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="flex h-full flex-col border-r">
      <div className="p-3 flex gap-2 items-center">
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search conversations"
          className="h-9"
        />
        <Button variant="outline" size="icon" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Spinner className="h-4 w-4" /> : "↻"}
        </Button>
      </div>

      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">Failed to load conversations</div>
        ) : (
          <ScrollArea className="h-full">
            <div className="space-y-2 p-3">
              {items.map((c) => (
                <ConversationListItem
                  key={c.id}
                  conversation={c}
                  selected={c.id === selectedId}
                  onSelect={(id) => {
                    onSelect(id);
                    onSelectConversation?.(c);
                  }}
                />
              ))}
              {items.length === 0 && (
                <div className="text-sm text-muted-foreground text-center py-6">No conversations yet</div>
              )}
              {hasNextPage && (
                <div className="flex justify-center py-2">
                  <Button variant="outline" onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? <Spinner className="h-4 w-4" /> : "Load more"}
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
