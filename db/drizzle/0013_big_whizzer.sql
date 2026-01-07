CREATE TABLE "media_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"message_id" integer NOT NULL,
	"file_key" text NOT NULL,
	"file_name" text,
	"file_url" text NOT NULL,
	"file_size" integer NOT NULL,
	"file_type" text NOT NULL,
	"mime_type" text NOT NULL,
	"provider_media_id" text NOT NULL,
	"provider_media_url" text NOT NULL,
	"download_status" text DEFAULT 'pending' NOT NULL,
	"download_attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"uploaded_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "media_file_id" integer;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "media_files_message_unique" ON "media_files" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "media_files_company_id_idx" ON "media_files" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "media_files_conversation_id_idx" ON "media_files" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "media_files_download_status_idx" ON "media_files" USING btree ("download_status");--> statement-breakpoint
CREATE INDEX "media_files_company_status_attempts_idx" ON "media_files" USING btree ("company_id","download_status","download_attempts");--> statement-breakpoint
CREATE INDEX "media_files_company_created_id_idx" ON "media_files" USING btree ("company_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_media_file_id_media_files_id_fk" FOREIGN KEY ("media_file_id") REFERENCES "public"."media_files"("id") ON DELETE set null ON UPDATE no action;