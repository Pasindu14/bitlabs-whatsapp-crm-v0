import { z } from 'zod';

// Constants
export const CONVERSATION_FILTER_TYPES = ['all', 'unread', 'favorites', 'groups'] as const;
export type ConversationFilterType = (typeof CONVERSATION_FILTER_TYPES)[number];

export const MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'read', 'failed'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

// Phone number validation and normalization
export const phoneNumberSchema = z
  .string()
  .min(1, 'Phone number required')
  .max(20, 'Phone number too long')
  .transform((val) => val.replace(/\D/g, ''))
  .refine((val) => val.length >= 10 && val.length <= 15, 'Invalid phone number format');

// Message text validation
export const messageTextSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(4096, 'Message too long');

// Send new message - Client schema (form validation)
export const sendNewMessageClientSchema = z.object({
  phoneNumber: phoneNumberSchema,
  messageText: messageTextSchema,
});

export type SendNewMessageInput = z.infer<typeof sendNewMessageClientSchema>;

// Send new message - Server schema (extends client + auth)
export const sendNewMessageServerSchema = sendNewMessageClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type SendNewMessageServerInput = z.infer<typeof sendNewMessageServerSchema>;

// Conversation filter schema
export const conversationFilterSchema = z.object({
  companyId: z.number().int().positive(),
  filterType: z.enum(CONVERSATION_FILTER_TYPES),
  searchTerm: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  includeArchived: z.boolean().default(false),
});

export type ConversationListFilter = z.infer<typeof conversationFilterSchema>;

// Assign conversation schema
export const assignConversationSchema = z.object({
  conversationId: z.number().int().positive(),
  userId: z.number().int().positive().nullable(),
  companyId: z.number().int().positive(),
});

export type AssignConversationInput = z.infer<typeof assignConversationSchema>;

// Mark as read schema
export const markAsReadSchema = z.object({
  conversationId: z.number().int().positive(),
  companyId: z.number().int().positive(),
});

export type MarkAsReadInput = z.infer<typeof markAsReadSchema>;

// Get messages schema
export const getMessagesSchema = z.object({
  conversationId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type GetMessagesInput = z.infer<typeof getMessagesSchema>;

// Clear conversation schema
export const clearConversationSchema = z.object({
  conversationId: z.number().int().positive(),
  companyId: z.number().int().positive(),
});

export type ClearConversationInput = z.infer<typeof clearConversationSchema>;

// Delete conversation schema
export const deleteConversationSchema = z.object({
  conversationId: z.number().int().positive(),
  companyId: z.number().int().positive(),
});

export type DeleteConversationInput = z.infer<typeof deleteConversationSchema>;

// Archive conversation schema
export const archiveConversationSchema = z.object({
  conversationId: z.number().int().positive(),
  companyId: z.number().int().positive(),
});

export type ArchiveConversationInput = z.infer<typeof archiveConversationSchema>;

// Response schemas
export const contactResponseSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  phone: z.string(),
  name: z.string().nullable(),
  avatar: z.string().nullable(),
  isGroup: z.boolean(),
  presence: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  isActive: z.boolean(),
});

export type ContactResponse = z.infer<typeof contactResponseSchema>;

export const messageResponseSchema = z.object({
  id: z.number().int(),
  conversationId: z.number().int(),
  companyId: z.number().int(),
  contactId: z.number().int(),
  direction: z.enum(MESSAGE_DIRECTIONS),
  status: z.enum(MESSAGE_STATUSES),
  content: z.string(),
  mediaUrl: z.string().nullable(),
  mediaType: z.string().nullable(),
  providerMessageId: z.string().nullable(),
  providerStatus: z.string().nullable(),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  isActive: z.boolean(),
});

export type MessageResponse = z.infer<typeof messageResponseSchema>;

export const conversationResponseSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  contactId: z.number().int(),
  lastMessageId: z.number().int().nullable(),
  lastMessagePreview: z.string().nullable(),
  lastMessageTime: z.date().nullable(),
  unreadCount: z.number().int(),
  isFavorite: z.boolean(),
  isArchived: z.boolean(),
  assignedToUserId: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  isActive: z.boolean(),
  contact: contactResponseSchema.optional(),
});

export type ConversationResponse = z.infer<typeof conversationResponseSchema>;

// Send new message output
export const sendNewMessageOutputSchema = z.union([
  z.object({
    success: z.literal(true),
    conversationId: z.number().int(),
    contactId: z.number().int(),
    messageId: z.number().int(),
    createdContact: z.boolean(),
    createdConversation: z.boolean(),
    message: z.object({
      id: z.number().int(),
      status: z.enum(['sending', 'sent']),
      content: z.string(),
      createdAt: z.date(),
    }),
  }),
  z.object({
    success: z.literal(false),
    error: z.string(),
    code: z.enum([
      'VALIDATION_ERROR',
      'CONTACT_CREATE_FAILED',
      'CONVERSATION_CREATE_FAILED',
      'MESSAGE_INSERT_FAILED',
      'WHATSAPP_SEND_FAILED',
      'UNKNOWN',
    ]),
  }),
]);

export type SendNewMessageOutput = z.infer<typeof sendNewMessageOutputSchema>;

// Conversation list output
export const conversationListOutputSchema = z.object({
  conversations: z.array(conversationResponseSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type ConversationListOutput = z.infer<typeof conversationListOutputSchema>;

// Message list output
export const messageListOutputSchema = z.object({
  messages: z.array(messageResponseSchema),
  previousCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type MessageListOutput = z.infer<typeof messageListOutputSchema>;
