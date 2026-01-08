import { z } from "zod";

export const ACCOUNT_STATUS = ["active", "inactive", "all"] as const;
export type AccountStatus = (typeof ACCOUNT_STATUS)[number];

export const accountAnalyticsListSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  searchTerm: z.string().trim().max(255).optional(),
  accountId: z.number().int().positive().optional(),
  status: z.enum(ACCOUNT_STATUS).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type AccountAnalyticsListInput = z.infer<typeof accountAnalyticsListSchema>;

export const accountAnalyticsListServerSchema = accountAnalyticsListSchema.extend({
  companyId: z.number().int().positive(),
});

export type AccountAnalyticsListServerInput = z.infer<typeof accountAnalyticsListServerSchema>;

export const accountAnalyticsItemSchema = z.object({
  whatsappAccountId: z.number().int().positive(),
  name: z.string(),
  phone: z.string(),
  receivedCount: z.number().int().min(0),
  sentCount: z.number().int().min(0),
  isActive: z.boolean(),
});

export type AccountAnalyticsItem = z.infer<typeof accountAnalyticsItemSchema>;

export const accountAnalyticsListResponseSchema = z.object({
  accounts: z.array(accountAnalyticsItemSchema),
  nextCursor: z.string().optional(),
  hasMore: z.boolean(),
});

export type AccountAnalyticsListResponse = z.infer<typeof accountAnalyticsListResponseSchema>;

export const accountAnalyticsGetSchema = z.object({
  whatsappAccountId: z.number().int().positive(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export type AccountAnalyticsGetInput = z.infer<typeof accountAnalyticsGetSchema>;

export const accountAnalyticsGetServerSchema = accountAnalyticsGetSchema.extend({
  companyId: z.number().int().positive(),
});

export type AccountAnalyticsGetServerInput = z.infer<typeof accountAnalyticsGetServerSchema>;

export const accountAnalyticsDetailSchema = z.object({
  receivedCount: z.number().int().min(0),
  sentCount: z.number().int().min(0),
  dailySeries: z.array(
    z.object({
      date: z.string(),
      received: z.number().int().min(0),
      sent: z.number().int().min(0),
    })
  ).optional(),
});

export type AccountAnalyticsDetail = z.infer<typeof accountAnalyticsDetailSchema>;
