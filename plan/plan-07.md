---
feature: "Message Sending Flow (Service → API → Contact/Conversation Creation → Message Insertion → UI Reload)"
date: "2026-01-02"
plan_number: "07"
---

# Feature Master Plan: Complete Message Sending Flow

## 1) Feature Summary

### Goal
Implement a complete, production-ready message sending flow that orchestrates:
- Contact creation (if needed)
- Conversation creation (if needed)
- Message insertion into database
- WhatsApp API integration
- UI state management with optimistic updates
- Retry mechanism for failed sends
- UI should be same as whatsapp web

### Actors & Permissions
- **Authenticated user** (within a company): Can send messages to any phone number
- **Company scope**: All operations scoped by `companyId`
- **Audit trail**: Track who created/updated messages, contacts, conversations

### Primary Flows
1. **App Initialization**: Load conversations, auto-select last viewed, fetch messages
2. **Sidebar Search**: Debounced search by contact name/phone (local filtering)
3. **Filter Chips**: All/Unread/Favorites/Groups with state preservation
4. **Archived Section**: Toggle archived conversations, unarchive action
5. **Conversation Selection**: Load messages, mark as read, update header
6. **Menu Actions (3-dots)**: View info, clear chat, assign to user, delete
7. **Message Scrolling**: Load older messages (pagination), date separators, status rendering
8. **New Message Modal** (CORE): Full service flow with contact/conversation creation
9. **Message Status**: Sending → Sent → Delivered → Read (via webhooks/polling)
10. **Retry Mechanism**: Failed messages can be retried with same flow

### Assumptions
- E.164 phone number format (or normalization before send)
- WhatsApp API endpoint: `POST /api/whatsapp/send`
- Conversations identified by `(companyId, contactId)` or `(companyId, phone)`
- Message status updates via webhook (not polling)
- Soft delete strategy for conversations/messages (isActive flag)
- Multi-tenant: all queries scoped by `companyId`

---

## 2) Domain Model

### Entities

**Contact**
- Unique identifier per company + phone number
- Stores name, phone, avatar, presence status
- Soft delete support (isActive)
- Audit fields (createdAt, updatedAt, createdBy, updatedBy)

**Conversation**
- Unique per company + contact
- Tracks last message, unread count, is favorite, is archived
- Assigned to user (optional)
- Soft delete support (isActive)
- Audit fields

**Message**
- Belongs to conversation
- Direction: inbound/outbound
- Status: sending/sent/delivered/read/failed
- Stores provider IDs (wamid, messageSid, etc.)
- Soft delete support (isActive)
- Audit fields

**ConversationFilter** (UI state, not persisted)
- Type: all/unread/favorites/groups
- Search term (local filtering)

### Relationships
- Contact 1 ← → ∞ Conversation (one contact, many conversations per company)
- Conversation 1 ← → ∞ Message (one conversation, many messages)
- Conversation N ← → 1 User (optional assignment)

### State Machine (Message)
```
sending → sent → delivered → read
   ↓
failed → (retry) → sending
```

---

## 3) Database Design (Postgres/Drizzle)

### 3.1 Contacts Table

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companyId UUID NOT NULL,
  phone VARCHAR(20) NOT NULL,  -- E.164 format
  name VARCHAR(255),
  avatar VARCHAR(255),
  isGroup BOOLEAN DEFAULT FALSE,
  presence VARCHAR(50),  -- online/offline/away
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy UUID,
  updatedBy UUID,
  isActive BOOLEAN DEFAULT TRUE,
  
  CONSTRAINT fk_contacts_company FOREIGN KEY (companyId) REFERENCES companies(id),
  CONSTRAINT fk_contacts_created_by FOREIGN KEY (createdBy) REFERENCES users(id),
  CONSTRAINT fk_contacts_updated_by FOREIGN KEY (updatedBy) REFERENCES users(id),
  CONSTRAINT unique_contact_per_company UNIQUE (companyId, phone)
);
```

**Indexes:**
- `(companyId, phone)` — find contact by company + phone (UNIQUE)
- `(companyId, isActive)` — list active contacts
- `(companyId, name)` — search by name

### 3.2 Conversations Table

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  companyId UUID NOT NULL,
  contactId UUID NOT NULL,
  lastMessageId UUID,
  lastMessagePreview VARCHAR(255),
  lastMessageTime TIMESTAMP,
  unreadCount INT DEFAULT 0,
  isFavorite BOOLEAN DEFAULT FALSE,
  isArchived BOOLEAN DEFAULT FALSE,
  assignedToUserId UUID,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy UUID,
  updatedBy UUID,
  isActive BOOLEAN DEFAULT TRUE,
  
  CONSTRAINT fk_conversations_company FOREIGN KEY (companyId) REFERENCES companies(id),
  CONSTRAINT fk_conversations_contact FOREIGN KEY (contactId) REFERENCES contacts(id),
  CONSTRAINT fk_conversations_last_message FOREIGN KEY (lastMessageId) REFERENCES messages(id),
  CONSTRAINT fk_conversations_assigned_user FOREIGN KEY (assignedToUserId) REFERENCES users(id),
  CONSTRAINT fk_conversations_created_by FOREIGN KEY (createdBy) REFERENCES users(id),
  CONSTRAINT fk_conversations_updated_by FOREIGN KEY (updatedBy) REFERENCES users(id),
  CONSTRAINT unique_conversation_per_company UNIQUE (companyId, contactId)
);
```

