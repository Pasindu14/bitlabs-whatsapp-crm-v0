---
trigger: model_decision
description: Apply this rule to anything in the Service layer (features/**/services/*-service.ts): business logic, DB work, Result<T>, multi-tenant companyId constraints, transactions, perf logging (lib/logger.ts), audit_logs, internal API gateway calls (outside tx), and cross-feature service dependency restrictions.
---

# Service Rules

<service_rules>

## Applies to
- `features/**/services/*-service.ts` (server-only business logic + DB orchestration)

## Hard requirements
- Public methods return `Promise<Result<T>>`
- Expected failures return `Result.fail(...)` (or helpers). No throwing for expected cases.
- All failure messages are user-readable (no internals: SQL/vendor/stack/tokens/PII).

## Tenant + DB safety
- Every query/write is scoped by `companyId` (never `id` alone).
- Default reads include `isActive = true` unless intentionally not.
- Select only required columns; use controlled `returning({ ... })` for writes.
- No string interpolation for user input; raw SQL only if parameterized and justified.
- No `any` for DB rows.

## Transactions + side effects
- Use transactions only for atomic multi-write invariants; keep them short.
- No network/external calls inside a transaction.

## Audit logs (writes)
- Every write creates an `audit_logs` row via `auditLogsTable`.
- If the write is in a transaction, the audit insert is in the same transaction.
- Must include: `entityType, entityId, companyId, action, oldValues, newValues, changedBy, changeReason?`.
- Failure audit must exist even if tx rolls back:
  - Preferred: `<ACTION>_ATTEMPT` in tx, then `<ACTION>_SUCCESS` after, or `<ACTION>_FAILED` outside on failure.
  - Or: `<ACTION>_FAILED` outside on failure.
- Never store secrets/PII-heavy data in audit JSON.
- No need of try-catch for audit logs
- Failure audits are mandatory in every catch block:
  ```typescript
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Operation failed";
    perf.fail(errorMessage);
    await AuditLogService.logFailure({
      entityType: "user",
      entityId: data.id ?? null,
      companyId: data.companyId,
      userId: data.userId,
      action: "CREATE",
      error: errorMessage,
    });
    return Result.internal("Failed to create user");
  }
  ```

## Logging (perf)
- Start every method with `createPerformanceLogger("<Domain>.<method>")` and wrap in `try/catch`.
- Always:
  - success → `perf.complete(...)`
  - any failure (expected return or catch) → `perf.fail(...)` BEFORE returning a failure Result
- NO `logServerError(...)` in services (including catch blocks). Use `perf.fail(...)` only.
- No direct `console.*` in services; keep perf context small (companyId + ids).

## Boundaries
- No service-to-service imports across features. Use shared service/repo or orchestration.
- External/third-party calls only via dedicated integration modules and never inside tx.
- If internal API gateway is required: call routes only via a shared helper (server-side, no-store, timeout, safe base URL).

## Exports
- Use barrel file (`index.ts`) when exporting multiple services from a directory
- Re-export all services from the barrel file for clean imports
- Example:
  ```typescript
  // features/users/services/index.ts
  export { UserService } from './user-service';
  export { UserProfileService } from './user-profile-service';
  export { UserSettingsService } from './user-settings-service';
  ```

</service_rules>
