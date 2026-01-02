---
feature: WhatsApp Chat Workspace (Contacts, Conversations, Messages)
plan: 03
date: 2026-01-02
---

1) **Feature Summary**
- Goal: Deliver a WhatsApp-style chat workspace (contacts, conversations, messages) with UX parity to the provided reference: left nav for contacts/conversations, center chat thread with messages, right-side details, using existing tables in `db/schema.ts` (contacts, conversations, messages, whatsapp_accounts). Include robust loading spinners and error handling/logging for data fetch and mutations.
- Primary flows: list contacts & conversations, search/filter, open conversation, load messages with spinner, send message, mark read/update unread counts, assign user, archive/unarchive, create/update contact, link to WhatsApp account, handle errors with toasts/logging.
- Assumptions: Multi-tenant Postgres with Drizzle; existing auth/session provides `companyId`, `userId`, `role`; scale up to 50k messages/conversation with cursor pagination; media sending handled via separate provider but placeholder mutation exists; read receipts tracked via `messages.status`.

2) **Domain Model**
- Entities: Contact (person with phone/name/email/tags); Conversation (thread keyed by phone & whatsapp account, unread, status, lastMessageAt); Message (inbound/outbound item with content/status/timestamp); WhatsappAccount (sending credentials) for routing.
- Relationships: Company 1→N Contacts; Contact 1→N Conversations; Conversation 1→N Messages; WhatsappAccount 1→N Conversations.
- State machine: Conversation `status`: active → archived (can unarchive to active). Message `status`: sent → delivered → read | failed (outbound); inbound default delivered/read set by webhook.

3) **Database Design (Postgres/Drizzle)**
- Reuse existing tables in `db/schema.ts`:
  - `contactsTable`: id, companyId, phoneNumber (unique per company), name/email/notes/tags, audit timestamps.
  - `conversationsTable`: id, companyId, contactId?, phoneNumber, whatsappAccountId?, lastMessageAt, unreadCount, status, assignedTo?, audit timestamps.
  - `messagesTable`: id, companyId, conversationId, messageId, direction, type, content(jsonb), status, timestamp, createdAt.
  - `whatsappAccountsTable`: existing for routing and metadata.
- Constraints: FK companyId to companies; conversation.contactId FK; messages.conversationId FK. Maintain unreadCount via service transactionally.
- Audit fields: createdAt/updatedAt present; add createdBy/updatedBy only if required later (not in current schema). Soft delete via `status` + `isActive` at account level; no deletions planned.
- Multi-tenant: every query filters by `companyId`; enforce in services and actions.
- Indexes (already present) used:
  - Conversations: `(companyId,lastMessageAt desc,id asc)` for inbox sorting; `(companyId,status,lastMessageAt)` for archive filter; `(companyId,phoneNumber)` lookup; contact/assigned/account indexes.
  - Messages: `(conversationId,timestamp desc,id asc)` for thread pagination; `messageId` lookup.
  - Contacts: `(companyId,phoneNumber)` and `(companyId,name,id)` for search/sort.
- Migration steps: none required initially; if adding createdBy/updatedBy later, alter tables with nullable columns + backfill.

4) **API / Server Actions Contract**
- `listContactsAction(input)` → cursor list. Input: `{ cursor?, limit=20, search?, tags?, companyId }`; Output: `{ items, nextCursor, hasMore }`.
- `listConversationsAction(input)` → inbox. Input: `{ cursor?, limit=20, status?=active|archived, search?, assignedTo?, whatsappAccountId?, companyId }`; Output: `{ items, nextCursor, hasMore }`.
- `getConversationAction({ id, companyId })` → conversation + contact summary.
- `listMessagesAction(input)` → thread messages. Input: `{ conversationId, cursor?, limit=30, companyId }`; Output: `{ items, nextCursor, hasMore }`. Must show spinner while loading.
- `sendMessageAction(input)` → create outbound message and push to provider. Input: `{ conversationId, type, content, companyId, userId }`; Output: `{ message }`. Errors mapped to Result.fail with logged context.
- `markConversationReadAction({ id, companyId })` → sets unreadCount=0 and updates lastMessageAt.
- `archiveConversationAction({ id, companyId, userId, archive: boolean })`.
- `assignConversationAction({ id, assignedTo, companyId, userId })`.
- `upsertContactAction({ id?, phoneNumber, name?, email?, tags?, companyId, userId })`.
- Error cases: validation failures, not found, unauthorized role, cross-tenant access, cursor decode errors, provider send failures, constraint conflicts (duplicate phone), inactive whatsapp account.
- Pagination strategy: cursor base64 `{ sortFieldValue (lastMessageAt or timestamp), id }`, fetch `limit+1`.

5) **Validation (Zod)**
- Schemas:
  - `contactCreate/UpdateClientSchema`, `contactServerSchema` (adds companyId/userId), `contactListClientSchema` (cursor/search/tags).
  - `conversationListClientSchema` (cursor/status/search/assignedTo/account), `conversationIdSchema`.
  - `messageListClientSchema` (conversationId, cursor, limit), `sendMessageClientSchema` (type enum text|image|document|template, content object with URL/text validation), `markReadSchema`, `archiveSchema`, `assignSchema`.
- Refinements: phoneNumber E.164; content required fields per type; cursor base64 parse with safe guard.
- Shared response schemas: `contactResponse`, `conversationResponse`, `messageResponse`, list response with cursor metadata.

