---
feature: Conversation Notes (part of Conversations feature)
date: 2025-01-04
plan_number: 01
---

# Conversation Notes Feature Plan

## 1) Feature Summary

### Goal
Enable users to add, view, update, and delete notes for conversations. Notes provide a way to document important information, context, or action items related to WhatsApp conversations.

**Note**: This is NOT a separate feature. All note functionality is part of the existing `conversations` feature, but with separate files for organization.

### Actors & Permissions
- **All authenticated users**: Can create notes on conversations they have access to (within their company)
- **Note creator**: Can update/delete their own notes
- **Admins/Managers**: Can view all notes, potentially update/delete any note (future enhancement)
- **Multi-tenant enforcement**: All note operations scoped by `companyId`

### Primary Flows
1. **Create note**: User clicks 3-dot menu in conversation header → "Add Note" → enters note content → saves
2. **View notes**: Notes displayed in conversation detail panel below messages, ordered by creation date (newest first)
3. **Update note**: User clicks 3-dot menu in conversation header → "Edit Note" (if note exists) → edits content → saves
4. **Delete note**: User clicks delete button on note card → confirms deletion
5. **List notes**: Fetch all notes for a specific conversation

### Assumptions
- Notes are text-based with basic formatting (bold, italic, lists, links)
- Each note belongs to exactly one conversation
- Multiple notes per conversation allowed
- Notes are not versioned (simple CRUD)
- Notes are not shared across conversations
- Rich text editor needed for better UX (Tiptap recommended)
- 3-dot menu in conversation header provides access to note operations

---

## 2) Domain Model

### Entities

**ConversationNote**
- Represents a single note attached to a conversation
- Contains rich text content, metadata, and audit fields
- Belongs to: Conversation, User (creator), Company

### Relationships
- **Conversation → ConversationNotes**: One-to-Many (one conversation has many notes)
- **User → ConversationNotes**: One-to-Many (one user creates many notes)
- **Company → ConversationNotes**: One-to-Many (one company has many notes)

### State Machine
No complex state machine needed. Notes are active or soft-deleted:
- `isActive: true` → `isActive: false` (soft delete)

---

## 3) Database Design (Postgres/Drizzle)

### Table: `conversation_notes`

```typescript
export const conversationNotesTable = pgTable("conversation_notes", {
  // Primary key
  id: serial("id").primaryKey(),

  // Foreign keys
  conversationId: integer("conversation_id")
    .references(() => conversationsTable.id)
    .notNull(),
  companyId: integer("company_id")
    .references(() => companiesTable.id)
    .notNull(),
  createdBy: integer("created_by")
    .references(() => usersTable.id)
    .notNull(),
  updatedBy: integer("updated_by")
    .references(() => usersTable.id),

  // Content
  content: text("content").notNull(), // Rich text HTML/JSON from Tiptap

  // Metadata
  isPinned: boolean("is_pinned").notNull().default(false), // Pin important notes

  // Audit fields
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  // Primary query index: conversation_id + is_active
  index("conversation_notes_conversation_active_idx")
    .on(table.conversationId.asc(), table.isActive.desc()),

  // Company-scoped queries
  index("conversation_notes_company_id_idx")
    .on(table.companyId.asc()),

  // Find notes by creator
  index("conversation_notes_created_by_idx")
    .on(table.createdBy.asc()),

  // Composite index for sorting (newest first)
  index("conversation_notes_conversation_created_idx")
    .on(table.conversationId.asc(), table.createdAt.desc(), table.id.desc()),

  // Pinned notes (show first)
  index("conversation_notes_conversation_pinned_idx")
    .on(table.conversationId.asc(), table.isPinned.desc(), table.createdAt.desc()),

  // Company + conversation filtering
  index("conversation_notes_company_conversation_idx")
    .on(table.companyId.asc(), table.conversationId.asc()),
]);
```

### Indexes Rationale
1. `conversation_notes_conversation_active_idx`: Fast lookup of active notes for a conversation
2. `conversation_notes_company_id_idx`: Multi-tenant enforcement
3. `conversation_notes_created_by_idx`: Find all notes by a user
4. `conversation_notes_conversation_created_idx`: Default sort by creation date
5. `conversation_notes_conversation_pinned_idx`: Prioritize pinned notes
6. `conversation_notes_company_conversation_idx`: Company-scoped conversation queries

