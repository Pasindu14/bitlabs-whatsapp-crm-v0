import { z } from 'zod';

export const whatsappPhoneProfileQuerySchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone number ID is required'),
  fields: z.string().optional(),
});

export const qualityRatingSchema = z.enum(['GREEN', 'YELLOW', 'RED', 'NA']);

export const nameStatusSchema = z.enum([
  'APPROVED',
  'AVAILABLE_WITHOUT_REVIEW',
  'DECLINED',
  'EXPIRED',
  'PENDING_REVIEW',
  'NONE',
]);

export const codeVerificationStatusSchema = z.enum(['VERIFIED', 'UNVERIFIED', 'EXPIRED', 'PENDING', 'NOT_VERIFIED']);

export const whatsappPhoneProfileResponseSchema = z.object({
  id: z.string(),
  display_phone_number: z.string().optional(),
  verified_name: z.string().optional(),
  quality_rating: qualityRatingSchema.optional(),
  name_status: nameStatusSchema.optional(),
  code_verification_status: codeVerificationStatusSchema.optional(),
  platform_type: z.string().optional(),
  throughput: z.object({
    level: z.string().optional(),
  }).optional(),
  webhook_configuration: z.object({
    application: z.string().optional(),
  }).optional(),
}).passthrough();

export type WhatsappPhoneProfileResponse = z.infer<typeof whatsappPhoneProfileResponseSchema>;
export type WhatsappPhoneProfileQuery = z.infer<typeof whatsappPhoneProfileQuerySchema>;
export type QualityRating = z.infer<typeof qualityRatingSchema>;
export type NameStatus = z.infer<typeof nameStatusSchema>;
export type CodeVerificationStatus = z.infer<typeof codeVerificationStatusSchema>;
