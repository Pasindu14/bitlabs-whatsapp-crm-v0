---
feature: WhatsApp Account Management
plan: 01
date: 2025-12-30
---

1) **Feature Summary**
- Goal: Allow tenants to create, view, update, and manage WhatsApp Business accounts (WABA/phone-number credentials) for messaging. Ensure tenant isolation and auditability.
- Actors & permissions: Admin/Manager can create/update/activate/deactivate/delete; Agent can view list/details; System uses credentials for sending (service layer only).
- Primary flows: list accounts, view account detail, create account, update account (name/token/webhook), activate/deactivate, delete/soft-delete, set default/sending account.
- Assumptions: Single companyId per session; accessToken stored as opaque string (encrypted at rest via infra, not app-level); webhook URL optional; phoneNumberId + businessAccountId combination unique per company; soft delete via isActive boolean; expected scale tens to hundreds per tenant; UI as protected page under /protected/whatsapp-accounts with table + modal form.

2) **Domain Model**
- Entities:
  - WhatsAppAccount: Credentials + metadata for a WABA phone number within a company.
- Relationships:
  - Company 1 - many WhatsAppAccount.
- State: status isActive (true/false). Could add "default" boolean (one per company) if needed; include in schema with unique partial index.

3) **Database Design (Postgres/Drizzle)**
- Table: whatsapp_accounts (already present; extend if needed)
  - id serial PK
  - companyId int not null FK companies.id
  - name text not null
  - phoneNumberId text not null
  - businessAccountId text not null
  - accessToken text not null
  - webhookUrl text null
  - isActive boolean not null default true
  - isDefault boolean not null default false (new) — only one default per company
  - createdAt timestamptz default now not null
  - updatedAt timestamptz
  - createdBy int null FK users.id
  - updatedBy int null FK users.id
- Constraints:
  - Unique (companyId, phoneNumberId)
  - Unique (companyId, name)
  - Unique partial on (companyId) where isDefault = true (one default per company)
- Indexes (per company, cursor-friendly):
  - (companyId, createdAt desc, id asc) for default sorting/pagination
  - (companyId, name asc, id asc) for name sorting/search prefix
  - (companyId, isActive asc, createdAt desc) for filtering active/inactive
  - (companyId, phoneNumberId asc) for lookup
  - (companyId, businessAccountId asc) for lookup
- Expected queries:
  - List with filters (isActive, search name/phone) + sort (createdAt/name) -> indexes above
  - Get by id within company -> PK + company filter
  - Set default -> update with unique partial constraint
  - Activate/deactivate -> update isActive
- Migration steps:
  1) Alter whatsapp_accounts add columns isDefault boolean default false not null, createdBy int, updatedBy int, updatedAt timestamptz
  2) Add unique constraints (companyId, phoneNumberId) & (companyId, name)
  3) Add partial unique index on (companyId) where isDefault
  4) Add indexes listed above
  5) Backfill createdBy/updatedBy null-safe if needed

4) **API / Server Actions Contract**
- listWhatsappAccounts({ cursor?, limit=20, search?, isActive?, sortField?, sortOrder? }) -> { items, nextCursor, hasMore }
- getWhatsappAccount({ id }) -> account
- createWhatsappAccount({ name, phoneNumberId, businessAccountId, accessToken, webhookUrl?, isDefault?, companyId, userId }) -> account
- updateWhatsappAccount({ id, name?, accessToken?, webhookUrl?, isDefault?, isActive?, companyId, userId }) -> account
- setDefaultWhatsappAccount({ id, companyId, userId }) -> void (clears previous default inside tx)
- deleteWhatsappAccount({ id, companyId, userId }) -> void (soft via isActive=false or hard delete if required; prefer soft)
- Error cases: validation failed, unauthorized (session/role), not found, conflict (unique/partial unique), inactive account, missing company context.
- Pagination: cursor base64 of { createdAt, id } with limit+1 fetch.

5) **Validation (Zod)**
- Client schemas: create/update/filter
  - createClientSchema: name (trim, 2-120), phoneNumberId (trim), businessAccountId (trim), accessToken (trim, min 10), webhookUrl optional URL, isDefault boolean optional
  - updateClientSchema: same fields optional, isActive boolean
  - filterSchema: cursor string optional, limit number (1-100), search string optional (trim, max 120), isActive boolean optional, sortField enum(createdAt,name), sortOrder enum(asc,desc)
