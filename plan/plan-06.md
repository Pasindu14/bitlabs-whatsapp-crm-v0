---
feature: Conversations UI/UX & Message Management (Full Feature)
date: 2026-01-02
plan_number: 06
---

# Conversations Feature: Complete UI/UX & Message Management Plan

## 1) Feature Summary

### Goal
Implement a complete WhatsApp-like conversations interface with:
- Real-time conversation list with search, filtering, and archiving
- Message thread view with infinite scroll (load older messages)
- Conversation selection with auto-load and mark-as-read
- New message modal with conversation creation
- Conversation menu actions (view info, clear chat, assign, delete, archive/unarchive)
- Message status tracking (Sending → Sent → Delivered → Read)
- Date separators in message threads
- Optimistic UI updates for better UX

### Actors & Permissions
- **Agent/User**: Can view assigned conversations, send/receive messages, search, filter, archive
- **Admin**: Can view all conversations, assign conversations to agents, delete conversations
- **System**: Webhook handler for message status updates

### Primary Flows
1. **App Load**: Fetch conversations, auto-select last viewed, load messages
2. **Search & Filter**: Debounced search, filter by status (All/Unread/Favorites/Groups), archive toggle
3. **Conversation Selection**: Click row → mark selected → load messages → mark as read
4. **New Message**: Click + → modal → validate → create conversation → send message → auto-select
5. **Message Pagination**: Scroll up → load older messages → prepend with date separators
6. **Conversation Actions**: Menu → confirm modal → execute action → update UI
7. **Message Status Updates**: Webhook/polling → update message status → update conversation preview

### Assumptions
- Conversations already exist in DB (from plan-03)
- Messages already exist in DB (from plan-03)
- Contacts already exist in DB (from plan-03)
- WhatsApp API integration exists (from plan-03)
- User session & auth already implemented
- Multi-tenant scoping via `companyId` is enforced
- Last selected conversation ID stored in localStorage or user preferences
- Message status updates via webhook (future) or polling (MVP)

---

## 2) Domain Model

### Entities

**Conversation**
- Represents a chat thread with a contact
- Fields: id, companyId, contactId, phoneNumber, lastMessage, lastMessageAt, unreadCount, isArchived, whatsappAccountId, assignedToUserId
- States: Active, Archived, Deleted

**Message**
- Represents a single message in a conversation
- Fields: id, companyId, conversationId, messageId (WhatsApp), direction (inbound/outbound), type (text/image/document), content, status, timestamp, createdAt
- States: Pending → Sent → Delivered → Read (for outbound); Received → Read (for inbound)

**Contact**
- Represents a WhatsApp contact
- Fields: id, companyId, phoneNumber, name, avatar, isActive
- Relationships: 1-many with Conversation

**ConversationFilter**
- Local state for filtering (not persisted)
- Fields: searchTerm, filterType (All/Unread/Favorites/Groups), isArchived

### Relationships
- Conversation 1-many Message
- Conversation many-1 Contact
- Conversation many-1 User (assignedToUserId)
- Message many-1 Conversation

### State Machine

**Conversation States**:
```
Active ↔ Archived
  ↓
Deleted (soft delete)
```

**Message Status (Outbound)**:
```
Pending → Sent → Delivered → Read
  ↓
Failed (retry possible)
```

**Message Status (Inbound)**:
```
Received → Read
```

---

## 3) Database Design (Postgres/Drizzle)

### Tables (Already Exist from plan-03, Enhanced Here)

