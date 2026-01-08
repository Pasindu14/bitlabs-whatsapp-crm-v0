import { z } from 'zod';

// Constants
export const CONVERSATION_FILTER_TYPES = ['all', 'unread', 'favorites', 'groups', 'assigned'] as const;
export type ConversationFilterType = (typeof CONVERSATION_FILTER_TYPES)[number];

export const MESSAGE_STATUSES = ['sending', 'sent', 'delivered', 'read', 'failed'] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const MESSAGE_DIRECTIONS = ['inbound', 'outbound'] as const;
export type MessageDirection = (typeof MESSAGE_DIRECTIONS)[number];

export const FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type FileType = (typeof FILE_TYPES)[number];

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

// File upload schema
export const fileUploadClientSchema = z.object({
  file: z.instanceof(File)
    .refine((f) => f.size <= 4 * 1024 * 1024, 'File size must be less than 4MB')
    .refine((f) => FILE_TYPES.includes(f.type as FileType), 'Invalid file type. Supported: JPEG, PNG, WEBP'),
});

export type FileUploadInput = z.infer<typeof fileUploadClientSchema>;

// Send message with image - Client schema (extends existing)
export const sendMessageWithImageClientSchema = z.object({
  phoneNumber: phoneNumberSchema,
  messageText: messageTextSchema.optional(),
  imageUrl: z.string().url().optional(),
  imageKey: z.string().min(1).optional(),
}).refine(
  (data) => data.messageText || data.imageUrl,
  'Either messageText or imageUrl is required'
);

export type SendMessageWithImageInput = z.infer<typeof sendMessageWithImageClientSchema>;

// Send message with image - Server schema (extends client + auth)
export const sendMessageWithImageServerSchema = sendMessageWithImageClientSchema.safeExtend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type SendMessageWithImageServerInput = z.infer<typeof sendMessageWithImageServerSchema>;

// File upload response schema
export const fileUploadResponseSchema = z.object({
  fileKey: z.string(),
  fileUrl: z.string().url(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  fileType: z.enum(FILE_TYPES),
});

export type FileUploadResponse = z.infer<typeof fileUploadResponseSchema>;

// Send new message - Server schema (extends client + auth)
export const sendNewMessageServerSchema = sendNewMessageClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type SendNewMessageServerInput = z.infer<typeof sendNewMessageServerSchema>;

// Conversation filter schema
export const conversationFilterSchema = z.object({
  filterType: z.enum(CONVERSATION_FILTER_TYPES),
  searchTerm: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  includeArchived: z.boolean().default(false),
  assignedUserId: z.number().int().positive().optional(),
  whatsappAccountId: z.number().int().positive().nullable().optional(),
});

export type ConversationListFilter = z.infer<typeof conversationFilterSchema>;

// Assign conversation schema
export const assignConversationClientSchema = z.object({
  conversationId: z.number().int().positive(),
  userId: z.number().int().positive().nullable(),
});

export type AssignConversationInput = z.infer<typeof assignConversationClientSchema>;

export const assignConversationServerSchema = assignConversationClientSchema.extend({
  companyId: z.number().int().positive(),
});

// Mark as read schema
export const markAsReadClientSchema = z.object({
  conversationId: z.number().int().positive(),
});

export type MarkAsReadInput = z.infer<typeof markAsReadClientSchema>;

export const markAsReadServerSchema = markAsReadClientSchema.extend({
  companyId: z.number().int().positive(),
});

// Get messages schema
export const getMessagesSchema = z.object({
  conversationId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type GetMessagesInput = z.infer<typeof getMessagesSchema>;

// Get conversation schema
export const getConversationSchema = z.object({
  conversationId: z.number().int().positive(),
});

export type GetConversationInput = z.infer<typeof getConversationSchema>;

// Update contact name schema
export const updateContactNameSchema = z.object({
  contactId: z.number().int().positive(),
  name: z.string().min(1).max(120).trim(),
});

export type UpdateContactNameInput = z.infer<typeof updateContactNameSchema>;

// Clear conversation schema
export const clearConversationClientSchema = z.object({
  conversationId: z.number().int().positive(),
});

export type ClearConversationInput = z.infer<typeof clearConversationClientSchema>;

export const clearConversationServerSchema = clearConversationClientSchema.extend({
  companyId: z.number().int().positive(),
});

// Delete conversation schema
export const deleteConversationClientSchema = z.object({
  conversationId: z.number().int().positive(),
});

export type DeleteConversationInput = z.infer<typeof deleteConversationClientSchema>;

export const deleteConversationServerSchema = deleteConversationClientSchema.extend({
  companyId: z.number().int().positive(),
});

// Archive conversation schema
export const archiveConversationClientSchema = z.object({
  conversationId: z.number().int().positive(),
});

export type ArchiveConversationInput = z.infer<typeof archiveConversationClientSchema>;

export const archiveConversationServerSchema = archiveConversationClientSchema.extend({
  companyId: z.number().int().positive(),
});

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

// Partial contact schema for list views (performance optimization)
export const contactListResponseSchema = z.object({
  id: z.number().int(),
  name: z.string().nullable(),
  phone: z.string(),
});

export type ContactListResponse = z.infer<typeof contactListResponseSchema>;

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
  mediaId: z.string().nullable(),
  mediaMimeType: z.string().nullable(),
  mediaCaption: z.string().nullable(),
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

// Conversation list schema with partial contact (performance optimization)
export const conversationListResponseSchema = z.object({
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
  contact: contactListResponseSchema.optional(),
});

export type ConversationListResponse = z.infer<typeof conversationListResponseSchema>;

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
  conversations: z.array(conversationListResponseSchema),
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

// Get WhatsApp message history schema
export const getWhatsAppMessageHistorySchema = z.object({
  whatsappAccountId: z.number().int().positive(),
  limit: z.number().int().min(1).max(100).optional(),
  before: z.string().optional(),
  after: z.string().optional(),
});

export type GetWhatsAppMessageHistoryInput = z.infer<typeof getWhatsAppMessageHistorySchema>;
