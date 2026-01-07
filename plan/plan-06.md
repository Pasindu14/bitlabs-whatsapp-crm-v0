---
feature: WhatsApp Media Message Handling
date: 2026-01-07
plan_number: 06
---

# Feature Master Plan: WhatsApp Media Message Handling

## 1) Feature Summary

### Goal
Enable the platform to receive, process, store, and display media messages (images, videos, audio, documents) sent by WhatsApp users through the Business API webhook.

### Actors & Permissions
- **System Service**: Automatically processes incoming webhooks (no user session)
- **All Users**: Can view media messages in conversations they have access to (based on company membership)
- **Admin/Manager**: Can manage media storage settings (future enhancement)

### Primary Flows
1. **Media Reception**: Webhook receives media message with temporary URL
2. **Media Download**: Background job downloads media from WhatsApp's temporary URL
3. **Media Storage**: Store media file persistently (local filesystem or cloud storage)
4. **Message Creation**: Create message record with media metadata
5. **Media Display**: Render media in chat interface with appropriate viewer
6. **Media Expiry Handling**: Handle expired temporary URLs with retry logic

### Assumptions
- WhatsApp provides temporary URLs that expire within a configurable time window (typically 24-48 hours)
- Media files should be downloaded and stored permanently to avoid link rot
- Initial implementation uses local filesystem storage (can be extended to S3/CloudFront later)
- Media size limits: Images up to 5MB, Videos up to 16MB, Audio up to 16MB, Documents up to 100MB (WhatsApp limits)
- Supported formats: JPEG, PNG, GIF, MP4, MP3, PDF, DOCX, etc.

---

## 2) Domain Model

### Entities

#### MediaFile
Represents a downloaded and stored media file from WhatsApp.

- **id**: Unique identifier
- **companyId**: Tenant identifier
- **conversationId**: Associated conversation
- **messageId**: Associated message
- **fileKey**: Storage key/path for the file
- **fileName**: Original filename (if provided)
- **fileUrl**: Public URL for accessing the file
- **fileSize**: Size in bytes
- **fileType**: Media type (image, video, audio, document)
- **mimeType**: MIME type (e.g., image/jpeg, video/mp4)
- **providerMediaId**: WhatsApp's media ID
- **providerMediaUrl**: Original temporary URL from WhatsApp
- **downloadStatus**: pending, downloading, completed, failed
- **downloadAttempts**: Number of download attempts
- **lastError**: Last error message if download failed
- **isActive**: Soft delete flag
- **createdAt/updatedAt**: Audit timestamps
- **uploadedBy**: User who triggered upload (null for webhook-initiated)

### Relationships
- **MediaFile** → **Conversation** (Many-to-One): One conversation can have many media files
- **MediaFile** → **Message** (One-to-One): Each media file is associated with one message
- **MediaFile** → **Company** (Many-to-One): Multi-tenant isolation

### State Machine (MediaFile.downloadStatus)
```
pending → downloading → completed
                ↓
              failed (can retry)
```

---

## 3) Database Design (Postgres/Drizzle)

### Tables

#### media_files Table

```typescript
export const mediaFilesTable = pgTable("media_files", {
  // Primary Key
  id: serial("id").primaryKey(),

  // Foreign Keys
  companyId: integer("company_id")
    .references(() => companiesTable.id, { onDelete: "cascade" })
    .notNull(),
  conversationId: integer("conversation_id")
    .references(() => conversationsTable.id, { onDelete: "cascade" })
    .notNull(),
  messageId: integer("message_id")
    .references(() => messagesTable.id, { onDelete: "cascade" })
    .notNull(),

  // File Metadata
  fileKey: text("file_key").notNull(),
  fileName: text("file_name"),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(), // image, video, audio, document
  mimeType: text("mime_type").notNull(),

  // Provider Metadata
  providerMediaId: text("provider_media_id").notNull(),
  providerMediaUrl: text("provider_media_url").notNull(),

  // Download Tracking
  downloadStatus: text("download_status").notNull().default("pending"), // pending, downloading, completed, failed
  downloadAttempts: integer("download_attempts").notNull().default(0),
  lastError: text("last_error"),

  // Audit Fields
  uploadedBy: integer("uploaded_by")
    .references((): any => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
  isActive: boolean("is_active").notNull().default(true),
}, (table) => [
  // Unique constraint: one media file per message
  uniqueIndex("media_files_message_unique")
    .on(table.messageId),

  // Company-scoped queries
  index("media_files_company_id_idx")
    .on(table.companyId),

  // Conversation media listing
  index("media_files_conversation_id_idx")
    .on(table.conversationId),

  // Find failed downloads for retry
  index("media_files_download_status_idx")
    .on(table.downloadStatus),

  // Retry failed downloads
  index("media_files_company_status_attempts_idx")
    .on(table.companyId, table.downloadStatus, table.downloadAttempts),

  // Composite index for cursor pagination
  index("media_files_company_created_id_idx")
    .on(table.companyId, table.createdAt.desc(), table.id.asc()),
]);
```

