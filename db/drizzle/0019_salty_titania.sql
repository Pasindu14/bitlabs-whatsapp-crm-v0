CREATE TABLE "orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"contact_id" integer NOT NULL,
	"conversation_id" integer,
	"created_by" integer NOT NULL,
	"updated_by" integer,
	"contact_name_snapshot" text NOT NULL,
	"contact_phone_snapshot" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"delivery_address" text NOT NULL,
	"order_description" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "orders_company_created_id_idx" ON "orders" USING btree ("company_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_company_status_id_idx" ON "orders" USING btree ("company_id","status","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_company_contact_id_idx" ON "orders" USING btree ("company_id","contact_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_company_conversation_id_idx" ON "orders" USING btree ("company_id","conversation_id","id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "orders_company_active_idx" ON "orders" USING btree ("company_id","is_active");