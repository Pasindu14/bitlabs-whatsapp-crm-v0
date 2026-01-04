'use server';

import { withAction } from '@/lib/server-action-helper';
import { Result } from '@/lib/result';
import { NoteService } from '../services/note-service';
import {
  conversationNoteCreateClientSchema,
  conversationNoteUpdateClientSchema,
  conversationNoteDeleteClientSchema,
  conversationNoteListSchema,
  conversationNoteGetSchema,
  type ConversationNoteCreateClientInput,
  type ConversationNoteUpdateClientInput,
  type ConversationNoteDeleteClientInput,
  type ConversationNoteListInput,
  type ConversationNoteGetInput,
  type ConversationNoteResponse,
  type ConversationNoteListResponse,
} from '../schemas/note-schema';

export const createConversationNoteAction = withAction<ConversationNoteCreateClientInput, ConversationNoteResponse>(
  'conversationNotes.create',
  async (auth, input) => {
    const result = await NoteService.create({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Note created successfully');
  },
  { schema: conversationNoteCreateClientSchema }
);

export const updateConversationNoteAction = withAction<ConversationNoteUpdateClientInput, ConversationNoteResponse>(
  'conversationNotes.update',
  async (auth, input) => {
    const result = await NoteService.update({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Note updated successfully');
  },
  { schema: conversationNoteUpdateClientSchema }
);

export const deleteConversationNoteAction = withAction<ConversationNoteDeleteClientInput, { success: boolean }>(
  'conversationNotes.delete',
  async (auth, input) => {
    const result = await NoteService.delete({
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Note deleted successfully');
  },
  { schema: conversationNoteDeleteClientSchema }
);

export const listConversationNotesAction = withAction<ConversationNoteListInput, ConversationNoteListResponse>(
  'conversationNotes.list',
  async (auth, input) => {
    const result = await NoteService.listForConversation({
      ...input,
      companyId: auth.companyId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Notes loaded');
  },
  { schema: conversationNoteListSchema }
);

export const getConversationNoteAction = withAction<ConversationNoteGetInput, ConversationNoteResponse>(
  'conversationNotes.get',
  async (auth, input) => {
    const result = await NoteService.getById({
      ...input,
      companyId: auth.companyId,
    });
    if (!result.isOk) return result;

    return Result.ok(result.data, 'Note loaded');
  },
  { schema: conversationNoteGetSchema }
);

export const getUserNoteForConversationAction = withAction<{ conversationId: number }, ConversationNoteResponse | null>(
  'conversationNotes.getUserNote',
  async (auth, input) => {
    const result = await NoteService.getUserNoteForConversation(
      input.conversationId,
      auth.userId,
      auth.companyId
    );
    if (!result.isOk) return result;

    return Result.ok(result.data, 'User note loaded');
  }
);
