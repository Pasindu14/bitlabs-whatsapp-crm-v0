---
feature: WhatsApp Analytics (per account message volume)
planNumber: 10
date: 2026-01-08
---

## 1) Feature Summary
### Goal
Build an analytics page that shows per-WhatsApp-account message volumes (received vs sent), scoped by company, with clear filters and pagination. 

### Actors & Permissions
- Authenticated users (role-based): Admin/Manager can view all; Agent can view only accounts they have access to (assume all accounts for now; refine later).

### Primary Flows
- View analytics dashboard (per-account list with metrics).
- Filter by date range, account, status (active/inactive), and search by account name/phone.
- Paginate through accounts.
- View account detail panel (optional) with trend chart (counts over time) — initial MVP: list with totals only.

### Interaction-to-Data Flow
- View list: User opens /analytics → `AnalyticsPage` → `AnalyticsTable` → `useAccountAnalytics` (React Query) → `listAccountAnalyticsAction` → `AnalyticsService.list` → Drizzle query over messages grouped by account, scoped by `companyId` → returns Result → hook caches → table renders counts and status badges; toast on errors.
- Filter change (date range, search, status, account): UI updates query params/state → hook refetch → action/service re-run with filters.
- Pagination: UI pager → updates cursor/limit → hook refetch → action/service returns `hasMore` + next cursor.
- Detail view (if added): Row click → optional `useAccountAnalyticsDetail` → `getAccountAnalyticsAction` → `AnalyticsService.getById` (or chart query) → UI shows breakdown.
- No create/update/delete flows (read-only analytics). Deactivate flow irrelevant; rely on existing WhatsApp account status.

### Assumptions
- Metrics needed: total received messages, total sent messages, per WhatsApp account, within a date range.
- Data source: `messages` table (already tenant-scoped) joined to `whatsapp_accounts`.
- Status filter uses account `isActive` or existing status flag.
- Timezone: use UTC storage; UI format with date-fns.
- No role-based account restrictions for now (all authenticated users with company session can view).

---

## 2) Domain Model
- Entity: AccountAnalytics (derived, read-only): `whatsappAccountId`, `accountName`, `accountPhone`, `receivedCount`, `sentCount`, `dateRange`, `isActive`.
- Relationship: WhatsAppAccount 1–N Messages. Analytics is aggregated over Messages grouped by WhatsAppAccount.
- Invariants: counts are non-negative; queries always scoped by `companyId`; date range bounds inclusive.

---

## 3) Database Design (Postgres/Drizzle)
- No new tables required; use existing `messages` and `whatsapp_accounts`.
- If performance needs: consider a materialized view or summary table later (not in MVP). For now, live aggregate queries with indexes.

### Indexes (existing/needed)
- Ensure `messages` has composite index `(company_id, whatsapp_account_id, created_at)` to support date-range aggregates.
- Ensure `whatsapp_accounts` has `company_id` index and `is_active` index (existing per schema; verify).

### Migration Plan
- No migration if indexes already exist. If missing, add index on messages `(company_id, whatsapp_account_id, created_at)`. Rollback: drop index.

---

## 4) API / Server Actions Contract
- `listAccountAnalyticsAction(input)`: { companyId (from auth), cursor?, limit (default 20, max 100), searchTerm?, accountId?, status?, startDate?, endDate? } → { accounts: [{ whatsappAccountId, name, phone, receivedCount, sentCount, isActive }], nextCursor?, hasMore }
- `getAccountAnalyticsAction` (optional for detail): { companyId, whatsappAccountId, startDate?, endDate? } → { receivedCount, sentCount, dailySeries?: [{ date, received, sent }] }
- Errors: validation, unauthorized, not found (for get), unexpected.
- Pagination: cursor-based (id + createdAt of account as tiebreaker; or message count ordering + id).
- Cache: invalidate `analytics` queries on account status changes (if reused), else read-only.

---

## 5) Validation (Zod)
- `accountAnalyticsListSchema` (client/server): cursor?, limit 1-100 (default 20), searchTerm (trim, max 255), accountId?, status? (active/inactive/all), startDate?, endDate? (ensure start <= end), companyId (server only), userId (server only for audit/logging if needed).
- `accountAnalyticsGetSchema`: whatsappAccountId positive int, optional date range, companyId server only.
- Types: `AccountAnalyticsListInput`, `AccountAnalyticsListServerInput`, `AccountAnalyticsListResponse`, `AccountAnalyticsItem`.

---

## 6) Service Layer Plan
- `AnalyticsService.list(input: AccountAnalyticsListServerInput): Result<{ items, hasMore, nextCursor }>`
  - Query: messages join whatsapp_accounts filtered by companyId, optional accountId/status, date range, search on account name/phone (ILIKE), group by account, select counts of inbound vs outbound (messages.direction or sender flag), order by receivedCount desc then id desc, fetch limit+1 for cursor.
  - Logging: performance logger with row count.
- `AnalyticsService.getByAccount(input: AccountAnalyticsGetServerInput)`: optional daily series using date_trunc('day') group.

---

## 7) UI/UX Plan (shadcn + TanStack)
- Route: `/analytics` under protected layout.
- Components:
  - `AnalyticsPage` (server component) -> renders `AccountAnalyticsTable` (client).
  - `AccountAnalyticsTable`: filters bar (search, date range, account select, status select, reset), table columns (Account, Phone, Received, Sent, Status, Date Range applied), pagination/footer (rows per page + pager).
- States: loading skeleton; empty state with “No analytics found”; error toast.
- Accessibility: buttons labeled; inputs with placeholders; status badges.

---

## 8) Hook/State Plan
- `useAccountAnalytics(listInput)` (React Query useQuery): key `analytics.list` + filters; calls list action.
- `useAccountAnalyticsDetail(accountId, range)` (optional): key `analytics.detail`.
- Invalidation: invalidate on account status changes if reused; otherwise read-only.
- No Zustand needed.

---

## 9) Security & Compliance
- Auth required; `companyId` from session via `withAction`.
- Service-level tenant filtering on `companyId` in every query.
- Validate inputs (dates, limits) server-side; reject cross-tenant ids.

---

## 10) Testing Plan
- Service unit tests: list with date filter, search, status filter, pagination (cursor), no data, terminal status accounts.
- Action tests: validation failure, auth injection for companyId.
- UI tests: filter interactions debounce, pagination buttons disabled/enabled, empty state.
- Edge: startDate > endDate rejected; account not found for detail; large limits clamped.

---

## 11) Performance & Observability
- Index usage: `(company_id, whatsapp_account_id, created_at)` for date filters; company index for accounts.
- Avoid N+1: single aggregate query.
- Log query duration and row counts via performance logger.
- Debounce search input in UI.

---

## 12) Delivery Checklist
- Folders: `features/analytics/{schemas,services,actions,hooks,components}`.
- Order: schema → service → actions → hooks → UI page/table → tests.
- DoD: multi-tenant enforced; filters functional; cursor pagination works; UI responsive; toasts on error; tests pass.