**Indexes:**
- `(companyId, contactId)` — find conversation by company + contact (UNIQUE)
- `(companyId, isActive, isArchived)` — list active conversations
- `(companyId, isFavorite, isActive)` — filter by favorite
- `(companyId, unreadCount)` — filter by unread
- `(companyId, lastMessageTime DESC)` — sort by recency
- `(assignedToUserId, companyId)` — find conversations assigned to user

### 3.3 Messages Table

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversationId UUID NOT NULL,
  companyId UUID NOT NULL,
  contactId UUID NOT NULL,
  direction VARCHAR(20) NOT NULL,  -- inbound/outbound
  status VARCHAR(50) DEFAULT 'sending',  -- sending/sent/delivered/read/failed
  content TEXT NOT NULL,
  mediaUrl VARCHAR(255),
  mediaType VARCHAR(50),  -- image/video/audio/document
  providerMessageId VARCHAR(255),  -- wamid or messageSid
  providerStatus VARCHAR(50),
  errorCode VARCHAR(100),
  errorMessage TEXT,
  createdAt TIMESTAMP DEFAULT NOW(),
  updatedAt TIMESTAMP DEFAULT NOW(),
  createdBy UUID,
  updatedBy UUID,
  isActive BOOLEAN DEFAULT TRUE,
  
  CONSTRAINT fk_messages_conversation FOREIGN KEY (conversationId) REFERENCES conversations(id),
  CONSTRAINT fk_messages_company FOREIGN KEY (companyId) REFERENCES companies(id),
  CONSTRAINT fk_messages_contact FOREIGN KEY (contactId) REFERENCES contacts(id),
  CONSTRAINT fk_messages_created_by FOREIGN KEY (createdBy) REFERENCES users(id),
  CONSTRAINT fk_messages_updated_by FOREIGN KEY (updatedBy) REFERENCES users(id)
);
```

**Indexes:**
- `(conversationId, createdAt DESC)` — fetch messages for conversation (paginated)
- `(companyId, status)` — find messages by status (for polling/retry)
- `(providerMessageId)` — find message by provider ID (for webhook updates)
- `(conversationId, isActive)` — active messages only

### 3.4 Migration Steps
1. Create `contacts` table with unique constraint
2. Create `conversations` table with foreign keys
3. Create `messages` table with foreign keys
4. Add indexes for query performance
5. Backfill any existing data (if migrating from legacy schema)
6. Add constraints for data integrity

---

## 4) API / Server Actions Contract

### 4.1 Server Actions

#### `sendNewMessageAction(input: SendNewMessageInput): Promise<SendNewMessageOutput>`

**Input:**
```typescript
interface SendNewMessageInput {
  companyId: string;
  phoneNumber: string;  // Will be normalized to E.164
  messageText: string;
}
```

**Output (Success):**
```typescript
interface SendNewMessageOutput {
  success: true;
  conversationId: string;
  contactId: string;
  messageId: string;
  createdContact: boolean;
  createdConversation: boolean;
  message: {
    id: string;
    status: 'sending' | 'sent';
    content: string;
    createdAt: string;
  };
}
```

**Output (Failure):**
```typescript
interface SendNewMessageOutput {
  success: false;
  error: string;
  code: 'VALIDATION_ERROR' | 'CONTACT_CREATE_FAILED' | 'CONVERSATION_CREATE_FAILED' | 'MESSAGE_INSERT_FAILED' | 'WHATSAPP_SEND_FAILED' | 'UNKNOWN';
}
```

#### `retryFailedMessageAction(messageId: string): Promise<RetryMessageOutput>`

**Input:**
```typescript
interface RetryMessageInput {
  messageId: string;
  companyId: string;
}
```

**Output:** Same as `SendNewMessageOutput`

#### `markConversationAsReadAction(conversationId: string): Promise<void>`

**Input:**
```typescript
interface MarkAsReadInput {
  conversationId: string;
  companyId: string;
}
```

#### `assignConversationToUserAction(conversationId: string, userId: string | null): Promise<void>`

**Input:**
```typescript
interface AssignConversationInput {
  conversationId: string;
  userId: string | null;  // null = unassign
  companyId: string;
}
```

#### `listConversationsAction(filter: ConversationListFilter): Promise<ConversationListOutput>`

**Input:**
```typescript
interface ConversationListFilter {
  companyId: string;
  filterType: 'all' | 'unread' | 'favorites' | 'groups';
  searchTerm?: string;
  cursor?: string;
  limit: number;
  includeArchived: boolean;
}
```

**Output:**
```typescript
interface ConversationListOutput {
  conversations: ConversationDTO[];
  nextCursor?: string;
  hasMore: boolean;
}
```

#### `getConversationMessagesAction(conversationId: string, cursor?: string): Promise<MessageListOutput>`

**Input:**
```typescript
interface GetMessagesInput {
  conversationId: string;
  companyId: string;
  cursor?: string;
  limit: number;
}
```

**Output:**
```typescript
interface MessageListOutput {
  messages: MessageDTO[];
  previousCursor?: string;
  hasMore: boolean;
}
```

#### `clearConversationAction(conversationId: string): Promise<void>`

**Input:**
```typescript
interface ClearConversationInput {
  conversationId: string;
  companyId: string;
}
```

#### `deleteConversationAction(conversationId: string): Promise<void>`

**Input:**
```typescript
interface DeleteConversationInput {
  conversationId: string;
  companyId: string;
}
```

#### `archiveConversationAction(conversationId: string): Promise<void>`

#### `unarchiveConversationAction(conversationId: string): Promise<void>`

### 4.2 WhatsApp API Endpoint

#### `POST /api/whatsapp/send`

**Request:**
```typescript
interface WhatsAppSendRequest {
  companyId: string;
  recipientPhoneNumber: string;  // E.164 format
  text: string;
}
```

**Response (Success):**
```typescript
interface WhatsAppSendResponse {
  success: true;
  messageId: string;  // provider message ID (wamid)
  timestamp: string;
}
```

**Response (Failure):**
```typescript
interface WhatsAppSendResponse {
  success: false;
  error: string;
  code: string;
}
```

### 4.3 Error Cases
- **VALIDATION_ERROR**: Phone number invalid, message empty, text too long
- **CONTACT_CREATE_FAILED**: DB error creating contact
- **CONVERSATION_CREATE_FAILED**: DB error creating conversation
- **MESSAGE_INSERT_FAILED**: DB error inserting message
- **WHATSAPP_SEND_FAILED**: WhatsApp API error (rate limit, invalid number, etc.)
- **UNAUTHORIZED**: User not authenticated or not in company
- **NOT_FOUND**: Conversation/message not found
- **CONFLICT**: Duplicate send attempt

### 4.4 Pagination Strategy
- **Cursor-based** for messages (using `createdAt` + `id`)
- **Cursor-based** for conversations (using `lastMessageTime` + `id`)
- Cursor format: `base64(timestamp:id)`

---

## 5) Validation (Zod)

### 5.1 Schemas

#### Phone Number Schema
```typescript
const phoneNumberSchema = z
  .string()
  .min(1, 'Phone number required')
  .transform(normalizeToE164)
  .refine(isValidE164, 'Invalid phone number format');
