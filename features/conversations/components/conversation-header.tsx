'use client';

import { useState } from 'react';
import { useConversation } from '../hooks/conversation-hooks';
import { MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UpdateContactNameDialog } from './update-contact-name-dialog';

interface ConversationHeaderProps {
  conversationId: number | null;
}

export function ConversationHeader({ conversationId }: ConversationHeaderProps) {
  const { data: selectedConversation } = useConversation(conversationId);
  const contact = selectedConversation?.contact as { id?: number; name?: string | null; phone?: string } | undefined;
  const displayName = contact?.name || contact?.phone || '';
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);

  const handleUpdateName = () => {
    setIsUpdateDialogOpen(true);
  };

  return (
    <>
      <div className="border-b p-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{displayName}</h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleUpdateName}>Update Name</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {contact?.id && (
        <UpdateContactNameDialog
          open={isUpdateDialogOpen}
          onOpenChange={setIsUpdateDialogOpen}
          contactId={contact.id}
          currentName={contact.name || ''}
        />
      )}
    </>
  );
}
