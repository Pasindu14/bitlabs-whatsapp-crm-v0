---
feature_name: Image Messaging with UploadThing
date: 2025-01-07
plan_number: 05
---

# Feature Master Plan: Image Messaging with UploadThing

## 1) Feature Summary

### Goal
Enable users to send images via WhatsApp conversations by integrating UploadThing for file hosting and extending the existing messaging system to support media attachments.

### Actors & Permissions
- **Authenticated Users**: Can send images in conversations (same permissions as text messaging)
- **Multi-Tenant**: All image uploads and messages scoped by `companyId`

### Primary Flows
1. **Image Selection**: User clicks attachment button (+) next to message input, selects image from device
2. **Image Preview**: Selected image appears in preview area with remove option
3. **Image Upload**: When user sends message, image is uploaded to UploadThing first
4. **Message Send**: After successful upload, image URL is sent to WhatsApp API via media message
5. **Message Display**: Sent messages display image thumbnails in the conversation

### Assumptions
- UploadThing token is already provided: `UPLOADTHING_TOKEN='eyJhcGlLZXkiOiJza19saXZlXzc1YWNkMGZhM2JhNWUzZDc0N2E4ZDBiNzI3ZGI2OWZjNjQ5MGZkZTY1MzRhMDY5ZjNlZGUwMjAwM2VhN2Y1NGEiLCJhcHBJZCI6ImtuaDZvaTl2d28iLCJyZWdpb25zIjpbInNlYTEiXX0='`
- Current `messagesTable` already has `mediaUrl` and `mediaType` columns (schema already supports media)
- Future extension: Audio support will follow similar pattern (not in scope for this plan)
- Max image size: 4MB (WhatsApp limit)
- Supported formats: JPEG, PNG, WEBP

---

## 2) Domain Model

### Entities

#### Message (existing, extended)
- **Definition**: Represents a message in a conversation, can now include media
- **Fields**: content (text), mediaUrl (UploadThing URL), mediaType (image/audio), status, direction
- **State Machine**: sending → sent/delivered/read/failed

#### FileUpload (new)
- **Definition**: Represents a file uploaded to UploadThing
- **Fields**: fileKey, fileName, fileUrl, fileSize, fileType, uploadedBy, companyId
- **Lifecycle**: pending → uploading → completed/failed

### Relationships
- **Message → FileUpload**: 1-1 (a message can have one attachment)
- **FileUpload → User**: many-1 (uploaded by user)
- **FileUpload → Company**: many-1 (scoped to company)

---

## 3) Database Design (Postgres/Drizzle)

### Tables

#### file_uploads (NEW)
```typescript
export const fileUploadsTable = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversationsTable.id).notNull(),
  fileKey: text("file_key").notNull().unique(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(), // bytes
  fileType: text("file_type").notNull(), // "image/jpeg", "image/png", etc
  mimeType: text("mime_type").notNull(),
  uploadedBy: integer("uploaded_by").references((): any => usersTable.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  // Primary query index: company_id
  index("file_uploads_company_id_idx").on(table.companyId.asc()),
  
  // Lookup by file_key (for UploadThing callbacks)
  uniqueIndex("file_uploads_file_key_unique").on(table.fileKey.asc()),
  
  // Find uploads by conversation
  index("file_uploads_conversation_id_idx").on(table.conversationId.asc()),
  
  // Find uploads by user
  index("file_uploads_uploaded_by_idx").on(table.uploadedBy.asc()),
  
  // Composite index for cursor pagination
  index("file_uploads_company_created_id_idx").on(table.companyId.asc(), table.createdAt.desc(), table.id.asc()),
  
  // Filter by file type
  index("file_uploads_company_file_type_idx").on(table.companyId.asc(), table.fileType.asc()),
]);
```

#### messages (EXISTING - verify columns)
```typescript
// Verify these columns exist (they should based on schema.ts):
mediaUrl: text("media_url"),      // Already exists - will store UploadThing URL
mediaType: text("media_type"),    // Already exists - will store "image", "audio", etc
```

### Indexes Summary
- `file_uploads_company_id_idx`: Company-scoped queries
- `file_uploads_file_key_unique`: UploadThing key lookups
- `file_uploads_conversation_id_idx`: Conversation attachment queries
- `file_uploads_uploaded_by_idx`: User upload history
- `file_uploads_company_created_id_idx`: Cursor pagination
- `file_uploads_company_file_type_idx`: Type filtering

### Expected Queries
1. **Get conversation attachments**: `SELECT * FROM file_uploads WHERE conversation_id = ?`
2. **Get user uploads**: `SELECT * FROM file_uploads WHERE uploaded_by = ? AND company_id = ?`
3. **Get by file key**: `SELECT * FROM file_uploads WHERE file_key = ?`
4. **List uploads with pagination**: `SELECT * FROM file_uploads WHERE company_id = ? ORDER BY created_at DESC LIMIT ?`