```

#### Message Text Schema
```typescript
const messageTextSchema = z
  .string()
  .min(1, 'Message cannot be empty')
  .max(4096, 'Message too long');
```

#### Send New Message Schema
```typescript
const sendNewMessageSchema = z.object({
  companyId: z.string().uuid('Invalid company ID'),
  phoneNumber: phoneNumberSchema,
  messageText: messageTextSchema,
});
```

#### Conversation Filter Schema
```typescript
const conversationFilterSchema = z.object({
  companyId: z.string().uuid(),
  filterType: z.enum(['all', 'unread', 'favorites', 'groups']),
  searchTerm: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  includeArchived: z.boolean().default(false),
});
```

#### Assign Conversation Schema
```typescript
const assignConversationSchema = z.object({
  conversationId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  companyId: z.string().uuid(),
});
```

### 5.2 Shared Types (Exported)
```typescript
export type SendNewMessageInput = z.infer<typeof sendNewMessageSchema>;
export type ConversationListFilter = z.infer<typeof conversationFilterSchema>;
export type AssignConversationInput = z.infer<typeof assignConversationSchema>;
```

---

## 6) Service Layer Plan

### 6.1 Service Methods

#### `ConversationService`

**`ensureContact(companyId: string, phone: string, name?: string): Promise<Result<Contact>>`**
- Normalize phone to E.164
- Query: `SELECT * FROM contacts WHERE companyId = ? AND phone = ?`
- If found: return existing contact
- If not found: create new contact with `isActive = true`
- Return Result<Contact> with success/failure

**`ensureConversation(companyId: string, contactId: string): Promise<Result<Conversation>>`**
- Query: `SELECT * FROM conversations WHERE companyId = ? AND contactId = ?`
- If found: return existing conversation
- If not found: create new conversation with `unreadCount = 0`, `isArchived = false`
- Return Result<Conversation>

**`createMessage(input: CreateMessageInput): Promise<Result<Message>>`**
- Input: `{ conversationId, companyId, contactId, direction, status, content, createdBy }`
- Insert message with `status = 'sending'`
- Return Result<Message> with inserted ID

**`updateMessageStatus(messageId: string, status: MessageStatus, providerMessageId?: string, error?: string): Promise<Result<void>>`**
- Update message status + provider ID + error (if failed)
- Update `updatedAt` timestamp
- Return Result<void>

**`getConversationMessages(conversationId: string, cursor?: string, limit: number = 50): Promise<Result<MessagePage>>`**
- Query messages ordered by `createdAt DESC`
- Apply cursor pagination
- Return messages + nextCursor
- Include date separators in response

**`listConversations(filter: ConversationListFilter): Promise<Result<ConversationPage>>`**
- Base query: `SELECT * FROM conversations WHERE companyId = ? AND isActive = true`
- Apply filters:
  - `filterType = 'unread'`: `WHERE unreadCount > 0`
  - `filterType = 'favorites'`: `WHERE isFavorite = true`
  - `filterType = 'groups'`: `JOIN contacts WHERE isGroup = true`
  - `filterType = 'all'`: no additional filter
- Apply search (local in service or DB LIKE):
  - Search contacts by name/phone: `JOIN contacts WHERE name ILIKE ? OR phone ILIKE ?`
- Sort by `lastMessageTime DESC`
- Apply cursor pagination
- Return conversations + nextCursor

**`markConversationAsRead(conversationId: string): Promise<Result<void>>`**
- Update: `unreadCount = 0`, `updatedAt = NOW()`
- Return Result<void>

**`assignConversationToUser(conversationId: string, userId: string | null): Promise<Result<void>>`**
- Update: `assignedToUserId = userId`, `updatedAt = NOW()`
- Return Result<void>

**`clearConversation(conversationId: string): Promise<Result<void>>`**
- Soft delete all messages: `UPDATE messages SET isActive = false WHERE conversationId = ?`
- Reset conversation: `unreadCount = 0`, `lastMessageId = null`, `lastMessagePreview = null`
- Return Result<void>

**`deleteConversation(conversationId: string): Promise<Result<void>>`**
- Soft delete conversation: `isActive = false`
- Soft delete all messages: `isActive = false`
- Return Result<void>

**`archiveConversation(conversationId: string): Promise<Result<void>>`**
- Update: `isArchived = true`

**`unarchiveConversation(conversationId: string): Promise<Result<void>>`**
- Update: `isArchived = false`

### 6.2 Message Service (Orchestration)

**`sendNewMessage(input: SendNewMessageInput, userId: string): Promise<Result<SendNewMessageOutput>>`**

**Exact Flow (as requested):**

1. **Validate input** (Zod)
   - Phone number, message text, company ID
   - Return error if validation fails

2. **Normalize phone number**
   - Convert to E.164 format
   - Return error if invalid

3. **Ensure Contact**
   - Call `ensureContact(companyId, normalizedPhone)`
   - If fails: return `Result.error('CONTACT_CREATE_FAILED')`
   - Store `contactId`, flag `createdContact = true/false`

4. **Ensure Conversation**
   - Call `ensureConversation(companyId, contactId)`
   - If fails: return `Result.error('CONVERSATION_CREATE_FAILED')`
   - Store `conversationId`, flag `createdConversation = true/false`

5. **Create Message Record (Local DB)**
   - Call `createMessage({conversationId, companyId, contactId, direction: 'outbound', status: 'sending', content: messageText, createdBy: userId})`
   - If fails: return `Result.error('MESSAGE_INSERT_FAILED')`
   - Store `messageId`

6. **Send Message via WhatsApp**
   - Call `POST /api/whatsapp/send` with `{companyId, recipientPhoneNumber: normalizedPhone, text: messageText}`
   - If success: extract `providerMessageId` (wamid)
   - If failure: capture error code + message

7. **Update Message Status**
   - If WhatsApp success:
     - Call `updateMessageStatus(messageId, 'sent', providerMessageId)`
     - Status = 'sent'
   - If WhatsApp failure:
     - Call `updateMessageStatus(messageId, 'failed', null, errorMessage)`
     - Status = 'failed'

8. **Update Conversation Last Message**
   - Update conversation: `lastMessageId = messageId`, `lastMessagePreview = truncate(messageText)`, `lastMessageTime = NOW()`

9. **Return Payload**
   - Success: `{ success: true, conversationId, contactId, messageId, createdContact, createdConversation, message: {...} }`
   - Failure: `{ success: false, error, code }`

### 6.3 Transaction Boundaries
- **Atomic transaction** for steps 3-8:
  - If any step fails, rollback all DB changes
  - WhatsApp send is outside transaction (can fail after message created; handle via retry)
  - If WhatsApp fails after message inserted, message stays in DB with `status = 'failed'`

### 6.4 Safety Rules
- **Select only needed columns**: avoid `SELECT *`
- **Use RETURNING clauses**: get inserted IDs immediately
- **Parameterized queries**: prevent SQL injection
- **Tenant scoping**: every query includes `companyId` filter
- **Soft delete checks**: filter by `isActive = true` in all list queries

### 6.5 Performance Logging
```typescript
const logger = new PerformanceLogger('ConversationService');

