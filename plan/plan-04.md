# WhatsApp Conversations Feature — Complete Build Spec

**Feature:** WhatsApp Conversations CRM UI (like WhatsApp Web)  
**Date:** 2026-01-02  
**Plan Number:** 04  
**Status:** Ready for Implementation

---

## 1. Feature Summary

### Goal
Build a complete WhatsApp conversation management UI that mirrors WhatsApp Web's layout:
- **Left Panel:** Conversation list with search, filtering, and real-time updates
- **Middle Panel:** Chat thread with message history, typing indicators, and read receipts
- **Right Panel:** Contact details, conversation metadata, and quick actions

### Actors & Permissions
- **Agent:** Can view assigned conversations, send/receive messages, update conversation status
- **Manager:** Can view all conversations, reassign, archive, view analytics
- **Admin:** Full access to all conversations, settings, and audit logs

### Primary Flows
1. **View Conversations:** List active conversations sorted by last message
2. **Open Conversation:** Load full message history with pagination
3. **Send Message:** Compose and send text/media messages
4. **Update Status:** Mark as read, archive, assign to agent
5. **Search/Filter:** Find conversations by contact name, phone, or message content
6. **Real-time Updates:** Receive new messages via polling or WebSocket

### Assumptions
- WhatsApp accounts already configured and synced
- Contacts already exist in the database
- Messages are stored in `messagesTable` with full history
- Company-scoped multi-tenancy enforced at service layer
- No WebSocket infrastructure yet; use polling for real-time updates
- UI follows shadcn/ui + TanStack patterns from existing codebase

---

## 2. Domain Model

### Entities

**Conversation**
- Represents a chat thread with a contact
- Tracks last message time, unread count, assignment, and status
- Links to contact and WhatsApp account

**Message**
- Individual message in a conversation
- Stores direction (inbound/outbound), type, content, and delivery status
- Immutable once created; status updates only

**Contact**
- WhatsApp contact with phone number, name, email, notes, tags
- Linked to conversations

**WhatsApp Account**
- Business account credentials and metadata
- Multiple per company

### Relationships
- Company → Conversations (1-many)
- Company → Messages (1-many)
- Conversation → Messages (1-many)
- Conversation → Contact (1-1, optional)
- Conversation → WhatsApp Account (1-1, optional)
- Conversation → User (assigned_to, optional)

### State Machine

**Conversation Status:**
```
active → archived → active
```

**Message Status:**
```
sent → delivered → read
     ↘ failed (retry possible)
```

---

## 3. Database Design (Postgres/Drizzle)

### Tables (Already Exist — No Changes Required)

All required tables are already in `db/schema.ts`:
- `companiesTable`
- `usersTable`
- `whatsappAccountsTable`
- `contactsTable`
- `conversationsTable`
- `messagesTable`
- `auditLogsTable`

**Verify these columns exist:**

**conversationsTable:**
- `id` (PK)
- `companyId` (FK, indexed)
- `contactId` (FK, optional)
- `phoneNumber` (E.164)
- `whatsappAccountId` (FK, optional)
- `lastMessageAt` (timestamp)
- `unreadCount` (int)
- `status` (text: "active", "archived")
- `assignedTo` (FK to users, optional)
- `createdAt`, `updatedAt`

**messagesTable:**
- `id` (PK)
- `companyId` (FK, indexed)
- `conversationId` (FK, indexed)
- `messageId` (text, unique per conversation)
- `direction` (text: "inbound", "outbound")
- `type` (text: "text", "image", "document", "template")
- `content` (jsonb: `{ body?: string, mediaUrl?: string, ... }`)
- `status` (text: "sent", "delivered", "read", "failed")
- `timestamp` (timestamp)
- `createdAt`

### Indexes (Already Exist)

**Critical indexes for conversations:**
- `conversations_company_id_last_message_at_id_idx` (company + last message time + id) — for list sorting
- `conversations_company_id_status_last_message_at_idx` (company + status + last message time) — for filtering
- `conversations_company_id_phone_number_idx` (company + phone) — for lookup

**Critical indexes for messages:**
- `messages_conversation_id_timestamp_id_idx` (conversation + timestamp + id) — for loading thread
- `messages_message_id_idx` (message ID) — for status updates

### Expected Queries

| Query | Index Used | Notes |
|-------|-----------|-------|
| List conversations by company, sorted by last message | `conversations_company_id_last_message_at_id_idx` | Cursor pagination |
| Filter by status (active/archived) | `conversations_company_id_status_last_message_at_idx` | With status filter |
| Get conversation by phone number | `conversations_company_id_phone_number_idx` | Lookup |
| Load messages in conversation | `messages_conversation_id_timestamp_id_idx` | Reverse chronological |
| Update message status by ID | `messages_message_id_idx` | Status updates |
| Search conversations by contact name | Full table scan + app-level filter | Consider adding FTS if needed |

### Migration Steps
**No migrations needed.** All tables and indexes already exist. Verify with:
```bash
npm run db:push
```

---

## 4. API / Server Actions Contract

### Actions to Create

