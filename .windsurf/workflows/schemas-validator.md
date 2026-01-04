# /review-schemas-rule-compliance

## Description
Given a feature scope (domain folder or spec), review ALL schemas-layer code under `features/**/schemas/*-schema.ts`
against our Schemas Rules. Report violations ONE-BY-ONE with exact file/line evidence and a concrete fix suggestion.
Do NOT apply fixes unless the user explicitly asks to fix.

## Steps

1) Identify the feature scope
   - If user provided a feature domain name: resolve it to `features/{domain}/`.
   - If user provided paths: use those paths.
   - If user provided only a spec: infer the most likely domain folder(s) and list them.

2) Discover and load Schemas Rules
   - Locate and read the active schemas rules file(s) in the workspace:
     - Prefer `.windsurf/rules/schemas-rules.md` (or any rule whose description indicates "schemas layer").
   - If multiple schemas rules exist, deduplicate and apply the most specific rule(s).
   - Treat these rules as the single source of truth for this review.

3) Collect schemas targets
   - Enumerate all files matching:
     - `features/**/schemas/*-schema.ts`
   - If the user scoped to a specific feature/domain, only include those schema files.

4) Review each schemas file (do this sequentially)
   For each schemas file:
   4.1) Build a checklist from the Schemas Rules sections (hard rules first):
        - Zod validation (use Zod for all validation, no manual validation)
        - Type exports (export types with z.infer<> for all schemas)
        - String validation (trim, max length, lowercase for emails)
        - Schema structure (constants first, client schemas, server schemas, response schemas, types)
        - Client/server separation (no companyId/userId in client schemas)
        - Server schemas (extend client + add companyId/userId)
        - Enums (use const arrays, not z.string() unions)
        - Validation rules (strings, emails, UUIDs, dates, booleans, optionals)
        - Boundaries (no business logic, no DB queries, no external API calls)
   4.2) Find violations and capture evidence:
        - Quote the smallest relevant code snippet.
        - Note exact file path and line range.
   4.3) Assign severity:
        - Blocker: missing trim/max length, using .any() without docs, missing type exports
        - High: wrong schema structure, missing client/server separation, wrong enum pattern
        - Medium/Low: naming conventions, reusability, organization

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
     - Top 3 highest-risk issues (validation, type exports, schema structure)
   - Ask only one question:
     - "Do you want me to generate the fixes now (minimal diffs, rule-compliant)?" (Yes/No)

## Notes
- Workflows are invoked via `/review-schemas-rule-compliance` in Cascade.
- Workflows are stored/discovered under `.windsurf/workflows/` locations in the workspace/git-root hierarchy.
