---
feature: User Management
plan: 02
date: 2025-12-30
---

1) **Feature Summary**
- Goal: Deliver a full "Users" admin surface that mirrors the WhatsApp Accounts feature structure—admins can list, create, edit, and deactivate company-scoped users while keeping auditability and tenant isolation intact.
- Actors & permissions: Admin can create/update/toggle/reset passwords; Manager can list + edit non-admin fields (name/role downgrade) but cannot delete admins; Agent/read-only roles can only list/self-view. System automations (e.g., onboarding flows) may call create via service layer using service credentials.
- Primary flows: list + search users, view details, create user (modal form), edit user (role/email/status) using same modal, activate/deactivate (soft delete), reset password/invite link regeneration.
- Assumptions: Each user belongs to a single company, passwords are stored hashed and never exposed, invites send via separate workflow, expected tenant size 5-500 users, UI resides at `/protected/users` with TanStack table + shadcn dialogs.

2) **Domain Model**
- Entities:
  - **User**: Person with login credentials, role, and status flags (`isActive`). Already stored in `usersTable`.
  - **AuditLog** (existing) captures changes for compliance.
- Relationships: Company 1→N Users; User 1→N AuditLogs (changedBy). No new many-to-many structures required.
- State machine: `isActive = true|false`. Transitions: `active → deactivate` (soft delete) and `inactive → reactivate`. Role transitions limited to Admin-only operations; prevent demoting the last remaining Admin inside a company.

3) **Database Design (Postgres/Drizzle)**
- Reuse existing `usersTable` schema with columns `id, name, email, passwordHash, role, companyId, createdBy, updatedBy, isActive, startDateTime, createdAt, updatedAt` plus indexes on `companyId`, `isActive`, `email`, `role`, and composite pagination indexes already defined in `db/schema.ts`@db/schema.ts#11-60.
- Optional future-proof columns (not required initially): `lastLoginAt` (timestamptz) and `invitationToken` (text, nullable) for invite tracking—only add when the workflow demands it.
- Constraints & indexes:
  - Keep global unique on `email` to prevent duplicates across companies.
  - Composite indexes already cover sorting by `createdAt`, `name`, `email`, and `role`; ensure migrations ran (drizzle migration verification step). No new indexes required unless new filters introduced (e.g., `lastLoginAt`).
- Expected queries: list by `companyId` with search on name/email (ILIKE), filter `isActive`, sort by `createdAt | name | email | role`; get by id; toggle `isActive`; update profile fields; count active admins during role demotion.
- Migration steps (only if new optional columns desired):
  1. `ALTER TABLE users ADD COLUMN last_login_at timestamptz;`
  2. `ALTER TABLE users ADD COLUMN invitation_token text;`
  3. Add index `users_company_id_last_login_at_idx` if we ship activity filtering.
  4. Backfill values with NULL defaults; no downtime since nullable.

4) **API / Server Actions Contract**
- `listUsersAction(input)` → `{ items, nextCursor, hasMore }`; Input: `{ cursor?, limit=20, search?, isActive?, role?, sortField∈[createdAt,name,email,role], sortOrder∈[asc,desc] }`.
- `getUserAction({ id })` → single user; used for editing modal pre-fill.
- `createUserAction(input)` (Admin only) → user; Input: `{ name, email, role, temporaryPassword?, startDateTime?, isActive?, sendInvite?, companyId, userId }`.
- `updateUserAction({ id, name?, email?, role?, isActive?, startDateTime? })` (Admin/Manager rules) → updated user; must guard against email collisions and last-admin demotion.
- `toggleUserStatusAction({ id, isActive })` → void; wraps activate/deactivate semantics for Sonner toast clarity.
- `resetUserPasswordAction({ id })` → `{ resetToken } | void`; actual email send handled elsewhere.
- Error cases: validation failure, user not found, unauthorized role, unique email conflict, attempt to deactivate last active admin, attempt to edit outside company scope, cursor decode errors.
- Pagination: same cursor pattern as WhatsApp Accounts—fetch `limit+1`, base64 encode `{ sortFieldValue, id }` for stable ordering.

5) **Validation (Zod)**
- Client schemas:
  - `userCreateClientSchema`: `name (2-120, trim)`, `email (lowercased, max 255)`, `role (enum ADMIN|MANAGER|AGENT|VIEWER)`, `temporaryPassword (min 12 chars, optional)`, `startDateTime (ISO string optional)`, `sendInvite boolean optional`.
  - `userUpdateClientSchema`: partial create schema + `isActive boolean optional` (still validated via separate action), `role` required when changing.
  - `userListClientSchema`: cursor pagination fields + `role?`, `isActive?`, `search?` with `.trim()` and `.max(120)`.
  - `userResetPasswordClientSchema`: `{ id: number }` for action invocation.
- Server schemas extend client versions with `{ companyId: number; userId: number }` (actor) and include `id` where needed.
- Response schemas: `userResponseSchema` (omit `passwordHash`, include metadata) and `userListResponseSchema` for cursor payloads. Export inferred TypeScript types for services/hooks.