### Expected Queries
- **List notes by conversation**: `WHERE conversationId = ? AND isActive = true ORDER BY isPinned DESC, createdAt DESC`
- **Get note by ID**: `WHERE id = ? AND companyId = ? AND isActive = true`
- **Create note**: `INSERT` with returning
- **Update note**: `UPDATE WHERE id = ? AND companyId = ? AND isActive = true`
- **Delete note**: `UPDATE SET isActive = false WHERE id = ? AND companyId = ?`

### Migration Steps
1. Create `conversation_notes` table with all columns
2. Create all indexes
3. Add relation in Drizzle schema
4. No backfill needed (new feature)

---

## 4) API / Server Actions Contract

**Note**: All note actions are in the separate `features/conversations/actions/note-actions.ts` file

### Actions List (in note-actions.ts)

**`createConversationNoteAction`**
- Input: `{ conversationId: number, content: string, isPinned?: boolean }`
- Output: `ConversationNoteResponse`
- Errors: Validation error, conversation not found, unauthorized

**`updateConversationNoteAction`**
- Input: `{ noteId: number, content: string, isPinned?: boolean }`
- Output: `ConversationNoteResponse`
- Errors: Validation error, note not found, unauthorized (not creator)

**`deleteConversationNoteAction`**
- Input: `{ noteId: number }`
- Output: `{ success: boolean }`
- Errors: Note not found, unauthorized (not creator)

**`listConversationNotesAction`**
- Input: `{ conversationId: number, limit?: number, cursor?: string }`
- Output: `{ notes: ConversationNoteResponse[], nextCursor?: string, hasMore: boolean }`
- Errors: Conversation not found, unauthorized

**`getConversationNoteAction`**
- Input: `{ noteId: number }`
- Output: `ConversationNoteResponse`
- Errors: Note not found, unauthorized

**`getUserNoteForConversationAction`**
- Input: `{ conversationId: number }`
- Output: `ConversationNoteResponse | null`
- Errors: Conversation not found, unauthorized
- Purpose: Used to determine "Edit Note" menu item visibility

### Pagination Strategy
- Cursor-based pagination using `createdAt` + `id`
- Default limit: 20 notes per page
- Order: Pinned first, then newest first

---

## 5) Validation (Zod)

**Note**: All note schemas are in the separate `features/conversations/schemas/note-schema.ts` file

### Schemas (in note-schema.ts)

```typescript
// Constants
export const NOTE_CONTENT_MIN_LENGTH = 1;
export const NOTE_CONTENT_MAX_LENGTH = 10000;

// Client create schema
export const conversationNoteCreateClientSchema = z.object({
  conversationId: z.number().int().positive(),
  content: z.string()
    .min(NOTE_CONTENT_MIN_LENGTH, 'Note content is required')
    .max(NOTE_CONTENT_MAX_LENGTH, 'Note is too long (max 10,000 characters)'),
  isPinned: z.boolean().default(false),
});

// Server create schema (extends client + auth)
export const conversationNoteCreateServerSchema = conversationNoteCreateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(), // creator
});

// Client update schema
export const conversationNoteUpdateClientSchema = z.object({
  noteId: z.number().int().positive(),
  content: z.string()
    .min(NOTE_CONTENT_MIN_LENGTH, 'Note content is required')
    .max(NOTE_CONTENT_MAX_LENGTH, 'Note is too long (max 10,000 characters)'),
  isPinned: z.boolean().optional(),
});

// Server update schema
export const conversationNoteUpdateServerSchema = conversationNoteUpdateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(), // updater
});

// Delete schema
export const conversationNoteDeleteSchema = z.object({
  noteId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

// List schema
export const conversationNoteListSchema = z.object({
  conversationId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

// Get by ID schema
export const conversationNoteGetSchema = z.object({
  noteId: z.number().int().positive(),
});

// Response schema
export const conversationNoteResponseSchema = z.object({
  id: z.number().int(),
  conversationId: z.number().int(),
  companyId: z.number().int(),
  content: z.string(),
  isPinned: z.boolean(),
  createdBy: z.number().int(),
  updatedBy: z.number().int().nullable(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
  isActive: z.boolean(),
  // Optional: include creator info
  creator: z.object({
    id: z.number().int(),
    name: z.string(),
    email: z.string(),
  }).optional(),
});

export type ConversationNoteResponse = z.infer<typeof conversationNoteResponseSchema>;
```

---

## 6) Service Layer Plan

**Note**: All note methods are in the separate `features/conversations/services/note-service.ts` file

### Service Methods (in NoteService)

