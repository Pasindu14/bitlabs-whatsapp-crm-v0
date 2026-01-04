'use client';

import { useSession } from 'next-auth/react';
import { Plus } from 'lucide-react';
import { ConversationList } from '@/features/conversations/components/conversation-list';
import { MessageList } from '@/features/conversations/components/message-list';
import { ConversationHeader } from '@/features/conversations/components/conversation-header';
import { ConversationFilterChips } from '@/features/conversations/components/conversation-filter-chips';
import { ConversationSearch } from '@/features/conversations/components/conversation-search';
import { MessageInput } from '@/features/conversations/components/message-input';
import { NewMessageModal } from '@/features/conversations/components/new-message-modal';
import { useConversationStore } from '@/features/conversations/store/conversation-store';
import { useSendNewMessage, useConversations, useWhatsAppMessageHistory } from '@/features/conversations/hooks/conversation-hooks';
import { useDefaultWhatsappAccount } from '@/features/whatsapp-accounts/hooks/use-whatsapp-accounts';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function ConversationsPage() {
  const session = useSession();
  const {
    selectedConversationId,
    filterType,
    searchTerm,
    showArchivedSection,
    openNewMessageModal,
  } = useConversationStore();

  const { isPending: isSending } = useSendNewMessage();

  const currentUserId = session.data?.user?.id ? parseInt(session.data.user.id, 10) : undefined;

  const { data: conversationsData } = useConversations({
    filterType,
    searchTerm,
    includeArchived: showArchivedSection,
    limit: 50,
    assignedUserId: filterType === 'assigned' ? currentUserId : undefined,
  });

  const { data: defaultAccount } = useDefaultWhatsappAccount();


  const handleSendMessage = () => {
    if (!selectedConversationId) {
      toast.error('Please select a conversation first');
      return;
    }

    toast.info('Message sending not yet implemented for existing conversations');
  };


  return (
    <div className="flex h-screen gap-4 bg-background">
      {/* Sidebar */}
      <div className="w-80 border-r flex flex-col">
        {/* Header */}
        <div className="border-b p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Messages</p>
            <p className="text-lg font-bold">Inbox</p>
          </div>
          <Button
            size="icon"
            variant="outline"
            onClick={openNewMessageModal}
            aria-label="New message"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Search */}
        <ConversationSearch />

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          <ConversationList
            filterType={filterType}
            searchTerm={searchTerm}
            includeArchived={showArchivedSection}
          />
        </div>

        {/* Filter Chips */}
        <div className="border-t p-2">
          <ConversationFilterChips />
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedConversationId ? (
          <>
            {/* Chat Header */}
            <ConversationHeader conversationId={selectedConversationId} />

            {/* Messages */}
            <div className="flex-1 overflow-hidden">
              <MessageList
                conversationId={selectedConversationId}
          
              />
            </div>

            {/* Message Input */}
            <MessageInput
              onSend={handleSendMessage}
              isLoading={isSending}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">
                Select a conversation to start messaging
              </p>
              <p className="text-sm text-muted-foreground">
                Or create a new message with the + button
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <NewMessageModal />
    </div>
  );
}
