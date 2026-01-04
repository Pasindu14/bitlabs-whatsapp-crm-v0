'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useConversation } from '../hooks/conversation-hooks';
import { MoreVertical, Pencil, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UpdateContactNameDialog } from './update-contact-name-dialog';
import { AssignUserDialog } from './assign-user-dialog';

interface ConversationHeaderProps {
  conversationId: number | null;
}

export function ConversationHeader({ conversationId }: ConversationHeaderProps) {
  const session = useSession();
  const { data: selectedConversation } = useConversation(conversationId);
  const contact = selectedConversation?.contact as { id?: number; name?: string | null; phone?: string } | undefined;
  const displayName = contact?.name || contact?.phone || '';
  const [isUpdateDialogOpen, setIsUpdateDialogOpen] = useState(false);
  const [isAssignUserDialogOpen, setIsAssignUserDialogOpen] = useState(false);

  const currentUserId = session.data?.user?.id ? parseInt(session.data.user.id, 10) : undefined;
  const assignedToUserId = selectedConversation?.assignedToUserId;
  const canUpdateContact = !assignedToUserId || assignedToUserId === currentUserId;

  const handleUpdateName = () => {
    setIsUpdateDialogOpen(true);
  };

  const handleAssignUser = () => {
    setIsAssignUserDialogOpen(true);
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
            <DropdownMenuItem onClick={handleAssignUser} className="text-xs">
              <User className="mr-2 h-3 w-3" />
              Assign User
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleUpdateName} className="text-xs" disabled={!canUpdateContact}>
              <Pencil className="mr-2 h-3 w-3" />
              Update Name
            </DropdownMenuItem>
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
      {conversationId && (
        <AssignUserDialog
          open={isAssignUserDialogOpen}
          onOpenChange={setIsAssignUserDialogOpen}
          conversationId={conversationId}
          currentAssignedUserId={assignedToUserId ?? null}
        />
      )}
    </>
  );
}
