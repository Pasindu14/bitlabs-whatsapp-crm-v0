import { db } from '@/db/drizzle';
import { contactsTable, conversationsTable, messagesTable, whatsappAccountsTable } from '@/db/schema';
import { eq, and, desc, lt } from 'drizzle-orm';
import { createPerformanceLogger } from '@/lib/logger';
import { Result } from '@/lib/result';
import { AuditLogService } from '@/lib/audit-log.service';
import type {
  ContactResponse,
  ConversationResponse,
  MessageResponse,
  ConversationListFilter,
  MessageStatus,
  MessageDirection,
} from '../schemas/conversation-schema';


type ServiceResult<T> = Result<T>;

interface CreateMessageInput {
  conversationId: number;
  companyId: number;
  contactId: number;
  direction: MessageDirection;
  status: MessageStatus;
  content: string;
  createdBy: number;
  mediaUrl?: string;
  mediaType?: string;
  whatsappAccountId?: number;
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
  static async updateContactName(
    contactId: number,
    companyId: number,
    name: string
  ): Promise<ServiceResult<ContactResponse>> {
    const logger = createPerformanceLogger('ConversationService.updateContactName', {
      context: { contactId, companyId },
    });
    try {
      const [updated] = await db
        .update(contactsTable)
        .set({
          name,
          updatedAt: new Date(),
        })
        .where(and(eq(contactsTable.id, contactId), eq(contactsTable.companyId, companyId)))
        .returning();

      if (!updated) {
        logger.fail(new Error('Contact not found'));
        return Result.fail('Contact not found', { code: 'NOT_FOUND' });
      }

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'UPDATE',
        resourceId: contactId,
        entityType: 'contact',
        newValues: { name },
      });