#### conversations
```sql
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  companyId INT NOT NULL,
  contactId INT,
  phoneNumber VARCHAR(20) NOT NULL,
  lastMessage TEXT,
  lastMessageAt TIMESTAMP,
  unreadCount INT DEFAULT 0,
  isArchived BOOLEAN DEFAULT FALSE,
  isActive BOOLEAN DEFAULT TRUE,
  whatsappAccountId INT,
  assignedToUserId INT,
  lastSelectedAt TIMESTAMP,  -- NEW: Track last selection for auto-load
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy INT,
  updatedBy INT,
  
  CONSTRAINT fk_company FOREIGN KEY (companyId) REFERENCES companies(id),
  CONSTRAINT fk_contact FOREIGN KEY (contactId) REFERENCES contacts(id),
  CONSTRAINT fk_whatsapp_account FOREIGN KEY (whatsappAccountId) REFERENCES whatsapp_accounts(id),
  CONSTRAINT fk_assigned_user FOREIGN KEY (assignedToUserId) REFERENCES users(id)
);

CREATE INDEX idx_conversations_company_active ON conversations(companyId, isActive) WHERE isActive = TRUE;
CREATE INDEX idx_conversations_company_archived ON conversations(companyId, isArchived);
CREATE INDEX idx_conversations_company_unread ON conversations(companyId, unreadCount) WHERE unreadCount > 0;
CREATE INDEX idx_conversations_assigned_user ON conversations(assignedToUserId);
CREATE INDEX idx_conversations_last_message_at ON conversations(companyId, lastMessageAt DESC);
CREATE INDEX idx_conversations_phone_number ON conversations(companyId, phoneNumber);
```

#### messages
```sql
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  companyId INT NOT NULL,
  conversationId INT NOT NULL,
  messageId VARCHAR(255) UNIQUE,  -- WhatsApp message ID
  direction VARCHAR(10) NOT NULL,  -- 'inbound' or 'outbound'
  type VARCHAR(20) NOT NULL,  -- 'text', 'image', 'document'
  content JSONB NOT NULL,  -- { body?: string, mediaUrl?: string }
  status VARCHAR(20) NOT NULL,  -- 'pending', 'sent', 'delivered', 'read', 'failed'
  timestamp TIMESTAMP NOT NULL,
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy INT,
  updatedBy INT,
  
  CONSTRAINT fk_company FOREIGN KEY (companyId) REFERENCES companies(id),
  CONSTRAINT fk_conversation FOREIGN KEY (conversationId) REFERENCES conversations(id)
);

CREATE INDEX idx_messages_conversation ON messages(conversationId, createdAt DESC);
CREATE INDEX idx_messages_company_status ON messages(companyId, status);
CREATE INDEX idx_messages_timestamp ON messages(companyId, timestamp DESC);
CREATE INDEX idx_messages_direction ON messages(conversationId, direction);
```

#### contacts
```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  companyId INT NOT NULL,
  phoneNumber VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(255),
  avatar VARCHAR(255),
  isActive BOOLEAN DEFAULT TRUE,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy INT,
  updatedBy INT,
  
  CONSTRAINT fk_company FOREIGN KEY (companyId) REFERENCES companies(id),
  CONSTRAINT unique_phone_per_company UNIQUE (companyId, phoneNumber)
);

CREATE INDEX idx_contacts_company_active ON contacts(companyId, isActive);
CREATE INDEX idx_contacts_phone_number ON contacts(phoneNumber);
```

### Indexes Summary
| Table | Index | Columns | Purpose |
|-------|-------|---------|---------|
| conversations | idx_conversations_company_active | (companyId, isActive) | List active conversations |
| conversations | idx_conversations_company_archived | (companyId, isArchived) | Filter archived conversations |
| conversations | idx_conversations_company_unread | (companyId, unreadCount) | Show unread badge |
| conversations | idx_conversations_last_message_at | (companyId, lastMessageAt DESC) | Sort by recency |
| conversations | idx_conversations_phone_number | (companyId, phoneNumber) | Search by phone |
| messages | idx_messages_conversation | (conversationId, createdAt DESC) | Load messages for thread |
| messages | idx_messages_company_status | (companyId, status) | Filter by status |
| messages | idx_messages_timestamp | (companyId, timestamp DESC) | Pagination |
| messages | idx_messages_direction | (conversationId, direction) | Filter inbound/outbound |

### Migration Steps
1. Add `lastSelectedAt` column to conversations (if not exists)
2. Verify all indexes exist
3. Backfill `lastSelectedAt` with `updatedAt` for existing conversations
4. Add constraints for `assignedToUserId` if not exists

---

## 4) API / Server Actions Contract

### Server Actions

#### Conversations

**`getConversations`**
- Input: `{ companyId, searchTerm?, filterType?, isArchived?, cursor?, limit? }`
- Output: `{ success, data: { conversations: ConversationDTO[], nextCursor?, hasMore } }`
- Errors: Unauthorized, Invalid input
- Pagination: Cursor-based (use `lastMessageAt` + `id` as cursor)

