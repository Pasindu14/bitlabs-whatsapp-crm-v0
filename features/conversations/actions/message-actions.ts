'use server';

import { MessageService } from '../services/message-service';
import {
  sendNewMessageClientSchema,
  sendNewMessageServerSchema,
  sendNewMessageOutputSchema,
  type SendNewMessageInput,
  type SendNewMessageOutput,
} from '../schemas/conversation-schema';
import { auth } from '@/auth';

interface SessionUser {
  id: string | number;
  companyId: string | number;
  [key: string]: unknown;
}

export async function sendNewMessageAction(
  input: SendNewMessageInput
): Promise<SendNewMessageOutput> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized',
        code: 'UNKNOWN',
      };
    }

    // Validate client input
    const validatedInput = sendNewMessageClientSchema.parse(input);

    // Create server input with auth context
    const user = session.user as SessionUser;
    const serverInput = sendNewMessageServerSchema.parse({
      ...validatedInput,
      companyId: typeof user.companyId === 'string' ? parseInt(user.companyId, 10) : user.companyId,
      userId: typeof user.id === 'string' ? parseInt(user.id, 10) : user.id,
    });

    const result = await MessageService.sendNewMessage(serverInput);

    return sendNewMessageOutputSchema.parse(result);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to send message',
      code: 'UNKNOWN',
    };
  }
}

export async function retryFailedMessageAction(
  messageId: number
): Promise<SendNewMessageOutput> {
  try {
    const session = await auth();

    if (!session?.user) {
      return {
        success: false,
        error: 'Unauthorized',
        code: 'UNKNOWN',
      };
    }

    const user = session.user as SessionUser;
    const result = await MessageService.retryFailedMessage(
      messageId,
      typeof user.companyId === 'string' ? parseInt(user.companyId, 10) : user.companyId,
      typeof user.id === 'string' ? parseInt(user.id, 10) : user.id
    );

    return sendNewMessageOutputSchema.parse(result);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to retry message',
      code: 'UNKNOWN',
    };
  }
}
