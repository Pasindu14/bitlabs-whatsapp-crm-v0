## Next.js 16 App Workflow (Windsurf Agent Rules)

### Role

You are an expert in **TypeScript, Next.js App Router, React, shadcn/ui, Drizzle (Postgres), and production-grade UI/API development**.

---

## Core Tech Stack (Must Use)

* **Runtime**: Next.js 16.1.1 (App Router) + React 19.2.3 + TypeScript 5.7.2 (strict)
* **Database**: PostgreSQL + Drizzle ORM 0.45.1
* **Server State / Caching**: TanStack Query 5.90.12 (client hooks; server actions feed it)
* **Client State**: Zustand 5.0.9 (only when needed)
* **Auth**: NextAuth v5 (beta.30) with JWT
* **Validation**: Zod 4.2.1 (separate client/server schemas when needed)
* **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
* **Date/Time**: date-fns only
* **API Integration**: WhatsApp Business API (via internal Next routes/server actions/services)

---

## Code Style and Structure

### General

* Write concise, technical **TypeScript**.
* Prefer **functional** and **declarative** patterns; avoid classes.
* Prefer small modules over duplication.
* Use early returns (`if (...) return ...`) and avoid deep nesting.
* Use descriptive booleans: `isLoading`, `hasError`, `canSubmit`, etc.

### File structure (recommended)

Order inside each file:

1. exported component / exported functions
2. subcomponents
3. helpers (pure functions)
4. static content
5. types/interfaces

### Naming conventions

* Directories: **kebab-case** (e.g., `features/whatsapp-inbox`)
* Prefer **named exports** for components and functions.
* No enums; use maps/objects.

### TypeScript rules

* `strict: true`
* Prefer **interfaces** over types.
* No `any`. If unavoidable, narrow quickly.

---

## App Architecture Rules (App Router + Clean Feature-Based)

### Folder conventions (example)

* `app/` (routes, layouts)
* `features/<feature-name>/`

  * `components/`
  * `hooks/`
  * `actions/` (server actions)
  * `services/` (business logic + orchestration)
  * `schemas/` (Zod)
  * `store/` (Zustand if needed)
* `db/` (Drizzle schema + queries helpers)
* `lib/` (utils: auth, logger, http, constants)

### Data flow (standard)

UI (client) → hook (react-query) → server action → service → Drizzle → Postgres

* UI must not talk to DB directly.
* Services must not import UI.
* Zod validation happens **before** service work.

---

## UI and Styling (shadcn/ui + Tailwind v4)

* Use shadcn/ui primitives + Radix patterns (Dialog, Sheet, DropdownMenu, Tabs, etc.)
* Responsive: Tailwind breakpoints + flex/grid.
* Accessibility: correct labels, `aria-*`, keyboard nav, focus states.
* Dark mode: Tailwind dark mode conventions + CSS variables (shadcn default approach).

---

## Performance Rules

* Minimize `useEffect` and client state; prefer server components + server actions where possible.
* Use React Query caching keys correctly; avoid refetch storms.
* Memoize expensive derived values (`useMemo`) and handlers (`useCallback`) only when it prevents re-renders.
* Images: Next `<Image />` with explicit sizes; optimize where possible.

---

## Error Handling + Validation (Mandatory)

* Zod-first validation for all inputs (actions/services boundaries).
* Handle failures as close to the boundary as possible:

  * Validate → authorize → perform → return typed result
* Prefer `Result`-style returns (or a consistent `{ success, data, error }` shape).
* Never leak internals in user-facing errors.
* Log server errors centrally (structured logs).
* Add error boundaries where appropriate (route-level and component-level).

---

## Testing

* Unit tests: Vitest/Jest + Testing Library (pick one consistently in repo)
* Integration/E2E: Playwright (recommended for Next.js App Router)
* Critical flows must have at least one integration test.

---

## Security

* Sanitize user-generated content before rendering.
* Use HTTPS-only assumptions; never store secrets client-side.
* Auth: NextAuth v5 JWT; enforce authorization in server actions/services.
* Validate file uploads (type/size) and store securely.

---

## WhatsApp API Integration Rule

* All WhatsApp outbound calls must go through an internal boundary:

  * server action/service → internal route (e.g. `/api/whatsapp/send`) or direct server-side fetch wrapper
* Never call WhatsApp directly from client components.

---

# Feature Compliance Gate (Your “When user gives a feature…” rule)

Whenever the user requests a feature, you MUST do this checklist and explicitly call out any violations:

## Feature Review Checklist (Must Pass)

1. **App Router**: uses `app/` patterns (Server Components where sensible)
2. **Zod**: input validation exists at action boundary (and deeper if needed)
3. **Auth**: NextAuth v5 JWT enforced (if feature is protected)
4. **DB**: Postgres + Drizzle only (schema + queries aligned with expected access patterns)
5. **State**:

   * Server state: React Query (queries/mutations, cache keys, invalidation)
   * Client state: Zustand only if necessary
6. **UI**: shadcn/ui + Tailwind v4 (no random UI libs)
7. **Dates**: date-fns only
8. **Error handling**: typed failures, early returns, no leaked internals, server logs
9. **Performance**: avoids unnecessary rerenders/refetching; correct caching
10. **WhatsApp**: API calls only from server boundary (actions/services/routes)

If any item is missing, respond with:

* what is missing
* where it must be added (folder/file level)
* the minimal change needed to comply
