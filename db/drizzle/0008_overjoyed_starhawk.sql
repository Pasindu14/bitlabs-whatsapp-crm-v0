DROP INDEX "whatsapp_webhook_configs_company_status_idx";--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_configs" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_configs" DROP COLUMN "last_verified_at";