### Migration Steps
1. Create `file_uploads` table with all columns
2. Add indexes
3. No backfill needed (new table)
4. Add foreign key constraints
5. Verify `messagesTable` has `mediaUrl` and `mediaType` columns (already present)

---

## 4) API / Server Actions Contract

### UploadThing API Route (NEW)
**Route**: `POST /api/uploadthing`

**Purpose**: Handle UploadThing file upload callbacks

**Input**: UploadThing multipart/form-data

**Output**: UploadThing response with file metadata

### Send Message API Route (MODIFIED)
**Route**: `POST /api/conversations/send-message`

**Current Input**:
```typescript
{
  companyId: number;
  recipientPhoneNumber: string;
  text: string;
  phoneNumberId: string;
  accessToken: string;
}
```

**New Input** (extended):
```typescript
{
  companyId: number;
  recipientPhoneNumber: string;
  text?: string;  // Optional for image-only messages
  phoneNumberId: string;
  accessToken: string;
  type: "text" | "image";  // NEW
  mediaUrl?: string;       // NEW - UploadThing URL
  mediaId?: string;        // NEW - WhatsApp media ID (after upload)
}
```

**Output**: Same as current (success + messageId)

**Error Cases**:
- Validation error (missing required fields)
- UploadThing upload failed
- WhatsApp API send failed
- File size exceeded
- Invalid file type

### Server Actions

#### sendNewMessageAction (MODIFIED)
**Input** (extended):
```typescript
{
  phoneNumber: string;
  messageText?: string;  // Optional
  imageUrl?: string;     // NEW - UploadThing URL
  imageKey?: string;     // NEW - UploadThing file key
}
```

**Output**: Same as current

#### uploadImageAction (NEW)
**Input**:
```typescript
{
  file: File;
  companyId: number;
  userId: number;
}
```

**Output**:
```typescript
{
  fileKey: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}
```

**Error Cases**:
- File too large (>4MB)
- Invalid file type
- UploadThing API error
- Unauthorized

### Pagination Strategy
- Not applicable for single file uploads
- Future: List user uploads with cursor pagination

---

## 5) Validation (Zod)

### New Schemas

#### fileUploadSchema
```typescript
export const FILE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type FileType = (typeof FILE_TYPES)[number];

export const fileUploadClientSchema = z.object({
  file: z.instanceof(File)
    .refine((f) => f.size <= 2 * 1024 * 1024, "File size must be less than 2MB")
    .refine((f) => FILE_TYPES.includes(f.type as FileType), "Invalid file type. Supported: JPEG, PNG, WEBP"),
});

export type FileUploadInput = z.infer<typeof fileUploadClientSchema>;
```

#### sendMessageWithImageClientSchema (extends existing)
```typescript
export const sendMessageWithImageClientSchema = z.object({
  phoneNumber: phoneNumberSchema,
  messageText: messageTextSchema.optional(), // Optional for image-only messages
  imageUrl: z.string().url().optional(),
  imageKey: z.string().min(1).optional(),
}).refine(
  (data) => data.messageText || data.imageUrl,
  "Either messageText or imageUrl is required"
);

export type SendMessageWithImageInput = z.infer<typeof sendMessageWithImageClientSchema>;
```

#### sendMessageWithImageServerSchema
```typescript
export const sendMessageWithImageServerSchema = sendMessageWithImageClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type SendMessageWithImageServerInput = z.infer<typeof sendMessageWithImageServerSchema>;
```

#### fileUploadResponseSchema
```typescript
export const fileUploadResponseSchema = z.object({
  fileKey: z.string(),
  fileUrl: z.string().url(),
  fileName: z.string(),
  fileSize: z.number().int().positive(),
  fileType: z.enum(FILE_TYPES),
});

export type FileUploadResponse = z.infer<typeof fileUploadResponseSchema>;
```

### Refinements
- File size: max 2MB
- File type: only JPEG, PNG, WEBP
- At least one of messageText or imageUrl required

---

## 6) Service Layer Plan

### UploadThingService (NEW)
**Location**: `lib/uploadthing-service.ts`

**Methods**:
1. `uploadImage(file: File, companyId: number, userId: number): Promise<Result<FileUploadResponse>>`
   - Uploads file to UploadThing via API
   - Saves metadata to `file_uploads` table
   - Returns file URL and metadata

2. `deleteFile(fileKey: string, companyId: number): Promise<Result<void>>`
   - Deletes file from UploadThing
   - Marks record as inactive

3. `getFileByKey(fileKey: string, companyId: number): Promise<Result<FileUploadResponse>>`
   - Retrieves file metadata from database

