---
feature: WhatsApp Account Selector in Conversation Inbox
date: 2026-01-06
planNumber: 03
---

# Feature Master Plan: WhatsApp Account Selector in Conversation Inbox

## 1) Feature Summary

**Goal**: Add a WhatsApp account selector dropdown at the top of the conversation inbox sidebar header that allows users to switch between multiple WhatsApp accounts. All conversation data should be filtered by the selected account.

**Actors & Permissions**:
- All authenticated users can view and select from their company's active WhatsApp accounts
- No special permissions required beyond standard authentication

**Primary Flows**:
1. **Initial Load**: Fetch all active WhatsApp accounts for the company, auto-select the first account (or default account), then load conversations for that account
2. **Account Selection**: User selects a different WhatsApp account from dropdown, conversations list refreshes with data for selected account
3. **Loading States**: Show loading indicator for accounts list and conversations separately
4. **Empty States**: Show appropriate message if no WhatsApp accounts exist or no conversations for selected account

**Assumptions**:
- WhatsApp accounts feature already exists with full CRUD operations
- Conversations are already linked to WhatsApp accounts via `whatsappAccountId` foreign key
- User has at least one active WhatsApp account configured
- Default account preference should be respected if set

---

## 2) Domain Model

**Entities**:
- **WhatsAppAccount**: Represents a connected WhatsApp Business API account (already exists)
- **Conversation**: Represents a chat conversation linked to a WhatsApp account (already exists)

**Relationships**:
- WhatsAppAccount 1 → Many Conversations (one account can have many conversations)
- Company 1 → Many WhatsAppAccounts (multi-tenant)

**State Machine**:
- Account Selection State: `unloaded` → `loading` → `loaded` → `selected` → `switching`

---

## 3) Database Design (Postgres/Drizzle)

**No new tables required** - using existing schema:

**Existing Tables**:
- `whatsapp_accounts_table` (already exists)
  - Columns: `id`, `companyId`, `name`, `phoneNumberId`, `businessAccountId`, `accessToken`, `isActive`, `isDefault`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`
  
- `conversations_table` (already exists)
  - Columns: `id`, `companyId`, `whatsappAccountId`, `contactId`, `assignedToUserId`, `status`, `lastMessageAt`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy`

**Indexes** (verify these exist, add if missing):
```sql
-- For filtering conversations by account
CREATE INDEX IF NOT EXISTS idx_conversations_whatsapp_account 
ON conversations(companyId, whatsappAccountId, isActive, lastMessageAt DESC);

-- For fetching active accounts
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_company_active 
ON whatsapp_accounts(companyId, isActive, isDefault, createdAt DESC);
```

**Expected Queries**:
- List active accounts: `WHERE companyId = ? AND isActive = true ORDER BY isDefault DESC, createdAt DESC`
- List conversations by account: `WHERE companyId = ? AND whatsappAccountId = ? AND isActive = true ORDER BY lastMessageAt DESC`

**Migration Steps**:
1. Verify indexes exist on `conversations_table` for `whatsappAccountId`
2. Verify indexes exist on `whatsapp_accounts_table` for `companyId, isActive`
3. No schema changes required

---

## 4) API / Server Actions Contract

**Actions to Use** (already exist):
- `listWhatsappAccountsAction`: Fetch all active WhatsApp accounts for company
- Already returns: `{ items: WhatsappAccountResponse[], nextCursor, hasMore }`

**New/Modified Actions**:
- `getConversationsByWhatsappAccountAction` (modify existing conversation list action):
  - **Input**: `{ whatsappAccountId: number, filterType, searchTerm, includeArchived, limit, cursor }`
  - **Output**: `{ items: ConversationResponse[], nextCursor, hasMore }`
  - **Error cases**: Invalid account ID, account not found, unauthorized access

**Pagination Strategy**:
- Cursor-based pagination (already implemented)
- Cache key includes `whatsappAccountId` for proper invalidation

---

## 5) Validation (Zod)

**Schemas to Modify** (existing):
- `conversationFilterClientSchema`: Add `whatsappAccountId` field
- `conversationFilterServerSchema`: Add `whatsappAccountId` with validation

