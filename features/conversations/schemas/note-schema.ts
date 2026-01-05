import { z } from "zod";

export const NOTE_CONTENT_MIN_LENGTH = 1;
export const NOTE_CONTENT_MAX_LENGTH = 10000;

export const conversationNoteCreateClientSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string()
    .min(NOTE_CONTENT_MIN_LENGTH, 'Note content is required')
    .max(NOTE_CONTENT_MAX_LENGTH, 'Note is too long (max 10,000 characters)')
    .trim(),
  isPinned: z.boolean().default(false),
});

export type ConversationNoteCreateClientInput = z.infer<typeof conversationNoteCreateClientSchema>;

export const conversationNoteCreateServerSchema = conversationNoteCreateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type ConversationNoteCreateServerInput = z.infer<typeof conversationNoteCreateServerSchema>;

export const conversationNoteUpdateClientSchema = z.object({
  noteId: z.number().int().positive(),
  content: z.string()
    .min(NOTE_CONTENT_MIN_LENGTH, 'Note content is required')
    .max(NOTE_CONTENT_MAX_LENGTH, 'Note is too long (max 10,000 characters)')
    .trim(),
  isPinned: z.boolean().optional(),
});

export type ConversationNoteUpdateClientInput = z.infer<typeof conversationNoteUpdateClientSchema>;

export const conversationNoteUpdateServerSchema = conversationNoteUpdateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type ConversationNoteUpdateServerInput = z.infer<typeof conversationNoteUpdateServerSchema>;

export const conversationNoteDeleteClientSchema = z.object({
  noteId: z.number().int().positive(),
});

export type ConversationNoteDeleteClientInput = z.infer<typeof conversationNoteDeleteClientSchema>;

export const conversationNoteDeleteServerSchema = conversationNoteDeleteClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type ConversationNoteDeleteInput = z.infer<typeof conversationNoteDeleteServerSchema>;

export const conversationNoteListSchema = z.object({
  conversationId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export type ConversationNoteListInput = z.infer<typeof conversationNoteListSchema>;

export const conversationNoteGetSchema = z.object({
  noteId: z.number().int().positive(),
});

export type ConversationNoteGetInput = z.infer<typeof conversationNoteGetSchema>;

export const conversationNoteResponseSchema = z.object({
  id: z.number().int(),
  conversationId: z.number().int(),
  companyId: z.number().int(),
  content: z.string(),
  isPinned: z.boolean(),
  createdBy: z.number().int(),
  updatedBy: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  isActive: z.boolean(),
  creator: z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
  }).optional(),
});

export type ConversationNoteResponse = z.infer<typeof conversationNoteResponseSchema>;

export const conversationNoteListResponseSchema = z.object({
  notes: z.array(conversationNoteResponseSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type ConversationNoteListResponse = z.infer<typeof conversationNoteListResponseSchema>;
