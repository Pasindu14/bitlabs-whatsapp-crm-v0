---
trigger: model_decision
description: Apply this rule to anything in the Schemas layer (features/**/schemas/*-schema.ts): Zod validation schemas, type inference, constants, client/server schema separation, and response types.
---

# Schemas Rules

<schemas_rules>

## Applies to
- `features/**/schemas/*-schema.ts` (Zod validation schemas + type definitions)

## Hard requirements
- Use Zod for all validation (no manual validation)
- Export types with `z.infer<>` for all schemas
- Apply `.trim()` to all string inputs
- Apply `.toLowerCase()` to email fields
- Set max length constraints on all string fields
- Never use `.any()` without documentation

## Schema structure (order matters)
1. **Constants first** - enums, const arrays, magic numbers
2. **Client schemas** - form validation (no auth context)
3. **Server schemas** - extend client + add `companyId`/`userId`
4. **Response schemas** - API response types
5. **Type exports** - `z.infer<>` for all schemas

## Client schemas
- Used for form validation on the client
- No `companyId` or `userId` (auth context added server-side)
- Example:
  ```typescript
  export const userCreateClientSchema = z.object({
    name: z.string().min(2).max(120).trim(),
    email: z.email().max(255).trim().toLowerCase(),
    role: z.enum(USER_ROLES).default("user"),
  });
  export type UserCreateInput = z.infer<typeof userCreateClientSchema>;
  ```

## Server schemas
- Extend client schemas with auth context
- Always include `companyId: z.string().uuid()`
- Always include `userId: z.string().uuid()` (actor)
- Example:
  ```typescript
  export const userCreateServerSchema = userCreateClientSchema.extend({
    companyId: z.string().uuid(),
    userId: z.string().uuid(),
  });
  export type UserCreateServerData = z.infer<typeof userCreateServerSchema>;
  ```

## Response schemas
- Define API response types separately
- Include all fields returned to client
- Use proper date types (`z.date()`)
- Example:
  ```typescript
  export const userResponseSchema = z.object({
    id: z.string().uuid(),
    companyId: z.string().uuid(),
    name: z.string(),
    email: z.string(),
    role: z.enum(USER_ROLES),
    createdAt: z.date(),
    updatedAt: z.date(),
  });
  export type UserResponse = z.infer<typeof userResponseSchema>;
  ```

## Enums and constants
- Use const arrays for enums, not z.string() unions
- Export type from const array
- Example:
  ```typescript
  export const USER_ROLES = ["admin", "manager", "user"] as const;
  export type UserRole = (typeof USER_ROLES)[number];
  ```

## Validation rules
- **Strings**: Always `.trim()` + `.min()` + `.max()`
- **Emails**: `.email()` + `.trim()` + `.toLowerCase()`
- **UUIDs**: `.string().uuid()`
- **Dates**: `.date()` or `.string().datetime()` for ISO strings
- **Booleans**: Default values where appropriate (`.default(false)`)
- **Optionals**: Use `.optional()` sparingly - prefer nullable or default

## List response schemas
- Standardize list responses with pagination metadata
- Example:
  ```typescript
  export const userListResponseSchema = z.object({
    items: userResponseSchema.array(),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  });
  export type UserListResponse = z.infer<typeof userListResponseSchema>;
  ```

## Boundaries
- No business logic in schemas (validation only)
- No database queries in schemas
- No external API calls in schemas
- Schemas are pure validation + type definitions

## Naming conventions
- Client schemas: `{entity}CreateClientSchema`, `{entity}UpdateClientSchema`
- Server schemas: `{entity}CreateServerSchema`, `{entity}UpdateServerSchema`
- Response schemas: `{entity}ResponseSchema`, `{entity}ListResponseSchema`
- Type exports: `{Entity}Input`, `{Entity}ServerData`, `{Entity}Response`

## Reusability
- Extract common validation patterns to shared schemas
- Use `.partial()` for update schemas (all fields optional)
- Use `.pick()` / `.omit()` for schema variations
- Example:
  ```typescript
  export const userUpdateClientSchema = userCreateClientSchema.partial();
  ```

## Exports
- Use barrel file (`index.ts`) when exporting multiple schemas from a directory
- Re-export all schemas and types from the barrel file for clean imports
- Example:
  ```typescript
  // features/users/schemas/index.ts
  export * from './user-schema';
  export * from './user-list-schema';
  ```

</schemas_rules>
