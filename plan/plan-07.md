---
name: WhatsApp Media Proxy (On-Demand Streaming)
date: 2026-01-07
planNumber: 07
---

# WhatsApp Media Proxy (On-Demand Streaming) - Implementation Plan

## 1) Feature Summary

### Goal
Implement WhatsApp inbound media handling where media is NOT permanently stored. Instead:
- Webhook stores only media metadata (mediaId, mimeType, caption)
- UI shows a blur placeholder tile
- Media is streamed on-demand via a server proxy route
- Clicking again forces a reload (fresh fetch)

### Actors & Permissions
- **Inbound**: WhatsApp webhook (authenticated via app secret)
- **Users**: All authenticated users can view media in conversations they have access to
- **Tenant Isolation**: Media access is scoped by companyId

### Primary Flows
1. **Webhook receives media message**: Extract mediaId, mimeType, caption; store in messages table
2. **User views conversation**: Show blur placeholder for media messages
3. **User clicks placeholder**: Load real media via `/api/whatsapp/media/[mediaId]` proxy route
4. **User clicks again**: Force reload with new timestamp query param
5. **Error handling**: Show "Failed to load. Tap to retry." on errors

### Assumptions
- WhatsApp Graph API provides temporary media URLs that expire
- Access token is stored in environment variables
- MediaId is unique per media file in WhatsApp's system
- No need for permanent storage (privacy + storage savings)

---

## 2) Domain Model

### Entities

**MediaMessage** (extends existing Message entity)
- `mediaId`: WhatsApp's media identifier (string, nullable)
- `mediaMimeType`: MIME type from WhatsApp (string, nullable)
- `mediaCaption`: Caption text (string, nullable)

### Relationships
- MediaMessage **belongs to** Message (1:1, same table)
- Message **belongs to** Conversation (many:1)
- Conversation **belongs to** Company (many:1)

### State Machine
No state machine - media is always "available" via WhatsApp API until expired (typically 24h)

---

## 3) Database Design (Postgres/Drizzle)

### Table: `messages` (existing - modify)

**New Columns:**
```typescript
mediaId: text("media_id"),              // WhatsApp media ID
mediaMimeType: text("media_mime_type"),  // MIME type from webhook
mediaCaption: text("media_caption"),     // Caption text
```

**Existing Columns (unchanged):**
- `id`, `conversationId`, `companyId`, `contactId`, `whatsappAccountId`
- `direction`, `status`, `content`
- `mediaUrl` (deprecated - will be removed in future migration)
- `mediaType` (deprecated - will be removed in future migration)
- `providerMessageId`, `providerStatus`, `errorCode`, `errorMessage`
- `createdBy`, `updatedBy`, `isActive`, `createdAt`, `updatedAt`

**Constraints:**
- No new constraints (all nullable columns)

**Indexes:**
- No new indexes needed (mediaId is not queried directly)

**Migration Steps:**
1. Add columns `mediaId`, `mediaMimeType`, `mediaCaption` to `messages` table
2. Backfill existing media messages (if any) from `mediaUrl`/`mediaType` to new columns
3. Future: Remove deprecated `mediaUrl` and `mediaType` columns

---

## 4) API / Server Actions Contract

### Actions List

**No new server actions needed** - existing message actions already return media data.

### API Routes

#### `GET /api/whatsapp/media/[mediaId]/route.ts`
**Purpose:** Stream media from WhatsApp Graph API to client

**Input:**
- Route param: `mediaId` (string)
- Query param: `t` (timestamp, optional - forces reload)

**Output:**
- Binary file stream with appropriate `Content-Type`
- Headers:
  - `Content-Type`: From WhatsApp response (fallback to `application/octet-stream`)
  - `Cache-Control: no-store` (prevent caching)

**Error Cases:**
- `404`: Media not found in DB or not accessible by current user's companyId
- `403`: User doesn't have access to this conversation
- `500`: WhatsApp API error or internal error

**Security:**
- Validate user session (companyId)
- Validate mediaId belongs to a message in user's company
- Never expose WhatsApp access token to client

---

## 5) Validation (Zod)

### Schemas to Create

**No new Zod schemas needed** - existing message schemas already handle media fields.

**Existing Schema Updates:**
- Ensure `messageResponseSchema` includes `mediaId`, `mediaMimeType`, `mediaCaption`

---

## 6) Service Layer Plan

### Service Methods

**No new services needed** - existing services handle messages.

**WebhookIngestService.processMessage** (modify):
- Extract `mediaId`, `mediaMimeType`, `mediaCaption` from webhook payload
- Store in messages table along with other message data
- Do NOT download or store media binary

**Performance Logging:**
- Log media message processing (mediaId, type)
- Track proxy route performance (fetch time, stream time)

---

## 7) UI/UX Plan (shadcn + TanStack)

### Screens/Components to Add/Modify

**Modified: `features/conversations/components/message-list.tsx`**
- Add `MediaPlaceholder` component for blur tiles
- Handle click-to-reveal and click-to-reload
- Show error state on load failure

**New: `features/conversations/components/media-placeholder.tsx`**
- Blur placeholder tile with icon + "Tap to view" text
- Handles all media types (image, video, audio, document)
- Click event to reveal media
- Error state display

