'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NoteEditor } from './note-editor';
import { useCreateConversationNote, useUpdateConversationNote, useUserNoteForConversation } from '../hooks/note-hooks';
import { useNoteStore } from '../store/note-store';
import { toast } from 'sonner';

export function NoteDialog() {
  const { isDialogOpen, conversationId, closeDialog } = useNoteStore();
  const { data: userNote } = useUserNoteForConversation(conversationId);
  const createNoteMutation = useCreateConversationNote();
  const updateNoteMutation = useUpdateConversationNote();

  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!userNote;
  const isOpen = isDialogOpen;

  useEffect(() => {
    if (userNote) {
      setContent(userNote.content);
      setIsPinned(userNote.isPinned);
    } else {
      setContent('');
      setIsPinned(false);
    }
  }, [userNote, isOpen]);

  const handleClose = () => {
    setContent('');
    setIsPinned(false);
    closeDialog();
  };

  const handleSubmit = async () => {
    if (!conversationId || !content.trim()) {
      toast.error('Note content is required');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && userNote) {
        await updateNoteMutation.mutateAsync({
          noteId: userNote.id,
          content,
          isPinned,
        });
        toast.success('Note updated successfully');
      } else {
        await createNoteMutation.mutateAsync({
          conversationId,
          content,
          isPinned,
        });
        toast.success('Note created successfully');
      }
      handleClose();
    } catch (error) {
      toast.error(isEditing ? 'Failed to update note' : 'Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="min-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Note' : 'Add Note'}</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <NoteEditor content={content} onChange={setContent} />

          <div className="flex items-center space-x-2">
            <Checkbox
              id="pin"
              checked={isPinned}
              onCheckedChange={(checked) => setIsPinned(checked as boolean)}
            />
            <Label htmlFor="pin" className="cursor-pointer">
              Pin this note
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
