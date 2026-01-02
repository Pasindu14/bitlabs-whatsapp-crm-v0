CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"phone" text NOT NULL,
	"name" text,
	"avatar" text,
	"is_group" boolean DEFAULT false NOT NULL,
	"presence" text,
	"created_by" integer,
	"updated_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"last_message_id" integer,
	"last_message_preview" text,
	"last_message_time" timestamp with time zone,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"assigned_to_user_id" integer,
	"created_by" integer,
	"updated_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"direction" text NOT NULL,
	"status" text DEFAULT 'sending' NOT NULL,
	"content" text NOT NULL,
	"media_url" text,
	"media_type" text,
	"provider_message_id" text,
	"provider_status" text,
	"error_code" text,
	"error_message" text,
	"created_by" integer,
	"updated_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_user_id_users_id_fk" FOREIGN KEY ("assigned_to_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "contacts_company_phone_unique" ON "contacts" USING btree ("company_id","phone");--> statement-breakpoint
CREATE INDEX "contacts_company_is_active_idx" ON "contacts" USING btree ("company_id","is_active");--> statement-breakpoint
CREATE INDEX "contacts_company_name_idx" ON "contacts" USING btree ("company_id","name");--> statement-breakpoint
CREATE INDEX "contacts_company_created_id_idx" ON "contacts" USING btree ("company_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_company_contact_unique" ON "conversations" USING btree ("company_id","contact_id");--> statement-breakpoint
CREATE INDEX "conversations_company_is_active_is_archived_idx" ON "conversations" USING btree ("company_id","is_active","is_archived");--> statement-breakpoint
CREATE INDEX "conversations_company_is_favorite_is_active_idx" ON "conversations" USING btree ("company_id","is_favorite","is_active");--> statement-breakpoint
CREATE INDEX "conversations_company_unread_count_idx" ON "conversations" USING btree ("company_id","unread_count");--> statement-breakpoint
CREATE INDEX "conversations_company_last_message_time_idx" ON "conversations" USING btree ("company_id","last_message_time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_assigned_to_user_company_idx" ON "conversations" USING btree ("assigned_to_user_id","company_id");--> statement-breakpoint
CREATE INDEX "conversations_company_last_message_time_id_idx" ON "conversations" USING btree ("company_id","last_message_time" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "messages_company_status_idx" ON "messages" USING btree ("company_id","status");--> statement-breakpoint
CREATE INDEX "messages_provider_message_id_idx" ON "messages" USING btree ("provider_message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_is_active_idx" ON "messages" USING btree ("conversation_id","is_active");--> statement-breakpoint
CREATE INDEX "messages_conversation_created_at_id_idx" ON "messages" USING btree ("conversation_id","created_at" DESC NULLS LAST,"id");