import axios from 'axios';
import { ConversationService } from './conversation-service';
import type {
  SendNewMessageServerInput,
  SendNewMessageOutput,
} from '../schemas/conversation-schema';

interface WhatsAppSendResponse {
  success: boolean;
  messageId?: string;
  error?: string;
  code?: string;
}

export class MessageService {
  static async sendNewMessage(
    input: SendNewMessageServerInput
  ): Promise<SendNewMessageOutput> {
    try {
      // Step 1: Ensure contact exists
      const contactResult = await ConversationService.ensureContact(
        input.companyId,
        input.phoneNumber
      );

      if (!contactResult.success) {
        return {
          success: false,
          error: contactResult.error,
          code: 'CONTACT_CREATE_FAILED',
        };
      }

      const contact = contactResult.data;
      const createdContact = !contact.id;

      // Step 2: Ensure conversation exists
      const conversationResult = await ConversationService.ensureConversation(
        input.companyId,
        contact.id
      );

      if (!conversationResult.success) {
        return {
          success: false,
          error: conversationResult.error,
          code: 'CONVERSATION_CREATE_FAILED',
        };
      }

      const conversation = conversationResult.data;
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

      if (!messageResult.success) {
        return {
          success: false,
          error: messageResult.error,
          code: 'MESSAGE_INSERT_FAILED',
        };
      }

      const message = messageResult.data;

      // Step 4: Send message via WhatsApp API
      let whatsappResponse: WhatsAppSendResponse | null = null;
      try {
        // TODO: Fetch phoneNumberId and accessToken from WhatsApp account configuration
        // For now, these would need to be passed or retrieved from database
        const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || '';

        if (!phoneNumberId || !accessToken) {
          whatsappResponse = {
            success: false,
            error: 'WhatsApp credentials not configured',
            code: 'WHATSAPP_SEND_FAILED',
          };
        } else {
          const baseUrl =
            process.env.NEXT_PUBLIC_APP_URL ||
            process.env.NEXTAUTH_URL ||
            'http://localhost:3000';
          const apiUrl = new URL('/api/conversations/send-message', baseUrl).toString();

          const response = await axios.post<WhatsAppSendResponse>(
            apiUrl,
            {
              companyId: input.companyId,
              recipientPhoneNumber: input.phoneNumber,
              text: input.messageText,
              phoneNumberId,
              accessToken,
            },
            {
              headers: { 'Content-Type': 'application/json' },
            }
          );

          whatsappResponse = response.data;
        }
      } catch (error) {
        whatsappResponse = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          code: 'WHATSAPP_SEND_FAILED',
        };
      }

      // Step 5: Update message status based on WhatsApp response
      let finalStatus = 'sent';
      let providerMessageId: string | undefined;

      if (whatsappResponse?.success && whatsappResponse.messageId) {
        providerMessageId = whatsappResponse.messageId;
        finalStatus = 'sent';
      } else {
        finalStatus = 'failed';
      }

      const statusResult = await ConversationService.updateMessageStatus(
        message.id,
        finalStatus as 'sent' | 'failed',
        providerMessageId,
        whatsappResponse?.error
      );

      if (!statusResult.success) {
        return {
          success: false,
          error: statusResult.error,
          code: 'UNKNOWN',
        };
      }

      // Step 6: Update conversation last message
      const updateResult = await ConversationService.updateConversationLastMessage(
        conversation.id,
        message.id,
        input.messageText
      );

      if (!updateResult.success) {
        return {
          success: false,
          error: updateResult.error,
          code: 'UNKNOWN',
        };
      }

      // Step 7: Return success response
      return {
        success: true,
        conversationId: conversation.id,
        contactId: contact.id,
        messageId: message.id,
        createdContact,
        createdConversation,
        message: {
          id: message.id,
          status: finalStatus as 'sending' | 'sent',
          content: input.messageText,
          createdAt: message.createdAt,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'UNKNOWN',
      };
    }
  }

  static async retryFailedMessage(
    messageId: number,
    companyId: number,
    userId: number
  ): Promise<SendNewMessageOutput> {
    try {
      // Fetch the failed message
      const message = await fetch(`/api/messages/${messageId}`);
      if (!message.ok) {
        return {
          success: false,
          error: 'Message not found',
          code: 'UNKNOWN',
        };
      }

      const messageData = await message.json();

      // Fetch contact to get phone number
      const contact = await fetch(`/api/contacts/${messageData.contactId}`);
      if (!contact.ok) {
        return {
          success: false,
          error: 'Contact not found',
          code: 'UNKNOWN',
        };
      }

      const contactData = await contact.json();

      // Retry sending
      return this.sendNewMessage({
        companyId,
        phoneNumber: contactData.phone,
        messageText: messageData.content,
        userId,
      });
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        code: 'UNKNOWN',
      };
    }
  }
}
