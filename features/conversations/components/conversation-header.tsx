'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useConversation } from '../hooks/conversation-hooks';
import { useUserNoteForConversation } from '../hooks/note-hooks';
import { useNoteStore } from '../store/note-store';
import { MoreVertical, Pencil, User, StickyNote, Edit3, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { UpdateContactNameDialog } from './update-contact-name-dialog';
import { AssignUserDialog } from './assign-user-dialog';
import { NoteDialog } from './note-dialog';
import { formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface ConversationHeaderProps {
  conversationId: number | null;
}

export function ConversationHeader({ conversationId }: ConversationHeaderProps) {
  const session = useSession();
  const { data: selectedConversation } = useConversation(conversationId);
  const { data: userNote } = useUserNoteForConversation(conversationId);
  const { openDialog } = useNoteStore();
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

  const handleAddNote = () => {
    if (conversationId) {
      openDialog(conversationId);
    }
  };

  const handleEditNote = () => {
    if (conversationId) {
      openDialog(conversationId);
    }
  };

  const lastMessageAt = selectedConversation?.lastMessageTime;

  return (
    <>
      <div className="p-1 flex items-center justify-between w-full">
        <h2 className="text-lg font-semibold">{displayName}</h2>
        <div className="flex items-center gap-2">
         <span className="text-xs text-muted-foreground"> <Clock className="mr-2 h-3 w-3" /></span>
          {lastMessageAt && (
            <Badge className="text-xs text-muted-foreground bg-muted">
              {formatDistanceToNow(new Date(lastMessageAt), { addSuffix: true })}
            </Badge>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleAddNote} className="text-xs">
                <StickyNote className="mr-2 h-3 w-3" />
                Add/Edit Note
              </DropdownMenuItem>
              <DropdownMenuSeparator />
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
      <NoteDialog />
    </>
  );
}