#### Update messages Table (Add Media Reference)

```typescript
// Add to existing messagesTable:
mediaFileId: integer("media_file_id")
  .references(() => mediaFilesTable.id, { onDelete: "set null" }),
```

### Indexes Rationale

1. **media_files_message_unique**: Ensures one-to-one relationship with messages
2. **media_files_company_id_idx**: Multi-tenant filtering
3. **media_files_conversation_id_idx**: List all media for a conversation
4. **media_files_download_status_idx**: Find pending/failed downloads
5. **media_files_company_status_attempts_idx**: Retry failed downloads with attempt counting
6. **media_files_company_created_id_idx**: Cursor pagination for media gallery

### Expected Queries

1. **List media for conversation**: `WHERE companyId = ? AND conversationId = ? AND isActive = true ORDER BY createdAt DESC`
2. **Get media by message**: `WHERE messageId = ? AND isActive = true`
3. **Find pending downloads**: `WHERE downloadStatus = 'pending' AND downloadAttempts < 3`
4. **Find failed downloads for retry**: `WHERE downloadStatus = 'failed' AND downloadAttempts < 5 AND updatedAt > ?`
5. **Delete media by conversation**: `WHERE conversationId = ?` (cascade)

### Migration Steps

1. **Create media_files table** with all columns and indexes
2. **Add mediaFileId column** to messages table
3. **Create foreign key constraints** (deferred to avoid circular references)
4. **Backfill existing messages** with mediaUrl (if any) to create mediaFile records
5. **Create indexes** after data migration
6. **Add triggers** for automatic updatedAt updates

---

## 4) API / Server Actions Contract

### Actions List

#### Media Download Actions
- `downloadMediaFromProvider(companyId, whatsappAccountId, providerMediaId, providerMediaUrl, mediaFileId)`
  - Downloads media from WhatsApp's temporary URL
  - Updates mediaFile record with status and metadata
  - Returns: `Result<{ fileUrl, fileSize, mimeType }>`

- `retryFailedMediaDownloads(companyId, maxAttempts = 5)`
  - Finds failed media downloads and retries them
  - Returns: `Result<{ retried: number, succeeded: number, failed: number }>`

#### Media Query Actions
- `getMediaByMessageId(messageId)`
  - Retrieves media file associated with a message
  - Returns: `Result<MediaFileResponse>`

- `listMediaByConversation(conversationId, cursor?, limit?)`
  - Lists all media files for a conversation (cursor pagination)
  - Returns: `Result<MediaFileListResponse>`

- `getMediaDownloadStatus(mediaFileId)`
  - Checks download status of a media file
  - Returns: `Result<{ status, progress, error }>`

### Inputs/Outputs

#### downloadMediaFromProvider Input
```typescript
{
  companyId: number;
  whatsappAccountId: number;
  providerMediaId: string;
  providerMediaUrl: string;
  mediaFileId: number;
  fileType: "image" | "video" | "audio" | "document";
  mimeType: string;
}
```

#### MediaFileResponse
```typescript
{
  id: number;
  companyId: number;
  conversationId: number;
  messageId: number;
  fileKey: string;
  fileName: string | null;
  fileUrl: string;
  fileSize: number;
  fileType: "image" | "video" | "audio" | "document";
  mimeType: string;
  providerMediaId: string;
  downloadStatus: "pending" | "downloading" | "completed" | "failed";
  downloadAttempts: number;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}
```

