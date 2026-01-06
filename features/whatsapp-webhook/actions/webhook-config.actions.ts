"use server";

import { withAction } from "@/lib/server-action-helper";
import { Result } from "@/lib/result";
import { WebhookConfigService } from "../services/webhook-config.service";
import { WebhookIngestService } from "../services/webhook-ingest.service";
import {
  webhookConfigUpsertClientSchema,
  webhookEventLogListQuerySchema,
  type WebhookConfigResponse,
  type WebhookEventLogListResponse,
} from "../schemas/whatsapp-webhook-schema";
import { z } from "zod";

const webhookAccountIdSchema = z.object({
  whatsappAccountId: z.number().int().positive(),
});

type UpsertInput = z.infer<typeof webhookConfigUpsertClientSchema> & {
  whatsappAccountId: number;
};
type AccountIdInput = z.infer<typeof webhookAccountIdSchema>;
type EventLogListInput = z.infer<typeof webhookEventLogListQuerySchema> & {
  whatsappAccountId: number;
};

export const getWebhookConfigAction = withAction<
  AccountIdInput,
  WebhookConfigResponse | null
>(
  "webhookConfig.get",
  async (auth, input) => {
    const result = await WebhookConfigService.getByAccount(
      auth.companyId,
      input.whatsappAccountId
    );

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  { schema: webhookAccountIdSchema }
);

export const upsertWebhookConfigAction = withAction<
  UpsertInput,
  WebhookConfigResponse
>(
  "webhookConfig.upsert",
  async (auth, input) => {
    const result = await WebhookConfigService.upsert({
      appSecret: input.appSecret,
      callbackPath: input.callbackPath,
      companyId: auth.companyId,
      userId: auth.userId,
      whatsappAccountId: input.whatsappAccountId,
    });

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  {
    schema: webhookConfigUpsertClientSchema.extend({
      whatsappAccountId: z.number().int().positive(),
    }),
  }
);

export const listWebhookEventLogsAction = withAction<
  EventLogListInput,
  WebhookEventLogListResponse
>(
  "webhookEventLogs.list",
  async (auth, input) => {
    const result = await WebhookIngestService.listEventLogs(
      auth.companyId,
      input.whatsappAccountId,
      input.cursor,
      input.limit,
      input.processed
    );

    if (!result.success) {
      return Result.fail(result.message, result.error);
    }

    return result;
  },
  {
    schema: webhookEventLogListQuerySchema.extend({
      whatsappAccountId: z.number().int().positive(),
    }),
  }
);
