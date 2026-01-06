'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WhatsAppAccountSelector } from './whatsapp-account-selector';

interface ConversationSidebarHeaderProps {
  onNewMessage: () => void;
}

export function ConversationSidebarHeader({ onNewMessage }: ConversationSidebarHeaderProps) {
  return (
    <div className="border-b p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Messages</p>
          <p className="text-lg font-bold">Inbox</p>
        </div>
        <Button
          size="icon"
          variant="outline"
          onClick={onNewMessage}
          aria-label="New message"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <WhatsAppAccountSelector />
    </div>
  );
}
