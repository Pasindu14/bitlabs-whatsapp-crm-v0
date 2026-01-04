'use client';

import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { useConversations } from '../hooks/conversation-hooks';
import { useConversationStore } from '../store/conversation-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { MessageCircle } from 'lucide-react';
import type { ConversationFilterType, ConversationResponse, ContactResponse } from '../schemas/conversation-schema';

interface ConversationListProps {
  filterType: ConversationFilterType;
  searchTerm: string;
  includeArchived: boolean;
}

export function ConversationList({
  filterType,
  searchTerm,
  includeArchived,
}: ConversationListProps) {
  const session = useSession();
  const { selectedConversationId, setSelectedConversation } = useConversationStore();

  const { data, isLoading, error } = useConversations({
    filterType,
    searchTerm,
    includeArchived,
    limit: 50,
    assignedUserId: filterType === 'assigned' ? parseInt(session.data?.user.id || '0', 10) || undefined : undefined,
  });

  useEffect(() => {
    if (!isLoading && !error && data?.conversations && data.conversations.length === 0) {
      setSelectedConversation(null);
    }
  }, [data, isLoading, error, setSelectedConversation]);

  if (isLoading) {
    return (
      <ScrollArea className="h-full">
        <div className="space-y-2 p-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">Failed to load conversations</p>
          <p className="text-xs text-muted-foreground">Please try again</p>
        </div>
      </div>
    );
  }

  if (!data?.conversations || data.conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-center">
        <div>
          <MessageCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
          <p className="mt-2 text-sm font-medium text-foreground">No conversations</p>
          <p className="text-xs text-muted-foreground">Start a new chat with the + button</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="space-y-1 p-2">
        {data.conversations.map((conversation) => {
          const contact = conversation.contact as ContactResponse | undefined;
          const isSelected = selectedConversationId === conversation.id;

          return (
            <button
              key={conversation.id}
              onClick={() => setSelectedConversation(conversation.id)}
              className={`w-full rounded-lg px-3 py-2 text-left transition-colors ${
                isSelected
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent/50'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">
                    {contact?.name || contact?.phone || 'Unknown'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {conversation.lastMessagePreview || 'No messages'}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  {conversation.lastMessageTime && (
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(conversation.lastMessageTime), 'HH:mm')}
                    </span>
                  )}
                  {conversation.unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center h-5 w-5 rounded-full bg-primary text-xs font-medium text-primary-foreground">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </ScrollArea>
  );
}