// Log operation start + end
logger.start('ensureContact', { companyId, phone });
// ... operation ...
logger.end('ensureContact', { duration, success, contactId });
```

**Events to log:**
- `ensureContact` (duration, created: yes/no)
- `ensureConversation` (duration, created: yes/no)
- `createMessage` (duration, messageId)
- `sendNewMessage` (total duration, step timings, success/failure)
- `getConversationMessages` (duration, message count)
- `listConversations` (duration, conversation count, filter applied)

### 6.6 Result Pattern
```typescript
type Result<T> = 
  | { success: true; data: T }
  | { success: false; error: string; code: string };

// Usage
const result = await service.ensureContact(...);
if (result.success) {
  const contact = result.data;
} else {
  console.error(result.error, result.code);
}
```

---

## 7) UI/UX Plan (shadcn + TanStack)

### 7.1 Screens/Components

#### **App Shell (Layout)**
- Sidebar (left): conversation list + search + filter chips + archived section
- Chat area (center): selected conversation messages + input
- Header: conversation name, avatar, presence, 3-dots menu

#### **Conversation List (Sidebar)**
- Component: `ConversationListPanel`
- Displays: conversation rows (name, last message preview, time, unread badge, avatar)
- Interactions: click to select, hover to show 3-dots menu
- States: loading, empty, error, success

#### **Search Bar (Sidebar)**
- Component: `ConversationSearchInput`
- Debounced input (300ms)
- Filters locally by contact name + phone
- Shows search results in real-time
- Clear button to restore full list

#### **Filter Chips (Sidebar)**
- Component: `ConversationFilterChips`
- Buttons: All, Unread, Favorites, Groups
- Active state styling
- Click to toggle filter
- Preserve selection if conversation still in filtered list

#### **Archived Section (Sidebar)**
- Component: `ArchivedConversationsPanel`
- Toggle button: "Archived (N)"
- Expands/collapses to show archived conversations
- Unarchive action on each row

#### **Chat Header**
- Component: `ChatHeader`
- Shows: contact name, avatar, presence status
- 3-dots menu button
- Responsive (hide on mobile if needed)

#### **Message List (Center)**
- Component: `MessageList`
- Displays: message bubbles (inbound/outbound), date separators, status indicators
- Infinite scroll up to load older messages
- Auto-scroll to latest on new message
- States: loading, empty, error, success

#### **Message Bubble**
- Component: `MessageBubble`
- Shows: content, timestamp, status icon (sending/sent/delivered/read)
- Failed state: show "Failed" badge + "Retry" button
- Long-press/hover: show actions (copy, delete, etc.)

#### **Message Input**
- Component: `MessageInput`
- Text field + Send button
- "+" button to open "New message" modal
- Disabled when no conversation selected
- Character count (optional)

#### **New Message Modal**
- Component: `NewMessageModal`
- Fields:
  - Phone number input (with validation feedback)
  - Message text area (with character count)
  - Send button (disabled until valid)
- States: idle, sending, success, error
- Error message display
- Close button (X)

#### **3-Dots Menu (Conversation)**
- Component: `ConversationContextMenu`
- Actions:
  - View contact/group info
  - Clear chat
  - Assign to user (opens sub-menu with user list)
  - Delete chat
  - Archive/Unarchive
- Confirmation modals for destructive actions

#### **Assign to User Modal**
- Component: `AssignConversationModal`
- Dropdown/list of users
- "Unassign" option
- Confirm button
- Shows current assignee

### 7.2 Forms

#### **New Message Form**
```typescript
const form = useForm<SendNewMessageInput>({
  resolver: zodResolver(sendNewMessageSchema),
  defaultValues: {
    phoneNumber: '',
    messageText: '',
  },
});

