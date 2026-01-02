# WhatsApp CRM — Conversations Page (End-to-End Build Plan for AI IDE)

> Target: Build the WhatsApp Conversations UI (left list + chat thread + right contact panel) and all backend flows (DB → services → actions → hooks → UI → webhook ingest), using **existing schemas**.  
> Key requirement: **Sending messages must go through internal API route** `POST /api/whatsapp/send` (provider integration stays inside that route).

---

## 0) Definition of Done (DoD)

### UI
- Left panel: WhatsApp account selector, status filter (Active/Archived), search, conversation list, unread badges.
- Center panel: selected conversation header, message list, composer (text), send button.
- Right panel: contact summary, assignment, archive/unarchive, unread count, IDs.

### Behaviors
- Load accounts → load conversations → select conversation → load messages.
- Send outbound message:
  - persists DB first (outbound message row) ✅
  - then calls internal route `POST /api/whatsapp/send` ✅
  - updates message status based on API response ✅
- Inbound webhook ingestion:
  - creates/updates contact, conversation, message (idempotent) ✅
  - updates unread count + last message time ✅
- Assignment + archive operations update DB + UI immediately.
- Solid error handling + logging + loading states everywhere.

---

## 1) Constraints / Non-Negotiables

1. **Do NOT remove or relocate existing components in features folder.**
2. Respect multi-tenant scope: **companyId must filter everything**.
3. DB writes must be **idempotent** for webhook events (dedupe by provider messageId).
4. Mutations must implement:
   - optimistic UI updates where safe
   - rollback on error
5. Every server-side operation must have:
   - structured logging
   - consistent error model (AppFailure)
   - no unhandled throws leaking to client

---

## 2) Data Model (Use Existing Schemas)

Use the tables already defined in your Drizzle schema (pasted file):
- `whatsapp_accounts`
- `contacts`
- `conversations`
- `messages`
- `audit_logs`

> If any index/constraint is missing, only **add** (do not remove existing columns).

### Recommended (Add if missing)
- Unique dedupe for messages:
  - `UNIQUE(company_id, conversation_id, message_id)` (or `UNIQUE(company_id, message_id)` if globally unique)
- Indexes:
  - conversations list: `(company_id, status, last_message_at desc, id)`
  - messages list: `(company_id, conversation_id, timestamp desc, id)`

---

## 3) Standard Result + Error Shape

### Result
All services/actions return:
```ts
type Result<T> = { success: true; data: T } | { success: false; error: AppFailure };
```

### AppFailure
```ts
type AppFailure = {
  code:
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "VALIDATION"
    | "CONFLICT"
    | "DB_ERROR"
    | "PROVIDER_ERROR"
    | "UNKNOWN";
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
};
```

UI handling rules:
- Queries: inline error block + Retry button
- Mutations: toast error + keep UI stable
- Provider error: retryable true

---

## 4) Build Order (AI IDE MUST FOLLOW)

1) **Types + Zod schemas**  
2) **Services** (DB + tx + logging + audit)  
3) **Internal API route** `/api/whatsapp/send` (provider integration)  
4) **Server Actions** (validate → service)  
5) **React Query hooks**  
6) **UI components & page wiring**  
7) **Webhook route** (inbound + status updates)  
8) **Polling refresh**  
9) **Tests** + lint fix pass  

---

## 5) Types (Domain Contracts)

Create domain types (match DB fields):
- `WhatsAppAccountItem`
- `ConversationListItem` (includes `unreadCount`, `lastMessagePreview`, `lastMessageAt`, `contact`)
- `ConversationDetails`
- `MessageItem` (direction, type, content, status, timestamp)
- `ContactDetails`

Acceptance:
- No `any` in domain types.

---

## 6) Zod Validation (Inputs)

Create Zod schemas:

### Conversations
- `listConversationsInput`
  - `{ companyId, accountId?, status?: "active"|"archived", search?: string, cursor?, limit }`
- `getConversationDetailsInput`
  - `{ companyId, conversationId }`
- `markConversationReadInput`
  - `{ companyId, conversationId }`
