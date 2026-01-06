import { z } from "zod";

// Enumerations / constants
export const WHATSAPP_ACCOUNT_SORT_FIELDS = ["createdAt", "name"] as const;
export const SORT_ORDER = ["asc", "desc"] as const;

// Client schemas
export const whatsappAccountCreateClientSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  phoneNumberId: z.string().min(1).max(255).trim(),
  businessAccountId: z.string().min(1).max(255).trim(),
  accessToken: z.string().min(5).max(4096).trim(),
  isDefault: z.boolean().optional(),
});
export type WhatsappAccountCreateInput = z.infer<
  typeof whatsappAccountCreateClientSchema
>;

export const whatsappAccountUpdateClientSchema =
  whatsappAccountCreateClientSchema
    .partial()
    .extend({
      isActive: z.boolean().optional(),
    });
export type WhatsappAccountUpdateInput = z.infer<
  typeof whatsappAccountUpdateClientSchema
>;

export const whatsappAccountFilterClientSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().min(1).max(100).default(20),
  search: z.string().max(120).trim().optional(),
  isActive: z.boolean().optional(),
  sortField: z.enum(WHATSAPP_ACCOUNT_SORT_FIELDS).default("createdAt"),
  sortOrder: z.enum(SORT_ORDER).default("desc"),
});
export type WhatsappAccountFilterInput = z.infer<
  typeof whatsappAccountFilterClientSchema
>;

// Server schemas
export const whatsappAccountCreateServerSchema =
  whatsappAccountCreateClientSchema.extend({
    companyId: z.number().int(),
    userId: z.number().int(),
  });
export type WhatsappAccountCreateServerInput = z.infer<
  typeof whatsappAccountCreateServerSchema
>;

export const whatsappAccountUpdateServerSchema =
  whatsappAccountUpdateClientSchema.extend({
    id: z.number().int(),
    companyId: z.number().int(),
    userId: z.number().int(),
  });
export type WhatsappAccountUpdateServerInput = z.infer<
  typeof whatsappAccountUpdateServerSchema
>;

export const whatsappAccountSetDefaultSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  userId: z.number().int(),
});
export type WhatsappAccountSetDefaultInput = z.infer<
  typeof whatsappAccountSetDefaultSchema
>;

export const whatsappAccountGetSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
});
export type WhatsappAccountGetInput = z.infer<typeof whatsappAccountGetSchema>;

export const whatsappAccountListClientSchema =
  whatsappAccountFilterClientSchema;
export type WhatsappAccountListInput = z.infer<
  typeof whatsappAccountListClientSchema
>;

export const whatsappAccountListServerSchema =
  whatsappAccountFilterClientSchema.extend({
    companyId: z.number().int(),
  });
export type WhatsappAccountListServerInput = z.infer<
  typeof whatsappAccountListServerSchema
>;

// Response schemas
export const whatsappAccountResponseSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  name: z.string(),
  phoneNumberId: z.string(),
  businessAccountId: z.string(),
  // accessToken intentionally omitted from responses
  isActive: z.boolean(),
  isDefault: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  createdBy: z.number().int().nullable(),
  updatedBy: z.number().int().nullable(),
});
export type WhatsappAccountResponse = z.infer<
  typeof whatsappAccountResponseSchema
>;

export const whatsappAccountListResponseSchema = z.object({
  items: z.array(whatsappAccountResponseSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});
export type WhatsappAccountListResponse = z.infer<
  typeof whatsappAccountListResponseSchema
>;

// Action-only schemas (client input)
export const whatsappAccountIdSchema = z.object({
  id: z.number().int(),
});
export type WhatsappAccountIdInput = z.infer<typeof whatsappAccountIdSchema>;

export type WhatsappAccountListQueryInput = WhatsappAccountFilterInput;
