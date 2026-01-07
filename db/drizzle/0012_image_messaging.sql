-- Create file_uploads table
CREATE TABLE IF NOT EXISTS "file_uploads" (
    "id" SERIAL PRIMARY KEY,
    "company_id" INTEGER NOT NULL REFERENCES "companies"("id"),
    "conversation_id" INTEGER NOT NULL REFERENCES "conversations"("id"),
    "file_key" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "uploaded_by" INTEGER NOT NULL REFERENCES "users"("id"),
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "file_uploads_company_id_idx" ON "file_uploads" ("company_id" ASC);
CREATE UNIQUE INDEX IF NOT EXISTS "file_uploads_file_key_unique" ON "file_uploads" ("file_key" ASC);
CREATE INDEX IF NOT EXISTS "file_uploads_conversation_id_idx" ON "file_uploads" ("conversation_id" ASC);
CREATE INDEX IF NOT EXISTS "file_uploads_uploaded_by_idx" ON "file_uploads" ("uploaded_by" ASC);
CREATE INDEX IF NOT EXISTS "file_uploads_company_created_id_idx" ON "file_uploads" ("company_id" ASC, "created_at" DESC, "id" ASC);
CREATE INDEX IF NOT EXISTS "file_uploads_company_file_type_idx" ON "file_uploads" ("company_id" ASC, "file_type" ASC);
