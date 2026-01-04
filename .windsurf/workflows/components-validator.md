# /review-components-rule-compliance

## Description
Given a feature scope (domain folder or spec), review ALL components-layer code under `features/**/components/*.tsx`
against our Components Rules. Report violations ONE-BY-ONE with exact file/line evidence and a concrete fix suggestion.
Do NOT apply fixes unless the user explicitly asks to fix.

## Steps

1) Identify the feature scope
   - If user provided a feature domain name: resolve it to `features/{domain}/`.
   - If user provided paths: use those paths.
   - If user provided only a spec: infer the most likely domain folder(s) and list them.

2) Discover and load Components Rules
   - Locate and read the active components rules file(s) in the workspace:
     - Prefer `.windsurf/rules/components-rules.md` (or any rule whose description indicates "components layer").
   - If multiple components rules exist, deduplicate and apply the most specific rule(s).
   - Treat these rules as the single source of truth for this review.

3) Collect components targets
   - Enumerate all files matching:
     - `features/**/components/*.tsx`
   - If the user scoped to a specific feature/domain, only include those component files.

4) Review each components file (do this sequentially)
   For each components file:
   4.1) Build a checklist from the Components Rules sections (hard rules first):
        - TypeScript usage (no .js files, proper types)
        - 'use client' directive (only when necessary, prefer Server Components)
        - State management (Zustand/React Query, minimal useState)
        - Error handling (catch errors, user-friendly messages, retry buttons)
        - Loading states (skeleton loaders, spinners, disabled buttons)
        - Form handling (react-hook-form, Zod validation, mutation hooks)
        - Styling (Tailwind CSS, mobile-first, shadcn/ui components)
        - Boundaries (no DB calls, no business logic, no external API calls)
        - Performance (React.memo, useMemo, useCallback, lazy loading)
        - Accessibility (semantic HTML, ARIA labels, keyboard navigation)
        - Security (no sensitive data exposure, input validation)
   4.2) Find violations and capture evidence:
        - Quote the smallest relevant code snippet.
        - Note exact file path and line range.
   4.3) Assign severity:
        - Blocker: sensitive data exposure, missing input validation, direct DB calls
        - High: missing error handling, business logic in components, no TypeScript
        - Medium/Low: performance issues, accessibility issues, styling inconsistencies

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
     - Top 3 highest-risk issues (security, boundaries, error handling)
   - Ask only one question:
     - "Do you want me to generate the fixes now (minimal diffs, rule-compliant)?" (Yes/No)

## Notes
- Workflows are invoked via `/review-components-rule-compliance` in Cascade.
- Workflows are stored/discovered under `.windsurf/workflows/` locations in the workspace/git-root hierarchy.