**New Schema**:
```typescript
export const whatsappAccountSelectorSchema = z.object({
  whatsappAccountId: z.number().int().positive().nullable(),
});
export type WhatsappAccountSelectorInput = z.infer<typeof whatsappAccountSelectorSchema>;
```

**Shared Types**:
- `SelectedAccountState`: `{ id: number | null, name: string | null, isLoading: boolean }`

---

## 6) Service Layer Plan

**Service Methods** (modifications to existing ConversationService):

**`listByWhatsappAccount`**:
- **Responsibility**: List conversations filtered by WhatsApp account ID
- **Transaction**: Not needed (read-only)
- **Safety Rules**: 
  - Validate `whatsappAccountId` belongs to company
  - Select only needed columns
  - Apply cursor pagination
- **Performance Logging**: `ConversationService.listByWhatsappAccount`
- **Result Mapping**: 
  - Success: `Result.ok({ items, nextCursor, hasMore })`
  - Failure: `Result.fail()` for invalid account ID

**Transaction Boundaries**:
- No transactions required for read operations
- Account selection is client-side state only

---

## 7) UI/UX Plan (shadcn + TanStack)

**Screens/Components to Add**:

1. **`WhatsAppAccountSelector`** (new component):
   - Location: `features/conversations/components/whatsapp-account-selector.tsx`
   - UI: Select dropdown with account names
   - States: Loading, Loaded, Empty, Error
   - Features: 
     - Show account name + phone number
     - Badge for "Default" account
     - Loading skeleton while fetching accounts
     - Empty state if no accounts

2. **`ConversationSidebarHeader`** (new component):
   - Location: `features/conversations/components/conversation-sidebar-header.tsx`
   - UI: Header with title + account selector + new message button
   - Layout: Responsive, account selector below title on mobile, inline on desktop

3. **Modify `ConversationsPage`**:
   - Add account selector to sidebar header
   - Pass selected account to conversation list
   - Show loading state for entire sidebar until account selected

**Forms**:
- No forms needed (selection only)

**Table**:
- Existing `ConversationList` component receives `whatsappAccountId` prop

**Empty/Loading/Error States**:
- **Loading accounts**: Show skeleton selector
- **No accounts**: Show "No WhatsApp accounts configured" with CTA to add account
- **Loading conversations**: Show skeleton list
- **No conversations**: Show "No conversations for this account" message
- **Error**: Show toast notification

**Toast Strategy**:
- Error loading accounts: "Failed to load WhatsApp accounts"
- Error switching accounts: "Failed to switch account"

---

## 8) Hook/State Plan

**Hooks to Create**:

1. **`useSelectedWhatsappAccount`** (new hook):
   - Location: `features/conversations/hooks/use-selected-whatsapp-account.ts`
   - **Responsibility**: Manage selected WhatsApp account state
   - **React Query**: 
    - Fetch accounts with `useWhatsappAccounts({ isActive: true, limit: 100 })`
    - Auto-select first account or default account
    - Persist selection to localStorage
   - **Cache Key**: `['whatsapp-accounts', 'selected']`
   - **Invalidation**: Invalidate on account list changes
   - **Returns**: `{ selectedAccount, accounts, isLoading, error, selectAccount }`

2. **Modify `useConversations`** hook:
   - Add `whatsappAccountId` parameter
   - Update query key to include `whatsappAccountId`
   - Only execute query when `whatsappAccountId` is not null

**Local State (Zustand)**:
- **Modify `ConversationStore`**:
  - Add `selectedWhatsappAccountId: number | null`
  - Add `setSelectedWhatsappAccountId(id: number | null)`
  - Persist to localStorage

**Optimistic Updates**:
- Not needed for account selection (pure read operation)

---

## 9) Security & Compliance

**Auth Requirements**:
- Session-based authentication (already implemented)
- All queries scoped by `companyId` from session

**Row-level Tenant Enforcement**:
- Service layer validates `whatsappAccountId` belongs to user's company
- Database queries include `companyId` filter
- Prevents cross-tenant data leakage