// Fields
<input {...form.register('phoneNumber')} placeholder="+1234567890" />
<textarea {...form.register('messageText')} placeholder="Type message..." />
<button type="submit" disabled={!form.formState.isValid || isLoading}>
  Send
</button>
```

#### **Assign Conversation Form**
```typescript
const form = useForm<AssignConversationInput>({
  resolver: zodResolver(assignConversationSchema),
  defaultValues: {
    userId: conversation.assignedToUserId || null,
  },
});

// Field
<select {...form.register('userId')}>
  <option value="">Unassign</option>
  {users.map(u => <option value={u.id}>{u.name}</option>)}
</select>
```

### 7.3 Empty/Loading/Error States

#### **Conversation List**
- **Loading**: Skeleton rows (5-10 rows)
- **Empty**: "No conversations. Start a new chat with the + button."
- **Error**: "Failed to load conversations. Retry?" button

#### **Message List**
- **Loading**: Message skeleton bubbles (5-10)
- **Empty**: "No messages. Start the conversation!"
- **Error**: "Failed to load messages. Retry?" button

#### **New Message Modal**
- **Idle**: Form ready
- **Sending**: Spinner in button, disabled input
- **Success**: Close modal, show toast "Message sent"
- **Error**: Show error message in modal, keep modal open, allow retry

### 7.4 Toast Strategy (Sonner)
- **Success**: "Message sent successfully"
- **Error**: "Failed to send message. Retry?" (with action button)
- **Info**: "Conversation archived", "Assigned to John", "Chat cleared"
- **Warning**: "Message failed to send"

---

## 8) Hook/State Plan

### 8.1 React Query Hooks

#### `useConversations(filter: ConversationListFilter)`
```typescript
const query = useQuery({
  queryKey: ['conversations', filter.companyId, filter.filterType, filter.searchTerm],
  queryFn: () => listConversationsAction(filter),
  staleTime: 30000,  // 30s
  gcTime: 5 * 60 * 1000,  // 5m
});
```

#### `useConversationMessages(conversationId: string, cursor?: string)`
```typescript
const query = useInfiniteQuery({
  queryKey: ['messages', conversationId],
  queryFn: ({ pageParam }) => getConversationMessagesAction(conversationId, pageParam),
  getNextPageParam: (lastPage) => lastPage.previousCursor,
  initialPageParam: undefined,
  staleTime: 10000,  // 10s
});
```

#### `useSendNewMessage()`
```typescript
const mutation = useMutation({
  mutationFn: (input: SendNewMessageInput) => sendNewMessageAction(input),
  onSuccess: (data) => {
    // Invalidate conversations list
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
    // Invalidate messages for new conversation
    queryClient.invalidateQueries({ queryKey: ['messages', data.conversationId] });
  },
  onError: (error) => {
    // Show error toast
  },
});
```

#### `useRetryFailedMessage()`
```typescript
const mutation = useMutation({
  mutationFn: (messageId: string) => retryFailedMessageAction(messageId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['messages'] });
  },
});
```

#### `useMarkConversationAsRead()`
```typescript
const mutation = useMutation({
  mutationFn: (conversationId: string) => markConversationAsReadAction(conversationId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  },
});
```

#### `useAssignConversation()`
```typescript
const mutation = useMutation({
  mutationFn: (input: AssignConversationInput) => assignConversationToUserAction(input.conversationId, input.userId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['conversations'] });
  },
});
```

### 8.2 Local State (Zustand)

#### `useConversationStore`
```typescript
interface ConversationStore {
  selectedConversationId: string | null;
  setSelectedConversation: (id: string | null) => void;
  filterType: 'all' | 'unread' | 'favorites' | 'groups';
  setFilterType: (type) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  showArchivedSection: boolean;
  setShowArchivedSection: (show: boolean) => void;
}
```

**Persistence**: Save to localStorage (selectedConversationId, filterType)

### 8.3 Optimistic Updates

#### **Send New Message**
1. Immediately add message to message list with `status = 'sending'`
2. Move conversation to top of list
3. Update last message preview
4. If API fails: mark message as `status = 'failed'`, show retry button
5. If API succeeds: update message `status = 'sent'`, update `providerMessageId`

#### **Mark as Read**
1. Immediately set `unreadCount = 0` in conversation row
2. If API fails: revert to previous count

#### **Assign to User**
1. Immediately update conversation `assignedToUserId`
2. If API fails: revert to previous value

---

## 9) Security & Compliance

### 9.1 Auth Requirements
- **Session check**: Every action validates user is authenticated
- **Company scope**: Verify user belongs to `companyId` in request
- **Role check**: (Optional) Restrict message sending to specific roles

### 9.2 Row-Level Tenant Enforcement
- **Service layer**: Every query includes `WHERE companyId = ?`
- **DB constraints**: Foreign keys to `companies` table
- **Actions**: Verify `companyId` matches user's company before executing

### 9.3 Data Validation
- **Phone number**: E.164 format, length validation
- **Message text**: Non-empty, length limit (4096 chars)
- **IDs**: UUID format validation
- **Sanitization**: Escape user input before storing (if needed for display)

### 9.4 Rate Limiting
- **WhatsApp API**: Respect provider rate limits
- **Message sending**: Optional per-user/per-conversation rate limit
- **Search**: Debounce input to reduce DB load

---

## 10) Testing Plan

### 10.1 Unit Tests (Service Layer)

#### `ConversationService.ensureContact`
- ✓ Create new contact if not exists
- ✓ Return existing contact if exists
- ✓ Normalize phone number correctly
- ✓ Fail on invalid phone format
- ✓ Fail on DB error

#### `ConversationService.ensureConversation`
- ✓ Create new conversation if not exists
- ✓ Return existing conversation if exists
- ✓ Fail on DB error

#### `ConversationService.createMessage`
- ✓ Insert message with correct fields
- ✓ Set status to 'sending' by default
- ✓ Return inserted message ID
- ✓ Fail on DB error

#### `ConversationService.updateMessageStatus`
- ✓ Update status correctly
- ✓ Store provider message ID
- ✓ Store error message on failure
- ✓ Update updatedAt timestamp

#### `MessageService.sendNewMessage`
- ✓ Full flow: contact → conversation → message → WhatsApp → update
- ✓ Handle contact creation failure
- ✓ Handle conversation creation failure
- ✓ Handle message insertion failure
- ✓ Handle WhatsApp API failure
- ✓ Return correct output shape
- ✓ Rollback on transaction failure

#### `ConversationService.listConversations`
- ✓ Filter by type (all/unread/favorites/groups)
- ✓ Search by contact name/phone
- ✓ Cursor pagination
- ✓ Exclude archived by default
- ✓ Sort by lastMessageTime DESC

#### `ConversationService.getConversationMessages`
- ✓ Fetch messages for conversation
- ✓ Cursor pagination (load older)
- ✓ Include date separators
- ✓ Order by createdAt DESC
- ✓ Exclude soft-deleted messages

### 10.2 Integration Tests (DB + Service)

#### Message Sending Flow
- ✓ Send message to new contact → creates contact + conversation + message
- ✓ Send message to existing contact → reuses contact + conversation
- ✓ Verify conversation lastMessagePreview updated
- ✓ Verify conversation moved to top of list
- ✓ Verify message status transitions: sending → sent → delivered → read

#### Conversation Management
- ✓ Mark conversation as read → unreadCount = 0
- ✓ Assign conversation to user → assignedToUserId updated
- ✓ Clear conversation → all messages soft-deleted
- ✓ Delete conversation → conversation + messages soft-deleted
- ✓ Archive/unarchive conversation → isArchived toggled

### 10.3 UI Tests (Playwright)

#### New Message Modal Flow
- ✓ Open modal with + button
- ✓ Phone number validation (show error for invalid format)
- ✓ Message text validation (show error if empty)
- ✓ Send button disabled until valid
- ✓ Click Send → shows spinner
- ✓ On success → modal closes, conversation appears in list, messages load
- ✓ On failure → error message shown, modal stays open, can retry

#### Conversation Selection
- ✓ Click conversation row → selected state, messages load
- ✓ Scroll up in message list → load older messages
- ✓ New message appears at bottom → auto-scroll
- ✓ Mark as read → unread badge disappears

#### Filter & Search
- ✓ Click filter chip → list updates
- ✓ Type in search → results filter in real-time
- ✓ Clear search → full list restored
- ✓ Filter + search combined → both applied

#### 3-Dots Menu
- ✓ Open menu → actions visible
- ✓ Click "Assign to user" → modal opens with user list
- ✓ Select user → conversation updated
- ✓ Click "Clear chat" → confirmation, then messages cleared
- ✓ Click "Delete chat" → confirmation, then conversation removed

### 10.4 Edge Cases
- ✓ Send message with special characters (emoji, symbols)
- ✓ Send very long message (near 4096 limit)
- ✓ Send to invalid phone number (various formats)
- ✓ Network failure during send → message stays in 'failed' state
- ✓ Retry failed message → repeats full flow
- ✓ Concurrent sends to same conversation → messages ordered correctly
- ✓ Soft-deleted conversations not shown in list
- ✓ Pagination cursor handling (no infinite loops)

---

## 11) Performance & Observability

### 11.1 Query Cost Risks & Mitigations

| Query | Risk | Mitigation |
|-------|------|-----------|
| `listConversations` with search | Full table scan | Index on `(companyId, name)`, `(companyId, phone)` |
| `getConversationMessages` | Large result set | Cursor pagination (limit 50), index on `(conversationId, createdAt DESC)` |
| `ensureContact` + `ensureConversation` | N+1 in loop | Batch operations, cache results |
| `updateMessageStatus` on webhook | High write load | Index on `(providerMessageId)` for fast lookup |

### 11.2 Required Indexes (Recap)

**Contacts:**
- `(companyId, phone)` — UNIQUE, find by company + phone
- `(companyId, name)` — search by name
- `(companyId, isActive)` — list active

**Conversations:**
- `(companyId, contactId)` — UNIQUE, find by company + contact
- `(companyId, isActive, isArchived)` — list active/archived
- `(companyId, isFavorite, isActive)` — filter by favorite
- `(companyId, unreadCount)` — filter by unread
- `(companyId, lastMessageTime DESC)` — sort by recency
- `(assignedToUserId, companyId)` — find assigned conversations

**Messages:**
- `(conversationId, createdAt DESC)` — fetch messages (paginated)
- `(companyId, status)` — find by status (retry/polling)
- `(providerMessageId)` — find by provider ID (webhook updates)
- `(conversationId, isActive)` — active messages only

### 11.3 Logging/Metrics Events

**Application Events:**
- `message.sent` — user sent message (log: conversationId, contactId, messageId)
- `message.failed` — message send failed (log: error code, reason)
- `message.retried` — user retried failed message
- `conversation.assigned` — conversation assigned to user
- `conversation.archived` — conversation archived
- `conversation.cleared` — conversation cleared

**Performance Metrics:**
- `service.sendNewMessage.duration` — total time (target: <2s)
- `service.ensureContact.duration` — contact lookup/create (target: <200ms)
- `service.ensureConversation.duration` — conversation lookup/create (target: <200ms)
- `api.whatsapp.send.duration` — WhatsApp API call (target: <5s)
- `service.listConversations.duration` — list query (target: <500ms)
- `service.getConversationMessages.duration` — message fetch (target: <500ms)

**Error Tracking:**
- Log all failures with error code + context
- Track retry success rate
- Monitor WhatsApp API error rates

### 11.4 N+1 Avoidance
- **Batch contact/conversation lookups**: If sending to multiple numbers, batch the ensures
- **Eager load relationships**: When fetching conversations, include contact info in single query
- **Cache contact lookups**: Short-lived cache (1-5 min) for frequently accessed contacts

### 11.5 Debouncing & Throttling
- **Search input**: Debounce 300ms before filtering
- **Scroll pagination**: Throttle scroll events to prevent excessive API calls
- **Message status updates**: Batch webhook updates if possible

---

## 12) Delivery Checklist

### 12.1 Files/Folders to Create

```
features/conversations/
├── schemas/
│   ├── conversation.ts (Zod schemas)
│   ├── message.ts
│   └── contact.ts
├── services/
│   ├── conversation.service.ts
│   ├── message.service.ts
│   └── contact.service.ts
├── actions/
│   ├── send-new-message.action.ts
│   ├── list-conversations.action.ts
│   ├── get-messages.action.ts
│   ├── mark-as-read.action.ts
│   ├── assign-conversation.action.ts
│   ├── clear-conversation.action.ts
│   ├── delete-conversation.action.ts
│   ├── archive-conversation.action.ts
│   └── retry-message.action.ts
├── hooks/
│   ├── use-conversations.ts
│   ├── use-conversation-messages.ts
│   ├── use-send-new-message.ts
│   ├── use-mark-as-read.ts
│   ├── use-assign-conversation.ts
│   └── use-conversation-store.ts (Zustand)
├── components/
│   ├── conversation-list-panel.tsx
│   ├── conversation-search-input.tsx
│   ├── conversation-filter-chips.tsx
│   ├── archived-conversations-panel.tsx
│   ├── chat-header.tsx
│   ├── message-list.tsx
│   ├── message-bubble.tsx
│   ├── message-input.tsx
│   ├── new-message-modal.tsx
│   ├── conversation-context-menu.tsx
│   └── assign-conversation-modal.tsx
└── store/
    └── conversation.store.ts (Zustand)

