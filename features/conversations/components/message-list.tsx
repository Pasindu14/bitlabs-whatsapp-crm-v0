'use client';

import { useConversationMessages, useRetryFailedMessage } from '../hooks/conversation-hooks';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef } from 'react';
import { MediaPlaceholder } from './media-placeholder';

interface MessageListProps {
  conversationId: number;

}

export function MessageList({ conversationId }: MessageListProps) {
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useConversationMessages(conversationId);
  const { mutate: retryMessage, isPending: isRetrying } = useRetryFailedMessage();
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const messages = data?.pages.flatMap((page) => page?.messages || []) || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
  }, [messages.length, conversationId]);

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-4 p-4">
          {Array.from({ length: 13 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Failed to load messages</p>
          <p className="text-xs text-muted-foreground">Please try again</p>
        </div>
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">No messages</p>
          <p className="text-xs text-muted-foreground">Start the conversation!</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-4 p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.direction === 'outbound' ? 'justify-end' : 'justify-start'
            }`}
          >
            <div
              className={`max-w-xs rounded-lg px-4 py-2 ${
                message.direction === 'outbound'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              {message.mediaId && message.mediaType && (
                <div className="mb-2">
                  <MediaPlaceholder
                    mediaId={message.mediaId}
                    mediaType={message.mediaType as 'image' | 'video' | 'audio' | 'document'}
                    caption={message.mediaCaption || undefined}
                    className="max-w-[250px]"
                  />
                </div>
              )}
              {message.content && (
                <p className="text-sm">{message.content}</p>
              )}
              <div className="mt-1 flex items-center justify-between gap-2 text-xs opacity-70">
                <span>{format(new Date(message.createdAt), 'HH:mm')}</span>
                {message.direction === 'outbound' && (
                  <span>
                    {message.status === 'sending' && '⏱'}
                    {message.status === 'sent' && '✓'}
                    {message.status === 'delivered' && '✓✓'}
                    {message.status === 'read' && '✓✓'}
                    {message.status === 'failed' && '✗'}
                  </span>
                )}
              </div>
              {message.status === 'failed' && message.direction === 'outbound' && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-auto w-full p-1 text-xs"
                  onClick={() => {
                    retryMessage(message.id, {
                      onSuccess: () => {
                        toast.success('Message retry sent');
                      },
                      onError: (error) => {
                        toast.error(error.message || 'Failed to retry message');
                      },
                    });
                  }}
                  disabled={isRetrying}
                >
                  <RotateCcw className="mr-1 h-3 w-3" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        ))}

        <div ref={bottomRef} aria-hidden />

        {hasNextPage && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Loading...' : 'Load older messages'}
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
