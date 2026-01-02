import { z } from "zod";

export const contactResponseSchema = z.object({
  id: z.number(),
  companyId: z.number(),
  phoneNumber: z.string(),
  name: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  notes: z.string().nullable().optional(),
  tags: z.array(z.string()).nullable().optional(),
  createdAt: z.date().or(z.string()).optional(),
  updatedAt: z.date().or(z.string()).nullable().optional(),
});

export const contactCreateClientSchema = z.object({
  phoneNumber: z.string().min(3),
  name: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const contactUpdateClientSchema = contactCreateClientSchema.partial().extend({
  id: z.number(),
});

export const contactListClientSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).optional(),
  search: z.string().trim().max(120).optional(),
  tags: z.array(z.string()).optional(),
});

export const contactServerSchema = contactCreateClientSchema.extend({
  companyId: z.number(),
  userId: z.number(),
});

export type ContactResponse = z.infer<typeof contactResponseSchema>;
export type ContactListResponse = {
  items: ContactResponse[];
  nextCursor: string | null;
  hasMore: boolean;
};
export type ContactCreateInput = z.infer<typeof contactCreateClientSchema>;
export type ContactUpdateInput = z.infer<typeof contactUpdateClientSchema>;
export type ContactListInput = z.infer<typeof contactListClientSchema>;
