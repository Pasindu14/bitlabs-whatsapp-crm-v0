CREATE INDEX "conversations_company_active_archived_time_idx" ON "conversations" USING btree ("company_id", "is_active", "is_archived", "last_message_time" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "conversations_company_active_assigned_idx" ON "conversations" USING btree ("company_id", "is_active", "assigned_to_user_id");--> statement-breakpoint
CREATE INDEX "messages_conversation_company_active_idx" ON "messages" USING btree ("conversation_id", "company_id", "is_active", "created_at" DESC NULLS LAST);