All actions follow the **Result pattern**:
```ts
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

#### Conversation Actions

**`getConversations`**
- **Input:** `{ companyId: number; cursor?: string; limit?: number; status?: "active" | "archived"; search?: string; }`
- **Output:** `Result<{ conversations: ConversationDTO[]; nextCursor?: string; }>`
- **Errors:** unauthorized, invalid_input
- **Pagination:** Cursor-based (use `id` as cursor)

**`getConversationById`**
- **Input:** `{ companyId: number; conversationId: number; }`
- **Output:** `Result<ConversationDTO>`
- **Errors:** unauthorized, not_found

**`updateConversationStatus`**
- **Input:** `{ companyId: number; conversationId: number; status: "active" | "archived"; }`
- **Output:** `Result<ConversationDTO>`
- **Errors:** unauthorized, not_found, invalid_input

**`assignConversation`**
- **Input:** `{ companyId: number; conversationId: number; assignedTo?: number; }`
- **Output:** `Result<ConversationDTO>`
- **Errors:** unauthorized, not_found, invalid_user

**`markConversationAsRead`**
- **Input:** `{ companyId: number; conversationId: number; }`
- **Output:** `Result<ConversationDTO>`
- **Errors:** unauthorized, not_found

#### Message Actions

**`getMessages`**
- **Input:** `{ companyId: number; conversationId: number; cursor?: string; limit?: number; }`
- **Output:** `Result<{ messages: MessageDTO[]; nextCursor?: string; }>`
- **Errors:** unauthorized, not_found, invalid_input
- **Pagination:** Cursor-based (use `id` as cursor), reverse chronological

**`sendMessage`**
- **Input:** `{ companyId: number; conversationId: number; type: "text" | "image" | "document"; content: { body?: string; mediaUrl?: string; }; }`
- **Output:** `Result<MessageDTO>`
- **Errors:** unauthorized, not_found, invalid_input, send_failed
- **Idempotency:** Use `messageId` (generated) to prevent duplicates

**`updateMessageStatus`**
- **Input:** `{ companyId: number; messageId: string; status: "delivered" | "read" | "failed"; }`
- **Output:** `Result<MessageDTO>`
- **Errors:** unauthorized, not_found

#### Contact Actions (Existing — Reuse)

**`getContactById`**
- Used to populate right panel contact details

**`updateContact`**
- Used to update contact info from conversation UI

### DTO Shapes

**ConversationDTO:**
```ts
{
  id: number;
  companyId: number;
  contactId?: number;
  phoneNumber: string;
  whatsappAccountId?: number;
  lastMessageAt: Date;
  unreadCount: number;
  status: "active" | "archived";
  assignedTo?: number;
  createdAt: Date;
  updatedAt?: Date;
  contact?: { id: number; name?: string; email?: string; };
  assignedUser?: { id: number; name: string; };
  lastMessage?: MessageDTO;
}
```

**MessageDTO:**
```ts
{
  id: number;
  companyId: number;
  conversationId: number;
  messageId: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "document" | "template";
  content: { body?: string; mediaUrl?: string; [key: string]: unknown; };
  status: "sent" | "delivered" | "read" | "failed";
  timestamp: Date;
  createdAt: Date;
}
```

**ContactDTO:**
```ts
{
  id: number;
  companyId: number;
  phoneNumber: string;
  name?: string;
  email?: string;
  notes?: string;
  tags?: string[];
  createdAt: Date;
  updatedAt?: Date;
}
```

---

## 5. Validation (Zod)

### Schemas to Create

**File:** `features/conversations/schemas/index.ts`

```ts
import { z } from "zod";

// Query schemas
export const getConversationsInputSchema = z.object({
  companyId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "archived"]).optional(),
  search: z.string().max(100).optional(),
});

export const getConversationByIdInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const updateConversationStatusInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  status: z.enum(["active", "archived"]),
});

export const assignConversationInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  assignedTo: z.number().int().positive().optional(),
});

export const markConversationAsReadInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
});

export const getMessagesInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(50).default(20),
});

export const sendMessageInputSchema = z.object({
  companyId: z.number().int().positive(),
  conversationId: z.number().int().positive(),
  type: z.enum(["text", "image", "document"]),
  content: z.object({
    body: z.string().max(4096).optional(),
    mediaUrl: z.string().url().optional(),
  }).refine(
    (data) => data.body || data.mediaUrl,
    "Either body or mediaUrl must be provided"
  ),
});

export const updateMessageStatusInputSchema = z.object({
  companyId: z.number().int().positive(),
  messageId: z.string().min(1),
  status: z.enum(["delivered", "read", "failed"]),
});

