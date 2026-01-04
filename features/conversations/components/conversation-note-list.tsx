'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { useConversationNotes } from '../hooks/note-hooks';
import { ConversationNoteItem } from './conversation-note-item';
import { useUpdateConversationNote } from '../hooks/note-hooks';
import { toast } from 'sonner';

interface ConversationNoteListProps {
  conversationId: number | null;
  currentUserId: number;
  onEditNote: (noteId: number) => void;
  onDeleteNote: (noteId: number) => void;
}

export function ConversationNoteList({
  conversationId,
  currentUserId,
  onEditNote,
  onDeleteNote,
}: ConversationNoteListProps) {
  const { data, isLoading, error } = useConversationNotes(conversationId);
  const updateNoteMutation = useUpdateConversationNote();

  const handleTogglePin = async (noteId: number, isPinned: boolean) => {
    try {
      const note = data?.notes.find((n) => n.id === noteId);
      if (!note) return;

      await updateNoteMutation.mutateAsync({
        noteId,
        content: note.content,
        isPinned,
      });
      toast.success(isPinned ? 'Note pinned' : 'Note unpinned');
    } catch (error) {
      toast.error('Failed to update note');
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="border rounded-md p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 rounded-full" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Failed to load notes</p>
      </div>
    );
  }

  if (!data || data.notes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>No notes yet. Add a note to document important information.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {data.notes.map((note) => (
        <ConversationNoteItem
          key={note.id}
          note={note}
          currentUserId={currentUserId}
          onEdit={onEditNote}
          onDelete={onDeleteNote}
          onTogglePin={handleTogglePin}
        />
      ))}
    </div>
  );
}