db/
├── schema/
│   └── conversations.ts (Drizzle tables)

api/
├── whatsapp/
│   └── send.ts (WhatsApp send endpoint)

lib/
├── phone-utils.ts (E.164 normalization)
└── performance-logger.ts (logging utility)
```

### 12.2 Order of Implementation

1. **Database Schema** (Drizzle)
   - Create contacts, conversations, messages tables
   - Add indexes
   - Run migration

2. **Validation Schemas** (Zod)
   - Phone number, message text, conversation filters
   - Shared types

3. **Service Layer**
   - ConversationService (ensureContact, ensureConversation, etc.)
   - MessageService (sendNewMessage orchestration)
   - Performance logging

4. **Server Actions**
   - sendNewMessageAction
   - listConversationsAction
   - getConversationMessagesAction
   - Other CRUD actions

5. **WhatsApp API Endpoint**
   - `POST /api/whatsapp/send`
   - Error handling

6. **React Query Hooks**
   - useConversations
   - useConversationMessages
   - useSendNewMessage
   - Other mutations

7. **Zustand Store**
   - useConversationStore (selectedConversationId, filters, search)

8. **UI Components**
   - Conversation list + search + filters
   - Chat header
   - Message list + bubbles
   - Message input
   - New message modal
   - 3-dots menu + assign modal

9. **Integration Tests**
   - Service layer tests
   - Full flow tests

10. **UI Tests** (Playwright)
    - Modal flow
    - Conversation selection
    - Filter/search
    - Menu actions

### 12.3 Definition of Done

- [ ] All database tables created with indexes
- [ ] All Zod schemas defined and exported
- [ ] All service methods implemented with Result pattern
- [ ] All server actions implemented with validation
- [ ] WhatsApp API endpoint working
- [ ] All React Query hooks implemented
- [ ] Zustand store implemented with localStorage persistence
- [ ] All UI components built with shadcn/ui
- [ ] New message modal full flow working (send → create contact → create conversation → insert message → reload UI)
- [ ] Conversation list updates after send
- [ ] Messages load and display correctly
- [ ] Retry mechanism working for failed messages
- [ ] Filter chips working (all/unread/favorites/groups)
- [ ] Search working (debounced, local filtering)
- [ ] Archived section working
- [ ] 3-dots menu actions working (assign, clear, delete, archive)
- [ ] Mark as read working
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] All UI tests passing (Playwright)
- [ ] Performance metrics logged
- [ ] Error handling + toast notifications
- [ ] Responsive design (mobile-friendly)
- [ ] Accessibility (ARIA labels, keyboard navigation)

---

## 13) UI State Machine (Optional Reference)

### Conversation List States
```
idle → loading → success (render list)
                ↓
              error (show retry)
