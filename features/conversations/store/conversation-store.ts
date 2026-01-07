import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ConversationFilterType } from '../schemas/conversation-schema';

interface SelectedImage {
  file: File;
  previewUrl: string;
  uploadUrl?: string;
  uploadKey?: string;
}

interface ConversationStoreState {
  selectedConversationId: number | null;
  setSelectedConversation: (id: number | null) => void;

  selectedWhatsappAccountId: number | null;
  setSelectedWhatsappAccountId: (id: number | null) => void;

  filterType: ConversationFilterType;
  setFilterType: (type: ConversationFilterType) => void;

  searchTerm: string;
  setSearchTerm: (term: string) => void;

  showArchivedSection: boolean;
  setShowArchivedSection: (show: boolean) => void;

  isNewMessageModalOpen: boolean;
  openNewMessageModal: () => void;
  closeNewMessageModal: () => void;

  selectedImage: SelectedImage | null;
  setSelectedImage: (image: File | null) => void;
  clearSelectedImage: () => void;
  setUploadedImage: (url: string, key: string) => void;
}

export const useConversationStore = create<ConversationStoreState>()(
  persist(
    (set) => ({
      selectedConversationId: null,
      setSelectedConversation: (id) => set({ selectedConversationId: id }),

      selectedWhatsappAccountId: null,
      setSelectedWhatsappAccountId: (id) => set({ selectedWhatsappAccountId: id }),

      filterType: 'all',
      setFilterType: (type) => set({ filterType: type }),

      searchTerm: '',
      setSearchTerm: (term) => set({ searchTerm: term }),

      showArchivedSection: false,
      setShowArchivedSection: (show) => set({ showArchivedSection: show }),

      isNewMessageModalOpen: false,
      openNewMessageModal: () => set({ isNewMessageModalOpen: true }),
      closeNewMessageModal: () => set({ isNewMessageModalOpen: false }),

      selectedImage: null,
      setSelectedImage: (file) => set({
        selectedImage: file ? {
          file,
          previewUrl: URL.createObjectURL(file),
        } : null,
      }),
      clearSelectedImage: () => set({ selectedImage: null }),
      setUploadedImage: (url, key) => set((state) => ({
        selectedImage: state.selectedImage ? {
          ...state.selectedImage,
          uploadUrl: url,
          uploadKey: key,
        } : null,
      })),
    }),
    {
      name: 'conversation-store',
      partialize: (state) => ({
        selectedConversationId: state.selectedConversationId,
        filterType: state.filterType,
      }),
    }
  )
);
