-- Migration: Add conversation_notes table
-- Date: 2025-01-04
-- Description: Enable users to add notes to conversations for documentation and context

CREATE TABLE IF NOT EXISTS conversation_notes (
    id SERIAL PRIMARY KEY,
    conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Primary query index: conversation_id + is_active
CREATE INDEX IF NOT EXISTS conversation_notes_conversation_active_idx 
    ON conversation_notes (conversation_id ASC, is_active DESC);

-- Company-scoped queries
CREATE INDEX IF NOT EXISTS conversation_notes_company_id_idx 
    ON conversation_notes (company_id ASC);

-- Find notes by creator
CREATE INDEX IF NOT EXISTS conversation_notes_created_by_idx 
    ON conversation_notes (created_by ASC);

-- Composite index for sorting (newest first)
CREATE INDEX IF NOT EXISTS conversation_notes_conversation_created_idx 
    ON conversation_notes (conversation_id ASC, created_at DESC, id DESC);

-- Pinned notes (show first)
CREATE INDEX IF NOT EXISTS conversation_notes_conversation_pinned_idx 
    ON conversation_notes (conversation_id ASC, is_pinned DESC, created_at DESC);

-- Company + conversation filtering
CREATE INDEX IF NOT EXISTS conversation_notes_company_conversation_idx 
    ON conversation_notes (company_id ASC, conversation_id ASC);