```

### Message List States
```
idle → loading → success (render messages)
                ↓
              error (show retry)
```

### New Message Modal States
```
idle → (user fills form) → ready
       ↓
    sending (spinner) → success (close modal, show toast)
                      ↓
                    error (show message, allow retry)
```

### Message Sending States (per message)
```
sending → sent → delivered → read
  ↓
failed → (user clicks retry) → sending
```

### Assign to User Modal States
```
idle → loading → success (close modal, show toast)
                ↓
              error (show message, allow retry)
```

---

## 14) Summary

This plan provides a **complete, production-ready specification** for the message sending flow with:

✅ **Full service orchestration**: Contact → Conversation → Message → WhatsApp → UI update  
✅ **Atomic transactions**: Rollback on failure  
✅ **Retry mechanism**: Failed messages can be retried  
✅ **Optimistic updates**: Immediate UI feedback  
✅ **Comprehensive validation**: Zod schemas at boundaries  
✅ **Performance logging**: Track operation timings  
✅ **Multi-tenant safety**: Company scoping throughout  
✅ **Soft delete strategy**: Preserve audit trail  
✅ **Cursor pagination**: Efficient message/conversation loading  
✅ **Error handling**: Graceful failures with user feedback  
✅ **Testing strategy**: Unit, integration, and UI tests  
✅ **Security**: Auth checks, tenant enforcement, input validation  

**Next step**: Follow `/implementation-plan` with this plan file to build the feature end-to-end.