6) **Service Layer Plan**
- `ContactService`: list (search on name/phone via ILIKE, company filter), upsert (phone unique per company), getByPhone helper. Returns `Result.ok/notFound/conflict/fail`.
- `ConversationService`: list with status filter + search (phone/contact name join optional via subselect), cursor pagination on lastMessageAt; getById; createOrGetByPhone (used when receiving inbound); updateUnreadCount; archive; assign. Transactions around unreadCount resets and assignments.
- `MessageService`: list by conversationId with cursor on timestamp; send (insert outbound message, update conversation lastMessageAt/unreadCount=0 for outbound, performance log external send), recordInbound (for webhooks), updateStatus by messageId. Always select only needed columns and filter by companyId.
- Safety: transactions where updating conversation + message; use `Result` pattern; wrap each public method with performance logger and structured error logs (operation, companyId, conversationId, userId, messageId).

7) **UI/UX Plan (shadcn + TanStack)**
- Screens/components:
  - `/protected/inbox` page with three-column layout: left conversations list, center chat thread, right contact/details/assignment.
  - Components: `ConversationList` (React Query + skeleton list + spinner while fetching), `ConversationListItem` (unread badge), `ChatThread` (message bubbles, timestamps, status icons), `MessageComposer` (input + send button with loading state), `ContactSidebar` (contact details + edit form), `AssignDropdown`, `ArchiveToggle`, `ErrorBoundary` blocks for each column.
- Loading states: skeleton rows for conversation list; spinner overlay when fetching messages or switching conversation; disable send while sending; optimistic append outbound message with pending state.
- Error states: inline alert + retry buttons for list/messages; Sonner toasts for mutations; structured console/info logs for debugging (without leaking secrets).
- Table/filters: search box (debounced) for conversations and contacts; filter pills for status (Active/Archived), account dropdown, assigned user filter.
- Accessibility: focus management when opening thread; aria-live for toasts.

8) **Hook/State Plan**
- React Query hooks:
  - `useContacts(params)` (useInfiniteQuery, key: ["contacts", params]).
  - `useConversations(params)` (useInfiniteQuery, cursor-based). On params change, show spinner until data ready.
  - `useMessages(conversationId)` (useInfiniteQuery with cursor). Keep previous data while loading new pages; show spinner on initial.
  - Mutations: `useSendMessage`, `useMarkRead`, `useArchiveConversation`, `useAssignConversation`, `useUpsertContact` — each invalidates relevant caches (`conversations`, `messages`, `contacts`).
- Local state: selectedConversationId, composer text, attachment draft; no Zustand unless needed; optimistic outbound message append with rollback on error.
- Error handling: mutation onError -> toast + log with context; query onError -> show error component + retry.

9) **Security & Compliance**
- All actions wrapped with session/role guard; enforce `companyId` scoping in services. Viewer cannot mutate; Agent cannot archive/delete contacts unless permitted; Admin/Manager can mutate all.
- Do not log message content when erroring; log only metadata (ids, types). Mask access tokens.
- Validate phone numbers and content to prevent injection; escape search inputs.

10) **Testing Plan**
- Unit tests: cursor pagination math for conversations/messages; sendMessage updates conversation lastMessageAt/unread; archive toggles status; assign updates assignedTo with company scoping; contact upsert handles duplicate phone conflict.
- Integration tests: server actions with mocked session ensure tenant isolation and role checks; inbound message handling updates unread count; markRead zeroes unread.
- UI tests: conversation list loading spinner, message thread spinner on switch, send message success/error toasts, optimistic append rollback, archive/assign flows, contact edit modal validation.
- Edge cases: long threads (pagination >5 pages), zero results, concurrent send failure, cursor tampering, archived conversations still load messages read-only.

11) **Performance & Observability**
- Query risks: large message history; always paginate with `(timestamp desc, id asc)` index; limit 30/page; avoid N+1 by selecting contact names via join only when needed.
- Index recap: reuse existing indexes in `db/schema.ts` for conversations/messages/contacts; consider future partial index on `status='archived'` if archive-heavy tenants.
- Logging/metrics: performance logger around service methods; structured logs for validation errors and provider failures; increment counters for send success/fail; measure message load latency.
- Debounce search inputs (300ms) to avoid query storms; cache conversations/messages with React Query; batch invalidations.

12) **Delivery Checklist**
- Files/folders to create:
  - `features/conversations/schemas/*.ts` (contact, conversation, message DTOs)
  - `features/conversations/services/{contact.service.ts,conversation.service.ts,message.service.ts}`
  - `features/conversations/actions/*.ts`
  - `features/conversations/hooks/{use-contacts.ts, use-conversations.ts, use-messages.ts, use-send-message.ts}`
  - `features/conversations/components/{conversation-list.tsx, conversation-list-item.tsx, chat-thread.tsx, message-composer.tsx, contact-sidebar.tsx, assign-dropdown.tsx, archive-toggle.tsx}`
  - Page: `app/(protected)/inbox/page.tsx`
  - Tests under `features/conversations/__tests__/`
- Order: schemas → services → actions → hooks → components/page → tests → smoke build.
- Definition of Done: multi-tenant scoping enforced, spinners on conversation/message loading, robust error handling + logging (no sensitive data), cursor pagination working, toasts wired, tests pass, lint passes.
