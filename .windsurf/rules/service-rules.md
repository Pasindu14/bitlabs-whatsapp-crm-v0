---
trigger: model_decision
description: Apply this rule to anything that happens in the Service layer (features/**/services/*-service.ts): business logic, DB orchestration, Result<T> returns, multi-tenant companyId constraints, transactions, performance/error logging via lib/logger.ts, audit logs via audit_logs table, internal API gateway calls (outside tx), and cross-feature service dependency restrictions.
---

Pasi, added. Below is the **full updated `service.rules.md`** with a new mandatory **Audit Logging** section that enforces audit logs for every transactional write, including failures.

```md
# Service Layer Rules (Next.js + Drizzle + Multi-Tenant)

<service_rules>

## Scope
- Applies to: `features/**/services/*-service.ts`
- Services contain **business logic + database orchestration** only.
- Services are **server-only** modules.
- No UI concerns, no React code, no Server Actions, no route handlers.

## File & Export Conventions
- File name: `features/{domain}/services/{domain}-service.ts`
- Public API should be consistent:
  - either `export const {Domain}Service = { ... }`
  - or `export async function ...`
- Every public service method MUST return `Promise<Result<T>>`.

## Result Pattern (Hard Rule)
- Do not throw for expected/runtime failures (validation, not found, conflict, permission, downstream failure).
- Return `Result.fail(...)` with safe error codes/messages.
- Throw only for truly unrecoverable programmer errors (rare).
- Never leak:
  - SQL strings
  - stack traces
  - vendor responses
  - tokens/keys/PII

## Multi-Tenant Hard Rules
- Every read/write MUST include `companyId` constraint.
- Default reads MUST include `isActive = true` unless explicitly designed otherwise.
- Never allow cross-tenant access by querying with only `id` (must include `companyId` too).
- Any “lookup by unique field” must also be tenant-scoped.

## DB Safety (Drizzle)
- Avoid broad selects:
  - Always select only the required columns.
- Prefer controlled `returning({ ... })` on insert/update/delete.
- Parameterize all user input (no string interpolation).
- Avoid raw SQL unless unavoidable; if used, always parameterize and document why.
- Use typed select shapes and mappers; do not use `any` for rows.

## Transactions
- Use `db.transaction(...)` when:
  - multiple writes must be atomic
  - write depends on a prior read/constraint check
  - maintaining invariants across multiple tables
- Keep transactions short.
- NEVER perform network calls inside a transaction.

## Auditing & Soft Deletes
- On INSERT: set auditing fields when applicable:
  - `createdBy`, `updatedBy`
  - timestamps if not DB-defaulted
- On UPDATE: set:
  - `updatedBy`, `updatedAt`
- For soft delete:
  - set `isActive = false` + audit fields
  - do not hard delete unless explicitly required by the feature spec.

## Audit Logs (Mandatory for ALL transactional writes)
- Every write operation that mutates state MUST produce an audit log entry in `audit_logs` using `auditLogsTable`.
- If the write is done inside `db.transaction(...)`, the audit log MUST be written inside the SAME transaction.

### What must be logged
For each mutation (insert/update/soft-delete/hard-delete), write an audit log row with:
- `entityType` (string): stable domain name, e.g. `"user" | "department" | "conversation" | "message"`
- `entityId` (number): the affected entity id
- `companyId` (number): tenant scope (required)
- `action` (string): e.g. `"CREATE" | "UPDATE" | "DELETE" | "SOFT_DELETE" | "RESTORE" | "STATUS_CHANGE" | "SEND" | "ASSIGN"`
- `oldValues` (jsonb): only changed fields / previous snapshot (safe; no secrets)
- `newValues` (jsonb): only changed fields / new snapshot (safe; no secrets)
- `changedBy` (number): `actor.userId` (required)
- `changeReason` (string | null): optional reason (if available from input)
- `createdAt`: DB default

### Failure audit logging (Required)
- If a transactional operation fails:
  - you MUST also write a failure audit entry BEFORE returning failure, whenever possible.
- Because a DB transaction rollback would remove the audit row, implement one of these approved patterns:

#### Pattern A (Preferred): Two-phase audit (Attempt + Result)
- Write an audit log with `action = "<ACTION>_ATTEMPT"` inside the transaction (includes intended `newValues`).
- After the transaction succeeds, write another audit log with `action = "<ACTION>_SUCCESS"` (outside tx) OR include success markers in `tags`/metrics.
- If the transaction fails, write a new audit log OUTSIDE the failed transaction with:
  - `action = "<ACTION>_FAILED"`
  - `oldValues` and `newValues` as available
  - include safe `error` message in `changeReason` (do not leak vendor/sql/secrets)

#### Pattern B: Write failure audit outside tx only
- If you cannot do two-phase:
  - On failure, write a single audit log OUTSIDE the transaction:
    - `action = "<ACTION>_FAILED"`
    - `changeReason` includes safe error message
- This ensures audit trail exists even when the tx rolled back.

### Sensitive data rule for audit logs
- NEVER store:
  - passwords, password hashes
  - tokens/keys/secrets
  - full message bodies or PII-heavy payloads
- Store minimal diffs/fields only.

## Authorization Expectations
- Services must receive an `actor` context (or equivalent):
  - `{ userId, companyId, role }`
- Enforce permission checks at the service boundary (or call a shared authz helper).
- Even if actions check auth, services must still protect against misuse when feasible.

## Pagination, Sorting, and Filtering
- For list endpoints:
  - prefer cursor-based pagination (stable ordering)
  - avoid offset pagination unless explicitly required
- Sorting:
  - `sortBy` must be allow-listed (never trust raw field strings)
  - `order` must be validated (`asc` | `desc`)
- Search:
  - escape LIKE/ILIKE input (no wildcard injection)
  - cap search length and result count if applicable.

## Logging (Mandatory: lib/logger.ts)
- Services MUST use `lib/logger.ts` for ALL success and failure logging.
- Every public service method MUST create a logger:
  - `const perf = createPerformanceLogger("<Domain>.<method>", { context, tags, slowThresholdMs });`

### Success Logging (Required)
- On success, the method MUST call:
  - `perf.complete(recordCount?, extraContext?)`

### Failure Logging (Required)
- On any expected failure where you return `Result.fail(...)`:
  - call `perf.fail(errorMessageOrError, extraContext?)`
  - also call `logServerError("<Domain>.<method>", error)` in DEV mode to print full error
- On unexpected exception (catch block):
  - call `perf.fail(error as Error, extraContext?)`
  - call `logServerError("<Domain>.<method>", error as Error)` (DEV prints full error)
  - return `Result.fail({ code: "INTERNAL_ERROR", message: "Something went wrong" })`

### Console Rule
- No direct `console.*` inside services.
- Only allowed logging is through:
  - `PerformanceLogger` / `createPerformanceLogger`
  - `logServerError(...)` (dev-only full error)

### Logging Context Safety
- Use safe `context` only:
  - include `companyId`, ids (non-sensitive), filters (safe), recordCount
- Never include:
  - passwords/tokens/access keys
  - raw vendor responses
  - message bodies or PII payloads
  - full request objects

## Error Normalization
- Normalize failures into stable codes:
  - NOT_FOUND
  - CONFLICT (unique constraint)
  - FORBIDDEN
  - VALIDATION_FAILED (if service validates)
  - DOWNSTREAM_FAILED (internal/external dependency)
  - INTERNAL_ERROR (fallback)
- Prefer predictable failures over inconsistent messages.

## Cross-Feature Dependency Rules (Hard Rule)
- A service MUST NOT import or call another feature’s service directly.
- Approved alternatives:
  - Shared Domain Service: `features/_shared/services/{domain}.service.ts`
  - Shared Repo/Data Helper: `features/_shared/data/{domain}.repo.ts`
  - Orchestration layer: actions or `features/_shared/orchestrators/...`

## External Integrations (Generic)
- Services MUST NOT call third-party APIs directly unless the integration is implemented as a dedicated client/module.
- Services may orchestrate external calls ONLY:
  - outside DB transactions
  - after DB commit when persistence depends on the operation
  - with timeouts and safe error mapping to `Result.fail(...)`

## Internal API Route Gateway Pattern (When Required)
- Services MAY call internal API routes ONLY via a shared helper module.
- Must be:
  - server-side only
  - `cache: "no-store"`
  - timeout (`AbortController`)
  - safe base URL:
    - `NEXT_PUBLIC_APP_URL`
    - else `https://${VERCEL_URL}`
    - else `http://localhost:3000`
- Never call internal API routes inside transactions.
- Log and normalize failures.

## Idempotency & Retries (When Applicable)
- Use DB-level dedupe/idempotency if a command can be retried.
- Never auto-retry vendor calls inside transactions.

## Helpers & Reuse
- Keep local helpers in `/* ---------------- helpers ---------------- */` at bottom.
- Move to shared utils only if reused across services and domain-agnostic.

## Clean Code Requirements
- Prefer early returns.
- Strict typing: no `any`.
- Avoid cross-layer/cross-feature imports that violate architecture.

</service_rules>
```

If you want, I can also give you a small **audit log helper rule** (like a required helper function signature) to keep audit inserts consistent across services.

