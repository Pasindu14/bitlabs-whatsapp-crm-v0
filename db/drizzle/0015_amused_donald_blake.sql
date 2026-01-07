ALTER TABLE "media_files" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE IF EXISTS "media_files" CASCADE;--> statement-breakpoint
ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "messages_media_file_id_media_files_id_fk";
--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN IF EXISTS "media_file_id";