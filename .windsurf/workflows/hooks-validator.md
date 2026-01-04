# /review-hooks-rule-compliance

## Description
Given a feature scope (domain folder or spec), review ALL hooks-layer code under `features/**/hooks/*.ts`
against our Hooks Rules. Report violations ONE-BY-ONE with exact file/line evidence and a concrete fix suggestion.
Do NOT apply fixes unless the user explicitly asks to fix.

## Steps

1) Identify the feature scope
   - If user provided a feature domain name: resolve it to `features/{domain}/`.
   - If user provided paths: use those paths.
   - If user provided only a spec: infer the most likely domain folder(s) and list them.

2) Discover and load Hooks Rules
   - Locate and read the active hooks rules file(s) in the workspace:
     - Prefer `.windsurf/rules/hooks-rules.md` (or any rule whose description indicates "hooks layer").
   - If multiple hooks rules exist, deduplicate and apply the most specific rule(s).
   - Treat these rules as the single source of truth for this review.

3) Collect hooks targets
   - Enumerate all files matching:
     - `features/**/hooks/*.ts`
   - If the user scoped to a specific feature/domain, only include those hook files.

4) Review each hooks file (do this sequentially)
   For each hooks file:
   4.1) Build a checklist from the Hooks Rules sections (hard rules first):
        - React Query result objects (data, error, isLoading, etc.)
        - Error throwing (MUST throw from failed actions, no Result<T> unwrapping)
        - Query configuration (staleTime, refetchOnWindowFocus, retry, enabled)
        - Invalidation strategy (mutations MUST invalidate relevant queries)
        - Query key structure (hierarchical keys, defined constants)
        - Boundaries (no DB calls, no business logic, no external API calls)
        - Performance (useSuspenseQuery, select, placeholderData)
        - Type safety (types inferred from action returns, never use any)
   4.2) Find violations and capture evidence:
        - Quote the smallest relevant code snippet.
        - Note exact file path and line range.
   4.3) Assign severity:
        - Blocker: not throwing errors, direct DB calls, external API calls
        - High: missing invalidation, wrong query configuration, using any
        - Medium/Low: query key structure, performance optimizations, naming conventions

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
     - Top 3 highest-risk issues (error handling, boundaries, invalidation)
   - Ask only one question:
     - "Do you want me to generate the fixes now (minimal diffs, rule-compliant)?" (Yes/No)

## Notes
- Workflows are invoked via `/review-hooks-rule-compliance` in Cascade.
- Workflows are stored/discovered under `.windsurf/workflows/` locations in the workspace/git-root hierarchy.