**`getConversationById`**
- Input: `{ companyId, conversationId }`
- Output: `{ success, data: ConversationDTO }`
- Errors: Unauthorized, Not found

**`markConversationAsRead`**
- Input: `{ companyId, conversationId }`
- Output: `{ success, data: ConversationDTO }`
- Errors: Unauthorized, Not found

**`archiveConversation`**
- Input: `{ companyId, conversationId }`
- Output: `{ success, data: ConversationDTO }`
- Errors: Unauthorized, Not found

**`unarchiveConversation`**
- Input: `{ companyId, conversationId }`
- Output: `{ success, data: ConversationDTO }`
- Errors: Unauthorized, Not found

**`clearConversation`**
- Input: `{ companyId, conversationId }`
- Output: `{ success }`
- Errors: Unauthorized, Not found
- Side effect: Delete all messages in conversation

**`deleteConversation`**
- Input: `{ companyId, conversationId }`
- Output: `{ success }`
- Errors: Unauthorized, Not found
- Side effect: Soft delete conversation (isActive = false)

**`assignConversation`**
- Input: `{ companyId, conversationId, assignedToUserId }`
- Output: `{ success, data: ConversationDTO }`
- Errors: Unauthorized, Not found, Invalid user
- Permission: Admin only

**`updateConversationLastSelected`**
- Input: `{ companyId, conversationId }`
- Output: `{ success }`
- Errors: Unauthorized, Not found
- Side effect: Update `lastSelectedAt` timestamp

#### Messages

**`getMessages`**
- Input: `{ companyId, conversationId, cursor?, limit? }`
- Output: `{ success, data: { messages: MessageDTO[], nextCursor?, hasMore } }`
- Errors: Unauthorized, Not found
- Pagination: Cursor-based (use `timestamp` + `id` as cursor, reverse order for older messages)

**`sendMessage`** (Already exists from plan-03)
- Input: `{ companyId, conversationId, type, content, phoneNumber? }`
- Output: `{ success, data: MessageDTO }`
- Errors: Unauthorized, Not found, Invalid input, API error
- Side effects: Create conversation if needed, update conversation lastMessage, unreadCount

**`updateMessageStatus`**
- Input: `{ companyId, messageId, status }`
- Output: `{ success, data: MessageDTO }`
- Errors: Unauthorized, Not found
- Side effect: Update conversation lastMessageAt if needed

---

## 5) Validation (Zod)

### Schemas to Create

```typescript
// Conversation Schemas
export const getConversationsInputSchema = z.object({
  companyId: z.number().int().positive(),
  searchTerm: z.string().max(100).optional(),
  filterType: z.enum(['all', 'unread', 'favorites', 'groups']).optional(),
  isArchived: z.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const getConversationByIdInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const markConversationAsReadInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const archiveConversationInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const assignConversationInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  assignedToUserId: z.number().int().positive(),
});

export const clearConversationInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const deleteConversationInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const updateConversationLastSelectedInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

// Message Schemas
export const getMessagesInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
});

export const updateMessageStatusInputSchema = z.object({
  companyId: z.number().int().positive(),
  messageId: z.string().min(1),
  status: z.enum(['delivered', 'read', 'failed']),
});

// DTOs
export type ConversationDTO = {
  id: number;
  companyId: number;
  contactId: number | null;
  phoneNumber: string;
  lastMessage: string | null;
  lastMessageAt: Date | null;
  unreadCount: number;
  isArchived: boolean;
  assignedToUserId: number | null;
  contact?: { id: number; name?: string; avatar?: string; phoneNumber: string };
  assignedToUser?: { id: number; name: string; email: string };
  createdAt: Date;
  updatedAt: Date;
};

export type MessageDTO = {
  id: number;
  companyId: number;
  conversationId: number;
  messageId: string | null;
  direction: 'inbound' | 'outbound';
  type: 'text' | 'image' | 'document';
  content: { body?: string; mediaUrl?: string };
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: Date;
  createdAt: Date;
};

export type PaginationCursor = {
  nextCursor?: string;
  hasMore: boolean;
};
```

---

## 6) Service Layer Plan

### ConversationService Methods