#### MediaFileListResponse
```typescript
{
  items: MediaFileResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}
```

### Error Cases
- **Validation Error**: Invalid URL, missing required fields
- **Not Found**: Media file or message not found
- **Unauthorized**: Invalid access token for WhatsApp API
- **Download Failed**: Network error, expired URL, file too large
- **Storage Error**: Disk full, permission denied
- **Conflict**: Media already downloaded

### Pagination Strategy
- Cursor-based pagination using `(createdAt, id)` tuple
- Default limit: 20 media files per page
- Maximum limit: 100

---

## 5) Validation (Zod)

### Schemas

#### mediaFileCreateServerSchema
```typescript
export const mediaFileCreateServerSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  messageId: z.number().int().positive(),
  providerMediaId: z.string().max(255),
  providerMediaUrl: z.string().url().max(2048),
  fileType: z.enum(["image", "video", "audio", "document"]),
  mimeType: z.string().max(100),
  fileName: z.string().max(255).optional(),
});

export type MediaFileCreateServerInput = z.infer<typeof mediaFileCreateServerSchema>;
```

#### mediaFileUpdateSchema
```typescript
export const mediaFileUpdateSchema = z.object({
  fileKey: z.string().max(500).optional(),
  fileUrl: z.string().url().max(2048).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  downloadStatus: z.enum(["pending", "downloading", "completed", "failed"]).optional(),
  downloadAttempts: z.number().int().nonnegative().optional(),
  lastError: z.string().max(1000).optional(),
  updatedAt: z.date().optional(),
});
```

#### mediaFileListQuerySchema
```typescript
export const mediaFileListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  fileType: z.enum(["image", "video", "audio", "document"]).optional(),
  downloadStatus: z.enum(["pending", "downloading", "completed", "failed"]).optional(),
});
```

#### mediaDownloadRequestSchema
```typescript
export const mediaDownloadRequestSchema = z.object({
  companyId: z.number().int().positive(),
  whatsappAccountId: z.number().int().positive(),
  providerMediaId: z.string().max(255),
  providerMediaUrl: z.string().url().max(2048),
  mediaFileId: z.number().int().positive(),
  fileType: z.enum(["image", "video", "audio", "document"]),
  mimeType: z.string().max(100),
});
```

### Refinements
- Validate file size limits (Image: 5MB, Video: 16MB, Audio: 16MB, Document: 100MB)
- Validate MIME type matches file type
- Validate URL is from WhatsApp domain (lookaside.fbsbx.com)

### Shared Types Exported
- `MediaFileResponse`
- `MediaFileListResponse`
- `MediaDownloadStatus`

---

## 6) Service Layer Plan

### Service Methods

#### MediaFileService

```typescript
class MediaFileService {
  // Create media file record (pending download)
  static create(data: MediaFileCreateServerInput): Promise<Result<MediaFileResponse>>

  // Download media from WhatsApp and store locally
  static downloadFromProvider(
    companyId: number,
    whatsappAccountId: number,
    providerMediaId: string,
    providerMediaUrl: string,
    mediaFileId: number
  ): Promise<Result<{ fileUrl: string; fileSize: number }>>

  // Retry failed downloads
  static retryFailedDownloads(companyId: number, maxAttempts: number): Promise<Result<RetrySummary>>

  // Get media by message ID
  static getByMessageId(messageId: number): Promise<Result<MediaFileResponse>>

  // List media for conversation
  static listByConversation(
    conversationId: number,
    cursor?: string,
    limit?: number,
    filters?: MediaFilters
  ): Promise<Result<MediaFileListResponse>>

  // Update download status
  static updateDownloadStatus(
    mediaFileId: number,
    status: DownloadStatus,
    metadata?: Partial<MediaFileMetadata>
  ): Promise<Result<void>>

  // Delete media file (soft delete)
  static delete(mediaFileId: number): Promise<Result<void>>
}
```

### Transaction Boundaries
- **create**: Single transaction (insert media file, update message with mediaFileId)
- **downloadFromProvider**: Transaction for updating status, file storage is external
- **retryFailedDownloads**: Batch transaction (update multiple records)
- **delete**: Transaction (soft delete media file, nullify message reference)