**Transaction Boundaries**:
- Upload to UploadThing (external API) - NOT in transaction
- Save to database - separate transaction

**Safety Rules**:
- Validate file size and type before upload
- Use environment variable for UploadThing token
- Log all upload attempts
- Handle UploadThing API errors gracefully

**Performance Logging**:
- `UploadThingService.uploadImage`: log file size, upload duration
- `UploadThingService.deleteFile`: log delete operation

### MessageService (MODIFIED)
**Location**: `features/conversations/services/message-service.ts`

**Modified Method**:
```typescript
static async sendNewMessage(input: SendMessageWithImageServerInput): Promise<Result<SendNewMessageOutput>>
```

**Changes**:
- Accept optional `imageUrl` and `imageKey`
- If image provided:
  - Validate image exists in `file_uploads` table
  - Set `mediaUrl` and `mediaType` on message
  - Call WhatsApp API with image payload
- If no image:
  - Use existing text message logic

**Transaction Boundaries**:
- Single transaction for message + contact + conversation creation
- WhatsApp API call outside transaction (after commit)

**Safety Rules**:
- Verify image belongs to same company
- Use safe selects (only needed columns)
- Return clause for message ID

**Performance Logging**:
- `MessageService.sendNewMessage`: log message type (text/image), duration

---

## 7) UI/UX Plan (shadcn + TanStack)

### Components to Add/Modify

#### MessageInput (MODIFIED)
**Location**: `features/conversations/components/message-input.tsx`

**Changes**:
1. Replace `openNewMessageModal` on Plus button with image attachment popover
2. Add image preview area (hidden when no image selected)
3. Add remove image button (X icon)
4. Update send button to handle image uploads

**New UI Elements**:
- Attachment button (Plus icon) with popover
- Image preview thumbnail
- Remove image button
- Upload progress indicator

#### ImageAttachmentPopover (NEW)
**Location**: `features/conversations/components/image-attachment-popover.tsx`

**Features**:
- File input for image selection
- Drag and drop support
- File type validation
- File size validation
- Upload to UploadThing button

**States**:
- Idle (show upload button)
- Uploading (show progress)
- Success (show preview)
- Error (show error message)

#### MessageBubble (MODIFIED)
**Location**: `features/conversations/components/message-bubble.tsx` (if exists, else create)

**Changes**:
- Display image thumbnail if `mediaUrl` exists
- Click to open full-size image
- Show image caption if provided

### Forms
- No new forms (uses existing message input)
- File validation in component

### Table
- Not applicable for this feature

### Empty/Loading/Error States
- **Empty**: No image selected
- **Loading**: Upload progress bar
- **Error**: Error toast with retry option

### Toast Strategy (Sonner)
- Success: "Image uploaded successfully"
- Error: "Failed to upload image: {error}"
- Warning: "File too large (max 2MB)"

---

## 8) Hook/State Plan

### Hooks to Create

#### useUploadImage (NEW)
**Location**: `features/conversations/hooks/use-upload-image.ts`

**Usage**:
```typescript
const { uploadImage, isUploading, error } = useUploadImage();
```

**React Query**:
- Mutation: `uploadImageAction`
- Cache key: `['upload', 'image']`
- Invalidate: none (no dependent queries)

**Error Handling**:
- Throw errors for UI to handle
- Show toast notifications

#### useSendMessageWithImage (MODIFIED)
**Location**: `features/conversations/hooks/conversation-hooks.ts`

**Changes**:
- Extend `useSendNewMessage` to accept optional image data
- Handle image upload before message send
- Invalidate message queries on success

**React Query**:
- Mutation: `sendNewMessageAction`
- Cache keys: `['conversations']`, `['messages', conversationId]`
- Invalidation: both on success

### Local State (Zustand)
**Location**: `features/conversations/store/conversation-store.ts`

**New State**:
```typescript
selectedImage: {
  file: File;
  previewUrl: string;
  uploadUrl?: string;
  uploadKey?: string;
} | null;
```

**New Actions**:
- `setSelectedImage(image: File | null)`
- `clearSelectedImage()`
- `setUploadedImage(url: string, key: string)`

---

## 9) Security & Compliance

### Auth Requirements
- **Session**: User must be authenticated (handled by `withAction`)
- **Role Checks**: Same as text messaging (all authenticated users)

### Row-Level Tenant Enforcement
- **Service Layer**: Filter `file_uploads` by `companyId`
- **UploadThing**: Include `companyId` in file metadata
- **WhatsApp API**: Verify phone number belongs to company

### Data Validation at Boundaries
- **Client**: File size, file type, required fields
- **Service**: Verify image ownership, validate URLs
- **API**: Recipient phone number format, access token