- Server schemas: extend with companyId (uuid/string?) and userId (uuid/string?) per existing conventions (use numbers if DB uses serial), align with session types; coerce email casing none here; ensure trim/lowercase where needed.
- Response schemas: accountResponse, accountListResponse with cursor metadata.

6) **Service Layer Plan**
- whatsappAccount.service.ts
  - list(data): company scoped, apply search (ILIKE on name/phone), isActive filter default true, cursor pagination using createdAt desc, id desc/asc tie-break; return Result.ok({ items, nextCursor, hasMore })
  - getById({ id, companyId }): return scoped record or fail not found
  - create(data): enforce uniqueness via DB constraints; if isDefault true, wrap in transaction to clear previous default for company; return created record (selected fields)
  - update(data): scoped update; if setting isDefault true, transaction to clear previous default; handle isActive toggle; return updated record
  - setDefault(data): transaction: clear previous default then set target default
  - delete/softDeactivate(data): set isActive=false and updatedBy; optionally redact accessToken? (keep as-is)
- Safety: select/return only needed columns; use returning; wrap multi-step operations in transaction; use performance logger per operation.

7) **UI/UX Plan (shadcn + TanStack)**
- Page `/protected/whatsapp-accounts`
  - Header with title, description, "New Account" button -> opens modal/drawer form
  - Table (TanStack) with columns: Name, Phone Number ID, Business Account ID, Status (active/default), Updated At, Actions (edit, set default, activate/deactivate) using shared `components/data-table/generic-data-table.tsx` (do not reimplement)
  - Filters: search by name/phone, isActive toggle, sort selector
  - Row badges: Default, Inactive
  - Empty state with CTA to create account
- Modal form (react-hook-form + zodResolver): fields name, phoneNumberId, businessAccountId, accessToken (password input), webhookUrl (optional), isDefault checkbox
- Detail inline drawer optional for later; not required initial
- Toasts via Sonner for create/update/activate/deactivate/default set
- Loading: skeleton table rows; Error: inline alert

8) **Hook/State Plan**
- Hooks (React Query):
  - useWhatsappAccounts (list) with cursor pagination; keys include filters
  - useCreateWhatsappAccount, useUpdateWhatsappAccount, useSetDefaultWhatsappAccount, useToggleWhatsappAccount (activate/deactivate)
- Invalidation: after mutations, invalidate list and specific get
- Local state: use Zustand or component state for modal open; optimistic updates optional for activate/deactivate; avoid for create/update because of token handling.

9) **Security & Compliance**
- Auth required; role check admin/manager for mutations
- All queries/mutations include companyId from session (withAction helper); service filters by companyId AND id; enforce isActive default true for list unless explicitly requested
- Do not log accessToken contents; avoid sending tokens to client after creation (maybe omit from response); mask in UI
- Add audit logging on create/update/default-toggle/deactivate

10) **Testing Plan**
- Unit tests: service methods for create (unique conflict), setDefault (clears previous), list pagination cursor correctness, activate/deactivate toggles
- Integration: server actions with mocked session; DB tests with seeded data
- UI: render table and modal; form validation errors; mutation success path with mocked actions; default badge behavior
- Edge cases: duplicate phoneNumberId, missing accessToken, set default on inactive account (should fail), pagination boundary (no more results), search returning zero rows

11) **Performance & Observability**
- Index recap: (companyId, createdAt desc, id asc); (companyId, name asc, id asc); (companyId, isActive asc, createdAt desc); partial unique on isDefault; unique combos on name/phone
- Avoid N+1: fetch list with single query; no joins needed initially
- Logging: performance logger around service methods; audit logger for mutations
- Debounce search input on UI (use-debounce)

12) **Delivery Checklist**
- Create @plan/plan-01.md (done)
- DB migration: add columns/constraints/indexes
- Feature folders: schemas/actions/services/hooks/components for whatsapp-accounts
- Wire page /protected/whatsapp-accounts with table + modal
- Ensure withAction/withPublicAction usage for multi-tenant + validation
- Tests per plan
- Definition of Done: all flows implemented, tests pass, lint/build pass, multi-tenant filters present, accessToken not exposed to client responses
