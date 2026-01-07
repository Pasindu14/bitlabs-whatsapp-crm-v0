CREATE TABLE "file_uploads" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text NOT NULL,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"uploaded_by" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
DROP INDEX "conversations_company_contact_unique";--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "whatsapp_account_id" integer;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_uploads" ADD CONSTRAINT "file_uploads_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "file_uploads_company_id_idx" ON "file_uploads" USING btree ("company_id");--> statement-breakpoint
CREATE UNIQUE INDEX "file_uploads_file_key_unique" ON "file_uploads" USING btree ("file_key");--> statement-breakpoint
CREATE INDEX "file_uploads_conversation_id_idx" ON "file_uploads" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "file_uploads_uploaded_by_idx" ON "file_uploads" USING btree ("uploaded_by");--> statement-breakpoint
CREATE INDEX "file_uploads_company_created_id_idx" ON "file_uploads" USING btree ("company_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "file_uploads_company_file_type_idx" ON "file_uploads" USING btree ("company_id","file_type");--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_whatsapp_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("whatsapp_account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_company_contact_whatsapp_account_unique" ON "conversations" USING btree ("company_id","contact_id","whatsapp_account_id");