// Export types
export type GetConversationsInput = z.infer<typeof getConversationsInputSchema>;
export type GetConversationByIdInput = z.infer<typeof getConversationByIdInputSchema>;
export type UpdateConversationStatusInput = z.infer<typeof updateConversationStatusInputSchema>;
export type AssignConversationInput = z.infer<typeof assignConversationInputSchema>;
export type MarkConversationAsReadInput = z.infer<typeof markConversationAsReadInputSchema>;
export type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;
export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;
export type UpdateMessageStatusInput = z.infer<typeof updateMessageStatusInputSchema>;
```

### Refinements
- `sendMessage`: Ensure either `body` or `mediaUrl` is provided
- `getConversations`: Validate `limit` is between 1-100
- `getMessages`: Validate `limit` is between 1-50

---

## 6. Service Layer Plan

### Service Methods

**File:** `features/conversations/services/conversation.service.ts`

```ts
export class ConversationService {
  // List conversations with cursor pagination
  async getConversations(
    companyId: number,
    cursor?: string,
    limit: number = 20,
    status?: "active" | "archived",
    search?: string
  ): Promise<Result<{ conversations: ConversationDTO[]; nextCursor?: string; }>>;

  // Get single conversation with contact + assigned user
  async getConversationById(
    companyId: number,
    conversationId: number
  ): Promise<Result<ConversationDTO>>;

  // Update conversation status (active/archived)
  async updateConversationStatus(
    companyId: number,
    conversationId: number,
    status: "active" | "archived",
    userId: number
  ): Promise<Result<ConversationDTO>>;

  // Assign conversation to user
  async assignConversation(
    companyId: number,
    conversationId: number,
    assignedTo: number | null,
    userId: number
  ): Promise<Result<ConversationDTO>>;

  // Mark conversation as read (set unreadCount to 0)
  async markConversationAsRead(
    companyId: number,
    conversationId: number,
    userId: number
  ): Promise<Result<ConversationDTO>>;

  // Get or create conversation by phone number
  async getOrCreateConversation(
    companyId: number,
    phoneNumber: string,
    whatsappAccountId?: number
  ): Promise<Result<ConversationDTO>>;

  // Increment unread count (called when inbound message received)
  async incrementUnreadCount(
    conversationId: number
  ): Promise<Result<void>>;
}
```

**File:** `features/conversations/services/message.service.ts`

```ts
export class MessageService {
  // Get messages in conversation with cursor pagination (reverse chronological)
  async getMessages(
    companyId: number,
    conversationId: number,
    cursor?: string,
    limit: number = 20
  ): Promise<Result<{ messages: MessageDTO[]; nextCursor?: string; }>>;

  // Send message (text, image, document)
  async sendMessage(
    companyId: number,
    conversationId: number,
    type: "text" | "image" | "document",
    content: { body?: string; mediaUrl?: string; },
    userId: number
  ): Promise<Result<MessageDTO>>;

  // Update message status (delivered, read, failed)
  async updateMessageStatus(
    companyId: number,
    messageId: string,
    status: "delivered" | "read" | "failed"
  ): Promise<Result<MessageDTO>>;

  // Create inbound message (called from webhook)
  async createInboundMessage(
    companyId: number,
    conversationId: number,
    messageId: string,
    type: string,
    content: Record<string, unknown>,
    timestamp: Date
  ): Promise<Result<MessageDTO>>;

  // Batch update message statuses (for read receipts)
  async batchUpdateMessageStatus(
    companyId: number,
    messageIds: string[],
    status: "delivered" | "read"
  ): Promise<Result<void>>;
}
```

### Transaction Boundaries

**`sendMessage`:**
1. Validate input
2. Insert message into `messagesTable`
3. Update `conversationsTable.lastMessageAt`
4. Call WhatsApp API to send (external)
5. Update message status to "sent" or "failed"
6. Log audit event
→ **Wrap steps 2-6 in transaction**

**`markConversationAsRead`:**
1. Validate input
2. Update `conversationsTable.unreadCount = 0`
3. Update all messages in conversation to status "read"
4. Log audit event
→ **Wrap steps 2-4 in transaction**

### Safety Rules

**Select Only Needed Columns:**
```ts
// ✅ Good
db.select({
  id: conversationsTable.id,
  phoneNumber: conversationsTable.phoneNumber,
  lastMessageAt: conversationsTable.lastMessageAt,
}).from(conversationsTable);

// ❌ Avoid
db.select().from(conversationsTable);
```

**Use Returning Clauses:**
```ts
// ✅ Good
const result = await db
  .update(conversationsTable)
  .set({ unreadCount: 0 })
  .where(eq(conversationsTable.id, conversationId))
  .returning();

// ❌ Avoid
await db.update(...);
const updated = await db.select().from(...); // Extra query
```

**Enforce Company Scope:**
```ts
// ✅ Every query must include companyId filter
where(
  and(
    eq(conversationsTable.companyId, companyId),
    eq(conversationsTable.id, conversationId)
  )
)
```

### Performance Logging Points

**File:** `features/conversations/services/conversation.service.ts`

```ts
import { performanceLogger } from "@/lib/performance-logger";