**Data Validation**:
- Account ID validation in server actions
- Prevent null account ID in conversation queries
- Validate account is active before selecting

---

## 10) Testing Plan

**Unit Tests**:
- `useSelectedWhatsappAccount` hook:
  - Auto-selects first account when loaded
  - Auto-selects default account if exists
  - Persists selection to localStorage
  - Handles empty accounts list
  - Handles loading states

**Integration Tests**:
- Service method `listByWhatsappAccount`:
  - Returns correct conversations for account
  - Filters by company
  - Handles invalid account ID
  - Pagination works correctly

**UI Tests**:
- `WhatsAppAccountSelector` component:
  - Renders loading state
  - Renders account options
  - Shows default badge
  - Handles selection change
  - Shows empty state

**Critical Flows**:
1. Initial load → accounts fetched → first account auto-selected → conversations loaded
2. User selects different account → conversations refresh
3. User has no accounts → empty state shown
4. Account list fails to load → error toast shown

**Edge Cases**:
- No active WhatsApp accounts
- Default account is inactive
- Account gets deleted while selected
- Rapid account switching
- Network errors

---

## 11) Performance & Observability

**Query Cost Risks**:
- Fetching all accounts (limit 100) - minimal impact
- Conversation queries already optimized with indexes
- No N+1 queries expected

**Required Indexes**:
- `idx_conversations_whatsapp_account`: `(companyId, whatsappAccountId, isActive, lastMessageAt)`
- `idx_whatsapp_accounts_company_active`: `(companyId, isActive, isDefault, createdAt)`

**Logging/Metrics Events**:
- `WhatsAppAccountSelector.account_selected`: Track account switching
- `ConversationService.listByWhatsappAccount`: Performance logging
- `useSelectedWhatsappAccount.auto_selected`: Track auto-selection behavior

**N+1 Avoidance**:
- Single query for accounts list
- Single query for conversations per account
- No nested queries

**Debouncing**:
- Account selection: No debouncing needed (instant)
- Search: Already debounced in existing implementation

---

## 12) Delivery Checklist

**Files to Create**:
1. `features/conversations/components/whatsapp-account-selector.tsx`
2. `features/conversations/components/conversation-sidebar-header.tsx`
3. `features/conversations/hooks/use-selected-whatsapp-account.ts`

**Files to Modify**:
1. `features/conversations/store/conversation-store.ts` - Add selected account state
2. `features/conversations/hooks/conversation-hooks.ts` - Add whatsappAccountId to useConversations
3. `features/conversations/schemas/conversation-schema.ts` - Add whatsappAccountId to filter schema
4. `features/conversations/services/conversation-service.ts` - Add listByWhatsappAccount method
5. `features/conversations/actions/conversation-actions.ts` - Add whatsappAccountId to list action
6. `app/(protected)/conversations/page.tsx` - Integrate account selector

**Order of Implementation**:
1. **DB Layer**: Verify indexes exist (no schema changes)
2. **Schema**: Add `whatsappAccountId` to conversation filter schema
3. **Service**: Add `listByWhatsappAccount` method to ConversationService
4. **Actions**: Modify conversation list action to accept `whatsappAccountId`
5. **Hooks**: Create `useSelectedWhatsappAccount` hook, modify `useConversations`
6. **Store**: Add selected account state to ConversationStore
7. **Components**: Create `WhatsAppAccountSelector` and `ConversationSidebarHeader`
8. **Page**: Integrate selector into `ConversationsPage`
9. **Testing**: Add unit and integration tests

**Definition of Done**:
- [ ] Account selector visible in conversation sidebar header
- [ ] Accounts load and display in dropdown
- [ ] First account auto-selected on initial load
- [ ] Default account prioritized if exists
- [ ] Conversations filter by selected account
- [ ] Loading states displayed for accounts and conversations
- [ ] Empty states displayed when no accounts or conversations
- [ ] Account selection persists across page refreshes
- [ ] Error handling for failed loads
- [ ] Mobile responsive layout
- [ ] All linting passes
- [ ] Tests added and passing