**`getConversations(companyId, searchTerm?, filterType?, isArchived?, cursor?, limit?)`**
- Build WHERE conditions: `companyId`, `isActive = true`, `isArchived`, filter by unreadCount if needed
- If searchTerm: ILIKE search on `phoneNumber` and `contact.name`
- Order by `lastMessageAt DESC`
- Cursor pagination using `(lastMessageAt, id)` tuple
- Select: id, companyId, contactId, phoneNumber, lastMessage, lastMessageAt, unreadCount, isArchived, assignedToUserId, createdAt, updatedAt
- Join with contacts for name/avatar
- Join with users for assignedToUser
- Performance: Log query time, warn if > 500ms
- Result: Return conversations + nextCursor + hasMore

**`getConversationById(companyId, conversationId)`**
- WHERE: `companyId`, `id`, `isActive = true`
- Select: all fields
- Join: contacts, users
- Result: Return conversation or "Not found"

**`markConversationAsRead(companyId, conversationId)`**
- Transaction:
  1. Update conversation: `unreadCount = 0`, `updatedAt = NOW()`
  2. Update messages: WHERE `conversationId` AND `direction = 'inbound'`, set `status = 'read'`
- Result: Return updated conversation

**`archiveConversation(companyId, conversationId)`**
- Update conversation: `isArchived = true`, `updatedAt = NOW()`
- Result: Return updated conversation

**`unarchiveConversation(companyId, conversationId)`**
- Update conversation: `isArchived = false`, `updatedAt = NOW()`
- Result: Return updated conversation

**`clearConversation(companyId, conversationId)`**
- Transaction:
  1. Delete messages: WHERE `conversationId` (soft delete: `isActive = false`)
  2. Update conversation: `lastMessage = null`, `lastMessageAt = null`, `unreadCount = 0`
- Result: Return success

**`deleteConversation(companyId, conversationId)`**
- Soft delete: Update conversation `isActive = false`, `updatedAt = NOW()`
- Result: Return success

**`assignConversation(companyId, conversationId, assignedToUserId)`**
- Verify user exists and belongs to company
- Update conversation: `assignedToUserId`, `updatedAt = NOW()`
- Result: Return updated conversation

**`updateConversationLastSelected(companyId, conversationId)`**
- Update conversation: `lastSelectedAt = NOW()`
- Result: Return success

### MessageService Methods (Enhanced)

**`getMessages(companyId, conversationId, cursor?, limit?)`**
- WHERE: `companyId`, `conversationId`, `isActive = true`
- Order by `timestamp DESC` (newest first, but reverse for display)
- Cursor pagination using `(timestamp, id)` tuple
- Select: all fields
- Result: Return messages + nextCursor + hasMore

**`updateMessageStatus(companyId, messageId, status)`**
- WHERE: `companyId`, `messageId`
- Update: `status`, `updatedAt = NOW()`
- Side effect: If all messages in conversation are read, update conversation `lastMessageAt`
- Result: Return updated message

### Transaction Boundaries
- `markConversationAsRead`: Transaction (conversation + messages)
- `clearConversation`: Transaction (messages + conversation)
- `sendMessage`: Transaction (conversation + message + contact creation)

### Safety Rules
- Always select only needed columns (avoid SELECT *)
- Use `.returning()` for mutations to get updated data
- Validate `companyId` matches session before any query
- Use parameterized queries (Drizzle handles this)
- Log all mutations with operation name + affected rows

### Performance Logging
- Log operation name, query time, affected rows
- Warn if query > 500ms
- Warn if cursor pagination returns > limit + 1 rows (indicates data inconsistency)

---

## 7) UI/UX Plan (shadcn + TanStack)

### Screens/Components

#### Layout: `conversations-page.tsx`
- 3-panel layout: Sidebar (conversations list) | Chat thread | Contact details (optional)
- Top bar: App logo, search, filter chips, + button
- Responsive: Sidebar collapses on mobile

#### Sidebar: `conversation-list.tsx`
- Search input (debounced, 300ms)
- Filter chips: All | Unread | Favorites | Groups | Archived toggle
- Conversation rows:
  - Avatar + Contact name/phone
  - Last message preview (truncated)
  - Time (relative: "2m ago", "Yesterday", "Jan 2")
  - Unread badge (red circle with count)
  - Selected state (highlight background)
