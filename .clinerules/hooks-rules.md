---
trigger: model_decision
description: Apply this rule to anything in the Hooks layer (features/**/hooks/*.ts): React Query wrappers around actions, error throwing, invalidation logic, and client-side data fetching orchestration.
---

# Hooks Rules

<hooks_rules>

## Applies to
- `features/**/hooks/*.ts` (client-side React Query wrappers around server actions)

## Hard requirements
- All hooks return TanStack Query result objects (data, error, isLoading, etc.)
- Hooks MUST throw errors from failed actions (no Result<T> unwrapping in components)
- Use `useMutation` for write operations, `useQuery` for reads
- TypeScript types inferred from action returns

## Query configuration
- Set appropriate `staleTime` based on data volatility (e.g., 0 for real-time, 5min for reference data)
- Use `refetchOnWindowFocus: false` for user-initiated actions to avoid unexpected refreshes
- Set `retry: false` for mutations (let users retry explicitly)
- Use `enabled` conditions for conditional queries (e.g., `enabled: !!id`)

## Error handling
- Extract error messages from action failures and throw them
- Never swallow errors in hooks - let components handle display
- Preserve original error context for debugging
- Use consistent error message format across hooks

## Invalidation strategy
- Mutations MUST invalidate relevant queries via `invalidateQueries`
- Use exact query keys for targeted invalidation
- For list + detail patterns, invalidate both on mutations
- Consider `refetchQueries` vs `invalidateQueries` based on need

## Query key structure
- Use hierarchical keys: `['domain', 'list']`, `['domain', id]`
- Define query key constants at top of file:
  ```typescript
  export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    list: (filters: string) => [...userKeys.lists(), { filters }] as const,
    details: () => [...userKeys.all, 'detail'] as const,
    detail: (id: string) => [...userKeys.details(), id] as const,
  };
  ```

## Optimistic updates (optional)
- Only use for simple, predictable updates
- Always provide rollback function in `onError`
- Update cache using `setQueryData` with proper key structure
- Test rollback paths thoroughly

## Boundaries
- No direct DB calls in hooks (use actions only)
- No business logic in hooks (delegate to services/actions)
- No external API calls in hooks (use actions only)
- Hooks orchestrate data fetching, not implement it

## Performance
- Use `useSuspenseQuery` for data required for rendering (when appropriate)
- Avoid unnecessary `useEffect` - rely on React Query's built-in reactivity
- Use `select` to transform data at query level (not in components)
- Consider `placeholderData` for instant loading states

## Naming conventions
- Hook names: `use{Domain}{Operation}` (e.g., `useUsersList`, `useUserCreate`)
- Query key names: `{domain}Keys` (e.g., `userKeys`, `conversationKeys`)
- Keep hooks focused (single responsibility)

## Exports
- Use barrel file (`index.ts`) when exporting multiple hooks from a directory
- Re-export all hooks from the barrel file for clean imports
- Example:
  ```typescript
  // features/users/hooks/index.ts
  export { useUsersList } from './use-users-list';
  export { useUserCreate } from './use-user-create';
  export { useUserUpdate } from './use-user-update';
  export { useUserDelete } from './use-user-delete';
  ```

</hooks_rules>