- `assignConversationInput`
  - `{ companyId, conversationId, assignedTo?: number|null }`
- `archiveConversationInput`
  - `{ companyId, conversationId, status: "active"|"archived" }`

### Messages
- `listMessagesInput`
  - `{ companyId, conversationId, cursor?, limit }`
- `sendTextMessageInput`
  - `{ companyId, conversationId, content: { text: string } }`

Acceptance:
- Actions reject invalid payload with `VALIDATION`.

---

## 7) Services (DB + Logging + Audit)

### 7.1 WhatsAppAccountsService
- `listAccounts(companyId)` → active accounts, default first.

### 7.2 ConversationsService
- `listConversations(input)`
  - Filters: companyId, accountId optional, status, search (phone/name)
  - Sort: `lastMessageAt DESC, id ASC`
  - Cursor pagination
- `getConversationDetails(companyId, conversationId)`
  - Join contact + assigned user fields (if your user table exists).
- `markRead(companyId, conversationId, userId)`
  - Set `unreadCount=0`, update `updatedAt`
  - Insert `audit_logs` (entityType="conversations", action="mark_read")
- `setAssignment(companyId, conversationId, assignedTo, userId)`
  - Update assignedTo
  - Audit log action: assign/unassign
- `setArchiveStatus(companyId, conversationId, status, userId)`
  - Update status
  - Audit log action: archive/unarchive

### 7.3 MessagesService
- `listMessages(companyId, conversationId, cursor, limit)`
  - Sort: `timestamp DESC, id ASC` → reverse in UI for chat order

#### 7.3.1 sendTextMessage (CRITICAL FLOW)
Implement **exactly** in this order:

**Step A — Load conversation**
1. Fetch conversation by `(companyId, conversationId)`  
2. If not found → `NOT_FOUND`

**Step B — Insert message + update conversation (DB transaction)**
3. Start DB transaction  
4. Insert new message row:
   - direction: `"outbound"`
   - type: `"text"`
   - content: `{ text }`
   - status: `"pending"` (or `"sent"` if you prefer)
   - timestamp: `now()`
   - `conversationId`, `companyId`
5. Update conversation:
   - `lastMessageAt = now()`
   - optionally store `lastMessagePreview`
6. Insert audit log:
   - entityType: `"messages"`, action: `"send_attempt"`
   - include metadata: conversationId, phone number (safe)
7. Commit transaction

**Step C — Send via internal API route**
8. Call internal route (server-to-server):
   - `POST /api/whatsapp/send`
   - Use absolute URL via `process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"`
   - Body:
     - companyId
     - recipientPhoneNumber: `convo.phoneNumber`
     - text: input.content.text
9. If API returns success:
   - Update message row:
     - set `status="sent"` (or provider returned status)
     - set `messageId` from provider response (if any)
   - Insert audit log: action `"send_success"`
10. If API returns error:
   - Update message row:
     - set `status="failed"`
   - Insert audit log: action `"send_failed"` + error summary
   - Return `Result.fail(PROVIDER_ERROR, retryable=true)`

**Step D — Return**
11. Return saved message (with latest status/messageId)

**Notes**
- Do not retry automatically.
- Do not expose provider tokens in logs.
- This flow guarantees the UI always shows the outgoing bubble even if provider fails.

---

## 8) Internal API Route: `POST /api/whatsapp/send`

Create route handler at `app/api/whatsapp/send/route.ts`:

### Input
```ts
{
  companyId: number;
  recipientPhoneNumber: string;
  text: string;
}
```

### Steps
1. Validate input (Zod)
2. Resolve WhatsApp account credentials/config by companyId (and default account if needed)
3. Call your provider (WASenderAPI / Meta Graph)
4. Map provider response → normalized response:
```ts
{ success: true, data: { providerMessageId?: string, raw?: unknown } }
or
{ success: false, error: { code: "PROVIDER_ERROR", message, details?, retryable: true } }
```

### Error handling
- Provider non-2xx → return `PROVIDER_ERROR`
- Unexpected → return `UNKNOWN` with safe details