**`NoteService.create(data)`**
- Validate conversation exists and belongs to company
- Insert note with `createdBy` = current user
- Log audit entry
- Return created note

**`NoteService.update(noteId, companyId, userId, updates)`**
- Fetch note, verify ownership (creator or admin)
- Update content and optionally `isPinned`
- Set `updatedBy` = current user
- Log audit entry
- Return updated note

**`NoteService.delete(noteId, companyId, userId)`**
- Fetch note, verify ownership (creator or admin)
- Soft delete: set `isActive = false`
- Log audit entry
- Return success

**`NoteService.listForConversation(conversationId, companyId, cursor, limit)`**
- Query notes for conversation, ordered by `isPinned DESC, createdAt DESC`
- Apply cursor pagination
- Return paginated results

**`NoteService.getById(noteId, companyId)`**
- Fetch single note with creator info
- Verify company access
- Return note

**`NoteService.getUserNoteForConversation(conversationId, userId, companyId)`**
- Helper method to check if user has a note on this conversation
- Used for "Edit Note" menu item visibility
- Returns the user's note or null

### Transaction Boundaries
- All operations are single-table transactions (no cross-table transactions needed)
- Audit logging happens after main operation (non-critical)

### Safety Rules
- Always filter by `companyId` and `isActive`
- Use `.returning()` for create/update operations
- Select only needed columns (avoid `SELECT *`)
- Verify ownership before update/delete

### Performance Logging
- Log operation name + conversation ID + note count
- Measure query execution time
- Track slow queries (>100ms)

### Result Mapping
- Success: `Result.ok(data, message)`
- Not found: `Result.fail('Note not found', { code: 'NOT_FOUND' })`
- Unauthorized: `Result.fail('Unauthorized', { code: 'UNAUTHORIZED' })`
- Validation: `Result.fail('Validation error', { code: 'VALIDATION_ERROR' })`
- Internal: `Result.fail('Internal error', { code: 'INTERNAL_ERROR' })`

---

## 7) UI/UX Plan (shadcn + TanStack)

### Screens/Components

**1. ConversationNoteList** (in conversation detail panel, below messages)
- Display all notes for current conversation
- Pinned notes shown first with pin icon
- Each note shows: creator name, creation date, content, actions
- Empty state when no notes
- Loading skeleton while fetching

**2. ConversationNoteItem**
- Individual note card
- Creator avatar + name + timestamp
- Rich text content rendered safely
- Edit/Delete buttons (only for creator)
- Pin toggle button
- Collapsible for long notes

**3. CreateNoteDialog** (Dialog component, triggered from 3-dot menu)
- Modal for creating new note
- Rich text editor (Tiptap)
- Pin checkbox
- Save/Cancel buttons
- Character counter

**4. EditNoteDialog** (Dialog component, triggered from 3-dot menu)
- Same as CreateNoteDialog but for editing
- Pre-filled with existing content

**5. DeleteNoteConfirmation** (AlertDialog)
- Confirmation dialog before deletion
- "Delete" and "Cancel" buttons

**6. ConversationHeaderMenu** (3-dot menu update)
- Add "Add Note" menu item (always visible)
- Add "Edit Note" menu item (visible if user has a note on this conversation)
- Add "View Notes" menu item (scrolls to notes section)

### 3-Dot Menu Integration

The conversation header's 3-dot menu (right side) will have these note-related options:

```
┌─────────────────┐
│ Add Note        │ ← Always visible, opens CreateNoteDialog
│ Edit Note       │ ← Visible if current user has a note on this conversation
│ ─────────────── │
│ Archive         │
│ Clear Chat      │
│ Delete Chat     │
└─────────────────┘
```

**Logic for "Edit Note" visibility:**
- Check if current user has created a note for this conversation
- If yes, show "Edit Note" menu item
- If no, hide "Edit Note" menu item
- If multiple notes, show "Edit Notes" (plural) and let user select which note to edit

### Forms
- Use `react-hook-form` with `zodResolver`
- Tiptap editor integrated as custom form field
- Real-time validation
- Character limit indicator

### Rich Text Editor: Tiptap
**Why Tiptap?**
- Modern, well-maintained, excellent TypeScript support
- Extensible architecture
- Works great with React
- Mobile-friendly
- Can start simple, add features later

**Initial Features:**
- Bold, italic, underline
- Bullet and numbered lists
- Links
- Code blocks
- Clean, minimal toolbar

**Installation:**
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