### Safety Rules
- Always filter by `companyId` and `isActive`
- Select only required columns
- Use `returning()` clause for inserts/updates
- Validate file size before storage
- Sanitize filenames to prevent path traversal

### Performance Logging Points
- `MediaFileService.create`: Record creation time
- `MediaFileService.downloadFromProvider`: Record download duration, file size
- `MediaFileService.retryFailedDownloads`: Record batch size, success rate
- `MediaFileService.listByConversation`: Record query time, result count

### Result Mapping
- **Success**: `Result.ok(data)` with media file or summary
- **Validation Error**: `Result.validation(message)`
- **Not Found**: `Result.notFound(message)`
- **Download Failed**: `Result.fail(message)` with retry info
- **Storage Error**: `Result.internal(message)`

---

## 7) UI/UX Plan (shadcn + TanStack)

### Screens/Components to Add

#### MessageList Component Updates
- **MediaMessageItem**: Display media messages with appropriate viewer
  - Image: `<img>` with lightbox on click
  - Video: `<video>` with custom controls
  - Audio: `<audio>` with waveform visualization
  - Document: File icon with download button

- **MediaPreviewPopover**: Quick preview of media in chat
  - Thumbnail for images/videos
  - File info for documents
  - Download/Open action

- **MediaGalleryModal**: Full-screen gallery for conversation media
  - Grid layout for images
  - Filter by media type
  - Pagination
  - Download all option

#### New Components

#### MediaViewer Component
```typescript
// Universal media viewer component
<MediaViewer
  type="image" | "video" | "audio" | "document"
  url={string}
  mimeType={string}
  fileName={string}
  onDownload={() => void}
  onFullscreen={() => void}
/>
```

#### ImageLightbox Component
```typescript
<ImageLightbox
  images={Array<{ url: string; thumbnail: string; alt: string }>}
  initialIndex={number}
  isOpen={boolean}
  onClose={() => void}
/>
```

#### VideoPlayer Component
```typescript
<VideoPlayer
  src={string}
  poster={string}
  controls={boolean}
  autoplay={boolean}
  onTimeUpdate={(time) => void}
/>
```

#### AudioPlayer Component
```typescript
<AudioPlayer
  src={string}
  waveform={boolean}
  onPlay={() => void}
  onPause={() => void}
/>
```

#### FileDownloadButton Component
```typescript
<FileDownloadButton
  url={string}
  fileName={string}
  fileSize={number}
  mimeType={string}
/>
```

### Forms
No forms required for received media (system-triggered).

### Table
- **MediaGalleryTable**: Display all media in conversation
  - Columns: Thumbnail, Type, Name, Size, Date, Actions
  - Filters: Media type, date range
  - Sort: Date, size, name
  - Pagination: Cursor-based

### Empty/Loading/Error States
- **Empty**: "No media in this conversation" with illustration
- **Loading**: Skeleton loader for media items
- **Error**: "Failed to load media" with retry button
- **Download Failed**: "Media download failed" with retry indicator

### Toast Strategy (Sonner)
- Success: "Media downloaded successfully"
- Error: "Failed to download media: {error}"
- Warning: "Media download in progress..."
- Info: "Media will be available shortly"

---

## 8) Hook/State Plan

### Hooks to Create

#### useMediaByMessage
```typescript
const { data: media, isLoading, error } = useMediaByMessage(messageId);

// React Query wrapper
// Cache key: ['media', 'message', messageId]
// Stale time: 5 minutes
```

#### useMediaByConversation
```typescript
const {
  data: mediaList,
  isLoading,
  error,
  hasNextPage,
  fetchNextPage,
} = useMediaByConversation(conversationId, { limit, fileType });

// Infinite scroll with cursor pagination
// Cache key: ['media', 'conversation', conversationId]
```

#### useMediaDownload
```typescript
const { downloadMedia, isDownloading, progress } = useMediaDownload();

// Manual download trigger (for user-initiated downloads)
// Optimistic UI updates
```

