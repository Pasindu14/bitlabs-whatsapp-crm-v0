# /review-all-rule-compliance

## Description
Given a feature scope (domain folder or spec), review ALL code across ALL layers (services, actions, components, hooks, schemas)
against their respective Rules. Report violations ONE-BY-ONE with exact file/line evidence and a concrete fix suggestion.
Do NOT apply fixes unless the user explicitly asks to fix.

## Steps

1) Identify the feature scope
   - If user provided a feature domain name: resolve it to `features/{domain}/`.
   - If user provided paths: use those paths.
   - If user provided only a spec: infer the most likely domain folder(s) and list them.

2) Discover and load Rules for all layers
   - Locate and read the active rules files in the workspace:
     - `.windsurf/rules/service-rules.md` (service layer)
     - `.windsurf/rules/actions-rules.md` (actions layer)
     - `.windsurf/rules/components-rules.md` (components layer)
     - `.windsurf/rules/hooks-rules.md` (hooks layer)
     - `.windsurf/rules/schemas-rules.md` (schemas layer)
   - Treat these rules as the single source of truth for this review.

3) Collect targets for all layers
   Enumerate all files matching:
   - `features/**/services/*-service.ts`
   - `features/**/actions/*-actions.ts`
   - `features/**/components/*.tsx`
   - `features/**/hooks/*.ts`
   - `features/**/schemas/*-schema.ts`
   - If the user scoped to a specific feature/domain, only include those files.

4) Review each file by layer (do this sequentially)

   ### Service Layer Review
   For each service file:
   4.1) Build checklist from Service Rules:
        - Result pattern (Promise<Result<T>>, no expected throws)
        - Multi-tenant constraints (companyId ALWAYS, isActive defaults)
        - Drizzle safety (select only needed columns, controlled returning)
        - Transactions (no network calls inside tx, short tx)
        - Audit logs (writes generate audit logs; tx failures still create failure audit)
        - Logging (lib/logger.ts: perf.complete/perf.fail)
        - Cross-feature restriction (no importing other feature services)
        - External integrations (helper + timeout + no-store + outside tx)
   4.2) Find violations with evidence (file path, line range, snippet)
   4.3) Assign severity:
        - Blocker: tenant leak risk, missing Result, missing companyId, unsafe external call in tx
        - High: missing audit log, missing perf logging, unsafe select/returning, cross-feature service call
        - Medium/Low: style/organization/helper placement

   ### Actions Layer Review
   For each actions file:
   4.1) Build checklist from Actions Rules:
        - withAction wrapper compliance
        - Auth context usage (extract companyId from auth)
        - Result<T> return pattern (never throw)
        - Schema validation (client vs server schemas)
        - Error handling (no try/catch, unwrap Result)
        - Service delegation (thin wrappers, no business logic)
        - Type safety (import types from schemas, never use any)
        - Security (validate input, filter by companyId from auth)
   4.2) Find violations with evidence (file path, line range, snippet)
   4.3) Assign severity:
        - Blocker: missing withAction, missing companyId from auth, exposing internal errors
        - High: missing schema validation, using try/catch, business logic in actions, using any
        - Medium/Low: naming conventions, type imports, performance issues

   ### Components Layer Review
   For each components file:
   4.1) Build checklist from Components Rules:
        - TypeScript usage (no .js files, proper types)
        - 'use client' directive (only when necessary)
        - State management (Zustand/React Query, minimal useState)
        - Error handling (catch errors, user-friendly messages)
        - Loading states (skeleton loaders, spinners, disabled buttons)
        - Form handling (react-hook-form, Zod validation)
        - Styling (Tailwind CSS, mobile-first, shadcn/ui)
        - Boundaries (no DB calls, no business logic, no external API calls)
        - Performance (React.memo, useMemo, useCallback, lazy loading)
        - Accessibility (semantic HTML, ARIA labels, keyboard navigation)
        - Security (no sensitive data exposure, input validation)
   4.2) Find violations with evidence (file path, line range, snippet)
   4.3) Assign severity:
        - Blocker: sensitive data exposure, missing input validation, direct DB calls
        - High: missing error handling, business logic in components, no TypeScript
        - Medium/Low: performance issues, accessibility issues, styling inconsistencies

   ### Hooks Layer Review
   For each hooks file:
   4.1) Build checklist from Hooks Rules:
        - React Query result objects (data, error, isLoading)
        - Error throwing (MUST throw from failed actions)
        - Query configuration (staleTime, refetchOnWindowFocus, retry, enabled)
        - Invalidation strategy (mutations MUST invalidate queries)
        - Query key structure (hierarchical keys, defined constants)
        - Boundaries (no DB calls, no business logic, no external API calls)
        - Performance (useSuspenseQuery, select, placeholderData)
        - Type safety (types inferred from actions, never use any)
   4.2) Find violations with evidence (file path, line range, snippet)
   4.3) Assign severity:
        - Blocker: not throwing errors, direct DB calls, external API calls
        - High: missing invalidation, wrong query configuration, using any
        - Medium/Low: query key structure, performance optimizations, naming conventions

   ### Schemas Layer Review
   For each schemas file:
   4.1) Build checklist from Schemas Rules:
        - Zod validation (use Zod for all validation)
        - Type exports (export types with z.infer<>)
        - String validation (trim, max length, lowercase for emails)
        - Schema structure (constants, client, server, response, types)
        - Client/server separation (no companyId/userId in client schemas)
        - Server schemas (extend client + add companyId/userId)
        - Enums (use const arrays, not z.string() unions)
        - Validation rules (strings, emails, UUIDs, dates, booleans)
        - Boundaries (no business logic, no DB queries, no external API calls)
   4.2) Find violations with evidence (file path, line range, snippet)
   4.3) Assign severity:
        - Blocker: missing trim/max length, using .any() without docs, missing type exports
        - High: wrong schema structure, missing client/server separation, wrong enum pattern
        - Medium/Low: naming conventions, reusability, organization

5) Output violations ONE-BY-ONE (strict format)
   - Print violations in this exact structure, one at a time:
     (1) [SEVERITY] Rule: <rule name>
         Layer: <service|actions|components|hooks|schemas>
         File: <path>:<lineStart>-<lineEnd>
         Evidence: <short snippet>
         Why it violates: <1-2 sentences>
         Fix: <specific change (what + where)>
   - After printing each violation, move to the next violation automatically.
   - Do not bundle multiple violations into one item.

6) Summary
   - After all violations are listed:
     - Total violations by severity
     - Total violations by layer
     - Files affected
     - Top 5 highest-risk issues across all layers
   - Ask only one question:
     - "Do you want me to generate the fixes now (minimal diffs, rule-compliant)?" (Yes/No)

## Notes
- Workflows are invoked via `/review-all-rule-compliance` in Cascade.
- Workflows are stored/discovered under `.windsurf/workflows/` locations in the workspace/git-root hierarchy.
- This workflow combines all individual layer validators into a single comprehensive review.
