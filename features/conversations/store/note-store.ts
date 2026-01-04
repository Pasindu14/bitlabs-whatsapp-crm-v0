import { create } from 'zustand';

interface NoteStore {
  isDialogOpen: boolean;
  conversationId: number | null;
  isDeleteDialogOpen: boolean;
  deletingNoteId: number | null;

  openDialog: (conversationId: number) => void;
  closeDialog: () => void;
  openDeleteDialog: (noteId: number, conversationId: number) => void;
  closeDeleteDialog: () => void;
}

export const useNoteStore = create<NoteStore>((set) => ({
  isDialogOpen: false,
  conversationId: null,
  isDeleteDialogOpen: false,
  deletingNoteId: null,

  openDialog: (conversationId) =>
    set({
      isDialogOpen: true,
      conversationId,
    }),

  closeDialog: () =>
    set({
      isDialogOpen: false,
      conversationId: null,
    }),

  openDeleteDialog: (noteId, conversationId) =>
    set({
      isDeleteDialogOpen: true,
      deletingNoteId: noteId,
      conversationId,
    }),

  closeDeleteDialog: () =>
    set({
      isDeleteDialogOpen: false,
      deletingNoteId: null,
      conversationId: null,
    }),
}));