#### useMediaGallery
```typescript
const {
  media,
  filters,
  setFilter,
  openGallery,
  closeGallery,
  selectedMedia,
} = useMediaGallery(conversationId);

// Zustand store for gallery state
// Filter by media type
// Keyboard navigation
```

### Local State (Zustand)

#### MediaGalleryStore
```typescript
interface MediaGalleryStore {
  isOpen: boolean;
  conversationId: number | null;
  selectedMediaId: number | null;
  filters: {
    type: "all" | "image" | "video" | "audio" | "document";
    dateRange: [Date, Date] | null;
  };
  openGallery: (conversationId: number, mediaId?: number) => void;
  closeGallery: () => void;
  setFilter: (type: string) => void;
  nextMedia: () => void;
  prevMedia: () => void;
}
```

### Optimistic Updates
- Update message preview immediately when media is received
- Show placeholder thumbnail while downloading
- Update download status in real-time

---

## 9) Security & Compliance

### Auth Requirements
- **Webhook Processing**: No user session (system service)
- **Media Viewing**: User must have access to the conversation (company membership)
- **Media Downloading**: Requires valid WhatsApp access token
- **Media Deletion**: Only users with conversation edit permissions

### Row-Level Tenant Enforcement
- Service layer always filters by `companyId`
- Database constraints enforce tenant isolation
- File storage paths include `companyId` for isolation

### Data Validation at Boundaries
- **Webhook**: Validate payload structure, verify signature
- **Download**: Validate URL domain, file size, MIME type
- **Storage**: Sanitize filenames, prevent path traversal
- **Display**: Escape URLs, validate content types

### Security Considerations
- **XSS**: Media URLs are trusted (from our storage), but still escape
- **CSRF**: Not applicable for webhook (POST only)
- **File Upload**: Validate file signatures (magic bytes), not just MIME type
- **Access Control**: Media URLs should be signed or require authentication
- **Rate Limiting**: Limit concurrent downloads per company

---

## 10) Testing Plan

### Unit Tests (Service Methods)
- `MediaFileService.create`: Valid and invalid inputs
- `MediaFileService.downloadFromProvider`: Success, network error, expired URL
- `MediaFileService.retryFailedDownloads`: Batch processing, max attempts
- `MediaFileService.getByMessageId`: Found, not found, inactive
- `MediaFileService.listByConversation`: Pagination, filters, sorting

### Integration Tests (DB + Service)
- Create message with media → webhook processing → media download
- Retry failed downloads → verify status updates
- Delete conversation → verify media cascade deletion
- List media with filters → verify correct results

### UI Tests (Critical Flows)
- Receive image message → display in chat
- Click image → open lightbox
- Navigate gallery → keyboard shortcuts
- Download media → verify file
- Failed download → show error state

### Edge Cases Checklist
- [ ] Expired temporary URL
- [ ] File too large
- [ ] Unsupported file type
- [ ] Network timeout during download
- [ ] Concurrent downloads for same media
- [ ] Media file deleted from storage
- [ ] Corrupted media file
- [ ] Zero-byte file
- [ ] Invalid MIME type
- [ ] Path traversal in filename
- [ ] Duplicate media IDs
- [ ] Message deleted before media download

---

## 11) Performance & Observability

### Query Cost Risks + Mitigations
- **Large media files**: Stream downloads, don't buffer in memory
- **Many media in conversation**: Cursor pagination, lazy loading
- **Failed download retries**: Exponential backoff, max attempts
- **Gallery view**: Thumbnail generation, CDN caching

### Required Indexes Recap
1. `media_files_message_unique` - One-to-one with messages
2. `media_files_company_id_idx` - Multi-tenant filtering
3. `media_files_conversation_id_idx` - Conversation media listing
4. `media_files_download_status_idx` - Pending/failed downloads
5. `media_files_company_status_attempts_idx` - Retry logic
6. `media_files_company_created_id_idx` - Cursor pagination

### Logging/Metrics Events
- `media_download_started`: MediaFileId, FileType, CompanyId
- `media_download_completed`: MediaFileId, FileSize, Duration
- `media_download_failed`: MediaFileId, Error, Attempts
- `media_retry_triggered`: CompanyId, RetryCount
- `media_viewed`: MediaFileId, UserId, FileType
- `media_gallery_opened`: ConversationId, UserId