      logger.complete(1);
      return Result.ok(updated as ContactResponse, 'Contact name updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "contact",
        entityId: contactId,
        companyId,
        userId: 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to update contact name');
    }
  }

  static async ensureContact(
    companyId: number,
    phone: string,
    name?: string
  ): Promise<ServiceResult<ContactResponse>> {
    const logger = createPerformanceLogger('ConversationService.ensureContact', {
      context: { companyId, phone },
    });
    try {
      const existing = await db.query.contactsTable.findFirst({
        where: and(
          eq(contactsTable.companyId, companyId),
          eq(contactsTable.phone, phone)
        ),
      });

      if (existing) {
        logger.complete(1);
        return Result.ok(existing as ContactResponse, 'Contact found');
      }

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

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'CREATE',
        resourceId: newContact.id,
        entityType: 'contact',
        newValues: { phone, name: name || null, isGroup: false },
      });

      logger.complete(1);
      return Result.ok(newContact as ContactResponse, 'Contact created');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "contact",
        entityId: null,
        companyId,
        userId: 0,
        action: "CREATE",
        error: errorMessage,
      });
      return Result.internal('Failed to ensure contact');
    }
  }

  static async ensureConversation(
    companyId: number,
    contactId: number
  ): Promise<ServiceResult<ConversationResponse>> {
    const logger = createPerformanceLogger('ConversationService.ensureConversation', {
      context: { companyId, contactId },
    });
    try {
      const existing = await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.companyId, companyId),
          eq(conversationsTable.contactId, contactId)
        ),
      });

      if (existing) {
        logger.complete(1);
        return Result.ok(existing as ConversationResponse, 'Conversation found');
      }

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

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'CREATE',
        resourceId: newConversation.id,
        entityType: 'conversation',
        newValues: { contactId, unreadCount: 0, isArchived: false },
      });

      logger.complete(1);
      return Result.ok(newConversation as ConversationResponse, 'Conversation created');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: null,
        companyId,
        userId: 0,
        action: "CREATE",
        error: errorMessage,
      });
      return Result.internal('Failed to ensure conversation');
    }
  }

  static async createMessage(
    input: CreateMessageInput
  ): Promise<ServiceResult<MessageResponse>> {
    const logger = createPerformanceLogger('ConversationService.createMessage', {
      context: {
        conversationId: input.conversationId,
        companyId: input.companyId,
      },
    });
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
          mediaUrl: input.mediaUrl,
          mediaType: input.mediaType,
          whatsappAccountId: input.whatsappAccountId,
          createdBy: input.createdBy,
          isActive: true,
        })
        .returning();

      await AuditLogService.log({
        companyId: input.companyId,
        userId: input.createdBy,
        action: 'CREATE',
        resourceId: newMessage.id,
        entityType: 'message',
        newValues: { conversationId: input.conversationId, direction: input.direction, status: input.status },
      });

      logger.complete(1);
      return Result.ok(newMessage as MessageResponse, 'Message created');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "message",
        entityId: null,
        companyId: input.companyId,
        userId: input.createdBy,
        action: "CREATE",
        error: errorMessage,
      });
      return Result.internal('Failed to create message');
    }
  }

  static async updateMessageStatus(
    messageId: number,
    companyId: number,
    status: MessageStatus,
    providerMessageId?: string,
    errorMessage?: string,
    userId?: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.updateMessageStatus', {
      context: { messageId, status },
    });
    try {
      await db
        .update(messagesTable)
        .set({
          status,
          providerMessageId: providerMessageId || null,
          errorMessage: errorMessage || null,
          updatedAt: new Date(),
        })
        .where(and(eq(messagesTable.id, messageId), eq(messagesTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: userId || 0,
        action: 'UPDATE',
        resourceId: messageId,
        entityType: 'message',
        newValues: { status, providerMessageId },
      });

      logger.complete();
      return Result.ok(undefined, 'Message status updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "message",
        entityId: messageId,
        companyId,
        userId: userId || 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to update message status');
    }
  }

  static async updateConversationLastMessage(
    conversationId: number,
    companyId: number,
    messageId: number,
    preview: string,
    userId?: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.updateConversationLastMessage', {
      context: { conversationId, messageId },
    });
    try {
      await db
        .update(conversationsTable)
        .set({
          lastMessageId: messageId,
          lastMessagePreview: preview.substring(0, 255),
          lastMessageTime: new Date(),
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: userId || 0,
        action: 'UPDATE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { lastMessageId: messageId, lastMessagePreview: preview.substring(0, 255) },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation updated');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: userId || 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to update conversation');
    }
  }

  static async getConversation(
    conversationId: number,
    companyId: number
  ): Promise<ServiceResult<ConversationResponse>> {
    const logger = createPerformanceLogger('ConversationService.getConversation', {
      context: { conversationId, companyId },
    });
    try {
      const result = await db.query.conversationsTable.findFirst({
        where: and(
          eq(conversationsTable.id, conversationId),
          eq(conversationsTable.companyId, companyId),
          eq(conversationsTable.isActive, true)
        ),
        with: {
          contact: true,
        },
      });

      if (!result) {
        logger.fail(new Error('Conversation not found'));
        return Result.fail('Conversation not found', { code: 'NOT_FOUND' });
      }

      logger.complete(1);
      return Result.ok(result as ConversationResponse, 'Conversation found');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "READ",
        error: errorMessage,
      });
      return Result.internal('Failed to fetch conversation');
    }
  }

  static async getConversationMessages(
    conversationId: number,
    companyId: number,
    cursor?: string,
    limit: number = 50
  ): Promise<ServiceResult<MessagePage>> {
    const logger = createPerformanceLogger('ConversationService.getConversationMessages', {
      context: { conversationId, companyId, limit, ...(cursor ? { cursor } : {}) },
    });
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
              eq(messagesTable.companyId, companyId),
              eq(messagesTable.isActive, true),
              cursorCondition
            )
          : and(
              eq(messagesTable.conversationId, conversationId),
              eq(messagesTable.companyId, companyId),
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

      logger.complete(items.length);
      return Result.ok({
        messages: [...items].reverse() as MessageResponse[],
        previousCursor: nextCursor,
        hasMore,
      }, 'Messages loaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "message",
        entityId: null,
        companyId,
        userId: 0,
        action: "READ",
        error: errorMessage,
      });
      return Result.internal('Failed to fetch messages');
    }
  }

  static async listConversations(
    companyId: number,
    filter: Omit<ConversationListFilter, 'companyId'>
  ): Promise<ServiceResult<ConversationPage>> {
    const logger = createPerformanceLogger('ConversationService.listConversations', {
      context: {
        companyId,
        filterType: filter.filterType,
        limit: filter.limit,
        includeArchived: filter.includeArchived,
        ...(filter.whatsappAccountId !== undefined && { whatsappAccountId: filter.whatsappAccountId }),
      },
    });
    try {
      const fetchLimit = filter.limit + 1;
      let cursorCondition = undefined;

      if (filter.cursor) {
        const decodedCursor = Buffer.from(filter.cursor, 'base64').toString('utf-8');
        const [, cursorId] = decodedCursor.split(':');
        cursorCondition = lt(conversationsTable.id, parseInt(cursorId, 10));
      }

      const baseClauses = [
        eq(conversationsTable.companyId, companyId),
        eq(conversationsTable.isActive, true),
        filter.includeArchived ? undefined : eq(conversationsTable.isArchived, false),
        filter.whatsappAccountId ? eq(conversationsTable.whatsappAccountId, filter.whatsappAccountId) : undefined,
      ].filter(Boolean);

      if (cursorCondition) {
        baseClauses.push(cursorCondition);
      }

      if (filter.filterType === 'favorites') {
        baseClauses.push(eq(conversationsTable.isFavorite, true));
      }
      

      const whereConditions = and(...baseClauses);

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
      // Apply assigned filter locally
      if (filter.filterType === 'assigned' && filter.assignedUserId) {
        filtered = filtered.filter((conv) => conv.assignedToUserId === filter.assignedUserId);
      }

      const hasMore = filtered.length > filter.limit;
      const items = hasMore ? filtered.slice(0, filter.limit) : filtered;
      const nextCursor = hasMore
        ? Buffer.from(`${items[items.length - 1].lastMessageTime?.getTime() || 0}:${items[items.length - 1].id}`).toString('base64')
        : undefined;

      logger.complete(items.length);
      return Result.ok({
        conversations: items as ConversationResponse[],
        nextCursor,
        hasMore,
      }, 'Conversations loaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: null,
        companyId,
        userId: 0,
        action: "READ",
        error: errorMessage,
      });
      return Result.internal('Failed to list conversations');
    }
  }

  static async markConversationAsRead(
    conversationId: number,
    companyId: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.markConversationAsRead', {
      context: { conversationId, companyId },
    });
    try {
      await db
        .update(conversationsTable)
        .set({
          unreadCount: 0,
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'UPDATE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { unreadCount: 0 },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation marked as read');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to mark conversation as read');
    }
  }

  static async assignConversationToUser(
    conversationId: number,
    companyId: number,
    userId: number | null
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.assignConversationToUser', {
      context: { conversationId, companyId, userId },
    });
    try {
      await db
        .update(conversationsTable)
        .set({
          assignedToUserId: userId,
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'UPDATE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { assignedToUserId: userId },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation assigned');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to assign conversation');
    }
  }

  static async clearConversation(
    conversationId: number,
    companyId: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.clearConversation', {
      context: { conversationId, companyId },
    });
    try {
      await db
        .update(messagesTable)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(messagesTable.conversationId, conversationId), eq(messagesTable.companyId, companyId)));

      await db
        .update(conversationsTable)
        .set({
          unreadCount: 0,
          lastMessageId: null,
          lastMessagePreview: null,
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'UPDATE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { unreadCount: 0, lastMessageId: null, lastMessagePreview: null },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation cleared');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to clear conversation');
    }
  }

  static async deleteConversation(
    conversationId: number,
    companyId: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.deleteConversation', {
      context: { conversationId, companyId },
    });
    try {
      await db
        .update(messagesTable)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(messagesTable.conversationId, conversationId), eq(messagesTable.companyId, companyId)));

      await db
        .update(conversationsTable)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'DELETE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { isActive: false },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation deleted');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "DELETE",
        error: errorMessage,
      });
      return Result.internal('Failed to delete conversation');
    }
  }

  static async archiveConversation(
    conversationId: number,
    companyId: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.archiveConversation', {
      context: { conversationId, companyId },
    });
    try {
      await db
        .update(conversationsTable)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'UPDATE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { isArchived: true },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation archived');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to archive conversation');
    }
  }

  static async unarchiveConversation(
    conversationId: number,
    companyId: number
  ): Promise<ServiceResult<void>> {
    const logger = createPerformanceLogger('ConversationService.unarchiveConversation', {
      context: { conversationId, companyId },
    });
    try {
      await db
        .update(conversationsTable)
        .set({
          isArchived: false,
          updatedAt: new Date(),
        })
        .where(and(eq(conversationsTable.id, conversationId), eq(conversationsTable.companyId, companyId)));

      await AuditLogService.log({
        companyId,
        userId: 0,
        action: 'UPDATE',
        resourceId: conversationId,
        entityType: 'conversation',
        newValues: { isArchived: false },
      });

      logger.complete();
      return Result.ok(undefined, 'Conversation unarchived');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "conversation",
        entityId: conversationId,
        companyId,
        userId: 0,
        action: "UPDATE",
        error: errorMessage,
      });
      return Result.internal('Failed to unarchive conversation');
    }
  }

  static async getWhatsAppMessageHistory(
    whatsappAccountId: number,
    companyId: number,
    limit?: number,
    before?: string,
    after?: string
  ): Promise<ServiceResult<unknown>> {
    const logger = createPerformanceLogger('ConversationService.getWhatsAppMessageHistory', {
      context: { whatsappAccountId, companyId },
    });
    try {
      const [account] = await db
        .select({
          phoneNumberId: whatsappAccountsTable.phoneNumberId,
          accessToken: whatsappAccountsTable.accessToken,
        })
        .from(whatsappAccountsTable)
        .where(
          and(
            eq(whatsappAccountsTable.id, whatsappAccountId),
            eq(whatsappAccountsTable.companyId, companyId)
          )
        )
        .limit(1);

      if (!account) {
        logger.fail(new Error('WhatsApp account not found'));
        return Result.fail('WhatsApp account not found');
      }

      const queryParams = new URLSearchParams({
        companyId: companyId.toString(),
        phoneNumberId: account.phoneNumberId,
        accessToken: account.accessToken,
      });
      if (limit) queryParams.append('limit', limit.toString());
      if (before) queryParams.append('before', before);
      if (after) queryParams.append('after', after);

      const response = await fetch(
        `http://localhost:3000/api/conversations/get-message-history?${queryParams.toString()}`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData?.error || `HTTP ${response.status}`;
        logger.fail(new Error(errorMessage));
        return Result.fail(errorMessage);
      }

      const data = await response.json();
      logger.complete();
      return Result.ok(data, 'WhatsApp message history loaded');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Operation failed";
      logger.fail(error as Error);
      await AuditLogService.logFailure({
        entityType: "whatsapp_account",
        entityId: whatsappAccountId,
        companyId,
        userId: 0,
        action: "READ",
        error: errorMessage,
      });
      return Result.internal('Failed to fetch WhatsApp message history');
    }
  }
}
