import { ConversationService } from './conversation-service';
import { Result } from '@/lib/result';
import { createPerformanceLogger } from '@/lib/logger';
import { db } from '@/db/drizzle';
import { messagesTable, contactsTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import type {
  SendNewMessageServerInput,
  SendNewMessageOutput,
} from '../schemas/conversation-schema';

export class MessageService {
  static async sendNewMessage(
    input: SendNewMessageServerInput
  ): Promise<Result<SendNewMessageOutput>> {
    const logger = createPerformanceLogger('MessageService.sendNewMessage', {
      context: { companyId: input.companyId, phoneNumber: input.phoneNumber },
    });

    try {
      // Step 1: Ensure contact exists
      const contactResult = await ConversationService.ensureContact(
        input.companyId,
        input.phoneNumber
      );

      if (!contactResult.isOk) {
        logger.fail(contactResult.message);
        return Result.fail(contactResult.message, contactResult.error);
      }

      const contact = contactResult.data;
      if (!contact) {
        logger.fail('Contact data missing');
        return Result.internal('Contact data missing');
      }
      const createdContact = !contact.id;

      // Step 2: Ensure conversation exists
      const conversationResult = await ConversationService.ensureConversation(
        input.companyId,
        contact.id
      );

      if (!conversationResult.isOk) {
        logger.fail(conversationResult.message);
        return Result.fail(conversationResult.message, conversationResult.error);
      }

      const conversation = conversationResult.data;
      if (!conversation) {
        logger.fail('Conversation data missing');
        return Result.internal('Conversation data missing');
      }
      const createdConversation = !conversation.id;

      // Step 3: Create message record (status = 'sending')
      const messageResult = await ConversationService.createMessage({
        conversationId: conversation.id,
        companyId: input.companyId,
        contactId: contact.id,
        direction: 'outbound',
        status: 'sending',
        content: input.messageText,
        createdBy: input.userId,
      });

      if (!messageResult.isOk) {
        logger.fail(messageResult.message);
        return Result.fail(messageResult.message, messageResult.error);
      }

      const message = messageResult.data;
      if (!message) {
        logger.fail('Message data missing');
        return Result.internal('Message data missing');
      }

      // Step 4: Send message via WhatsApp API (delegated to integration module)
      // TODO: Implement WhatsApp integration module
      // For now, mark as sent without actual API call
      const finalStatus = 'sent' as const;
      const providerMessageId = undefined;

      // Step 5: Update message status
      const statusResult = await ConversationService.updateMessageStatus(
        message.id,
        input.companyId,
        finalStatus,
        providerMessageId,
        undefined
      );

      if (!statusResult.isOk) {
        logger.fail(statusResult.message);
        return Result.fail(statusResult.message, statusResult.error);
      }

      // Step 6: Update conversation last message
      const updateResult = await ConversationService.updateConversationLastMessage(
        conversation.id,
        input.companyId,
        message.id,
        input.messageText
      );

      if (!updateResult.isOk) {
        logger.fail(updateResult.message);
        return Result.fail(updateResult.message, updateResult.error);
      }

      // Step 7: Return success response
      logger.complete();
      return Result.ok({
        success: true,
        conversationId: conversation.id,
        contactId: contact.id,
        messageId: message.id,
        createdContact,
        createdConversation,
        message: {
          id: message.id,
          status: finalStatus,
          content: input.messageText,
          createdAt: message.createdAt,
        },
      }, 'Message sent');
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal('Failed to send message');
    }
  }

  static async retryFailedMessage(
    messageId: number,
    companyId: number,
    userId: number
  ): Promise<Result<SendNewMessageOutput>> {
    const logger = createPerformanceLogger('MessageService.retryFailedMessage', {
      context: { messageId, companyId },
    });

    try {
      // Fetch the failed message directly from DB
      const message = await db.query.messagesTable.findFirst({
        where: eq(messagesTable.id, messageId),
      });

      if (!message) {
        logger.fail('Message not found');
        return Result.notFound('Message not found');
      }

      // Fetch contact to get phone number
      const contact = await db.query.contactsTable.findFirst({
        where: eq(contactsTable.id, message.contactId),
      });

      if (!contact) {
        logger.fail('Contact not found');
        return Result.notFound('Contact not found');
      }

      // Retry sending
      const result = await this.sendNewMessage({
        companyId,
        phoneNumber: contact.phone,
        messageText: message.content,
        userId,
      });

      if (result.isOk) {
        logger.complete();
      } else {
        logger.fail(result.message);
      }

      return result;
    } catch (error) {
      logger.fail(error as Error);
      return Result.internal('Failed to retry message');
    }
  }
}
