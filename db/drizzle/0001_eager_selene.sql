ALTER TABLE "whatsapp_accounts" ADD COLUMN "is_default" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD COLUMN "created_by" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD COLUMN "updated_by" integer;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_company_phone_unique" ON "whatsapp_accounts" USING btree ("company_id","phone_number_id");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_company_name_unique" ON "whatsapp_accounts" USING btree ("company_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_accounts_company_default_unique" ON "whatsapp_accounts" USING btree ("company_id") WHERE "whatsapp_accounts"."is_default" = true;--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_company_name_id_idx" ON "whatsapp_accounts" USING btree ("company_id","name","id");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_company_phone_idx" ON "whatsapp_accounts" USING btree ("company_id","phone_number_id");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_company_business_id_idx" ON "whatsapp_accounts" USING btree ("company_id","business_account_id");