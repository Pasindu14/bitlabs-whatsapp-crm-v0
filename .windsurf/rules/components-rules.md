---
trigger: model_decision
description: Apply this rule to anything in the Components layer (features/**/components/*.tsx): UI logic, Zustand + React Query integration, Tailwind styling, form handling, and user interactions.
---

# Components Rules

<components_rules>

## Applies to
- `features/**/components/*.tsx` (React components - UI logic + presentation)

## Hard requirements
- Use TypeScript for all components (no .js files)
- Use `'use client'` only when necessary (prefer Server Components)
- All state management via Zustand stores or React Query
- Use shadcn/ui components as building blocks
- Tailwind CSS for all styling

## Component structure
```typescript
'use client';  // only if needed

import { useState } from 'react';
import { useHook } from '../hooks/use-hook';
import { useStore } from '../store/use-store';
import { Button } from '@/components/ui/button';

export function ComponentName() {
  // 1. Hooks (React Query, Zustand, etc.)
  const { data, isLoading, error } = useHook();
  const { state, setState } = useStore();

  // 2. Local state (minimal, only for UI)
  const [isOpen, setIsOpen] = useState(false);

  // 3. Handlers
  const handleClick = () => {
    // handle user interaction
  };

  // 4. Conditional rendering
  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  // 5. Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  );
}
```

## State management
- **Server state**: Use React Query hooks (from `hooks/`)
- **Client state**: Use Zustand stores (from `store/`)
- **Form state**: Use react-hook-form + Zod validation
- **UI state**: Use React useState sparingly (modals, toggles, etc.)
- Never mix concerns - use appropriate tool for each state type

## Error handling
- Catch errors from hooks with `if (error) return <ErrorState />`
- Display user-friendly error messages (never show stack traces)
- Provide retry buttons for recoverable errors
- Use toast notifications for non-blocking errors

## Loading states
- Show skeleton loaders for data fetching
- Show loading spinners for actions
- Disable buttons during mutations
- Use optimistic updates where appropriate

## Form handling
- Use react-hook-form for all forms
- Validate with Zod schemas from `schemas/`
- Submit via mutation hooks
- Show validation errors inline
- Reset form on success

## Styling conventions
- Use Tailwind utility classes
- Follow mobile-first responsive design
- Use shadcn/ui components for common patterns
- Extract repeated patterns to subcomponents
- Use `cn()` helper for conditional classes

## Naming conventions
- Component names: PascalCase (e.g., `UserForm`, `UsersTable`)
- File names: kebab-case (e.g., `user-form.tsx`, `users-table.tsx`)
- Hook calls: `use{Domain}{Operation}` (e.g., `useUserCreate`)
- Store calls: `use{Domain}Store` (e.g., `useUserStore`)

## Component categories
- **List components**: `{Domain}Table`, `{Domain}List` - display paginated lists
- **Form components**: `{Domain}Form`, `{Domain}CreateForm` - create/edit entities
- **Detail components**: `{Domain}Detail`, `{Domain}View` - display single entity
- **Modal components**: `{Domain}Modal`, `{Domain}Dialog` - modals/dialogs
- **Card components**: `{Domain}Card` - compact entity display

## Boundaries
- No direct DB queries in components (use hooks only)
- No business logic in components (delegate to services via hooks)
- No external API calls in components (use hooks only)
- Components are UI + orchestration only

## Performance
- Use `React.memo()` for expensive components
- Use `useMemo()` for expensive computations
- Use `useCallback()` for event handlers passed to children
- Lazy load heavy components with `React.lazy()`
- Avoid unnecessary re-renders with proper dependencies

## Accessibility
- Use semantic HTML elements
- Add ARIA labels where needed
- Ensure keyboard navigation works
- Use proper heading hierarchy
- Test with screen readers

## Type safety
- Import types from schemas: `ResponseType`, `InputType`
- Never use `any` - always use proper types
- Use generic types where appropriate
- Example:
  ```typescript
  import type { UserResponse } from '../schemas/user-schema';
  ```

## Code organization
- Keep components focused (single responsibility)
- Extract subcomponents for complex UI
- Use composition over inheritance
- Colocate related components
- Keep files under 300 lines (split if larger)

## Testing
- Write unit tests for complex logic
- Write integration tests for user flows
- Mock hooks and stores in tests
- Test error states and loading states

## Security
- Never expose sensitive data in UI
- Validate all user inputs
- Sanitize user-generated content
- Use proper authentication checks
- Never trust client-side data

## Exports
- Use barrel file (`index.tsx`) when exporting multiple components from a directory
- Re-export all components from the barrel file for clean imports
- Example:
  ```typescript
  // features/users/components/index.tsx
  export { UsersTable } from './users-table';
  export { UserForm } from './user-form';
  export { UserDetail } from './user-detail';
  export { UserModal } from './user-modal';
  ```

</components_rules>