- Empty state: "No conversations" or "No results"
- Loading skeleton: 5 rows of placeholder content

#### Chat Thread: `chat-thread.tsx`
- Header: Contact name, avatar, presence indicator, menu (3 dots)
- Message list:
  - Infinite scroll (scroll up to load older)
  - Date separators ("Today", "Yesterday", "Jan 2, 2025")
  - Message bubbles:
    - Inbound: Left-aligned, gray background
    - Outbound: Right-aligned, blue background
    - Status icon: Spinner (pending), checkmark (sent), double checkmark (delivered), blue checkmark (read)
  - Message content: Text, image, document
- Input area:
  - Textarea (auto-expand, max 4096 chars)
  - + button (new message modal)
  - Send button (disabled if empty)
- Loading skeleton: Message placeholder rows
- Empty state: "No messages" or "Start the conversation"

#### Conversation Menu: `conversation-menu.tsx`
- Dropdown menu (3 dots icon)
- Options:
  - View contact info
  - Clear chat
  - Assign to user (admin only)
  - Archive/Unarchive
  - Delete
- Each action opens confirm modal

#### Confirm Modal: `confirm-action-modal.tsx`
- Title: "Are you sure?"
- Description: Action-specific message
- Buttons: Cancel, Confirm (destructive if delete)
- On confirm: Disable buttons, show spinner, execute action, close modal, show toast

#### New Message Modal: `new-conversation-modal.tsx` (Already exists, enhance)
- Phone number input (E.164 format, validation)
- Message textarea (max 4096 chars)
- Send button (disabled if invalid)
- On send: Show spinner, create conversation, send message, auto-select, close modal
- Error handling: Show error toast, keep modal open for retry

#### Contact Info Panel: `contact-info-panel.tsx` (Optional for MVP)
- Contact name, phone, avatar
- Conversation metadata: Created at, assigned to, unread count
- Quick actions: Call, WhatsApp, Email

### Forms

**Search Form** (react-hook-form)
- Field: searchTerm (text, debounced)
- On change: Trigger filter action

**Filter Chips** (state-based, no form)
- State: filterType, isArchived
- On click: Update state, reload list

**Conversation Menu Form** (confirm modal)
- Action type: view-info, clear-chat, assign, archive, delete
- On confirm: Execute server action

**New Message Form** (react-hook-form + zodResolver)
- Fields:
  - phoneNumber (required, E.164 format)
  - message (required, max 4096)
- Validation: Phone format, message not empty
- On submit: Call sendMessageAction

### Empty/Loading/Error States
- **Loading**: Skeleton loaders (conversation rows, message rows)
- **Empty conversations**: "No conversations yet. Click + to start."
- **Empty messages**: "No messages. Start the conversation."
- **Empty search results**: "No conversations match your search."
- **Error**: Toast with error message, retry button (for failed messages)
- **Offline**: Banner at top "You're offline. Messages will sync when online."

### Toast Strategy (Sonner)
- Success: "Message sent", "Conversation archived", "Chat cleared"
- Error: "Failed to send message", "Failed to archive", action-specific errors
- Info: "Loading older messages...", "Marking as read..."
- Auto-dismiss: 3-5 seconds for success, 5-10 seconds for error

---

## 8) Hook/State Plan

### React Query Hooks

**`useConversations(companyId, searchTerm?, filterType?, isArchived?)`**
- Query key: `['conversations', companyId, searchTerm, filterType, isArchived]`
- Query fn: Call `getConversations` action
- Stale time: 30 seconds
- Cache time: 5 minutes
- Pagination: Cursor-based with `useInfiniteQuery`
- Invalidation: On `sendMessage`, `archiveConversation`, `markConversationAsRead`, `deleteConversation`

**`useConversationById(companyId, conversationId)`**
- Query key: `['conversation', companyId, conversationId]`
- Query fn: Call `getConversationById` action
- Stale time: 30 seconds
- Invalidation: On conversation updates

**`useMessages(companyId, conversationId)`**
- Query key: `['messages', companyId, conversationId]`
- Query fn: Call `getMessages` action
- Stale time: 10 seconds
- Pagination: Cursor-based with `useInfiniteQuery` (reverse order for older messages)
- Invalidation: On `sendMessage`, `updateMessageStatus`

