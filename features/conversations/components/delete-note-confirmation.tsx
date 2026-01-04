'use client';

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useDeleteConversationNote } from '../hooks/note-hooks';
import { useNoteStore } from '../store/note-store';
import { toast } from 'sonner';

export function DeleteNoteConfirmation() {
  const { isDeleteDialogOpen, deletingNoteId, conversationId, closeDeleteDialog } = useNoteStore();
  const deleteNoteMutation = useDeleteConversationNote();

  const handleDelete = async () => {
    if (!deletingNoteId || !conversationId) return;

    try {
      await deleteNoteMutation.mutateAsync({
        noteId: deletingNoteId,
        conversationId,
      });
      toast.success('Note deleted successfully');
      closeDeleteDialog();
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  return (
    <AlertDialog open={isDeleteDialogOpen} onOpenChange={closeDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Note</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this note? This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteNoteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteNoteMutation.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleteNoteMutation.isPending ? 'Deleting...' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
