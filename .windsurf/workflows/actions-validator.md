# /review-actions-rule-compliance

## Description
Given a feature scope (domain folder or spec), review ALL actions-layer code under `features/**/actions/*-actions.ts`
against our Actions Rules. Report violations ONE-BY-ONE with exact file/line evidence and a concrete fix suggestion.
Do NOT apply fixes unless the user explicitly asks to fix.

## Steps

1) Identify the feature scope
   - If user provided a feature domain name: resolve it to `features/{domain}/`.
   - If user provided paths: use those paths.
   - If user provided only a spec: infer the most likely domain folder(s) and list them.

2) Discover and load Actions Rules
   - Locate and read the active actions rules file(s) in the workspace:
     - Prefer `.windsurf/rules/actions-rules.md` (or any rule whose description indicates "actions layer").
   - If multiple actions rules exist, deduplicate and apply the most specific rule(s).
   - Treat these rules as the single source of truth for this review.

3) Collect actions targets
   - Enumerate all files matching:
     - `features/**/actions/*-actions.ts`
   - If the user scoped to a specific feature/domain, only include those action files.

4) Review each actions file (do this sequentially)
   For each actions file:
   4.1) Build a checklist from the Actions Rules sections (hard rules first):
        - withAction wrapper compliance (all actions wrapped with withAction)
        - Auth context usage (extract companyId from auth, pass to services)
        - Result<T> return pattern (never throw for expected failures)
        - Schema validation (use schema in withAction options, client vs server schemas)
        - Error handling (no try/catch, unwrap Result with if (!result.success))
        - Service delegation (thin wrappers, no business logic in actions)
        - Type safety (import types from schemas, never use any)
        - Security (validate input, filter by companyId from auth, never trust client-provided data)
   4.2) Find violations and capture evidence:
        - Quote the smallest relevant code snippet.
        - Note exact file path and line range.
   4.3) Assign severity:
        - Blocker: missing withAction wrapper, missing companyId from auth, exposing internal errors
        - High: missing schema validation, using try/catch, business logic in actions, using any
        - Medium/Low: naming conventions, type imports, performance issues

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
     - Top 3 highest-risk issues (auth context, error handling, validation)
   - Ask only one question:
     - "Do you want me to generate the fixes now (minimal diffs, rule-compliant)?" (Yes/No)

## Notes
- Workflows are invoked via `/review-actions-rule-compliance` in Cascade.
- Workflows are stored/discovered under `.windsurf/workflows/` locations in the workspace/git-root hierarchy.
