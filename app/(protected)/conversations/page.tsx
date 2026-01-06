'use client';

import { useSession } from 'next-auth/react';
import { Plus, ArrowLeft } from 'lucide-react';
import { ConversationList } from '@/features/conversations/components/conversation-list';
import { MessageList } from '@/features/conversations/components/message-list';
import { ConversationHeader } from '@/features/conversations/components/conversation-header';
import { ConversationFilterChips } from '@/features/conversations/components/conversation-filter-chips';
import { ConversationSearch } from '@/features/conversations/components/conversation-search';
import { MessageInput } from '@/features/conversations/components/message-input';
import { NewMessageModal } from '@/features/conversations/components/new-message-modal';
import { useConversationStore } from '@/features/conversations/store/conversation-store';
import { useSendNewMessage, useConversations, useWhatsAppMessageHistory, useConversation } from '@/features/conversations/hooks/conversation-hooks';
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
    setSelectedConversation,
  } = useConversationStore();

  const { isPending: isSending, mutate: sendNewMessage } = useSendNewMessage();
  const { data: selectedConversation } = useConversation(selectedConversationId);

  const currentUserId = session.data?.user?.id ? parseInt(session.data.user.id, 10) : undefined;

  const { data: conversationsData } = useConversations({
    filterType,
    searchTerm,
    includeArchived: showArchivedSection,
    limit: 50,
    assignedUserId: filterType === 'assigned' ? currentUserId : undefined,
  });

  const { data: defaultAccount } = useDefaultWhatsappAccount();


  const handleSendMessage = async (messageText: string) => {
    if (!selectedConversationId) {
      toast.error('Please select a conversation first');
      return;
    }

    if (!selectedConversation?.contact?.phone) {
      toast.error('Could not find contact phone number');
      return;
    }

    try {
      await sendNewMessage({
        phoneNumber: selectedConversation.contact.phone,
        messageText,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message';
      toast.error(errorMessage);
    }
  };

  const handleBackToList = () => {
    setSelectedConversation(null);
  };

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const showChatView = selectedConversationId && isMobile;

  return (
    <div className="flex h-[100dvh] md:h-[calc(100dvh-50px)] gap-4 bg-background">
      {/* Sidebar - Hidden on mobile when chat is selected */}
      <div className={`${showChatView ? 'hidden md:flex' : 'flex'} w-80 border-r flex flex-col md:flex`}>
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

      {/* Main Chat Area - Full width on mobile when selected */}
      <div className={`${showChatView ? 'flex' : 'hidden md:flex'} flex-1 flex flex-col`}>
        {selectedConversationId ? (
          <>
            {/* Chat Header */}
            <div className="p-4 flex items-center gap-3 border-b md:hidden">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={handleBackToList}
                aria-label="Back to conversations"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <ConversationHeader conversationId={selectedConversationId} />
            </div>
            <div className="hidden md:block md:border-b md:p-4">
              <ConversationHeader conversationId={selectedConversationId} />
            </div>

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