6) **Service Layer Plan**
- `UserService.list(input)`: enforce `companyId`, search with `ilike(name/email)`, optional role + `isActive` filters, cursor ordering fallback to `createdAt desc, id desc`. Returns `Result.ok({ items, nextCursor, hasMore })`.
- `UserService.get({ id, companyId })`: safe select; return `Result.notFound` if missing.
- `UserService.create(data)`: inside transaction — optionally hash `temporaryPassword`, insert user, log audit entry; if `sendInvite`, enqueue background job outside transaction. Returns selected columns only.
- `UserService.update(data)`: transaction to fetch existing record (for last-admin checks + audit), apply partial updates, update `updatedBy/updatedAt`. If email changes, rely on DB unique error -> convert to `Result.conflict` message.
- `UserService.toggleStatus({ id, companyId, isActive, userId })`: validate cannot deactivate self or last admin; update `isActive` flag + audit log.
- `UserService.resetPassword({ id, companyId, userId })`: create reset token row or return token payload; ensure secrets never logged.
- All methods wrap with `createPerformanceLogger("UserService.method")`, return `Result.ok/fail/notFound/conflict` as appropriate.

7) **UI/UX Plan (shadcn + TanStack)**
- Page `/protected/users` under protected layout. Reuse table scaffolding from WhatsApp Accounts: header with CTA "Invite User" (opens `<UserForm />` dialog). Provide description summarizing licensing count.
- Table uses the shared `components/datatable/data-table.tsx` presenter for rendering rows, pagination, and bulk actions so styling stays consistent; feed it via TanStack columns + state defined in the feature.
- Columns: Name (with avatar initials + ID), Email (copy button), Role (badge + inline select for admins), Status (Active/Inactive badge + tooltip for last login), Created (date-fns format), Actions (Edit, Activate/Deactivate, Reset Password). Support column filters for status & role, global search for name/email, column visibility panel.
- Forms: React Hook Form + `userCreateClientSchema` / `userUpdateClientSchema` via zodResolver. Fields: name, email, role select, temporary password (Admin only, optional), start date/time picker (existing date components), active checkbox for edits. Loading states and disable buttons while submitting.
- Dialogs: same `Dialog`/`DialogContent` pattern as WhatsApp accounts. For destructive actions, use `AlertDialog` confirmation.
- Empty/loading states: skeleton rows + "No users yet" illustration with CTA to invite.
- Toasts via Sonner for success/error events; error surfaces show raw message from Result.

8) **Hook/State Plan**
- React Query hooks mirroring WhatsApp accounts naming:
  - `useUsers(params)` → `useInfiniteQuery` with cursor pagination; query key includes filters.
  - `useCreateUser()`, `useUpdateUser()`, `useToggleUserStatus(active: boolean)`, `useResetUserPassword()`. Each invalidates `["users"]` and handles Sonner messaging.
- Local state: component-level `useState` for dialog open + editing row, row selection for bulk future features (keep placeholder but not shipped now). Zustand store not required initially.
- Optimistic updates: safe for status toggles (flip `isActive` locally) but keep server truth for create/update due to email uniqueness.

9) **Security & Compliance**
- Every action wrapped with `withAction`, injecting `{ companyId, userId, role }`. Service layer always filters by `companyId`.
- Role guard utility ensures only Admin (and in limited cases Manager) can mutate. Hard-block demoting/deactivating yourself or the final Admin.
- Hash temporary passwords using existing auth utilities before insert; never return `passwordHash` or reset tokens to client except for immediate display to Admin who triggered it.
- Audit logging: call `AuditLogService.record` after create/update/toggle/reset; log `oldValues/newValues` diffs for compliance.
- Input validation enforces trimmed/lowercased emails, min password length, and ensures invites align with policy.

10) **Testing Plan**
- Unit tests (services): list pagination/cursor math, create rejects duplicate email, update enforces last admin constraint, toggle status respects self-protection, reset password generates token.
- Integration tests: server actions with mocked auth context verifying Result envelope, multi-tenant isolation (user from other company not accessible), React Query hook smoke tests using MSW.
- UI tests (Playwright/RTL): form validation errors, successful create/edit flows, toggle status button, disabled actions for insufficient role, ensures loading/empty states render.
- Edge cases: search returning zero rows, large tenant (pagination >5 pages), invite without temp password (auto generated), email casing collisions, concurrent edits (detect via updatedAt).

11) **Performance & Observability**
- Query risks: search with ILIKE on name/email — rely on existing indexes + optional trigram extension later if necessary. Debounce search input (300ms) before refetch.
- Index recap: `users_company_id_created_at_id_idx`, `users_company_id_name_id_idx`, `users_company_id_email_id_idx`, `users_company_id_role_id_idx` already cover planned sorts @db/schema.ts#45-60.
- Logging: performance logger per service call, structured logs for validation errors, audit log writes for all mutations.
- Avoid N+1 by selecting only required columns in single query; include `totalCount` via `COUNT(*) OVER()` only if UI needs it (not planned). Batch React Query invalidations to avoid thundering herd.

12) **Delivery Checklist**
- Files/folders:
  - `features/users/schemas/user.schema.ts`
  - `features/users/services/user.service.ts`
  - `features/users/actions/user.actions.ts`
  - `features/users/hooks/use-users.ts`
  - `features/users/components/user-form.tsx`, `user-table.tsx`, optional `user-status-badge.tsx`
  - Page: `app/(protected)/users/page.tsx`
  - Tests under `features/users/__tests__/`
- Implementation order: DB migration (if any) → schemas → service → actions → hooks → UI components/page → Sonner toasts → tests → smoke build.
- Definition of Done: All actions wired with multi-tenant filters, role-based guards enforced, forms validated with zod, React Query cache invalidated post-mutation, UX parity with WhatsApp accounts, tests & lint pass, plan documented in @plan/plan-02.md.
