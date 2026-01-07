-- Performance Analysis: EXPLAIN ANALYZE for slow queries
-- Run this in your PostgreSQL database to verify index usage

-- 1. Get Conversation Messages Query (with cursor)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
  id, conversation_id, company_id, contact_id, direction, status, content,
  media_url, media_type, media_id, media_mime_type, media_caption,
  provider_message_id, provider_status, error_code, error_message,
  created_at, updated_at, is_active
FROM messages
WHERE conversation_id = 12
  AND company_id = 1
  AND is_active = true
ORDER BY created_at DESC, id DESC
LIMIT 51;

-- 2. List Conversations Query (with filters)
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
  c.id, c.company_id, c.contact_id, c.last_message_id, c.last_message_preview,
  c.last_message_time, c.unread_count, c.is_favorite, c.is_archived,
  c.assigned_to_user_id, c.created_at, c.updated_at, c.is_active,
  ct.id as contact_id, ct.name, ct.phone
FROM conversations c
LEFT JOIN contacts ct ON c.contact_id = ct.id
WHERE c.company_id = 1
  AND c.is_active = true
  AND c.is_archived = false
  AND c.assigned_to_user_id IS NULL
ORDER BY c.last_message_time DESC NULLS LAST, c.id DESC
LIMIT 51;

-- 3. WhatsApp Accounts List Query
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT 
  id, company_id, phone_number_id, access_token, is_active,
  created_at, updated_at
FROM whatsapp_accounts
WHERE company_id = 1
  AND is_active = true;

-- 4. Check if indexes exist
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('conversations', 'messages', 'whatsapp_accounts')
  AND schemaname = 'public'
ORDER BY tablename, indexname;

-- 5. Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan as index_scans,
  idx_tup_read as tuples_read,
  idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE tablename IN ('conversations', 'messages', 'whatsapp_accounts')
ORDER BY idx_scan DESC;
