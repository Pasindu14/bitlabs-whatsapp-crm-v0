'use client';

import { format } from 'date-fns';
import { Pin, PinOff, MoreHorizontal, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card } from '@/components/ui/card';
import DOMPurify from 'dompurify';
import type { ConversationNoteResponse } from '../schemas/note-schema';

interface ConversationNoteItemProps {
  note: ConversationNoteResponse;
  currentUserId: number;
  onEdit: (noteId: number) => void;
  onDelete: (noteId: number) => void;
  onTogglePin: (noteId: number, isPinned: boolean) => void;
}

export function ConversationNoteItem({
  note,
  currentUserId,
  onEdit,
  onDelete,
  onTogglePin,
}: ConversationNoteItemProps) {
  const isOwner = note.createdBy === currentUserId;
  const sanitizedContent = DOMPurify.sanitize(note.content);

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          {note.creator ? (
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {note.creator.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center">
              <User className="h-3 w-3 text-muted-foreground" />
            </div>
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium">
              {note.creator?.name || 'Unknown User'}
            </span>
            <span className="text-xs text-muted-foreground">
              {format(new Date(note.createdAt), 'MMM d, yyyy • h:mm a')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onTogglePin(note.id, !note.isPinned)}
            className="h-8 w-8 p-0"
          >
            {note.isPinned ? (
              <Pin className="h-4 w-4 fill-current" />
            ) : (
              <PinOff className="h-4 w-4" />
            )}
          </Button>

          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(note.id)}>
                  Edit Note
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => onDelete(note.id)}
                  className="text-destructive"
                >
                  Delete Note
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      <div className="prose prose-sm max-w-none">
        <div dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
      </div>
    </Card>
  );
}