**`useSendMessage(companyId, conversationId)`** (Already exists from plan-03)
- Mutation fn: Call `sendMessageAction`
- Optimistic update: Insert message with status "pending" before API call
- On success: Update message with real ID + timestamp, update conversation lastMessage
- On error: Mark message as "failed", show error toast
- Invalidation: Invalidate conversations + messages queries

**`useMarkConversationAsRead(companyId, conversationId)`**
- Mutation fn: Call `markConversationAsRead` action
- Optimistic update: Set unreadCount = 0, mark messages as read
- On success: Update conversation
- Invalidation: Invalidate conversation + messages queries

**`useArchiveConversation(companyId, conversationId)`**
- Mutation fn: Call `archiveConversation` action
- Optimistic update: Set isArchived = true
- On success: Remove from active list, show toast
- Invalidation: Invalidate conversations query

**`useDeleteConversation(companyId, conversationId)`**
- Mutation fn: Call `deleteConversation` action
- On success: Remove from list, navigate to empty state, show toast
- Invalidation: Invalidate conversations query

**`useAssignConversation(companyId, conversationId)`**
- Mutation fn: Call `assignConversation` action
- On success: Update conversation, show toast
- Invalidation: Invalidate conversation query

**`useClearConversation(companyId, conversationId)`**
- Mutation fn: Call `clearConversation` action
- On success: Clear message list, update conversation, show toast
- Invalidation: Invalidate messages + conversation queries

### Local State (Zustand Store)

**`useConversationStore`**
```typescript
{
  selectedConversationId: number | null,
  setSelectedConversationId: (id: number | null) => void,
  
  searchTerm: string,
  setSearchTerm: (term: string) => void,
  
  filterType: 'all' | 'unread' | 'favorites' | 'groups',
  setFilterType: (type) => void,
  
  isArchived: boolean,
  setIsArchived: (archived: boolean) => void,
  
  lastSelectedConversationId: number | null,
  setLastSelectedConversationId: (id: number | null) => void,
  
  // Optimistic updates
  optimisticMessages: Map<string, MessageDTO>,
  addOptimisticMessage: (message) => void,
  removeOptimisticMessage: (messageId) => void,
}
```

### Optimistic Updates

**Sending a message**:
1. Generate temporary message ID (UUID)
2. Insert into `optimisticMessages` with status "pending"
3. Update conversation preview with new message
4. On API success: Replace temp ID with real ID, update timestamp
5. On API error: Mark as "failed", show retry button

**Marking as read**:
1. Optimistically set `unreadCount = 0`
2. Mark all inbound messages as read
3. On API success: Confirm
4. On API error: Revert

**Archiving**:
1. Optimistically set `isArchived = true`
2. Remove from active list
3. On API success: Confirm
4. On API error: Revert

---

## 9) Security & Compliance

### Auth Requirements
- All actions require valid session (`auth()`)
- Verify `session.user.companyId === input.companyId` before any operation
- Admin-only actions: `assignConversation`, `deleteConversation` (optional)

### Row-Level Tenant Enforcement
- **Service layer**: Every query includes `WHERE companyId = ?`
- **DB constraints**: Foreign keys ensure data isolation
- **Validation**: Zod schemas validate companyId is positive integer
- **Audit**: Log all mutations with `createdBy` / `updatedBy`

### Data Validation at Boundaries
- Phone number format: E.164 (e.g., +1234567890)
- Message length: 1-4096 characters
- Search term: Max 100 characters, safe LIKE escaping
- Cursor: Opaque string, validated by service

### Soft Delete Strategy
- Conversations: `isActive = false` (not deleted, just hidden)
- Messages: `isActive = false` (preserve history)
- Contacts: `isActive = false` (preserve relationships)
- Queries default to `WHERE isActive = true`

---

## 10) Testing Plan

### Unit Tests (Service Methods)

**ConversationService**
- `getConversations`: Test search, filter, pagination, cursor handling
- `getConversationById`: Test found, not found, unauthorized
- `markConversationAsRead`: Test unreadCount reset, message status update
- `archiveConversation`: Test isArchived flag
- `deleteConversation`: Test soft delete
- `assignConversation`: Test user validation, update
- `clearConversation`: Test message deletion, conversation reset

