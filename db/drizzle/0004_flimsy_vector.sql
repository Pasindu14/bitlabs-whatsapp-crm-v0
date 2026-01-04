CREATE TABLE "conversation_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"created_by" integer NOT NULL,
	"updated_by" integer,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversation_notes" ADD CONSTRAINT "conversation_notes_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "conversation_notes_conversation_active_idx" ON "conversation_notes" USING btree ("conversation_id","is_active" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversation_notes_company_id_idx" ON "conversation_notes" USING btree ("company_id");--> statement-breakpoint
CREATE INDEX "conversation_notes_created_by_idx" ON "conversation_notes" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "conversation_notes_conversation_created_idx" ON "conversation_notes" USING btree ("conversation_id","created_at" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversation_notes_conversation_pinned_idx" ON "conversation_notes" USING btree ("conversation_id","is_pinned" DESC NULLS LAST,"created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversation_notes_company_conversation_idx" ON "conversation_notes" USING btree ("company_id","conversation_id");