### Empty/Loading/Error States
- **Empty**: "No notes yet. Add a note to document important information."
- **Loading**: Skeleton cards (3-4 placeholders)
- **Error**: "Failed to load notes. Please try again." with retry button

### Toast Strategy (Sonner)
- Success: "Note created/updated/deleted"
- Error: "Failed to save note. Please try again."
- Validation: "Note content is required"

---

## 8) Hook/State Plan

**Note**: All note hooks are in the separate `features/conversations/hooks/note-hooks.ts` file

### Hooks to Create (in note-hooks.ts)

**`useConversationNotes(conversationId)`**
- Fetches all notes for a conversation
- Uses React Query with cache key: `['conversations', 'notes', conversationId]`
- Refetches on window focus (optional)
- Stale time: 30s

**`useCreateConversationNote()`**
- Mutation for creating notes
- On success: invalidate `useConversationNotes` query
- Optimistic update (optional)

**`useUpdateConversationNote()`**
- Mutation for updating notes
- On success: invalidate `useConversationNotes` query

**`useDeleteConversationNote()`**
- Mutation for deleting notes
- On success: invalidate `useConversationNotes` query

**`useUserNoteForConversation(conversationId)`**
- Fetches the current user's note for a conversation
- Used to determine "Edit Note" menu item visibility
- Returns `ConversationNoteResponse | null`

### Local State
- Separate Zustand store in `features/conversations/store/note-store.ts`:
  - `isCreateDialogOpen: boolean`
  - `editingNoteId: number | null`
  - `isDeleteDialogOpen: boolean`
  - `deletingNoteId: number | null`

### Cache Keys (in note-hooks.ts)
```typescript
export const noteKeys = {
  all: ['conversations', 'notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  conversationList: (conversationId: number) => [...noteKeys.lists(), conversationId] as const,
  detail: (noteId: number) => [...noteKeys.all, 'detail', noteId] as const,
  userNote: (conversationId: number) => [...noteKeys.all, 'user', conversationId] as const,
};
```

### Invalidation Strategy
- Create/Update/Delete: invalidate `conversationNoteKeys.list(conversationId)`
- No cross-feature invalidation needed

---

## 9) Security & Compliance

### Auth Requirements
- User must be authenticated (session required)
- All operations scoped by `companyId` from session
- Update/delete: verify user is creator OR has admin role

### Row-Level Tenant Enforcement
- **Service layer**: Always filter by `companyId` in queries
- **DB constraints**: No FK constraint needed (company_id is included)
- **Audit logging**: Track all mutations with `changedBy`

### Data Validation at Boundaries
- **Client**: Zod schema validation before sending
- **Server**: Zod schema validation in action
- **Content sanitization**: Use DOMPurify to sanitize HTML from Tiptap before saving
- **Length limits**: Enforce max 10,000 characters

### XSS Prevention
- Sanitize HTML content with DOMPurify
- Render content as HTML only after sanitization
- Never trust user input directly

---

## 10) Testing Plan

### Unit Tests (Service Methods)
- `ConversationNoteService.create`: Valid input, invalid conversation, unauthorized
- `ConversationNoteService.update`: Valid update, not found, not creator
- `ConversationNoteService.delete`: Valid delete, not found, not creator
- `ConversationNoteService.list`: With/without cursor, empty results
- `ConversationNoteService.getById`: Valid ID, not found, wrong company

### Integration Tests (DB + Service)
- Create note → verify in DB
- Update note → verify changes
- Delete note → verify soft delete
- List notes → verify ordering (pinned first, then newest)
- Multi-tenant isolation → notes from company A not visible to company B

### UI Tests (Critical Flows)
- Create note dialog opens/closes
- Note content validation
- Note creation success
- Note update success
- Note deletion with confirmation
- Pin/unpin toggle
- Empty state displays correctly
- Loading states

### Edge Cases Checklist
- Very long note content (>10,000 chars)
- Empty note content
- Special characters in content
- HTML injection attempts
- Note with deleted conversation (should still be viewable)
- Note with deleted creator (handle gracefully)
- Concurrent edits (last write wins)

---

## 11) Performance & Observability

### Query Cost Risks + Mitigations
- **Risk**: Fetching all notes for a conversation with many notes
  - **Mitigation**: Cursor pagination, limit to 20 per page
- **Risk**: Slow queries without proper indexes
  - **Mitigation**: All indexes defined, monitor query performance
- **Risk**: Large HTML content in notes
  - **Mitigation**: Content length limit (10,000 chars), lazy rendering

