'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NoteEditor } from './note-editor';
import { useUpdateConversationNote, useConversationNote } from '../hooks/note-hooks';
import { useNoteStore } from '../store/note-store';
import { toast } from 'sonner';

export function EditNoteDialog() {
  const { editingNoteId, conversationId, closeEditDialog } = useNoteStore();
  const updateNoteMutation = useUpdateConversationNote();
  const { data: note } = useConversationNote(editingNoteId);

  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (note) {
      setContent(note.content);
      setIsPinned(note.isPinned);
    }
  }, [note]);

  const handleClose = () => {
    setContent('');
    setIsPinned(false);
    closeEditDialog();
  };

  const handleSubmit = async () => {
    if (!editingNoteId || !content.trim()) {
      toast.error('Note content is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await updateNoteMutation.mutateAsync({
        noteId: editingNoteId,
        content,
        isPinned,
      });
      toast.success('Note updated successfully');
      handleClose();
    } catch (error) {
      toast.error('Failed to update note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={!!editingNoteId} onOpenChange={handleClose}>
      <DialogContent className="min-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Edit Note</DialogTitle>
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
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
