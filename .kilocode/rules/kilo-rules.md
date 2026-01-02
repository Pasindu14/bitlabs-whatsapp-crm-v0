# kilo-rules.md
# kilo-rules.md - Section-wise Rules

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

---

## Table of Contents

1. [General Architecture Rules](#general-architecture-rules)
2. [Schema Rules](#schema-rules)
3. [Service Layer Rules](#service-layer-rules)
4. [Server Actions Rules](#server-actions-rules)
5. [React Hooks Rules](#react-hooks-rules)
6. [Zustand Store Rules](#zustand-store-rules)
7. [Component Rules](#component-rules)
8. [File Organization Rules](#file-organization-rules)
9. [Feature Scaffold Guide](#feature-scaffold-guide)
10. [Implementation Examples](#implementation-examples)

---

## General Architecture Rules

### Multi-Tenancy (CRITICAL - Applies Everywhere)

**✅ ALWAYS:**
- Filter every database query by `companyId` from session
- Include `companyId` in every mutation
- Include `userId` (actor) in every mutation for audit trail
- Use `eq(table.companyId, session.user.companyId)` in where clauses

**❌ NEVER:**
- Skip `companyId` filtering (this is a security breach)
- Allow cross-tenant data access
- Assume `companyId` is optional

### Result<T> Pattern (Applies to Services, Actions, Hooks)

**✅ ALWAYS:**
- Return `Result<T>` from all service methods
- Use `Result.ok(data)` for success cases
- Use `Result.fail(message)` for error cases
- Unwrap results in actions: `if (!result.ok) return { ok: false, error: result.error }`
- Throw errors in hooks: `if (!result.ok) throw new Error(result.error)`

**❌ NEVER:**
- Use try/catch to return error responses directly from services
- Return raw data or throw exceptions from services
- Handle Result unwrapping with try/catch in actions or hooks

### Date Handling (Applies Everywhere)

**✅ ALWAYS:**
- Use date-fns for all date formatting, parsing, and conversions
- Use `format()` for date formatting
- Use `parse()`, `parseISO()` for parsing dates
- Use `formatISO()` for ISO string conversion
- Use `isValid()` for date validation

**❌ NEVER:**
- Use native Date methods like `.toISOString().split()`, `.getFullYear()`, `.getMonth()`
- Use string manipulation for date formatting
- Use moment.js or other date libraries

**Examples:**
```typescript
// ✅ CORRECT
import { format, parseISO } from 'date-fns';
const formatted = format(new Date(), 'yyyy-MM-dd');
const parsed = parseISO('2025-01-01');

// ❌ WRONG
const formatted = new Date().toISOString().split('T')[0];
const year = new Date().getFullYear();
```

### File Naming Convention (Applies Everywhere)

**✅ ALWAYS:**
- Use kebab-case for all file names
- Examples: `user-schema.ts`, `user-service.ts`, `user-actions.ts`, `user-hooks.ts`, `user-list.tsx`

**❌ NEVER:**
- Use camelCase, PascalCase, or snake_case for file names
- Mix naming conventions within the same project

### Type Safety (Applies Everywhere)

**✅ ALWAYS:**
- Export types using `z.infer<>` from Zod schemas
- Define all types in schema files
- Import types with `import type` syntax

**❌ NEVER:**
- Declare types outside of schema files
- Use `any` type without explicit documentation explaining why
- Skip type exports from schemas

---

## Schema Rules

### Location & Structure

**Location**: `features/{domain}/schemas/{domain}-schema.ts`

**✅ ALWAYS:**
- Define constants before schemas (e.g., `USER_ROLES`, `STATUS_VALUES`)
- Use const arrays for enums: `export const USER_ROLES = ["admin", "manager"] as const`
- Export types: `export type UserRole = (typeof USER_ROLES)[number]`
- Separate client and server schemas
- Create response schemas for API returns
- Apply `.trim()` to all string inputs
- Apply `.toLowerCase()` to email inputs
- Set max length constraints on all strings
- Use `.min()` and `.max()` for validation boundaries

**❌ NEVER:**
- Use `z.string().enum()` or string unions for enums (use const arrays)
- Skip `.trim()` on string inputs
- Skip max length constraints
- Use `.any()` without documentation
- Mix client and server concerns in one schema
- Define types outside schema files

### Schema Pattern

```typescript
// ✅ CORRECT STRUCTURE

// 1. Constants first
export const USER_ROLES = ["admin", "manager", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// 2. Client schema (form validation, no auth context)
export const userCreateClientSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.email().max(255).trim().toLowerCase(),
  role: z.enum(USER_ROLES).default("user"),
});
export type UserCreateInput = z.infer<typeof userCreateClientSchema>;

// 3. Server schema (extends client + auth context)
export const userCreateServerSchema = userCreateClientSchema.extend({
  companyId: z.string().uuid(),
  userId: z.string().uuid(), // actor for audit
});
export type UserCreateServerData = z.infer<typeof userCreateServerSchema>;

// 4. Response schema
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

// 5. List response schema (for pagination)
export const userListResponseSchema = z.object({
  users: z.array(userResponseSchema),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});
export type UserListResponse = z.infer<typeof userListResponseSchema>;
```

### Schema Validation Rules

**✅ ALWAYS:**
- String inputs: `.min(1).max(n).trim()`
- Email inputs: `.email().max(255).trim().toLowerCase()`
- UUID fields: `.string().uuid()`
- Optional fields: `.optional()` or `.nullable()`
- Default values: `.default(value)` when appropriate
- Enum validation: `z.enum(CONST_ARRAY)`

**❌ NEVER:**
- Leave strings without max length
- Skip trimming on user inputs
- Use loose validation like `.string()` alone
- Use `.refine()` when built-in validators exist

---

## Service Layer Rules

### Location & Structure

**Location**: `features/{domain}/services/{domain}-service.ts`

**✅ ALWAYS:**
- Use static class methods only
- Return `Result<T>` from all methods
- Return `Result.ok(data)` on success
- Return `Result.fail(message)` on error
- Filter all queries by `companyId`
- Use `createPerformanceLogger()` at the start of each method
- Call `logger.end()` before every return statement
- Log all mutations with `AuditLogService.log()`
- Import types from schemas: `import type { UserCreateServerData } from "../schemas/user-schema"`

**❌ NEVER:**
- Use instance methods or constructors
- Throw exceptions directly
- Return error responses directly from catch blocks
- Skip `companyId` filtering
- Skip performance logging
- Skip audit logging for mutations
- Put validation logic in services (use schemas)
- Put HTTP/API logic in services (use actions)

### Service Method Pattern

```typescript
// ✅ CORRECT SERVICE METHOD

import { Result } from "@/lib/result";
import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { createPerformanceLogger } from "@/lib/performance-logger";
import { AuditLogService } from "@/features/audit/services/audit-log-service";
import type { UserCreateServerData, UserResponse } from "../schemas/user-schema";

export class UserService {
  static async create(data: UserCreateServerData): Promise<Result<UserResponse>> {
    const logger = createPerformanceLogger("UserService.create");

    try {
      // 1. Database operation with multi-tenant filtering
      const [user] = await db
        .insert(users)
        .values(data)
        .returning();

      // 2. End performance logging
      logger.end();

      // 3. Audit log the mutation
      await AuditLogService.log({
        companyId: data.companyId,
        userId: data.userId,
        action: "user.create",
        resourceId: user.id,
      });

      // 4. Return success
      return Result.ok(user);
    } catch (error) {
      logger.end();
      return Result.fail("Failed to create user");
    }
  }

  static async getById(
    companyId: string,
    id: string
  ): Promise<Result<UserResponse | null>> {
    const logger = createPerformanceLogger("UserService.getById");

    try {
      const user = await db.query.users.findFirst({
        where: and(
          eq(users.companyId, companyId),
          eq(users.id, id)
        ),
      });

      logger.end();
      return Result.ok(user || null);
    } catch (error) {
      logger.end();
      return Result.fail("Failed to fetch user");
    }
  }
}
```

### Pagination in Services

**✅ ALWAYS:**
- Use cursor-based pagination
- Fetch `limit + 1` items to check for more: `const fetchLimit = limit + 1`
- Return `hasMore: data.length > limit`
- Include ID in orderBy as tiebreaker: `orderBy: [desc(table.createdAt), desc(table.id)]`
- Encode cursor as base64: `{ id, sortField }`
- Build cursor condition separately
- Combine `companyId` filter with cursor condition using `and()`

```typescript
// ✅ CORRECT PAGINATION

static async list(
  companyId: string,
  limit = 20,
  cursor?: string
): Promise<Result<{ users: UserResponse[]; hasMore: boolean; nextCursor?: string }>> {
  const logger = createPerformanceLogger("UserService.list");

  try {
    const fetchLimit = limit + 1;
    const cursorCondition = cursor ? lt(users.id, cursor) : undefined;

    const results = await db.query.users.findMany({
      where: cursorCondition
        ? and(eq(users.companyId, companyId), cursorCondition)
        : eq(users.companyId, companyId),
      orderBy: [desc(users.createdAt), desc(users.id)], // ID as tiebreaker
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
```

**❌ NEVER:**
- Use offset-based pagination for large datasets
- Forget to include ID in orderBy
- Return all items without pagination
- Skip the `hasMore` flag

---

## Server Actions Rules

### Location & Structure

**Location**: `features/{domain}/actions/{domain}-actions.ts`

**✅ ALWAYS:**
- Start file with `"use server"` directive
- Use `withAction.schema(clientSchema).action()` wrapper
- Validate input with client schema
- Extract `companyId` and `userId` from `ctx.user`
- Extend client data with server fields (companyId, userId)
- Delegate business logic to services
- Return `{ ok: boolean; data?: T; error?: string }`
- Unwrap Result with: `if (!result.ok) return { ok: false, error: result.error }`

**❌ NEVER:**
- Forget `"use server"` directive
- Put business logic in actions (belongs in services)
- Use try/catch for error handling (Result<T> handles it)
- Skip validation with withAction
- Manually handle authentication (withAction provides ctx)
- Return raw service results without unwrapping

### Server Action Pattern

```typescript
// ✅ CORRECT ACTION

"use server";

import { withAction } from "@/lib/server-action-helper";
import { userCreateClientSchema } from "../schemas/user-schema";
import { UserService } from "../services/user-service";
import type { UserResponse } from "../schemas/user-schema";

export const createUserAction = withAction
  .schema(userCreateClientSchema)
  .action(async ({ parsedInput, ctx }) => {
    // 1. Extend client data with server context
    const serverData = {
      ...parsedInput,
      companyId: ctx.user.companyId,
      userId: ctx.user.id,
    };

    // 2. Delegate to service
    const result = await UserService.create(serverData);

    // 3. Unwrap Result and return
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: result.data };
  });

export const getUserAction = withAction
  .schema(z.object({ id: z.string().uuid() }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await UserService.getById(
      ctx.user.companyId,
      parsedInput.id
    );

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: result.data };
  });

export const listUsersAction = withAction
  .schema(z.object({
    limit: z.number().min(1).max(100).default(20),
    cursor: z.string().optional(),
  }))
  .action(async ({ parsedInput, ctx }) => {
    const result = await UserService.list(
      ctx.user.companyId,
      parsedInput.limit,
      parsedInput.cursor
    );

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true, data: result.data };
  });
```

---

## React Hooks Rules

### Location & Structure

**Location**: `features/{domain}/hooks/{domain}-hooks.ts`

**✅ ALWAYS:**
- Use `useMutation` for mutations (create, update, delete)
- Use `useQuery` for reads (get, list)
- Throw errors: `if (!result.ok) throw new Error(result.error)`
- Invalidate queries on mutation success
- Use query keys: `["entityName", ...params]`
- Return unwrapped data from React Query
- Use `useQueryClient` for invalidation

**❌ NEVER:**
- Handle errors with try/catch (let React Query handle it)
- Return action results directly (unwrap them first)
- Forget to invalidate queries after mutations
- Use inconsistent query key patterns
- Put business logic in hooks (belongs in services)

### Hook Patterns

```typescript
// ✅ CORRECT HOOKS

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createUserAction,
  updateUserAction,
  deleteUserAction,
  getUserAction,
  listUsersAction,
} from "../actions/user-actions";
import type { UserCreateInput, UserUpdateInput, UserResponse } from "../schemas/user-schema";

// Mutation hook
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UserCreateInput) => {
      const result = await createUserAction(data);
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

// Query hook for single item
export function useUser(id: string) {
  return useQuery({
    queryKey: ["users", id],
    queryFn: async () => {
      const result = await getUserAction({ id });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
  });
}

// Query hook for list with pagination
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

// Update mutation
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UserUpdateInput }) => {
      const result = await updateUserAction({ id, ...data });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: (data) => {
      // Invalidate list and specific item
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["users", data.id] });
    },
  });
}

// Delete mutation
export function useDeleteUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteUserAction({ id });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
```

---

## Zustand Store Rules

### Location & Structure

**Location**: `features/{domain}/store/{domain}-store.ts`

**✅ ALWAYS:**
- Use for UI state only (modals, filters, sorting, UI preferences)
- Use `create<StateInterface>()()` with TypeScript interface
- Use `persist` middleware for user preferences
- Use `partialize` to control what gets persisted
- Name persisted stores: `name: "{domain}-store"`
- Group related state and actions together
- Use descriptive action names: `openModal`, `closeModal`, `setFilter`

**❌ NEVER:**
- Store server data (use React Query instead)
- Store auth state (use NextAuth instead)
- Persist everything (only user preferences)
- Store derived state (compute it)
- Use Zustand for complex state logic (keep it simple)

### Store Pattern

```typescript
// ✅ CORRECT STORE

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserRole } from "../schemas/user-schema";

interface UserStoreState {
  // Modal state (transient - not persisted)
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  editingUserId: string | null;
  openCreateModal: () => void;
  closeCreateModal: () => void;
  openEditModal: (userId: string) => void;
  closeEditModal: () => void;

  // Filters (persisted - user preferences)
  roleFilter: UserRole | "all";
  searchQuery: string;
  setRoleFilter: (role: UserRole | "all") => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;

  // Sorting (persisted - user preferences)
  sortBy: "name" | "email" | "createdAt";
  sortOrder: "asc" | "desc";
  setSorting: (by: "name" | "email" | "createdAt", order: "asc" | "desc") => void;
}

export const useUserStore = create<UserStoreState>()(
  persist(
    (set) => ({
      // Modal state
      isCreateModalOpen: false,
      isEditModalOpen: false,
      editingUserId: null,
      openCreateModal: () => set({ isCreateModalOpen: true }),
      closeCreateModal: () => set({ isCreateModalOpen: false }),
      openEditModal: (userId) =>
        set({ isEditModalOpen: true, editingUserId: userId }),
      closeEditModal: () =>
        set({ isEditModalOpen: false, editingUserId: null }),

      // Filters
      roleFilter: "all",
      searchQuery: "",
      setRoleFilter: (role) => set({ roleFilter: role }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearFilters: () => set({ roleFilter: "all", searchQuery: "" }),

      // Sorting
      sortBy: "createdAt",
      sortOrder: "desc",
      setSorting: (by, order) => set({ sortBy: by, sortOrder: order }),
    }),
    {
      name: "user-store",
      // Only persist user preferences, not transient UI state
      partialize: (state) => ({
        roleFilter: state.roleFilter,
        searchQuery: state.searchQuery,
        sortBy: state.sortBy,
        sortOrder: state.sortOrder,
      }),
    }
  )
);
```

---

## Component Rules

### Location & Structure

**Location**: `features/{domain}/components/{component-name}.tsx`

**✅ ALWAYS:**
- Use `"use client"` directive for interactive components
- Use kebab-case for component file names (e.g., `user-list.tsx`, `user-create-form.tsx`)
- Import and use custom hooks for data fetching
- Import and use Zustand stores for UI state
- Use shadcn/ui components from `@/components/ui/`
- Use Tailwind utility classes exclusively
- Handle loading states from React Query
- Handle error states from React Query
- Use TypeScript interfaces for props
- Keep components focused and single-purpose

**❌ NEVER:**
- Fetch data directly in components (use hooks)
- Use inline styles
- Use custom CSS files
- Put business logic in components (use services)
- Create custom UI components (use shadcn/ui)
- Use CSS-in-JS libraries
- Skip loading/error states
- Use class components (use functional components only)

### Component Patterns

```typescript
// ✅ CORRECT COMPONENT (file: user-list.tsx)

"use client";

import { useUsers, useDeleteUser } from "../hooks/user-hooks";
import { useUserStore } from "../store/user-store";
import { UserCreateDialog } from "./user-create-dialog";
import { UserEditDialog } from "./user-edit-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Trash2, Edit } from "lucide-react";
import { USER_ROLES } from "../schemas/user-schema";

export function UserList() {
  // Hooks for data
  const { data, isLoading, error } = useUsers();
  const deleteUser = useDeleteUser();

  // Store for UI state
  const {
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
    openEditModal,
    roleFilter,
    setRoleFilter,
    searchQuery,
    setSearchQuery,
  } = useUserStore();

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Error: {error.message}</p>
        </CardContent>
      </Card>
    );
  }

  // Filter users
  const filteredUsers = data?.users.filter((user) => {
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesSearch =
      searchQuery === "" ||
      user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesRole && matchesSearch;
  });

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Users</h2>
        <Button onClick={openCreateModal}>Create User</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <Input
          placeholder="Search users..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            {USER_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* User list */}
      <div className="grid gap-4">
        {filteredUsers?.map((user) => (
          <Card key={user.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium">
                {user.name}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => openEditModal(user.id)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => deleteUser.mutate(user.id)}
                  disabled={deleteUser.isPending}
                >
                  {deleteUser.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <p className="text-sm">Role: {user.role}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty state */}
      {filteredUsers?.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">No users found</p>
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <UserCreateDialog
        open={isCreateModalOpen}
        onOpenChange={closeCreateModal}
      />
      <UserEditDialog />
    </div>
  );
}
```

### Form Component Pattern

```typescript
// ✅ CORRECT FORM COMPONENT (file: user-create-form.tsx)

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateUser } from "../hooks/user-hooks";
import { userCreateClientSchema, USER_ROLES } from "../schemas/user-schema";
import type { UserCreateInput } from "../schemas/user-schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface UserCreateFormProps {
  onSuccess?: () => void;
}

export function UserCreateForm({ onSuccess }: UserCreateFormProps) {
  const createUser = useCreateUser();

  const form = useForm<UserCreateInput>({
    resolver: zodResolver(userCreateClientSchema),
    defaultValues: {
      name: "",
      email: "",
      role: "user",
    },
  });

  const onSubmit = async (data: UserCreateInput) => {
    try {
      await createUser.mutateAsync(data);
      form.reset();
      onSuccess?.();
    } catch (error) {
      // Error is handled by React Query and displayed via form state
      console.error("Failed to create user:", error);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="John Doe" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl>
                <Input type="email" placeholder="john@example.com" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="role"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Role</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {USER_ROLES.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={createUser.isPending} className="w-full">
          {createUser.isPending && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          Create User
        </Button>
      </form>
    </Form>
  );
}
```

---

## File Organization Rules

### Feature Directory Structure

**✅ ALWAYS:**
- Follow this exact structure for every feature:

```
features/{domain}/
  ├── schemas/
  │   └── {domain}-schema.ts       # Zod schemas (client/server/response)
  ├── services/
  │   └── {domain}-service.ts      # Business logic with Result<T>
  ├── actions/
  │   └── {domain}-actions.ts      # Server actions with withAction
  ├── hooks/
  │   └── {domain}-hooks.ts        # React Query wrappers
  ├── store/
  │   └── {domain}-store.ts        # Zustand store (if needed)
  └── components/
      ├── {domain}-list.tsx
      ├── {domain}-create-form.tsx
      ├── {domain}-edit-form.tsx
      └── {domain}-create-dialog.tsx
```

**❌ NEVER:**
- Create files outside this structure
- Mix multiple domains in one directory
- Create index.ts barrel exports (explicit imports only)
- Use src/ directory (use app/ and features/)

### Import Rules

**✅ ALWAYS:**
- Use explicit imports: `import { UserService } from "@/features/users/services/user-service"`
- Use `@/` path alias for absolute imports
- Import types with `import type` syntax
- Group imports: external → internal → relative

**❌ NEVER:**
- Use barrel exports (index.ts files)
- Use relative imports for features (`../../features/...`)
- Import from parent directories in features

---

## Feature Scaffold Guide

### Creation Order

Follow this order when creating a new feature:

1. **Schema (`schemas/{domain}-schema.ts`)** → Define types and validation
2. **Service (`services/{domain}-service.ts`)** → Implement business logic
3. **Actions (`actions/{domain}-actions.ts`)** → Expose server actions
4. **Hooks (`hooks/{domain}-hooks.ts`)** → Create React Query wrappers
5. **Store (`store/{domain}-store.ts`)** → Add client state (if needed)
6. **Components (`components/*.tsx`)** → Build UI

### Quick Start Template

```bash
# Create feature directory
mkdir -p features/users/{schemas,services,actions,hooks,store,components}

# Create schema file
touch features/users/schemas/user-schema.ts

# Create service file
touch features/users/services/user-service.ts

# Create actions file
touch features/users/actions/user-actions.ts

# Create hooks file
touch features/users/hooks/user-hooks.ts

# Create store file
touch features/users/store/user-store.ts

# Create component files
touch features/users/components/{user-list,user-create-form,user-edit-form,user-create-dialog}.tsx
```

---

## Implementation Examples

### Complete Feature Example: User Management

#### 1. Schema (`features/users/schemas/user-schema.ts`)

```typescript
import { z } from "zod";

// Constants
export const USER_ROLES = ["admin", "manager", "user"] as const;
export type UserRole = (typeof USER_ROLES)[number];

// Client create schema
export const userCreateClientSchema = z.object({
  name: z.string().min(2).max(120).trim(),
  email: z.email().max(255).trim().toLowerCase(),
  role: z.enum(USER_ROLES).default("user"),
});
export type UserCreateInput = z.infer<typeof userCreateClientSchema>;

// Server create schema
export const userCreateServerSchema = userCreateClientSchema.extend({
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type UserCreateServerData = z.infer<typeof userCreateServerSchema>;

// Client update schema
export const userUpdateClientSchema = z.object({
  name: z.string().min(2).max(120).trim().optional(),
  email: z.email().max(255).trim().toLowerCase().optional(),
  role: z.enum(USER_ROLES).optional(),
});
export type UserUpdateInput = z.infer<typeof userUpdateClientSchema>;

// Server update schema
export const userUpdateServerSchema = userUpdateClientSchema.extend({
  id: z.string().uuid(),
  companyId: z.string().uuid(),
  userId: z.string().uuid(),
});
export type UserUpdateServerData = z.infer<typeof userUpdateServerSchema>;

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

#### 2. Service (`features/users/services/user-service.ts`)

```typescript
import { Result } from "@/lib/result";
import { db } from "@/db/drizzle";
import { users } from "@/db/schema";
import { eq, and, desc, lt } from "drizzle-orm";
import { createPerformanceLogger } from "@/lib/performance-logger";
import { AuditLogService } from "@/features/audit/services/audit-log-service";
import type {
  UserCreateServerData,
  UserUpdateServerData,
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

  static async update(
    data: UserUpdateServerData
  ): Promise<Result<UserResponse>> {
    const logger = createPerformanceLogger("UserService.update");

    try {
      const [user] = await db
        .update(users)
        .set(data)
        .where(and(eq(users.id, data.id), eq(users.companyId, data.companyId)))
        .returning();

      if (!user) {
        logger.end();
        return Result.fail("User not found");
      }

      logger.end();
      await AuditLogService.log({
        companyId: data.companyId,
        userId: data.userId,
        action: "user.update",
        resourceId: user.id,
      });

      return Result.ok(user);
    } catch (error) {
      logger.end();
      return Result.fail("Failed to update user");
    }
  }

  static async delete(
    companyId: string,
    userId: string,
    id: string
  ): Promise<Result<void>> {
    const logger = createPerformanceLogger("UserService.delete");

    try {
      await db
        .delete(users)
        .where(and(eq(users.id, id), eq(users.companyId, companyId)));

      logger.end();
      await AuditLogService.log({
        companyId,
        userId,
        action: "user.delete",
        resourceId: id,
      });

      return Result.ok(undefined);
    } catch (error) {
      logger.end();
      return Result.fail("Failed to delete user");
    }
  }

  static async getById(
    companyId: string,
    id: string
  ): Promise<Result<UserResponse | null>> {
    const logger = createPerformanceLogger("UserService.getById");

    try {
      const user = await db.query.users.findFirst({
        where: and(eq(users.companyId, companyId), eq(users.id, id)),
      });

      logger.end();
      return Result.ok(user || null);
    } catch (error) {
      logger.end();
      return Result.fail("Failed to fetch user");
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

---

## Critical Summary

### ✅ ALWAYS DO

1. **Multi-Tenancy**: Filter by `companyId`, include in mutations
2. **Result<T>**: Return from services, unwrap in actions, throw in hooks
3. **Date Handling**: Use date-fns exclusively, never native Date methods
4. **File Naming**: Use kebab-case everywhere
5. **Schemas**: Separate client/server, export types
6. **Services**: Static methods, Result<T>, performance logging, audit logging
7. **Actions**: `"use server"`, withAction wrapper, delegate to services
8. **Hooks**: useMutation/useQuery, throw errors, invalidate queries
9. **Stores**: UI state only, persist preferences
10. **Components**: `"use client"`, use hooks, Tailwind only
11. **Pagination**: Cursor-based, `limit + 1`, ID in orderBy
12. **Validation**: `.trim()` strings, `.toLowerCase()` emails, set max lengths

### ❌ NEVER DO

1. **Skip `companyId` filtering** (security breach)
2. **Put logic in wrong layer** (actions/hooks/components → services)
3. **Use try/catch for errors** (Result<T> and React Query handle it)
4. **Use native Date methods** (use date-fns)
5. **Use camelCase/PascalCase for files** (use kebab-case)
6. **Store server data in Zustand** (use React Query)
7. **Fetch in components** (use hooks)
8. **Use custom CSS** (use Tailwind)
9. **Skip logging** (performance + audit)
10. **Use wrong enum pattern** (use const arrays, not z.string unions)

---

This architecture ensures:
- **Security**: Multi-tenant isolation
- **Type Safety**: Zod + TypeScript
- **Maintainability**: Clear layer separation
- **Performance**: Cursor pagination, logging
- **Auditability**: All mutations tracked
- **Developer Experience**: Consistent patterns

Follow these rules exactly to maintain consistency and security across the codebase.