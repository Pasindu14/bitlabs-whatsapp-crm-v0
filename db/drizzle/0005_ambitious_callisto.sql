CREATE TABLE "whatsapp_webhook_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"whatsapp_account_id" integer NOT NULL,
	"verify_token" text NOT NULL,
	"app_secret" text NOT NULL,
	"callback_path" text NOT NULL,
	"status" text DEFAULT 'unverified' NOT NULL,
	"last_verified_at" timestamp with time zone,
	"created_by" integer,
	"updated_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "whatsapp_webhook_event_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"whatsapp_account_id" integer NOT NULL,
	"object_id" text,
	"event_type" text NOT NULL,
	"event_ts" timestamp with time zone NOT NULL,
	"payload" jsonb NOT NULL,
	"signature" text,
	"dedup_key" text NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"created_by" integer,
	"updated_by" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_configs" ADD CONSTRAINT "whatsapp_webhook_configs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_configs" ADD CONSTRAINT "whatsapp_webhook_configs_whatsapp_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("whatsapp_account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_configs" ADD CONSTRAINT "whatsapp_webhook_configs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_configs" ADD CONSTRAINT "whatsapp_webhook_configs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_event_logs" ADD CONSTRAINT "whatsapp_webhook_event_logs_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_event_logs" ADD CONSTRAINT "whatsapp_webhook_event_logs_whatsapp_account_id_whatsapp_accounts_id_fk" FOREIGN KEY ("whatsapp_account_id") REFERENCES "public"."whatsapp_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_event_logs" ADD CONSTRAINT "whatsapp_webhook_event_logs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_webhook_event_logs" ADD CONSTRAINT "whatsapp_webhook_event_logs_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_webhook_configs_company_account_unique" ON "whatsapp_webhook_configs" USING btree ("company_id","whatsapp_account_id");--> statement-breakpoint
CREATE INDEX "whatsapp_webhook_configs_company_status_idx" ON "whatsapp_webhook_configs" USING btree ("company_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "whatsapp_webhook_event_logs_company_dedup_unique" ON "whatsapp_webhook_event_logs" USING btree ("company_id","dedup_key");--> statement-breakpoint
CREATE INDEX "whatsapp_webhook_event_logs_company_account_processed_ts_idx" ON "whatsapp_webhook_event_logs" USING btree ("company_id","whatsapp_account_id","processed","event_ts" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "whatsapp_webhook_event_logs_payload_gin_idx" ON "whatsapp_webhook_event_logs" USING gin ("payload");