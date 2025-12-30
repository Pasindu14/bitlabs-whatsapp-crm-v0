-----
trigger: always_on
-------

## Project Overview

This is a **Next.js 16 + TypeScript** platform with multi-tenant architecture.

### Core Tech Stack

- **Runtime**: Next.js 16.1.1 (App Router) + React 19.2.3 + TypeScript 5.7.2
- **Database**: PostgreSQL with Drizzle ORM 0.45.1
- **State Management**: TanStack Query 5.90.12 (server) + Zustand 5.0.9 (client)
- **Authentication**: NextAuth v5 (beta.30) with JWT
- **Validation**: Zod 4.2.1 (client/server schema separation)
- **UI**: shadcn/ui + Radix UI + Tailwind CSS v4
- **Date/Time**: date-fns for all date formatting and conversions
- **API Integration**: WhatsApp Business API

### Domain

Multi-tenant WhatsApp conversation management with:

- User management (role-based access)
- WhatsApp account integration
- Conversation tracking
- Audit logging (all mutations logged)

## Table of Contents

1. [Architecture Principles](#architecture-principles)
2. [File Categories & Conventions](#file-categories--conventions)
3. [Feature Scaffold Guide](#feature-scaffold-guide)
4. [Integration Rules](#integration-rules)
5. [Implementation Examples](#implementation-examples)
6. [Common Patterns](#common-patterns)
7. [Critical Rules](#critical-rules)

---

## Architecture Principles

### 1. Multi-Tenancy (CRITICAL)

- **Every query MUST filter by `companyId`** from session
- **Every mutation MUST include `companyId`** and `userId` (actor)
- Use `db.query.{table}.findMany({ where: eq(table.companyId, session.user.companyId) })`
- Server actions receive `companyId` and `userId` automatically via `withAction` helper

### 2. Result<T> Pattern

- **All service methods return `Result<T>`** (`Result.ok(data)` or `Result.fail(message)`)
- Actions unwrap with `if (!result.ok) return { ok: false, error: result.error }`
- Hooks throw errors with `if (!result.ok) throw new Error(result.error)`
- **NEVER use try/catch in actions/hooks** - Result<T> handles all errors

### 3. Client/Server Schema Separation

- **Client schemas**: Form validation (no auth context) - `{entity}CreateClientSchema`, `{entity}UpdateClientSchema`
- **Server schemas**: Extend client + add `companyId`/`userId` - `{entity}CreateServerSchema`, `{entity}UpdateServerSchema`
- **Response schemas**: API response types - `{entity}ResponseSchema`, `{entity}ListResponseSchema`
- Example: `userCreateClientSchema` → `userCreateServerSchema.extend({ companyId, userId })`

### 4. Layer Responsibilities

- **Schemas (`*.schema.ts`)**: Validation, type inference, constants
- **Services (`*.service.ts`)**: Business logic, database access, Result<T> returns
- **Actions (`*.actions.ts`)**: Next.js server actions wrapped with `withAction`, validation, service delegation
- **Hooks (`*.ts` in `hooks/`)**: React Query wrappers around actions, error throwing, invalidation
- **Components (`*.tsx`)**: UI logic, Zustand + React Query integration, Tailwind styling
- **Stores (`*.ts` in `store/`)**: Client-side transient state (modals, filters, UI state)

### 5. Cursor Pagination

- **Pattern**: `fetchLimit = limit + 1`, return `hasMore: data.length > limit`
- **Cursor**: Encode `{ id, sortField }` as base64 string
- **Ordering**: Always include ID as tiebreaker (`orderBy: [desc(table.createdAt), desc(table.id)]`)
- **Query**: `where: cursorCondition ? and(companyFilter, cursorCondition) : companyFilter`

### 6. Date Handling

- **Always use date-fns** for date formatting, parsing, and conversions
- **NEVER use native Date methods** like `.toISOString().split()`, `.getFullYear()`, etc.
- **Common functions**: `format()`, `parse()`, `parseISO()`, `formatISO()`, `isValid()`
- **Example**: Use `format(date, 'yyyy-MM-dd')` instead of `date.toISOString().split('T')[0]`

---

## File Categories & Conventions

---

## File Categories & Conventions

### 1. Zod Schemas (`features/**/schemas/*-schema.ts`)

**Location**: `features/{domain}/schemas/{domain}-schema.ts`

**Pattern**: Client/server schema separation

```typescript
// Constants first
export const USER_ROLES = ["admin", "manager", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Client create schema (form validation)
export const userCreateClientSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.email().max(255).trim().toLowerCase(),
  role: z.enum(USER_ROLES).default("user"),
});
export type UserCreateInput = z.infer<typeof userCreateClientSchema>;

// Server create schema (extends client + auth)
export const userCreateServerSchema = userCreateClientSchema.extend({
  companyId: z.string().uuid(),
  userId: z.string().uuid(), // actor
});

// Response schema
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

**Rules**:

- ✅ Use const arrays for enums, not z.string() unions
- ✅ Apply `.trim()` to string inputs, `.toLowerCase()` to emails
- ✅ Export types with `z.infer<>`
- ✅ Server schemas extend client schemas
- ❌ NEVER use `.any()` without documentation
- ❌ NEVER skip max length constraints

---

### 2. Service Layer (`features/**/services/*-service.ts`)

**Location**: `features/{domain}/services/{domain}-service.ts`

**Pattern**: Static class with Result<T> returns

```typescript
import { Result } from "@/lib/result";
import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import type {
  UserCreateServerData,
  UserResponse,
} from "../schemas/user-schema";

export class UserService {
  static async create(
    data: UserCreateServerData
  ): Promise<Result<UserResponse>> {
    const logger = createPerformanceLogger("UserService.create");

    try {
      const [user] = await db.insert(users).values(data).returning();

      logger.end();
      await AuditLogService.log({
        companyId: data.companyId,
        userId: data.userId,
        action: "user.create",
        resourceId: user.id,
      });

      return Result.ok(user);
    } catch (error) {
      logger.end();
      return Result.fail("Failed to create user");
    }
  }

  static async list(
    companyId: string,
    limit = 20,
    cursor?: string
  ): Promise<
    Result<{ users: UserResponse[]; hasMore: boolean; nextCursor?: string }>
  > {
    const logger = createPerformanceLogger("UserService.list");

    try {
      const fetchLimit = limit + 1;
      const cursorCondition = cursor ? lt(users.id, cursor) : undefined;

      const results = await db.query.users.findMany({
        where: cursorCondition
          ? and(eq(users.companyId, companyId), cursorCondition)
          : eq(users.companyId, companyId),
        orderBy: [desc(users.createdAt), desc(users.id)],
        limit: fetchLimit,
      });

      const hasMore = results.length > limit;
      const items = hasMore ? results.slice(0, limit) : results;
      const nextCursor = hasMore ? items[items.length - 1].id : undefined;

      logger.end();
      return Result.ok({ users: items, hasMore, nextCursor });
    } catch (error) {
      logger.end();
      return Result.fail("Failed to list users");
    }
  }
}
```

**Rules**:

- ✅ Static methods only
- ✅ Return `Result.ok(data)` or `Result.fail(message)`
- ✅ Always filter by `companyId` (multi-tenancy)
- ✅ Use `createPerformanceLogger()` for timing
- ✅ Log mutations with `AuditLogService.log()`
- ✅ Cursor pagination: `fetchLimit = limit + 1`
- ✅ Use date-fns for all date formatting and conversions
- ❌ NEVER use try/catch to return error responses directly
- ❌ NEVER skip companyId filtering
- ❌ NEVER use native Date methods for formatting (use date-fns)

---

### 3. Server Actions (`features/**/actions/*-actions.ts`)

**Location**: `features/{domain}/actions/{domain}-actions.ts`

**Pattern**: withAction wrapper for auth + validation

```typescript
"use server";

import { withAction } from "@/lib/server-action-helper";
import { userCreateClientSchema } from "../schemas/user-schema";
import { UserService } from "../services/user-service";

export const createUserAction = withAction
  .schema(userCreateClientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const serverData = {
      ...parsedInput,
      companyId: ctx.user.companyId,
      userId: ctx.user.id,
    };

    const result = await UserService.create(serverData);

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: result.data };
  });
```

**Rules**:

- ✅ ALWAYS use `"use server"` directive
- ✅ Wrap with `withAction.schema(schema).action()`
- ✅ `ctx` provides authenticated `user` object with `companyId` and `id`
- ✅ Extend client data with `companyId` and `userId` from ctx
- ✅ Return `{ ok: boolean; data?: T; error?: string }`
- ✅ Delegate business logic to services
- ❌ NEVER put business logic in actions
- ❌ NEVER use try/catch (Result<T> handles errors)

---

### 4. React Hooks (`features/**/hooks/*-hooks.ts`)

**Location**: `features/{domain}/hooks/{entity}-hooks.ts`

**Pattern**: React Query wrappers around actions

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createUserAction, listUsersAction } from "../actions/user-actions";
import type { UserCreateInput, UserResponse } from "../schemas/user-schema";

export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserCreateInput) => {
      const result = await createUserAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useUsers(limit = 20, cursor?: string) {
  return useQuery({
    queryKey: ["users", limit, cursor],
    queryFn: async () => {
      const result = await listUsersAction({ limit, cursor });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}
```

**Rules**:

- ✅ Use `useMutation` for mutations, `useQuery` for reads
- ✅ Throw errors: `if (!result.ok) throw new Error(result.error)`
- ✅ Invalidate queries on mutation success
- ✅ Query keys: `["entity", ...params]`
- ❌ NEVER handle errors with try/catch (let React Query handle it)

---

### 5. Zustand Stores (`features/**/store/*-store.ts`)

**Location**: `features/{domain}/store/{entity}-store.ts`

**Pattern**: Client-side transient state (modals, filters)

```typescript
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface UserStoreState {
  // Modal state
  isCreateModalOpen: boolean;
  openCreateModal: () => void;
  closeCreateModal: () => void;

  // Filters (persisted)
  roleFilter: UserRole | "all";
  setRoleFilter: (role: UserRole | "all") => void;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      isCreateModalOpen: false,
      openCreateModal: () => set({ isCreateModalOpen: true }),
      closeCreateModal: () => set({ isCreateModalOpen: false }),

      roleFilter: "all",
      setRoleFilter: (role) => set({ roleFilter: role }),
    }),
    {
      name: "user-store",
      partialize: (state) => ({ roleFilter: state.roleFilter }), // Only persist filters
    }
  )
);
```

**Rules**:

- ✅ Use for UI state (modals, filters, sorting)
- ✅ Persist user preferences with `persist` middleware
- ✅ Use `partialize` to control what gets persisted
- ❌ NEVER store server data (use React Query)
- ❌ NEVER store auth state (use NextAuth)

---

### 6. React Components (`features/**/components/*.tsx`)

**Location**: `features/{domain}/components/{component-name}.tsx`

**Pattern**: Client components with hooks integration (use kebab-case for file names)

```typescript
"use client";

import { useUsers, useCreateUser } from "../hooks/user-hooks";
import { useUserStore } from "../store/user-store";
import { UserCreateForm } from "./user-create-form";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export function UserList() {
  const { data, isLoading } = useUsers();
  const createUser = useCreateUser();
  const { isCreateModalOpen, openCreateModal, closeCreateModal } =
    useUserStore();

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="space-y-4">
      <Button onClick={openCreateModal}>Create User</Button>

      <div className="grid gap-4">
        {data?.users.map((user) => (
          <div key={user.id} className="rounded border p-4">
            {user.name} - {user.email}
          </div>
        ))}
      </div>

      <Dialog open={isCreateModalOpen} onOpenChange={closeCreateModal}>
        <DialogContent>
          <UserCreateForm
            onSuccess={() => {
              closeCreateModal();
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

**Rules**:

- ✅ Use `"use client"` for interactive components
- ✅ Use kebab-case for component file names (e.g., `user-list.tsx`, `user-create-form.tsx`)
- ✅ Integrate Zustand for UI state, React Query for server data
- ✅ Use Tailwind utility classes (no custom CSS)
- ✅ Use shadcn/ui components from `@/components/ui/`
- ❌ NEVER fetch data in components (use hooks)
- ❌ NEVER use inline styles

---

## Feature Scaffold Guide

When creating a new feature, follow this structure:

```
features/{domain}/
  ├── schemas/{domain}-schema.ts       # Zod schemas (client/server/response)
  ├── services/{domain}-service.ts     # Business logic with Result<T>
  ├── actions/{domain}-actions.ts      # Server actions with withAction
  ├── hooks/{domain}-hooks.ts          # React Query wrappers
  ├── store/{domain}-store.ts          # Zustand store (if needed)
  └── components/                      # React components (kebab-case)
      ├── {domain}-list.tsx
      ├── {domain}-create-form.tsx
      └── {domain}-edit-form.tsx
```

### Creation Order

1. **Schema** → Define types and validation
2. **Service** → Implement business logic
3. **Actions** → Expose server actions
4. **Hooks** → Create React Query wrappers
5. **Store** → Add client state (if needed)
6. **Components** → Build UI

---

## Integration Rules

### Schema → Service

```typescript
// Schema exports types
export type UserCreateServerData = z.infer<typeof userCreateServerSchema>;

// Service imports and uses
import type { UserCreateServerData } from "../schemas/user-schema";
static async create(data: UserCreateServerData): Promise<Result<User>> {
  // ...
}
```

### Service → Action

```typescript
// Action delegates to service
export const createUserAction = withAction
  .schema(userCreateClientSchema)
  .action(async ({ parsedInput, ctx }) => {
    const serverData = {
      ...parsedInput,
      companyId: ctx.user.companyId,
      userId: ctx.user.id,
    };
    const result = await UserService.create(serverData);
    return result.ok
      ? { ok: true, data: result.data }
      : { ok: false, error: result.error };
  });
```

### Action → Hook

```typescript
// Hook wraps action
export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: UserCreateInput) => {
      const result = await createUserAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
}
```

### Hook + Store → Component

```typescript
// Component uses both (file: user-list.tsx)
export function UserList() {
  const { data } = useUsers(); // React Query (server state)
  const { isCreateModalOpen, openCreateModal } = useUserStore(); // Zustand (UI state)
  return <div>...</div>;
}
```

---

## Critical Rules

### ✅ ALWAYS

1. **Filter by `companyId`** in all database queries
2. **Include `userId` (actor)** in all mutations
3. **Return `Result<T>`** from service methods
4. **Use `withAction` wrapper** for all server actions
5. **Use `"use server"` directive** in action files
6. **Use `"use client"` directive** for interactive components
7. **Export types** with `z.infer<>` from schemas
8. **Use const arrays** for enums (not z.string().enum())
9. **Apply `.trim()`** to string inputs in schemas
10. **Apply `.toLowerCase()`** to email inputs
11. **Set max length constraints** on strings
12. **Use cursor pagination** with `fetchLimit = limit + 1`
13. **Include ID in orderBy** as tiebreaker
14. **Log mutations** with `AuditLogService.log()`
15. **Use performance logging** with `createPerformanceLogger()`
16. **Invalidate queries** in mutation `onSuccess`
17. **Use Tailwind classes** (no custom CSS)
18. **Use shadcn/ui components** from `@/components/ui/`
19. **Throw errors in hooks** with `throw new Error(result.error)`
20. **Use static methods** in service classes
21. **Use kebab-case** for all file names (schemas, services, actions, hooks, stores, components)
22. **Use date-fns** for all date formatting, parsing, and conversions

### ❌ NEVER

1. **Skip `companyId` filtering** (security breach)
2. **Put business logic in actions** (use services)
3. **Put business logic in hooks** (use services)
4. **Put business logic in components** (use services)
5. **Use try/catch in actions** (Result<T> handles errors)
6. **Use try/catch in hooks** (React Query handles errors)
7. **Return error responses directly** from service catch blocks
8. **Use `.any()` in schemas** without documentation
9. **Skip max length constraints** on strings
10. **Use z.string() unions** instead of const arrays for enums
11. **Mix client and server concerns** in schemas
12. **Store server data in Zustand** (use React Query)
13. **Store auth state in Zustand** (use NextAuth)
14. **Fetch data in components** (use hooks)
15. **Use inline styles** (use Tailwind)
16. **Use custom CSS files** (use Tailwind)
17. **Skip audit logging** for mutations
18. **Skip performance logging** for service methods
19. **Forget to export types** from schemas
20. **Use instance methods** in services (use static)
21. **Use native Date methods** for formatting (use date-fns instead)

---

## Summary

This app follows a **strict layered architecture** with:

- **Multi-tenancy**: Every query/mutation scoped to `companyId`
- **Result<T> pattern**: Type-safe error handling
- **Client/server schemas**: Validation separation
- **withAction helper**: Automatic auth injection
- **React Query + Zustand**: Server/client state split
- **Cursor pagination**: Scalable list queries
- **Audit logging**: All mutations tracked
- **Performance logging**: All service methods timed

Follow these patterns exactly to maintain consistency and security.
