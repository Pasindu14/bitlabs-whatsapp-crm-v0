# /review-service-rule-compliance

## Description
Given a feature scope (domain folder or spec), review ALL service-layer code under `features/**/services/*-service.ts`
against our Service Rules. Report violations ONE-BY-ONE with exact file/line evidence and a concrete fix suggestion.
Do NOT apply fixes unless the user explicitly asks to fix.

## Steps

1) Identify the feature scope
   - If user provided a feature domain name: resolve it to `features/{domain}/`.
   - If user provided paths: use those paths.
   - If user provided only a spec: infer the most likely domain folder(s) and list them.

2) Discover and load Service Rules
   - Locate and read the active service rules file(s) in the workspace:
     - Prefer `.windsurf/rules/service.rules.md` (or any rule whose description indicates “service layer”).
   - If multiple service rules exist, deduplicate and apply the most specific rule(s).
   - Treat these rules as the single source of truth for this review.

3) Collect service targets
   - Enumerate all files matching:
     - `features/**/services/*-service.ts`
   - If the user scoped to a specific feature/domain, only include those service files.

4) Review each service file (do this sequentially)
   For each service file:
   4.1) Build a checklist from the Service Rules sections (hard rules first):
        - Result pattern compliance (Promise<Result<T>>, no expected throws, safe failures)
        - Multi-tenant constraints (companyId ALWAYS, isActive defaults)
        - Drizzle safety (select only needed columns, controlled returning)
        - Transactions (no network calls inside tx, short tx)
        - Audit logs (writes generate audit logs; tx failures still create failure audit)
        - Logging (lib/logger.ts: perf.complete/perf.fail + logServerError in dev)
        - Cross-feature restriction (no importing other feature services; use shared repo/shared service/orchestrator)
        - External integrations / internal API gateway pattern (helper + timeout + no-store + outside tx)
   4.2) Find violations and capture evidence:
        - Quote the smallest relevant code snippet.
        - Note exact file path and line range.
   4.3) Assign severity:
        - Blocker: tenant leak risk, missing Result, missing companyId constraint, unsafe external call in tx
        - High: missing audit log, missing perf logging, unsafe select/returning, cross-feature service call
        - Medium/Low: style/organization/helper placement

5) Output violations ONE-BY-ONE (strict format)
   - Print violations in this exact structure, one at a time:
     (1) [SEVERITY] Rule: <rule name>
         File: <path>:<lineStart>-<lineEnd>
         Evidence: <short snippet>
         Why it violates: <1-2 sentences>
         Fix: <specific change (what + where)>
   - After printing each violation, move to the next violation automatically.
   - Do not bundle multiple violations into one item.

6) Summary
   - After all violations are listed:
     - Total violations by severity
     - Files affected
     - Top 3 highest-risk issues (tenant safety, transactions, audit/logging)
   - Ask only one question:
     - “Do you want me to generate the fixes now (minimal diffs, rule-compliant)?” (Yes/No)

## Notes
- Workflows are invoked via `/review-service-rule-compliance` in Cascade. :contentReference[oaicite:1]{index=1}
- Workflows are stored/discovered under `.windsurf/workflows/` locations in the workspace/git-root hierarchy. :contentReference[oaicite:2]{index=2}