Acceptance:
- Calling this route directly from a server action works reliably.

---

## 9) Server Actions (thin, validated)

Create actions:
- `whatsappAccounts.actions.ts` → listAccounts
- `conversations.actions.ts` → listConversations, getConversationDetails, markRead, setAssignment, setArchiveStatus
- `messages.actions.ts` → listMessages, sendTextMessage

Rules:
- Validate Zod in action
- Derive/verify companyId from session if available (otherwise trust input but keep consistent)
- Never call provider from actions directly; **only MessagesService calls `/api/whatsapp/send`**.

---

## 10) Client Hooks (React Query)

Query keys:
- `["whatsapp", "accounts", companyId]`
- `["whatsapp", "conversations", companyId, accountId, status, search]`
- `["whatsapp", "conversation", companyId, conversationId]`
- `["whatsapp", "messages", companyId, conversationId]`

### Mutations (required behaviors)
- Send message:
  - Optimistic insert temp bubble in messages cache
  - On success: replace temp with real message
  - On fail: mark temp as failed OR replace with failed message
- Mark read:
  - Optimistically set unreadCount = 0 in list cache + detail cache
- Assign/archive:
  - Optimistically update list item + details cache

### Refresh
- Poll conversations list every 5–10s
- Poll selected conversation messages every 3–5s while visible/focused

---

## 11) UI (Match Screenshot)

### Layout
- LeftPanel (25%):
  - Account selector
  - Status filter
  - Search input
  - ConversationList
- CenterPanel (50%):
  - ConversationHeader
  - MessagesThread
  - Composer
- RightPanel (25%):
  - ContactCard
  - AssignmentControl
  - ArchiveButton
  - Metadata

### Required UI States (implement all)
Left panel:
- loading → skeleton list
- error → retry
- empty → “No conversations”
- infinite loading more

Center:
- no selection → placeholder
- loading messages → skeleton bubbles
- error → retry
- sending message → disable button, spinner
- failed message bubble → show retry button (re-trigger send)

Right:
- loading skeleton
- error fallback
- contact missing → display phone only

---

## 12) Webhook Route (Inbound + Status Updates)

Create route e.g. `app/api/webhooks/whatsapp/route.ts`:

### Inbound message (idempotent)
In ONE transaction:
1. Resolve companyId via `phone_number_id` → `whatsapp_accounts`
2. Upsert contact by `(companyId, phoneNumber)`
3. Upsert conversation by `(companyId, phoneNumber, whatsappAccountId)`
4. Insert message (inbound) with `messageId` (dedupe via unique constraint)
5. Update conversation:
   - lastMessageAt
   - unreadCount += 1
6. Commit

### Status updates
- Find message by provider messageId → update status

Logging:
- Perf logging always
- No audit logs needed for webhooks

---

## 13) Tests (Minimum Set)

Service tests:
- `listConversations` pagination stable ordering
- `sendTextMessage`:
  - success: status becomes sent
  - failure: status becomes failed and returns PROVIDER_ERROR
- webhook inbound idempotency (duplicate event doesn’t duplicate message)

Action tests:
- Zod invalid payload → VALIDATION

UI smoke:
- no conversation selected state
- error state render

---

## 14) Acceptance Checklist

- [ ] Conversations list loads and filters (account/status/search)
- [ ] Selecting conversation loads details + messages
- [ ] Sending message:
  - [ ] inserts message row immediately
  - [ ] calls `POST /api/whatsapp/send`
  - [ ] updates message status to sent/failed
- [ ] Inbound webhook creates message and increments unread count
- [ ] Mark read resets unread count
- [ ] Assign + archive work with optimistic UI
- [ ] No console errors; all lint clean

---

## 15) Exact Snippet Requirement (internal API call)

MessagesService MUST use this pattern (adjust naming only):

```ts
// 3) Send via internal API route
const apiRes = await fetch(
  new URL("/api/whatsapp/send", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      companyId: input.companyId,
      recipientPhoneNumber: convo.phoneNumber,
      text: input.content?.text ?? "",
    }),
  }
);
```

---

**End of plan.**