### Security Considerations
- UploadThing token stored in environment variables
- File URLs are public (UploadThing default) - acceptable for WhatsApp
- No sensitive data in file metadata
- Rate limiting on uploads (future enhancement)

---

## 10) Testing Plan

### Unit Tests
- `UploadThingService.uploadImage`: mock UploadThing API, test success/error paths
- `UploadThingService.deleteFile`: test deletion logic
- `MessageService.sendNewMessage`: test with image, test without image
- Schema validation: test file size limits, file type validation

### Integration Tests
- Upload image → send message → verify in database
- Send image message → verify WhatsApp API call
- Upload failure → error handling
- Delete image → cleanup

### UI Tests
- Click attachment button → popover opens
- Select image → preview shows
- Remove image → preview clears
- Send with image → upload progress → success
- Upload error → error message shows

### Edge Cases Checklist
- File too large (>4MB)
- Invalid file type (PDF, video, etc)
- Network error during upload
- UploadThing API down
- WhatsApp API rejects image
- User cancels upload
- Multiple rapid uploads
- Image with caption
- Image-only message (no text)
- Text + image message

---

## 11) Performance & Observability

### Query Cost Risks + Mitigations
- **Risk**: Large file uploads blocking UI
  - **Mitigation**: Show progress indicator, non-blocking uploads
- **Risk**: N+1 queries when loading messages with images
  - **Mitigation**: Eager load file_uploads, use JOIN
- **Risk**: Slow image loading in conversation
  - **Mitigation**: Lazy load images, use thumbnails

### Required Indexes Recap
- `file_uploads_company_id_idx`: Company queries
- `file_uploads_file_key_unique`: Key lookups
- `file_uploads_message_id_idx`: Message attachments
- `file_uploads_uploaded_by_idx`: User uploads
- `file_uploads_company_created_id_idx`: Pagination
- `file_uploads_company_file_type_idx`: Type filtering

### Logging/Metrics Events
- `upload_image_start`: file size, file type, user ID
- `upload_image_success`: duration, file URL
- `upload_image_error`: error message
- `send_image_message_start`: message ID, image URL
- `send_image_message_success`: WhatsApp message ID
- `send_image_message_error`: error message

### N+1 Avoidance
- Load message attachments in single query with JOIN
- Batch file uploads if needed (future)
- Cache UploadThing responses (future)

---

## 12) Delivery Checklist

### Files/Folders to Create
1. `db/schema/file-uploads.ts` - New table definition
2. `lib/uploadthing-service.ts` - UploadThing integration service
3. `app/api/uploadthing/core.ts` - UploadThing FileRouter
4. `app/api/uploadthing/route.ts` - UploadThing API route handler
5. `features/conversations/components/image-attachment-popover.tsx` - Image upload UI
6. `features/conversations/hooks/use-upload-image.ts` - Upload hook
7. `drizzle/migrations/XXXX_add_file_uploads.sql` - Database migration

### Files/Folders to Modify
1. `db/schema.ts` - Add file_uploads table and relations
2. `app/api/conversations/send-message/route.ts` - Support image messages
3. `features/conversations/components/message-input.tsx` - Add attachment UI
4. `features/conversations/schemas/conversation-schema.ts` - Add image schemas
5. `features/conversations/services/message-service.ts` - Handle image messages
6. `features/conversations/actions/message-actions.ts` - Add upload action
7. `features/conversations/hooks/conversation-hooks.ts` - Add upload hook
8. `features/conversations/store/conversation-store.ts` - Add image state
9. `.env` - Add UPLOADTHING_TOKEN
10. `package.json` - Add uploadthing dependencies

### Order of Implementation
1. **Database**: Create migration for `file_uploads` table
2. **Infrastructure**: Install UploadThing packages, add env var
3. **Service Layer**: Create `UploadThingService`
4. **API Routes**: Set up UploadThing FileRouter and route
5. **Schemas**: Add validation schemas for images
6. **Actions**: Add `uploadImageAction`
7. **Hooks**: Create `useUploadImage` hook
8. **UI Components**: Create `ImageAttachmentPopover`
9. **Modify MessageInput**: Integrate attachment UI
10. **Modify Send Message API**: Support image payloads
11. **Modify MessageService**: Handle image messages
12. **Testing**: Test all flows

### Definition of Done
- [ ] Database migration created and applied
- [ ] UploadThing service integrated and tested
- [ ] Image upload API route working
- [ ] Attachment UI implemented in message input
- [ ] Image preview shows before send
- [ ] Images upload to UploadThing successfully
- [ ] Images send via WhatsApp API successfully
- [ ] Sent messages display image thumbnails
- [ ] Error handling for all failure scenarios
- [ ] All tests passing
- [ ] Lint clean
- [ ] Documentation updated (README)