### N+1 Avoidance
- Use `JOIN` when fetching messages with media
- Batch media queries for conversation gallery
- Preload thumbnails for gallery view

### Batching/Debouncing
- Batch failed download retries (run every 5 minutes)
- Debounce gallery filter changes (300ms)
- Throttle download progress updates (1 second)

---

## 12) Delivery Checklist

### Files/Folders to Create

#### Database
- `db/schema.ts` - Add media_files table and update messages table
- `db/drizzle/0006_add_media_files.sql` - Migration file

#### Feature: media-files
- `features/media-files/schemas/media-file-schema.ts`
- `features/media-files/services/media-file.service.ts`
- `features/media-files/services/media-download.service.ts`
- `features/media-files/actions/media-file.actions.ts`
- `features/media-files/hooks/use-media-by-message.ts`
- `features/media-files/hooks/use-media-by-conversation.ts`
- `features/media-files/hooks/use-media-gallery.ts`
- `features/media-files/store/media-gallery.store.ts`
- `features/media-files/components/media-viewer.tsx`
- `features/media-files/components/image-lightbox.tsx`
- `features/media-files/components/video-player.tsx`
- `features/media-files/components/audio-player.tsx`
- `features/media-files/components/file-download-button.tsx`
- `features/media-files/components/media-gallery-modal.tsx`
- `features/media-files/components/media-preview-popover.tsx`

#### Update Existing Files
- `features/whatsapp-webhook/services/webhook-ingest.service.ts` - Add media processing
- `features/conversations/components/message-list.tsx` - Add media rendering
- `features/conversations/components/message-item.tsx` - Update for media support
- `features/conversations/hooks/use-conversation-messages.ts` - Include media data

#### Shared Libs
- `lib/media-storage.ts` - File storage abstraction (local/S3)
- `lib/media-downloader.ts` - WhatsApp media download helper
- `lib/media-validator.ts` - File validation utilities

### Order of Implementation

#### Phase 1: Database & Foundation
1. Create migration for media_files table
2. Update messages table with mediaFileId column
3. Run migration
4. Create media storage abstraction layer

#### Phase 2: Core Services
5. Implement MediaFileService (CRUD operations)
6. Implement MediaDownloadService (download logic)
7. Add background job for retrying failed downloads

#### Phase 3: Webhook Integration
8. Update WebhookIngestService to create media file records
9. Trigger media download on webhook processing
10. Handle download failures and retries

#### Phase 4: Actions & Hooks
11. Create media file server actions
12. Create React Query hooks for media queries
13. Create Zustand store for gallery state

#### Phase 5: UI Components
14. Implement MediaViewer component
15. Implement ImageLightbox component
16. Implement VideoPlayer component
17. Implement AudioPlayer component
18. Implement FileDownloadButton component
19. Implement MediaGalleryModal component
20. Implement MediaPreviewPopover component

#### Phase 6: Integration
21. Update MessageList to render media messages
22. Add media gallery button to conversation header
23. Connect media download progress indicators
24. Add error handling and retry UI

#### Phase 7: Testing & Polish
25. Write unit tests for services
26. Write integration tests for webhook flow
27. Test UI components manually
28. Performance testing with large media files
29. Security audit (file validation, access control)
30. Documentation and deployment

### Definition of Done
- [ ] Database migration created and tested
- [ ] Media files are downloaded and stored when received via webhook
- [ ] Failed downloads are retried automatically
- [ ] Media messages display correctly in chat interface
- [ ] Image lightbox works with keyboard navigation
- [ ] Video/audio players have custom controls
- [ ] Document downloads work with correct filenames
- [ ] Media gallery shows all media in conversation
- [ ] Filters work in media gallery
- [ ] Download progress is visible to users
- [ ] Error states are handled gracefully
- [ ] All services have Result<T> returns
- [ ] All queries are scoped by companyId
- [ ] All indexes are created and tested
- [ ] Unit tests pass (90%+ coverage)
- [ ] Integration tests pass
- [ ] Manual testing completed
- [ ] Code follows project conventions
- [ ] No TypeScript errors
- [ ] Linting passes
