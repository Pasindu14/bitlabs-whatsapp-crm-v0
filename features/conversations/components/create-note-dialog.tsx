'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { NoteEditor } from './note-editor';
import { useCreateConversationNote } from '../hooks/note-hooks';
import { useNoteStore } from '../store/note-store';
import { toast } from 'sonner';

export function CreateNoteDialog() {
  const { isCreateDialogOpen, conversationId, closeCreateDialog } = useNoteStore();
  const createNoteMutation = useCreateConversationNote();
  const [content, setContent] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = () => {
    setContent('');
    setIsPinned(false);
    closeCreateDialog();
  };

  const handleSubmit = async () => {
    if (!conversationId || !content.trim()) {
      toast.error('Note content is required');
      return;
    }

    setIsSubmitting(true);
    try {
      await createNoteMutation.mutateAsync({
        conversationId,
        content,
        isPinned,
      });
      toast.success('Note created successfully');
      handleClose();
    } catch (error) {
      toast.error('Failed to create note');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isCreateDialogOpen} onOpenChange={handleClose}>
      <DialogContent className="min-w-6xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Add Note</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          <NoteEditor content={content} onChange={setContent}  />

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
            {isSubmitting ? 'Saving...' : 'Save Note'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
