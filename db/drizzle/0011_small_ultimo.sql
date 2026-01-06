ALTER TABLE "conversations" DROP CONSTRAINT "conversations_whatsapp_account_id_whatsapp_accounts_id_fk";
--> statement-breakpoint
DROP INDEX "conversations_company_contact_whatsapp_account_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_company_contact_unique" ON "conversations" USING btree ("company_id","contact_id");--> statement-breakpoint
ALTER TABLE "conversations" DROP COLUMN "whatsapp_account_id";