### Required Indexes Recap
1. `conversation_notes_conversation_active_idx` - Primary lookup
2. `conversation_notes_company_id_idx` - Multi-tenant
3. `conversation_notes_created_by_idx` - User queries
4. `conversation_notes_conversation_created_idx` - Sorting
5. `conversation_notes_conversation_pinned_idx` - Pinned priority
6. `conversation_notes_company_conversation_idx` - Company filtering

### Logging/Metrics Events
- `conversation_note.created` - Note created (conversationId, userId)
- `conversation_note.updated` - Note updated (noteId, userId)
- `conversation_note.deleted` - Note deleted (noteId, userId)
- `conversation_note.listed` - Notes fetched (conversationId, count)
- `conversation_note.query_slow` - Slow query warning (>100ms)

### N+1 Avoidance
- Use Drizzle relations to fetch creator info in single query
- No N+1 risk with proper `with` clause

### Batching/Debouncing
- No search functionality initially (no debouncing needed)
- Future: Add search with debouncing (300ms)

---

## 12) Delivery Checklist

### Files/Folders to Create

**Database:**
- `db/schema.ts` - Add `conversationNotesTable` and relation to existing schema

**Feature folder: `features/conversations/`** (NOT a separate feature - separate files within conversations)
- `schemas/note-schema.ts` - Zod schemas for notes (separate file)
- `services/note-service.ts` - Service layer for notes (separate file)
- `actions/note-actions.ts` - Server actions for notes (separate file)
- `hooks/note-hooks.ts` - React Query hooks for notes (separate file)
- `store/note-store.ts` - Zustand store for notes (separate file)
- `components/`
  - `conversation-note-list.tsx` - New component
  - `conversation-note-item.tsx` - New component
  - `create-note-dialog.tsx` - New component
  - `edit-note-dialog.tsx` - New component
  - `delete-note-confirmation.tsx` - New component
  - `note-editor.tsx` - New component (Tiptap wrapper)
  - `conversation-header.tsx` - Update to add note menu items

**Migration:**
- `db/drizzle/0002_conversation_notes.sql` - Migration file

**Integration:**
- Update conversation detail panel to include notes section below messages
- Update conversation header 3-dot menu to add note-related options

### Order of Implementation

1. **Database** (Day 1)
   - Add table to `db/schema.ts`
   - Create migration
   - Run migration

2. **Schemas** (Day 1)
   - Create Zod schemas
   - Define types

3. **Service Layer** (Day 1-2)
   - Implement service methods
   - Add performance logging
   - Add audit logging

4. **Actions** (Day 2)
   - Create server actions
   - Add validation
   - Test with curl/Postman

5. **Hooks** (Day 2)
   - Create React Query hooks
   - Define cache keys

6. **UI Components** (Day 3-4)
   - Install Tiptap
   - Create note editor component
   - Create list/item components
   - Create dialogs
   - Integrate into conversation detail panel

7. **Testing** (Day 4-5)
   - Unit tests for service
   - Integration tests
   - UI tests
   - Manual testing

8. **Polish** (Day 5)
   - Add loading states
   - Add empty states
   - Add error handling
   - Add toasts
   - Performance optimization

### Definition of Done
- [ ] Database table created and migrated
- [ ] All service methods implemented and tested
- [ ] All server actions working
- [ ] React Query hooks created
- [ ] UI components built and integrated
- [ ] Rich text editor (Tiptap) working
- [ ] Create/Update/Delete flows working
- [ ] Multi-tenant isolation verified
- [ ] XSS prevention implemented (DOMPurify)
- [ ] Audit logging working
- [ ] Loading/empty/error states implemented
- [ ] Toast notifications working
- [ ] All tests passing
- [ ] Manual testing completed
- [ ] Performance acceptable (<100ms per query)
- [ ] Code linted and formatted
- [ ] Documentation updated

---

## Appendix: Recommended NPM Packages

### Rich Text Editor
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-link
```

### HTML Sanitization
```bash
npm install dompurify
npm install @types/dompurify --save-dev
```

### Why These Packages?
- **Tiptap**: Modern, extensible, great TypeScript support, mobile-friendly
- **DOMPurify**: Industry standard for XSS prevention, actively maintained

### Alternative Considered
- **Quill**: Older, less TypeScript-friendly
- **Slate**: Too low-level, requires more setup
- **Lexical**: Good but more complex for simple use case

### Total Additional Dependencies: 5 packages