**MessageService**
- `getMessages`: Test pagination, cursor, ordering
- `updateMessageStatus`: Test status transitions, conversation update
- `sendMessage`: Test conversation creation, message insertion, WhatsApp API call

### Integration Tests (DB + Service)

**Conversation Flows**
- Create conversation → Send message → Mark as read → Verify unreadCount = 0
- Archive conversation → Verify not in active list → Unarchive → Verify restored
- Clear conversation → Verify messages deleted → Verify conversation reset
- Assign conversation → Verify assignedToUserId updated

**Message Flows**
- Send message → Verify pending status → Simulate webhook → Update to delivered → Verify conversation lastMessage
- Load messages with pagination → Verify cursor handling → Verify no duplicates
- Search conversations → Verify results match phone/name

### UI Tests (Playwright/Vitest)

**Critical Flows**
1. **App Load**: 
   - Verify conversations list loads
   - Verify last selected conversation auto-selects
   - Verify messages load for selected conversation

2. **Search & Filter**:
   - Type in search → Verify debounce (no immediate query)
   - Verify results filter by phone/name
   - Clear search → Verify full list restored

3. **New Message**:
   - Click + button → Verify modal opens
   - Enter phone + message → Verify send enabled
   - Click send → Verify message appears optimistically
   - Verify conversation auto-selects

4. **Conversation Actions**:
   - Click menu → Verify options appear
   - Click archive → Verify confirm modal → Click confirm → Verify conversation moves to archived
   - Click delete → Verify confirm modal → Click confirm → Verify conversation removed

5. **Message Pagination**:
   - Scroll up → Verify older messages load
   - Verify date separators appear
   - Verify no duplicates

### Edge Cases
- Empty conversation list
- Search with no results
- Network error during send (retry)
- Rapid clicks (prevent double submit)
- Very long message text (truncation)
- Very old messages (pagination performance)
- Concurrent updates (last write wins)
- User assigned to conversation then unassigned

---

## 11) Performance & Observability

### Query Cost Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| N+1 on conversation list (contact + user joins) | Use eager loading (join in single query) |
| Large message list (10k+ messages) | Cursor pagination, limit 20 per page |
| Search on unindexed columns | Index phoneNumber + contact.name |
| Unread count calculation | Denormalize in conversation table |
| Frequent status updates | Batch updates via webhook handler |

### Required Indexes (Recap)
- `conversations(companyId, isActive)` — List active
- `conversations(companyId, lastMessageAt DESC)` — Sort by recency
- `conversations(companyId, phoneNumber)` — Search
- `messages(conversationId, createdAt DESC)` — Load thread
- `messages(companyId, status)` — Filter by status
- `contacts(companyId, phoneNumber)` — Search contacts

### Logging/Metrics Events
- `conversation.list` — Query time, result count, filter applied
- `conversation.select` — Conversation ID, load time
- `message.send` — Message ID, status, API latency
- `message.load` — Conversation ID, message count, load time
- `search.query` — Search term, result count, latency
- `error.*` — Error type, operation, user ID, timestamp

### N+1 Avoidance
- Use Drizzle joins for conversation + contact + user
- Batch message status updates via webhook
- Cache conversation list (30s stale time)
- Debounce search input (300ms)

### Debouncing & Throttling
- Search input: Debounce 300ms
- Scroll pagination: Throttle 500ms (prevent rapid requests)
- Auto-save draft: Debounce 1s
- Presence indicator: Throttle 5s

---

## 12) Delivery Checklist

### Files/Folders to Create/Modify