async getConversations(...) {
  const startTime = performance.now();
  try {
    // ... query logic
    performanceLogger.log({
      operation: "getConversations",
      duration: performance.now() - startTime,
      companyId,
      resultCount: conversations.length,
    });
    return { success: true, data: { conversations, nextCursor } };
  } catch (error) {
    performanceLogger.log({
      operation: "getConversations",
      duration: performance.now() - startTime,
      companyId,
      error: error.message,
    });
    return { success: false, error: "Failed to fetch conversations" };
  }
}
```

### Result Mapping

**Success Cases:**
- `{ success: true, data: conversationDTO }`

**Failure Cases:**
- `{ success: false, error: "Unauthorized" }` — User not in company
- `{ success: false, error: "Conversation not found" }` — ID doesn't exist
- `{ success: false, error: "Invalid input" }` — Validation failed
- `{ success: false, error: "Send failed" }` — WhatsApp API error
- `{ success: false, error: "Database error" }` — Transaction failed

---

## 7. UI/UX Plan (shadcn + TanStack)

### Screens/Components to Add

**File Structure:**
```
features/conversations/
├── components/
│   ├── conversation-list.tsx          (Left panel)
│   ├── conversation-list-item.tsx     (List item with avatar, name, preview)
│   ├── conversation-search.tsx        (Search + filter bar)
│   ├── chat-thread.tsx                (Middle panel)
│   ├── message-list.tsx               (Scrollable message history)
│   ├── message-item.tsx               (Single message with status icon)
│   ├── message-input.tsx              (Compose box)
│   ├── contact-panel.tsx              (Right panel)
│   ├── contact-info.tsx               (Contact details)
│   ├── conversation-actions.tsx       (Archive, assign, etc.)
│   └── conversations-page.tsx         (Main layout combining all)
├── hooks/
│   ├── use-conversations.ts           (React Query)
│   ├── use-messages.ts                (React Query)
│   ├── use-send-message.ts            (Mutation)
│   └── use-conversation-polling.ts    (Real-time updates)
└── schemas/
    └── index.ts                       (Zod schemas)
```

### Components Detail

**`conversation-list.tsx`**
- TanStack Table with columns: avatar, name, preview, time, unread badge
- Sorting: by last message time (default)
- Filtering: status (active/archived), assigned to me
- Empty state: "No conversations"
- Loading state: skeleton loaders
- Infinite scroll or cursor pagination

**`conversation-search.tsx`**
- Input field with debounced search
- Filter dropdown: status, assigned to
- Clear button

**`chat-thread.tsx`**
- Header: contact name, status, assignment, menu
- Message list (scrollable, auto-scroll to bottom on new message)
- Message input box
- Typing indicator (if available)
- Read receipts (checkmarks)

**`message-input.tsx`**
- Textarea with auto-expand
- Send button (disabled while sending)
- Loading spinner during send
- Error toast on failure
- Keyboard shortcut: Cmd+Enter to send

**`contact-panel.tsx`**
- Contact avatar + name
- Phone number (clickable to call)
- Email (clickable to email)
- Tags
- Notes
- Conversation metadata (created, assigned to, status)
- Action buttons: edit contact, archive conversation, assign

### Forms (react-hook-form + zodResolver)

**Send Message Form:**
```tsx
const form = useForm<SendMessageInput>({
  resolver: zodResolver(sendMessageInputSchema),
  defaultValues: {
    companyId: currentCompanyId,
    conversationId: selectedConversationId,
    type: "text",
    content: { body: "" },
  },
});

const onSubmit = async (data) => {
  const result = await sendMessageAction(data);
  if (result.success) {
    form.reset();
    toast.success("Message sent");
  } else {
    toast.error(result.error);
  }
};
```

**Update Conversation Form:**
```tsx
const form = useForm<UpdateConversationStatusInput>({
  resolver: zodResolver(updateConversationStatusInputSchema),
  defaultValues: {
    companyId: currentCompanyId,
    conversationId: selectedConversationId,
    status: conversation.status,
  },
});
```

### Empty/Loading/Error States

**Empty Conversation List:**
```tsx
<div className="flex flex-col items-center justify-center h-full">
  <MessageCircle className="w-12 h-12 text-gray-300 mb-4" />
  <p className="text-gray-500">No conversations yet</p>
  <p className="text-sm text-gray-400">Messages will appear here</p>
</div>
```

**Loading Messages:**
```tsx
<div className="space-y-4">
  {[...Array(5)].map((_, i) => (
    <Skeleton key={i} className="h-16 w-full" />
  ))}
</div>
```

**Error State:**
```tsx
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Failed to load messages</AlertTitle>
  <AlertDescription>{error}</AlertDescription>
  <Button onClick={refetch} size="sm" className="mt-2">Retry</Button>
</Alert>
```

### Toast Strategy (Sonner)

```ts
// Success
toast.success("Message sent successfully");

// Error
toast.error("Failed to send message");

// Loading
const id = toast.loading("Sending message...");
// Later: toast.dismiss(id);

// Custom
toast.custom((t) => (
  <div className="bg-white p-4 rounded shadow">
    Message sent
  </div>
));
```

---

## 8. Hook/State Plan

### React Query Hooks

**File:** `features/conversations/hooks/use-conversations.ts`

```ts
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { getConversationsAction } from "../actions";

