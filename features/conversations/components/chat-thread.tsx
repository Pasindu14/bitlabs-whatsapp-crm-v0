"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { useMessages } from "../hooks/use-messages";
import type { MessageResponse } from "../schemas/message.schema";

type Props = {
  conversationId: number | null;
};

function MessageBubble({ message }: { message: MessageResponse }) {
  const isOutbound = message.direction === "outbound";
  return (
    <div className="flex flex-col gap-1 text-sm">
      <div
        className={`max-w-xl rounded-lg px-3 py-2 ${
          isOutbound ? "ml-auto bg-primary text-primary-foreground" : "mr-auto bg-muted"
        }`}
      >
        {message.content?.text ?? JSON.stringify(message.content)}
      </div>
      <div className="text-xs text-muted-foreground flex gap-2">
        <span>{new Date(message.timestamp).toLocaleTimeString()}</span>
        <span>{message.status}</span>
      </div>
    </div>
  );
}

export function ChatThread({ conversationId }: Props) {
  const {
    data,
    isLoading,
    isError,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useMessages({ conversationId: conversationId ?? 0, limit: 30, cursor: undefined, enabled: !!conversationId });

  const messagesDesc = data?.pages.flatMap((p) => p.items) ?? [];
  const messagesAsc = [...messagesDesc].reverse();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <div className="text-sm font-medium">Conversation</div>
        <Button variant="ghost" size="icon" onClick={() => refetch()} disabled={!conversationId || isFetching}>
          {isFetching ? <Spinner className="h-4 w-4" /> : "↻"}
        </Button>
      </div>
      <div className="flex-1 overflow-hidden">
        {isLoading && conversationId ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : isError ? (
          <div className="p-4 text-sm text-destructive">Failed to load messages</div>
        ) : !conversationId ? (
          <div className="p-6 text-sm text-muted-foreground">Select a conversation to view messages.</div>
        ) : (
          <ScrollArea className="h-full">
            <div className="flex flex-col gap-3 p-4">
              {messagesAsc.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              {messagesAsc.length === 0 && (
                <div className="text-sm text-muted-foreground">No messages yet</div>
              )}
              {hasNextPage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="self-center"
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                >
                  {isFetchingNextPage ? <Spinner className="h-4 w-4" /> : "Load older"}
                </Button>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