**New Files**:
- `features/conversations/actions/get-conversations.ts`
- `features/conversations/actions/mark-conversation-as-read.ts`
- `features/conversations/actions/archive-conversation.ts`
- `features/conversations/actions/unarchive-conversation.ts`
- `features/conversations/actions/clear-conversation.ts`
- `features/conversations/actions/delete-conversation.ts`
- `features/conversations/actions/assign-conversation.ts`
- `features/conversations/actions/update-message-status.ts`
- `features/conversations/actions/get-messages.ts`
- `features/conversations/hooks/use-conversations.ts`
- `features/conversations/hooks/use-conversation-by-id.ts`
- `features/conversations/hooks/use-messages.ts`
- `features/conversations/hooks/use-mark-as-read.ts`
- `features/conversations/hooks/use-archive-conversation.ts`
- `features/conversations/hooks/use-delete-conversation.ts`
- `features/conversations/hooks/use-assign-conversation.ts`
- `features/conversations/hooks/use-clear-conversation.ts`
- `features/conversations/components/conversation-list.tsx` (enhance)
- `features/conversations/components/chat-thread.tsx` (new)
- `features/conversations/components/conversation-menu.tsx` (new)
- `features/conversations/components/confirm-action-modal.tsx` (new)
- `features/conversations/components/contact-info-panel.tsx` (optional)
- `features/conversations/components/message-bubble.tsx` (new)
- `features/conversations/components/date-separator.tsx` (new)
- `features/conversations/store/conversation.store.ts` (enhance)
- `features/conversations/schemas/index.ts` (enhance)
- `features/conversations/services/conversation.service.ts` (new)
- `features/conversations/types/index.ts` (enhance)

**Modified Files**:
- `features/conversations/services/message.service.ts` (add getMessages, updateMessageStatus)
- `db/schema.ts` (add lastSelectedAt to conversations, verify indexes)
- `features/conversations/components/conversations-page.tsx` (enhance layout)

### Order of Implementation

1. **Database** (1-2 hours)
   - Add `lastSelectedAt` column to conversations
   - Verify all indexes exist
   - Run migrations

2. **Schemas & Types** (1 hour)
   - Create Zod schemas for all actions
   - Export DTOs and types

3. **Service Layer** (3-4 hours)
   - Implement ConversationService (all methods)
   - Enhance MessageService (getMessages, updateMessageStatus)
   - Add performance logging

4. **Server Actions** (2-3 hours)
   - Create all conversation actions
   - Create message actions
   - Add auth + validation

5. **React Query Hooks** (2-3 hours)
   - Implement all hooks
   - Set up cache keys + invalidation
   - Add optimistic updates

6. **Zustand Store** (1 hour)
   - Create conversation store
   - Add optimistic message handling

7. **UI Components** (6-8 hours)
   - Conversation list (search, filter, rows)
   - Chat thread (messages, infinite scroll)
   - Conversation menu + confirm modal
   - New message modal (enhance existing)
   - Message bubble + date separator
   - Contact info panel (optional)

8. **Integration** (2-3 hours)
   - Wire components together
   - Test data flow
   - Handle edge cases

9. **Testing** (3-4 hours)
   - Unit tests (services)
   - Integration tests (DB + service)
   - UI tests (critical flows)

10. **Polish & Optimization** (2-3 hours)
    - Performance tuning
    - Error handling
    - Loading states
    - Accessibility

### Definition of Done

- [ ] All database migrations applied
- [ ] All Zod schemas created and tested
- [ ] All service methods implemented with logging
- [ ] All server actions created with auth + validation
- [ ] All React Query hooks implemented with proper cache keys
- [ ] All UI components created and styled
- [ ] All critical user flows tested (manual + automated)
- [ ] All error cases handled with user-friendly messages
- [ ] All loading/empty states implemented
- [ ] Performance optimized (query times < 500ms, no N+1)
- [ ] Accessibility checked (WCAG 2.1 AA)
- [ ] Code reviewed and linted
- [ ] Documentation updated
- [ ] Ready for QA/staging deployment

---

## Notes & Assumptions

1. **Existing Infrastructure**: Assumes auth, session, company scoping, and WhatsApp API integration already exist (from plan-03).

2. **Message Status Updates**: MVP uses polling (check every 5-10s). Future: Implement webhook handler for real-time updates.

3. **Presence Indicator**: Simplified for MVP (last seen timestamp). Future: Real-time presence via WebSocket.

4. **Favorites & Groups**: Placeholder for MVP. Future: Implement star/favorite logic and group chat support.

5. **Offline Support**: Not in MVP. Future: Implement service worker + local DB sync.

6. **Accessibility**: All components must be keyboard-navigable and screen-reader friendly (WCAG 2.1 AA).

7. **Mobile Responsiveness**: Sidebar collapses on mobile, full-width chat thread.

8. **Rate Limiting**: Implement on server side to prevent abuse (e.g., max 10 messages/min per user).

---

**End of Plan**
