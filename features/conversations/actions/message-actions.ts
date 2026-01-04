'use server';

import { withAction } from '@/lib/server-action-helper';
import { Result } from '@/lib/result';
import { z } from 'zod';
import { MessageService } from '../services/message-service';
import {
  sendNewMessageClientSchema,
  sendNewMessageOutputSchema,
  type SendNewMessageInput,
  type SendNewMessageOutput,
} from '../schemas/conversation-schema';

export const sendNewMessageAction = withAction<SendNewMessageInput, SendNewMessageOutput>(
  'conversations.sendMessage',
  async (auth, input) => {
    const serverInput = {
      ...input,
      companyId: auth.companyId,
      userId: auth.userId,
    };

    const result = await MessageService.sendNewMessage(serverInput);
    if (!result.isOk) return result;

    const validated = sendNewMessageOutputSchema.parse(result.data);
    return Result.ok(validated, 'Message sent');
  },
  { schema: sendNewMessageClientSchema }
);

export const retryFailedMessageAction = withAction<number, SendNewMessageOutput>(
  'conversations.retryMessage',
  async (auth, messageId) => {
    const result = await MessageService.retryFailedMessage(
      messageId,
      auth.companyId,
      auth.userId
    );
    if (!result.isOk) return result;

    const validated = sendNewMessageOutputSchema.parse(result.data);
    return Result.ok(validated, 'Message retried');
  },
  { schema: z.number().int().positive() }
);
