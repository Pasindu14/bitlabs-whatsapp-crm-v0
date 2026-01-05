import { ConversationService } from './conversation-service';
import { Result } from '@/lib/result';
import { createPerformanceLogger } from '@/lib/logger';
import { db } from '@/db/drizzle';
import { messagesTable, contactsTable, whatsappAccountsTable } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import axios from 'axios';
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

      // Step 4: Get WhatsApp account credentials for the company
      const whatsappAccount = await db.query.whatsappAccountsTable.findFirst({
        where: and(
          eq(whatsappAccountsTable.companyId, input.companyId),
          eq(whatsappAccountsTable.isActive, true)
        ),
      });

      if (!whatsappAccount) {
        logger.fail('No active WhatsApp account found for company');
        // Update message status to failed
        await ConversationService.updateMessageStatus(
          message.id,
          input.companyId,
          'failed',
          undefined,
          'No active WhatsApp account configured',
          input.userId
        );
        return Result.fail('No active WhatsApp account configured', { code: 'INTERNAL_ERROR' });
      }

      // Step 5: Send message via WhatsApp API
      let finalStatus: 'sent' | 'failed' = 'sent';
      let providerMessageId: string | undefined;
      let errorMessage: string | undefined;

      try {
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/conversations/send-message`,
          {
            companyId: input.companyId,
            recipientPhoneNumber: input.phoneNumber,
            text: input.messageText,
            phoneNumberId: whatsappAccount.phoneNumberId,
            accessToken: whatsappAccount.accessToken,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.data.success) {
          providerMessageId = response.data.messageId;
          logger.complete();
        } else {
          finalStatus = 'failed';
          errorMessage = response.data.error || 'Failed to send via WhatsApp API';
          logger.fail(new Error(errorMessage));
        }
      } catch (error) {
        finalStatus = 'failed';
        const axiosError = error as { response?: { data?: { error?: string } }; message?: string };
        errorMessage = axiosError.response?.data?.error || axiosError.message || 'Failed to send via WhatsApp API';
        logger.fail(new Error(errorMessage));
      }

      // Step 6: Update message status
      const statusResult = await ConversationService.updateMessageStatus(
        message.id,
        input.companyId,
        finalStatus,
        providerMessageId,
        errorMessage,
        input.userId
      );

      if (!statusResult.isOk) {
        logger.fail(statusResult.message);
        return Result.fail(statusResult.message, statusResult.error);
      }

      // If WhatsApp send failed, return error
      if (finalStatus === 'failed') {
        return Result.fail(errorMessage || 'Failed to send message via WhatsApp', { code: 'INTERNAL_ERROR' });
      }

      // Step 7: Update conversation last message
      const updateResult = await ConversationService.updateConversationLastMessage(
        conversation.id,
        input.companyId,
        message.id,
        input.messageText,
        input.userId
      );

      if (!updateResult.isOk) {
        logger.fail(updateResult.message);
        return Result.fail(updateResult.message, updateResult.error);
      }

      // Step 8: Return success response
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