export function useConversations(
  companyId: number,
  status?: "active" | "archived",
  search?: string
) {
  return useInfiniteQuery({
    queryKey: ["conversations", companyId, status, search],
    queryFn: ({ pageParam }) =>
      getConversationsAction({
        companyId,
        cursor: pageParam,
        limit: 20,
        status,
        search,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.success ? lastPage.data.nextCursor : undefined,
    initialPageParam: undefined,
  });
}

export function useConversation(companyId: number, conversationId: number) {
  return useQuery({
    queryKey: ["conversation", companyId, conversationId],
    queryFn: () =>
      getConversationByIdAction({ companyId, conversationId }),
    enabled: !!conversationId,
  });
}
```

**File:** `features/conversations/hooks/use-messages.ts`

```ts
import { useInfiniteQuery } from "@tanstack/react-query";
import { getMessagesAction } from "../actions";

export function useMessages(
  companyId: number,
  conversationId: number
) {
  return useInfiniteQuery({
    queryKey: ["messages", companyId, conversationId],
    queryFn: ({ pageParam }) =>
      getMessagesAction({
        companyId,
        conversationId,
        cursor: pageParam,
        limit: 20,
      }),
    getNextPageParam: (lastPage) =>
      lastPage.success ? lastPage.data.nextCursor : undefined,
    initialPageParam: undefined,
    enabled: !!conversationId,
  });
}
```

**File:** `features/conversations/hooks/use-send-message.ts`

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { sendMessageAction } from "../actions";

export function useSendMessage(companyId: number, conversationId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SendMessageInput) => sendMessageAction(input),
    onMutate: async (newMessage) => {
      // Optimistic update
      await queryClient.cancelQueries({
        queryKey: ["messages", companyId, conversationId],
      });

      const previousMessages = queryClient.getQueryData([
        "messages",
        companyId,
        conversationId,
      ]);

      // Add optimistic message
      queryClient.setQueryData(
        ["messages", companyId, conversationId],
        (old: any) => ({
          ...old,
          pages: [
            {
              ...old.pages[0],
              data: {
                ...old.pages[0].data,
                messages: [
                  {
                    id: -1,
                    messageId: "optimistic",
                    status: "sending",
                    ...newMessage,
                  },
                  ...old.pages[0].data.messages,
                ],
              },
            },
            ...old.pages.slice(1),
          ],
        })
      );

      return { previousMessages };
    },
    onError: (error, variables, context) => {
      // Revert optimistic update
      if (context?.previousMessages) {
        queryClient.setQueryData(
          ["messages", companyId, conversationId],
          context.previousMessages
        );
      }
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({
        queryKey: ["messages", companyId, conversationId],
      });
      queryClient.invalidateQueries({
        queryKey: ["conversations", companyId],
      });
    },
  });
}
```

**File:** `features/conversations/hooks/use-conversation-polling.ts`

```ts
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

export function useConversationPolling(
  companyId: number,
  conversationId: number,
  enabled: boolean = true,
  interval: number = 3000 // 3 seconds
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled || !conversationId) return;

    const timer = setInterval(() => {
      // Refetch messages in background
      queryClient.invalidateQueries({
        queryKey: ["messages", companyId, conversationId],
      });
      // Refetch conversation (unread count, last message)
      queryClient.invalidateQueries({
        queryKey: ["conversation", companyId, conversationId],
      });
    }, interval);

    return () => clearInterval(timer);
  }, [companyId, conversationId, enabled, interval, queryClient]);
}
```

### Local State (Zustand — Only if Necessary)

**File:** `features/conversations/store/conversation.store.ts`

```ts
import { create } from "zustand";

interface ConversationStore {
  selectedConversationId: number | null;
  setSelectedConversationId: (id: number | null) => void;
  
  filterStatus: "active" | "archived" | null;
  setFilterStatus: (status: "active" | "archived" | null) => void;
  
  searchQuery: string;
  setSearchQuery: (query: string) => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  selectedConversationId: null,
  setSelectedConversationId: (id) => set({ selectedConversationId: id }),
  
  filterStatus: null,
  setFilterStatus: (status) => set({ filterStatus: status }),
  
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
}));
```

### Optimistic Updates

**Send Message:**
- Add message to list immediately with `status: "sending"`
- On success: update status to "sent"
- On error: remove message, show toast

**Mark as Read:**
- Update `unreadCount` to 0 immediately
- On error: revert

**Archive Conversation:**
- Remove from list immediately
- On error: add back

---

## 9. Security & Compliance

### Auth Requirements

**Session Check:**
```ts
// Every action must verify user session
const session = await auth();
if (!session?.user?.id) {
  return { success: false, error: "Unauthorized" };
}
```

**Role-Based Access:**
```ts
// Agent: Can only see assigned conversations
if (userRole === "agent") {
  // Filter to assigned conversations only
}

// Manager: Can see all conversations in company
if (userRole === "manager") {
  // Full access
}

// Admin: Full access
if (userRole === "admin") {
  // Full access
}
```

### Row-Level Tenant Enforcement

**Service Layer:**
```ts
// Every query includes companyId filter
where(
  and(
    eq(conversationsTable.companyId, companyId),
    eq(conversationsTable.id, conversationId)
  )
)
```

**Database Constraints:**
```sql
-- Foreign key ensures data integrity
ALTER TABLE conversations
  ADD CONSTRAINT conversations_company_id_fk
  FOREIGN KEY (company_id) REFERENCES companies(id);
```

**Action Layer:**
```ts
// Verify user belongs to company
const userCompanyId = session.user.companyId;
if (userCompanyId !== companyId) {
  return { success: false, error: "Unauthorized" };
}
```

### Data Validation at Boundaries

**Input Validation:**
```ts
// Use Zod schemas in every action
const parsed = sendMessageInputSchema.safeParse(input);
if (!parsed.success) {
  return { success: false, error: "Invalid input" };
}
```

**Output Sanitization:**
```ts
// Never expose sensitive fields
const dto: ConversationDTO = {
  id: conversation.id,
  phoneNumber: conversation.phoneNumber,
  // ❌ Never include accessToken
  // ❌ Never include passwordHash
};
```

---

## 10. Testing Plan

### Unit Tests

**File:** `features/conversations/services/__tests__/conversation.service.test.ts`

```ts
describe("ConversationService", () => {
  describe("getConversations", () => {
    it("should return conversations sorted by lastMessageAt", async () => {
      // Setup
      // Execute
      // Assert
    });

    it("should filter by status", async () => {
      // Setup
      // Execute
      // Assert
    });

    it("should enforce company scope", async () => {
      // Setup
      // Execute
      // Assert
    });

    it("should return error if company not found", async () => {
      // Setup
      // Execute
      // Assert
    });
  });

  describe("sendMessage", () => {
    it("should create message and update conversation", async () => {
      // Setup
      // Execute
      // Assert
    });

    it("should handle send failure gracefully", async () => {
      // Setup
      // Execute
      // Assert
    });

    it("should be idempotent with messageId", async () => {
      // Setup
      // Execute twice with same messageId
      // Assert only one message created
    });
  });

  describe("markConversationAsRead", () => {
    it("should set unreadCount to 0", async () => {
      // Setup
      // Execute
      // Assert
    });

    it("should mark all messages as read", async () => {
      // Setup
      // Execute
      // Assert
    });
  });
});
```

### Integration Tests

**File:** `features/conversations/__tests__/conversations.integration.test.ts`

```ts
describe("Conversations Integration", () => {
  it("should create conversation, send message, and update status", async () => {
    // 1. Create conversation
    // 2. Send message
    // 3. Mark as read
    // 4. Archive conversation
    // 5. Verify all changes persisted
  });

  it("should handle concurrent message sends", async () => {
    // Send 5 messages concurrently
    // Verify all created with correct order
  });

  it("should enforce company isolation", async () => {
    // Create conversation in company A
    // Try to access from company B
    // Verify unauthorized
  });
});
```

### UI Tests (Playwright)

**File:** `features/conversations/__tests__/conversations.e2e.test.ts`

```ts
describe("Conversations UI", () => {
  it("should display conversation list and open chat", async ({ page }) => {
    // 1. Navigate to conversations page
    // 2. Verify list loads
    // 3. Click conversation
    // 4. Verify chat thread loads
  });

  it("should send message and display in thread", async ({ page }) => {
    // 1. Open conversation
    // 2. Type message
    // 3. Click send
    // 4. Verify message appears with "sending" status
    // 5. Verify status updates to "sent"
  });

  it("should search conversations", async ({ page }) => {
    // 1. Type in search box
    // 2. Verify list filters
    // 3. Clear search
    // 4. Verify list resets
  });

  it("should archive conversation", async ({ page }) => {
    // 1. Open conversation
    // 2. Click archive button
    // 3. Verify removed from active list
    // 4. Filter by archived
    // 5. Verify conversation appears
  });
});
```

### Edge Cases Checklist

- [ ] Empty conversation list
- [ ] Very long message (4096 chars)
- [ ] Message with special characters
- [ ] Rapid message sends (debounce test)
- [ ] Network failure during send
- [ ] User logout while message sending
- [ ] Conversation deleted while viewing
- [ ] Contact deleted while viewing
- [ ] Unread count sync across tabs
- [ ] Pagination cursor validity
- [ ] Search with special SQL characters
- [ ] Concurrent read/unread updates
- [ ] Message status updates out of order
- [ ] Timezone handling for timestamps

---

## 11. Performance & Observability

### Query Cost Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| N+1 loading contacts for each conversation | Use `JOIN` in query, batch load |
| N+1 loading assigned users | Use `JOIN` in query, batch load |
| Loading all messages for large conversation | Use cursor pagination, limit 20 |
| Search across all messages | Add full-text search index if needed |
| Unread count updates blocking reads | Use separate UPDATE, not in transaction |

### Required Indexes (Already Exist)

```sql
-- Conversation list sorting
CREATE INDEX conversations_company_id_last_message_at_id_idx
  ON conversations(company_id, last_message_at DESC, id);

-- Message thread loading
CREATE INDEX messages_conversation_id_timestamp_id_idx
  ON messages(conversation_id, timestamp DESC, id);

-- Status filtering
CREATE INDEX conversations_company_id_status_last_message_at_idx
  ON conversations(company_id, status, last_message_at DESC);
```

### Logging/Metrics Events

**Performance Logger:**
```ts
performanceLogger.log({
  operation: "getConversations",
  duration: 145, // ms
  companyId: 1,
  resultCount: 20,
  hasNextPage: true,
});

performanceLogger.log({
  operation: "sendMessage",
  duration: 320, // ms
  companyId: 1,
  conversationId: 42,
  messageType: "text",
  status: "success",
});
```

**Error Logging:**
```ts
logger.error("Failed to send message", {
  conversationId: 42,
  error: error.message,
  stack: error.stack,
});
```

### N+1 Avoidance, Batching, Debouncing

**Batch Load Contacts:**
```ts
// ❌ Bad: N+1
const conversations = await getConversations();
for (const conv of conversations) {
  const contact = await getContact(conv.contactId);
}

// ✅ Good: Batch
const conversations = await getConversations();
const contactIds = conversations.map(c => c.contactId);
const contacts = await getContactsByIds(contactIds);
```

**Debounce Search:**
```ts
const [searchQuery, setSearchQuery] = useState("");
const debouncedSearch = useMemo(
  () => debounce((query) => {
    queryClient.invalidateQueries({
      queryKey: ["conversations", companyId, query],
    });
  }, 300),
  [companyId, queryClient]
);

const handleSearchChange = (query: string) => {
  setSearchQuery(query);
  debouncedSearch(query);
};
```

**Cursor Pagination:**
```ts
// ✅ Good: Cursor-based
const { data, fetchNextPage } = useInfiniteQuery({
  queryKey: ["conversations", companyId],
  queryFn: ({ pageParam }) =>
    getConversations({ companyId, cursor: pageParam, limit: 20 }),
  getNextPageParam: (lastPage) => lastPage.nextCursor,
});

// Load next page only when user scrolls to bottom
const handleScroll = (e) => {
  if (isAtBottom(e)) {
    fetchNextPage();
  }
};
```

---

## 12. Delivery Checklist

### Files/Folders to Create

```
features/conversations/
├── actions/
│   ├── index.ts                       (Export all actions)
│   ├── get-conversations.ts           (Server action)
│   ├── get-conversation-by-id.ts      (Server action)
│   ├── update-conversation-status.ts  (Server action)
│   ├── assign-conversation.ts         (Server action)
│   ├── mark-conversation-as-read.ts   (Server action)
│   ├── get-messages.ts                (Server action)
│   ├── send-message.ts                (Server action)
│   └── update-message-status.ts       (Server action)
├── components/
│   ├── conversation-list.tsx
│   ├── conversation-list-item.tsx
│   ├── conversation-search.tsx
│   ├── chat-thread.tsx
│   ├── message-list.tsx
│   ├── message-item.tsx
│   ├── message-input.tsx
│   ├── contact-panel.tsx
│   ├── contact-info.tsx
│   ├── conversation-actions.tsx
│   └── conversations-page.tsx
├── hooks/
│   ├── use-conversations.ts
│   ├── use-messages.ts
│   ├── use-send-message.ts
│   └── use-conversation-polling.ts
├── services/
│   ├── conversation.service.ts
│   ├── message.service.ts
│   └── index.ts
├── schemas/
│   └── index.ts
├── store/
│   └── conversation.store.ts
├── types/
│   └── index.ts                       (DTO types)
└── __tests__/
    ├── conversation.service.test.ts
    ├── message.service.test.ts
    ├── conversations.integration.test.ts
    └── conversations.e2e.test.ts
```

### Order of Implementation

1. **Schemas** (`features/conversations/schemas/index.ts`)
   - Define all Zod validation schemas
   - Export types

2. **Types** (`features/conversations/types/index.ts`)
   - Define DTO interfaces
   - Define Result type

3. **Services** (`features/conversations/services/`)
   - `conversation.service.ts` — All conversation queries/mutations
   - `message.service.ts` — All message queries/mutations
   - Add performance logging to all methods

4. **Actions** (`features/conversations/actions/`)
   - Create server action for each service method
   - Validate input with Zod
   - Check auth and company scope
   - Return Result type

5. **Hooks** (`features/conversations/hooks/`)
   - `use-conversations.ts` — React Query for list
   - `use-messages.ts` — React Query for thread
   - `use-send-message.ts` — Mutation with optimistic update
   - `use-conversation-polling.ts` — Real-time updates

6. **Store** (`features/conversations/store/`)
   - `conversation.store.ts` — Zustand for UI state (if needed)

7. **Components** (`features/conversations/components/`)
   - Start with leaf components (message-item, conversation-list-item)
   - Build up to container components (message-list, conversation-list)
   - Finally: conversations-page.tsx (main layout)

8. **Routes** (`app/(protected)/conversations/`)
   - Create page.tsx
   - Wire up conversations-page component

9. **Tests**
   - Unit tests for services
   - Integration tests for DB + service
   - E2E tests for UI flows

### Definition of Done

- [ ] All Zod schemas defined and tested
- [ ] All service methods implemented with Result type
- [ ] All server actions created and validated
- [ ] All React Query hooks working with proper cache keys
- [ ] All components rendering with proper loading/error states
- [ ] Optimistic updates working for send message
- [ ] Polling working for real-time updates
- [ ] Search and filtering working
- [ ] Pagination working (cursor-based)
- [ ] Audit logging for all mutations
- [ ] Unit tests passing (>80% coverage)
- [ ] Integration tests passing
- [ ] E2E tests passing (critical flows)
- [ ] Performance logging in place
- [ ] No N+1 queries
- [ ] All indexes verified in production
- [ ] Security: company scope enforced everywhere
- [ ] Security: auth checks on all actions
- [ ] Error handling: all error paths tested
- [ ] UI: empty states, loading states, error states
- [ ] UI: responsive design (mobile-friendly)
- [ ] UI: accessibility (ARIA labels, keyboard nav)
- [ ] Documentation: README with setup instructions

---

## 13. Implementation Notes

### Key Patterns to Follow

1. **Result Type Everywhere:**
   ```ts
   export type Result<T> =
     | { success: true; data: T }
     | { success: false; error: string };
   ```

2. **Zod Validation First:**
   - Define schema
   - Use `zodResolver` in forms
   - Validate in server actions before calling service

3. **Service Layer Isolation:**
   - Services handle DB queries and business logic
   - Services return Result type
   - Services are testable in isolation

4. **Server Actions as Thin Wrappers:**
   - Validate input with Zod
   - Check auth and company scope
   - Call service
   - Return result

5. **React Query for Data Fetching:**
   - Use `useQuery` for reads
   - Use `useInfiniteQuery` for pagination
   - Use `useMutation` for writes
   - Implement optimistic updates for UX

6. **Audit Logging:**
   - Log all mutations (create, update, delete)
   - Include user ID, timestamp, old/new values
   - Use `auditLogsTable`

### Common Pitfalls to Avoid

- ❌ **Skipping company scope check** → Data leaks between companies
- ❌ **Selecting all columns** → Performance issues
- ❌ **N+1 queries** → Slow list pages
- ❌ **No error handling** → Silent failures
- ❌ **Hardcoded limits** → Scalability issues
- ❌ **No pagination** → Memory issues with large datasets
- ❌ **Optimistic updates without rollback** → Stale UI
- ❌ **No loading states** → Poor UX
- ❌ **Mixing UI state and server state** → Sync issues

### Debugging Tips

**Enable Query Logging:**
```ts
// In development
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
    },
  },
});

// Add React Query DevTools
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
<ReactQueryDevtools initialIsOpen={false} />;
```

**Check Database Queries:**
```ts
// Enable Drizzle logging
import { sql } from "drizzle-orm";
// Set DEBUG=drizzle:* in env
```

**Monitor Performance:**
```ts
// Use browser DevTools Performance tab
// Check Network tab for slow requests
// Use React DevTools Profiler
```

---

## 14. Migration & Rollout

### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Code review completed
- [ ] Database migrations tested on staging
- [ ] Performance benchmarks acceptable
- [ ] Security review completed
- [ ] Accessibility audit passed
- [ ] Documentation updated

### Deployment Steps

1. **Deploy database migrations** (if any)
   ```bash
   npm run db:push
   ```

2. **Deploy code**
   ```bash
   git push origin feature/conversations
   # Merge PR
   # Deploy to production
   ```

3. **Monitor logs**
   - Watch for errors in server logs
   - Monitor performance metrics
   - Check audit logs for suspicious activity

4. **Rollback Plan**
   - If critical errors: revert deployment
   - If data corruption: restore from backup
   - Notify users of any downtime

### Feature Flags (Optional)

```ts
// Use feature flag to gradually roll out
if (process.env.FEATURE_CONVERSATIONS_ENABLED === "true") {
  // Show conversations UI
}
```

---

## 15. Future Enhancements

- [ ] WebSocket support for real-time messaging (replace polling)
- [ ] Full-text search for messages
- [ ] Message reactions (emoji)
- [ ] Message forwarding
- [ ] Message deletion/editing
- [ ] Conversation templates
- [ ] Bulk actions (archive, assign multiple)
- [ ] Conversation analytics (response time, sentiment)
- [ ] AI-powered suggestions
- [ ] Integration with external CRM systems
- [ ] WhatsApp status updates
- [ ] Group conversations
- [ ] Message scheduling
- [ ] Auto-reply templates

---

## Summary

This build spec provides **complete, production-ready instructions** for implementing the WhatsApp Conversations feature. Follow the implementation order (DB → Services → Actions → Hooks → Components) and adhere to the Result pattern, Zod validation, and company-scoped multi-tenancy throughout.

**Key Deliverables:**
- 8 server actions (get, list, update, send, etc.)
- 2 service classes (Conversation, Message)
- 4 React Query hooks with optimistic updates
- 11 UI components (list, thread, contact panel, etc.)
- Full test coverage (unit, integration, E2E)
- Performance logging and monitoring
- Security enforcement at every layer

**Estimated Effort:** 40-60 hours for a team of 2 developers.

**Ready to implement!**
