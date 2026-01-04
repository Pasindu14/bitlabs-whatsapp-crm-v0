# Rules Updates - Auth Context for Multi-Tenancy

## Components Rules Updates

### Update to "Boundaries" section:
Add the following rule:
```
- Never pass `companyId` from components - actions derive it from auth session
```

### Rationale:
Components should not need to know about or pass `companyId` for mutations. The `withAction` wrapper automatically provides the authenticated session (`auth`) which contains `companyId`. This ensures security by preventing client-side manipulation of company context.

---

## Actions Rules Updates

### Update to "Security" section:
Add the following rule:
```
- Client schemas should NOT include `companyId`/`userId` - these come from auth session
```

### Rationale:
Client-facing schemas (used in forms and UI) should only contain user-provided data. `companyId` and `userId` are security-sensitive values that must come from the authenticated session, not from client input. This prevents:
- Users from impersonating other companies
- Users from acting as other users
- Cross-tenant data access

### Example:

**Before (incorrect):**
```typescript
// Client schema - WRONG
export const markAsReadSchema = z.object({
  conversationId: z.number().int().positive(),
  companyId: z.number().int().positive(), // ❌ Should come from auth
});

// Action
export const markConversationAsReadAction = withAction<MarkAsReadInput, void>(
  'conversations.markAsRead',
  async (auth, input) => {
    // ❌ Using client-provided companyId - SECURITY RISK
    return await ConversationService.markConversationAsRead(
      input.conversationId,
      input.companyId
    );
  },
  { schema: markAsReadSchema }
);
```

**After (correct):**
```typescript
// Client schema - CORRECT
export const markAsReadSchema = z.object({
  conversationId: z.number().int().positive(),
  // ✅ No companyId - comes from auth
});

// Action
export const markConversationAsReadAction = withAction<MarkAsReadInput, void>(
  'conversations.markAsRead',
  async (auth, input) => {
    // ✅ Using auth.companyId - SECURE
    return await ConversationService.markConversationAsRead(
      input.conversationId,
      auth.companyId
    );
  },
  { schema: markAsReadSchema }
);
```

---

## Implementation Checklist

For each feature, ensure:

### Schemas
- [ ] Remove `companyId` from all client schemas
- [ ] Remove `userId` from all client schemas
- [ ] Keep `companyId`/`userId` only in server schemas (if needed for internal validation)

### Actions
- [ ] Use `auth.companyId` when calling services
- [ ] Use `auth.userId` when calling services (for audit logs)
- [ ] Never use `input.companyId` or `input.userId`

### Hooks
- [ ] Remove `companyId` from action calls in hooks
- [ ] Keep `companyId` only for query keys (for cache isolation)

### Components
- [ ] Remove `companyId` props from components that trigger mutations
- [ ] Keep `companyId` only for query hooks (for cache isolation)
