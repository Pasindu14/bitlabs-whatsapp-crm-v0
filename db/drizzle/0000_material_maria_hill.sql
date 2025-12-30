CREATE TABLE "audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"action" text NOT NULL,
	"old_values" jsonb,
	"new_values" jsonb,
	"changed_by" integer NOT NULL,
	"change_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"phone_number" text NOT NULL,
	"name" text,
	"email" text,
	"notes" text,
	"tags" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"contact_id" integer,
	"phone_number" text NOT NULL,
	"whatsapp_account_id" integer,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unread_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_to" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"message_id" text NOT NULL,
	"direction" text NOT NULL,
	"type" text NOT NULL,
	"content" jsonb NOT NULL,
	"status" text DEFAULT 'sent' NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"company_id" integer NOT NULL,
	"created_by" integer,
	"updated_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"start_date_time" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "whatsapp_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"phone_number_id" text NOT NULL,
	"business_account_id" text NOT NULL,
	"access_token" text NOT NULL,
	"webhook_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_changed_by_users_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_whatsapp_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("whatsapp_account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_accounts" ADD CONSTRAINT "whatsapp_accounts_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_company_id_idx" ON "audit_logs" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_logs_company_id_entity_type_idx" ON "audit_logs" USING btree ("company_id","entity_type");--> statement-breakpoint
CREATE INDEX "audit_logs_changed_by_idx" ON "audit_logs" USING btree ("changed_by");--> statement-breakpoint
CREATE INDEX "audit_logs_company_id_changed_by_idx" ON "audit_logs" USING btree ("company_id","changed_by");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_company_id_entity_type_entity_id_idx" ON "audit_logs" USING btree ("company_id","entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "contacts_company_id_idx" ON "contacts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "contacts_company_id_phone_number_idx" ON "contacts" USING btree ("company_id","phone_number");--> statement-breakpoint
CREATE INDEX "contacts_company_id_name_id_idx" ON "contacts" USING btree ("company_id","name","id");--> statement-breakpoint
CREATE INDEX "contacts_company_id_created_at_id_idx" ON "contacts" USING btree ("company_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "conversations_company_id_idx" ON "conversations" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "conversations_company_id_last_message_at_id_idx" ON "conversations" USING btree ("company_id","last_message_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "conversations_company_id_status_last_message_at_idx" ON "conversations" USING btree ("company_id","status","last_message_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_company_id_phone_number_idx" ON "conversations" USING btree ("company_id","phone_number");--> statement-breakpoint
CREATE INDEX "conversations_contact_id_idx" ON "conversations" USING btree ("contact_id");--> statement-breakpoint
CREATE INDEX "conversations_assigned_to_idx" ON "conversations" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "conversations_whatsapp_account_idx" ON "conversations" USING btree ("whatsapp_account_id");--> statement-breakpoint
CREATE INDEX "messages_company_id_idx" ON "messages" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_timestamp_id_idx" ON "messages" USING btree ("conversation_id","timestamp" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "messages_message_id_idx" ON "messages" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_id_idx" ON "messages" USING btree ("conversation_id");--> statement-breakpoint
CREATE INDEX "users_company_id_idx" ON "users" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "users_company_id_is_active_idx" ON "users" USING btree ("company_id","is_active") WHERE "users"."is_active" = true;--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_company_id_role_idx" ON "users" USING btree ("company_id","role");--> statement-breakpoint
CREATE INDEX "users_company_id_created_at_id_idx" ON "users" USING btree ("company_id","created_at" DESC NULLS LAST,"id");--> statement-breakpoint
CREATE INDEX "users_company_id_name_id_idx" ON "users" USING btree ("company_id","name","id");--> statement-breakpoint
CREATE INDEX "users_company_id_email_id_idx" ON "users" USING btree ("company_id","email","id");--> statement-breakpoint
CREATE INDEX "users_company_id_role_id_idx" ON "users" USING btree ("company_id","role","id");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_company_id_idx" ON "whatsapp_accounts" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_company_active_created_idx" ON "whatsapp_accounts" USING btree ("company_id","is_active","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whatsapp_accounts_company_created_id_idx" ON "whatsapp_accounts" USING btree ("company_id","created_at" DESC NULLS LAST,"id");