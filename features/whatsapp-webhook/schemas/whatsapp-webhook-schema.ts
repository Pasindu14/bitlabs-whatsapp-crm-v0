import { z } from "zod";

export const WEBHOOK_EVENT_TYPES = ["message", "status", "other"] as const;
export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

export const webhookConfigUpsertClientSchema = z.object({
  appSecret: z
    .string()
    .min(8, "App secret must be at least 8 characters")
    .max(255)
    .trim(),
  callbackPath: z
    .string()
    .min(1, "Callback path is required")
    .max(500)
    .trim()
    .refine(
      (val) => val.startsWith("/") || val.startsWith("https://"),
      "Callback path must start with '/' or be a full HTTPS URL"
    ),
});

export type WebhookConfigUpsertClientInput = z.infer<
  typeof webhookConfigUpsertClientSchema
>;

export const webhookConfigUpsertServerSchema = webhookConfigUpsertClientSchema
  .extend({
    companyId: z.number().int().positive(),
    userId: z.number().int().positive(),
    whatsappAccountId: z.number().int().positive(),
  })
  .strict();

export type WebhookConfigUpsertServerInput = z.infer<
  typeof webhookConfigUpsertServerSchema
>;

export const webhookConfigResponseSchema = z.object({
  id: z.number().int().positive(),
  companyId: z.number().int().positive(),
  whatsappAccountId: z.number().int().positive(),
  callbackPath: z.string(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export type WebhookConfigResponse = z.infer<typeof webhookConfigResponseSchema>;

export const webhookEventLogListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  processed: z.boolean().optional(),
});

export type WebhookEventLogListQuery = z.infer<
  typeof webhookEventLogListQuerySchema
>;

export const webhookEventLogResponseSchema = z.object({
  id: z.number().int().positive(),
  companyId: z.number().int().positive(),
  whatsappAccountId: z.number().int().positive(),
  objectId: z.string().nullable(),
  eventType: z.enum(WEBHOOK_EVENT_TYPES),
  eventTs: z.date(),
  payload: z.any().nullable(),
  signature: z.string().nullable(),
  dedupKey: z.string(),
  processed: z.boolean(),
  processedAt: z.date().nullable(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export type WebhookEventLogResponse = z.infer<typeof webhookEventLogResponseSchema>;

export const webhookEventLogListResponseSchema = z.object({
  items: z.array(webhookEventLogResponseSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type WebhookEventLogListResponse = z.infer<
  typeof webhookEventLogListResponseSchema
>;

export const webhookEventPayloadSchema = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z.array(
        z.object({
          field: z.string(),
          value: z.any(),
        })
      ),
    })
  ),
});

export type WebhookEventPayload = z.infer<typeof webhookEventPayloadSchema>;

export const webhookMessagePayloadSchema = z.object({
  messaging_product: z.string(),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  contacts: z.array(
    z.object({
      profile: z.object({
        name: z.string(),
      }),
      wa_id: z.string(),
    })
  ),
  messages: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      timestamp: z.string(),
      type: z.string(),
      text: z
        .object({
          body: z.string(),
        })
        .optional(),
      image: z
        .object({
          mime_type: z.string(),
          sha256: z.string(),
          id: z.string(),
          url: z.string(),
        })
        .optional(),
      video: z
        .object({
          mime_type: z.string(),
          sha256: z.string(),
          id: z.string(),
          url: z.string(),
        })
        .optional(),
      audio: z
        .object({
          mime_type: z.string(),
          sha256: z.string(),
          id: z.string(),
          url: z.string(),
        })
        .optional(),
      document: z
        .object({
          mime_type: z.string(),
          sha256: z.string(),
          id: z.string(),
          url: z.string(),
          filename: z.string().optional(),
        })
        .optional(),
    })
  ),
});

export type WebhookMessagePayload = z.infer<typeof webhookMessagePayloadSchema>;

export const webhookStatusPayloadSchema = z.object({
  messaging_product: z.string(),
  metadata: z.object({
    display_phone_number: z.string(),
    phone_number_id: z.string(),
  }),
  statuses: z.array(
    z.object({
      id: z.string(),
      recipient_id: z.string(),
      status: z.string(),
      timestamp: z.string(),
      conversation: z.object({
        id: z.string(),
        expiration_timestamp: z.number(),
        origin: z.object({
          type: z.string(),
        }),
      }),
    })
  ),
});

export type WebhookStatusPayload = z.infer<typeof webhookStatusPayloadSchema>;