**New: `app/api/whatsapp/media/[mediaId]/route.ts`**
- Server proxy route for streaming media

### Component Behavior

**MediaPlaceholder Component:**
```typescript
interface MediaPlaceholderProps {
  mediaId: string;
  mediaType: 'image' | 'video' | 'audio' | 'document';
  mimeType?: string;
  caption?: string;
}

State:
- revealed: boolean (default false)
- error: string | null (default null)
- timestamp: number (for forcing reload)

Render:
- If !revealed: Blur tile with icon + "Tap to view"
- If revealed && !error: Render media element (img/video/audio/link)
- If error: "Failed to load. Tap to retry."

On Click:
- If !revealed: set revealed = true
- If revealed: set timestamp = Date.now() (force reload)
```

### Empty/Loading/Error States
- **Loading**: Show spinner while fetching media
- **Error**: "Failed to load. Tap to retry." with retry button
- **Empty**: N/A (placeholder always shown initially)

### Toast Strategy
- No toasts for media loading (inline error handling)
- Toast only for critical errors (e.g., "Media expired")

---

## 8) Hook/State Plan

### Hooks to Create

**No new hooks needed** - existing conversation hooks already fetch messages with media data.

### Local State
- Component-level state for `revealed`, `error`, `timestamp` in `MediaPlaceholder`

### Optimistic Updates
- None needed (media loading is read-only)

---

## 9) Security & Compliance

### Auth Requirements
- User must be authenticated (session with companyId)
- Media access validated against user's companyId

### Row-Level Tenant Enforcement
- Proxy route queries messages table with:
  - `WHERE mediaId = ? AND companyId = ?`
- Returns 404 if media not found or not in user's company

### Data Validation at Boundaries
- Webhook: Validate mediaId format (WhatsApp format)
- Proxy route: Validate mediaId exists in DB before fetching

---

## 10) Testing Plan

### Unit Tests
- `MediaPlaceholder` component:
  - Renders blur tile initially
  - Reveals media on click
  - Shows error state on failure
  - Forces reload on second click

### Integration Tests
- Proxy route:
  - Returns 404 for invalid mediaId
  - Returns 403 for cross-company mediaId
  - Streams media correctly for valid mediaId
  - Sets correct Content-Type header
  - Sets Cache-Control: no-store

### UI Tests
- Media placeholder displays correctly for all types
- Click interaction works as expected
- Error state is user-friendly

### Edge Cases Checklist
- Media expired in WhatsApp (24h limit)
- MediaId not found in DB
- User tries to access media from another company
- Network timeout while fetching media
- WhatsApp API rate limits
- Invalid MIME type
- Very large media files (streaming should handle)

---

## 11) Performance & Observability

### Query Cost Risks + Mitigations
- **Risk**: N+1 queries if loading media for each message
  - **Mitigation**: Media loaded on-demand (only when clicked)
- **Risk**: Slow proxy route if WhatsApp API is slow
  - **Mitigation**: Stream response immediately, don't buffer entire file

### Required Indexes Recap
- No new indexes needed

### Logging/Metrics Events
- **Webhook**: Log media message received (mediaId, type, companyId)
- **Proxy Route**: Log media fetch (mediaId, duration, status)
- **UI**: Log media reveal events (mediaId, userId)

### N+1 Avoidance
- Media loaded on-demand eliminates N+1 issue
- No prefetching of media

---

## 12) Delivery Checklist

### Files/Folders to Create
- `app/api/whatsapp/media/[mediaId]/route.ts` - Proxy route
- `features/conversations/components/media-placeholder.tsx` - Blur placeholder component

### Files/Folders to Modify
- `db/schema.ts` - Add mediaId, mediaMimeType, mediaCaption columns to messagesTable
- `db/drizzle/000X_*.sql` - Migration file
- `features/whatsapp-webhook/services/webhook-ingest.service.ts` - Extract and store media metadata
- `features/conversations/components/message-list.tsx` - Integrate MediaPlaceholder

### Order of Implementation
1. **DB Schema**: Add columns to messages table
2. **Migration**: Generate and apply migration
3. **Webhook**: Update webhook ingest to extract and store media metadata
4. **Proxy Route**: Create `/api/whatsapp/media/[mediaId]/route.ts`
5. **UI Component**: Create `MediaPlaceholder` component
6. **Integration**: Update `message-list.tsx` to use `MediaPlaceholder`
7. **Testing**: Test all flows (webhook, proxy, UI)
8. **Cleanup**: Remove deprecated `mediaUrl`/`mediaType` columns (future)

### Definition of Done
- [ ] Migration applied successfully
- [ ] Webhook stores mediaId, mediaMimeType, mediaCaption for media messages
- [ ] Proxy route streams media from WhatsApp API
- [ ] UI shows blur placeholder for media messages
- [ ] Clicking placeholder reveals media
- [ ] Clicking again forces reload
- [ ] Error state displays correctly
- [ ] Tenant isolation enforced (404 for cross-company access)
- [ ] No media stored permanently in DB or filesystem
- [ ] All tests pass
- [ ] Build succeeds
- [ ] No lint errors
