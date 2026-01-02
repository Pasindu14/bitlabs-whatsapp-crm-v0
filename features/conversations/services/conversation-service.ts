import { db } from '@/db/drizzle';
import { contactsTable, conversationsTable, messagesTable } from '@/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import type {
  ContactResponse,
  ConversationResponse,
  MessageResponse,
  ConversationListFilter,
  MessageStatus,
  MessageDirection,
} from '../schemas/conversation-schema';

interface Result<T> {
  success: true;
  data: T;
}

interface ErrorResult {
  success: false;
  error: string;
  code: string;
}

type ServiceResult<T> = Result<T> | ErrorResult;

interface CreateMessageInput {
  conversationId: number;
  companyId: number;
  contactId: number;
  direction: MessageDirection;
  status: MessageStatus;
  content: string;
  createdBy: number;
}

interface MessagePage {
  messages: MessageResponse[];
  previousCursor?: string;
  hasMore: boolean;
}

interface ConversationPage {
  conversations: ConversationResponse[];
  nextCursor?: string;
  hasMore: boolean;
}

export class ConversationService {
  static async ensureContact(
    companyId: number,
    phone: string,
    name?: string
  ): Promise<ServiceResult<ContactResponse>> {
    try {
      // Query for existing contact
      const existing = await db.query.contactsTable.findFirst({
        where: and(
          eq(contactsTable.companyId, companyId),
          eq(contactsTable.phone, phone)
        ),
      });

      if (existing) {
        return {
          success: true,
          data: existing as ContactResponse,
        };
      }

      // Create new contact
      const [newContact] = await db
        .insert(contactsTable)
        .values({
          companyId,
          phone,
          name: name || null,
          isGroup: false,
          isActive: true,
        })
        .returning();

      return {
        success: true,
        data: newContact as ContactResponse,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to ensure contact',
        code: 'CONTACT_CREATE_FAILED',
      };
    }
  }

  static async ensureConversation(
    companyId: number,
    contactId: number
  ): Promise<ServiceResult<ConversationResponse>> {
    try {
      // Query for existing conversation
      const existing = await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.companyId, companyId),
          eq(conversationsTable.contactId, contactId)
        ),
      });

      if (existing) {
        return {
          success: true,
          data: existing as ConversationResponse,
        };
      }

      // Create new conversation
      const [newConversation] = await db
        .insert(conversationsTable)
        .values({
          companyId,
          contactId,
          unreadCount: 0,
          isArchived: false,
          isActive: true,
        })
        .returning();

      return {
        success: true,
        data: newConversation as ConversationResponse,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to ensure conversation',
        code: 'CONVERSATION_CREATE_FAILED',
      };
    }
  }

  static async createMessage(
    input: CreateMessageInput
  ): Promise<ServiceResult<MessageResponse>> {
    try {
      const [newMessage] = await db
        .insert(messagesTable)
        .values({
          conversationId: input.conversationId,
          companyId: input.companyId,
          contactId: input.contactId,
          direction: input.direction,
          status: input.status,
          content: input.content,
          createdBy: input.createdBy,
          isActive: true,
        })
        .returning();

      return {
        success: true,
        data: newMessage as MessageResponse,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to create message',
        code: 'MESSAGE_INSERT_FAILED',
      };
    }
  }

  static async updateMessageStatus(
    messageId: number,
    status: MessageStatus,
    providerMessageId?: string,
    errorMessage?: string
  ): Promise<ServiceResult<void>> {
    try {
      await db
        .update(messagesTable)
        .set({
          status,
          providerMessageId: providerMessageId || null,
          errorMessage: errorMessage || null,
          updatedAt: new Date(),
        })
        .where(eq(messagesTable.id, messageId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to update message status',
        code: 'UNKNOWN',
      };
    }
  }

  static async updateConversationLastMessage(
    conversationId: number,
    messageId: number,
    preview: string
  ): Promise<ServiceResult<void>> {
    try {
      await db
        .update(conversationsTable)
        .set({
          lastMessageId: messageId,
          lastMessagePreview: preview.substring(0, 255),
          lastMessageTime: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to update conversation',
        code: 'UNKNOWN',
      };
    }
  }

  static async getConversationMessages(
    conversationId: number,
    cursor?: string,
    limit: number = 50
  ): Promise<ServiceResult<MessagePage>> {
    try {
      const fetchLimit = limit + 1;
      let cursorCondition = undefined;

      if (cursor) {
        const decodedCursor = Buffer.from(cursor, 'base64').toString('utf-8');
        const [, cursorId] = decodedCursor.split(':');
        cursorCondition = lt(messagesTable.id, parseInt(cursorId, 10));
      }

      const results = await db.query.messagesTable.findMany({
        where: cursorCondition
          ? and(
              eq(messagesTable.conversationId, conversationId),
              eq(messagesTable.isActive, true),
              cursorCondition
            )
          : and(
              eq(messagesTable.conversationId, conversationId),
              eq(messagesTable.isActive, true)
            ),
        orderBy: [desc(messagesTable.createdAt), desc(messagesTable.id)],
        limit: fetchLimit,
      });

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore
        ? Buffer.from(`${items[items.length - 1].createdAt.getTime()}:${items[items.length - 1].id}`).toString('base64')
        : undefined;

      return {
        success: true,
        data: {
          messages: items as MessageResponse[],
          previousCursor: nextCursor,
          hasMore,
        },
      };
    } catch {
      return {
        success: false,
        error: 'Failed to fetch messages',
        code: 'UNKNOWN',
      };
    }
  }

  static async listConversations(
    filter: ConversationListFilter
  ): Promise<ServiceResult<ConversationPage>> {
    try {
      const fetchLimit = filter.limit + 1;
      let cursorCondition = undefined;

      if (filter.cursor) {
        const decodedCursor = Buffer.from(filter.cursor, 'base64').toString('utf-8');
        const [, cursorId] = decodedCursor.split(':');
        cursorCondition = lt(conversationsTable.id, parseInt(cursorId, 10));
      }

      let whereConditions = and(
        eq(conversationsTable.companyId, filter.companyId),
        eq(conversationsTable.isActive, true),
        filter.includeArchived ? undefined : eq(conversationsTable.isArchived, false)
      );

      // Apply filter type
      if (filter.filterType === 'favorites') {
        whereConditions = and(whereConditions, eq(conversationsTable.isFavorite, true));
      }

      if (cursorCondition) {
        whereConditions = and(whereConditions, cursorCondition);
      }

      const results = await db.query.conversationsTable.findMany({
        where: whereConditions,
        orderBy: [desc(conversationsTable.lastMessageTime), desc(conversationsTable.id)],
        limit: fetchLimit,
        with: {
          contact: true,
        },
      });

      // Apply search and other filters locally
      let filtered = results;
      if (filter.searchTerm) {
        const searchLower = filter.searchTerm.toLowerCase();
        filtered = results.filter((conv) => {
          const contact = conv.contact as unknown as ContactResponse;
          return (
            contact?.name?.toLowerCase().includes(searchLower) ||
            contact?.phone?.includes(searchLower)
          );
        });
      }

      // Apply unread filter locally
      if (filter.filterType === 'unread') {
        filtered = filtered.filter((conv) => conv.unreadCount > 0);
      }

      // Apply groups filter locally
      if (filter.filterType === 'groups') {
        filtered = filtered.filter((conv) => {
          const contact = conv.contact as unknown as ContactResponse;
          return contact?.isGroup;
        });
      }

      const hasMore = filtered.length > filter.limit;
      const items = hasMore ? filtered.slice(0, filter.limit) : filtered;
      const nextCursor = hasMore
        ? Buffer.from(`${items[items.length - 1].lastMessageTime?.getTime() || 0}:${items[items.length - 1].id}`).toString('base64')
        : undefined;

      return {
        success: true,
        data: {
          conversations: items as ConversationResponse[],
          nextCursor,
          hasMore,
        },
      };
    } catch {
      return {
        success: false,
        error: 'Failed to list conversations',
        code: 'UNKNOWN',
      };
    }
  }

  static async markConversationAsRead(
    conversationId: number
  ): Promise<ServiceResult<void>> {
    try {
      await db
        .update(conversationsTable)
        .set({
          unreadCount: 0,
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to mark conversation as read',
        code: 'UNKNOWN',
      };
    }
  }

  static async assignConversationToUser(
    conversationId: number,
    userId: number | null
  ): Promise<ServiceResult<void>> {
    try {
      await db
        .update(conversationsTable)
        .set({
          assignedToUserId: userId,
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to assign conversation',
        code: 'UNKNOWN',
      };
    }
  }

  static async clearConversation(
    conversationId: number
  ): Promise<ServiceResult<void>> {
    try {
      // Soft delete all messages
      await db
        .update(messagesTable)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(messagesTable.conversationId, conversationId));

      // Reset conversation
      await db
        .update(conversationsTable)
        .set({
          unreadCount: 0,
          lastMessageId: null,
          lastMessagePreview: null,
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to clear conversation',
        code: 'UNKNOWN',
      };
    }
  }

  static async deleteConversation(
    conversationId: number
  ): Promise<ServiceResult<void>> {
    try {
      // Soft delete all messages
      await db
        .update(messagesTable)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(messagesTable.conversationId, conversationId));

      // Soft delete conversation
      await db
        .update(conversationsTable)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to delete conversation',
        code: 'UNKNOWN',
      };
    }
  }

  static async archiveConversation(
    conversationId: number
  ): Promise<ServiceResult<void>> {
    try {
      await db
        .update(conversationsTable)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to archive conversation',
        code: 'UNKNOWN',
      };
    }
  }

  static async unarchiveConversation(
    conversationId: number
  ): Promise<ServiceResult<void>> {
    try {
      await db
        .update(conversationsTable)
        .set({
          isArchived: false,
          updatedAt: new Date(),
        })
        .where(eq(conversationsTable.id, conversationId));

      return {
        success: true,
        data: undefined,
      };
    } catch {
      return {
        success: false,
        error: 'Failed to unarchive conversation',
        code: 'UNKNOWN',
      };
    }
  }
}
