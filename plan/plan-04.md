---
feature: WhatsApp Phone Profile
date: 2026-01-06
plan_number: 04
---

# WhatsApp Phone Profile Feature Plan

## 1) Feature Summary

**Goal**: Display comprehensive WhatsApp Business phone number profile information for selected WhatsApp accounts, fetched from Meta Graph API.

**Actors & Permissions**:
- All authenticated users (role-based access inherited from WhatsApp accounts feature)
- Users must have access to view WhatsApp accounts in their company

**Primary Flows**:
- View phone profile for selected WhatsApp account
- Refresh profile data (manual or auto-refresh)
- Display quality rating with visual indicators
- Show verification status (name status, code verification)

**Assumptions**:
- WhatsApp accounts already exist in the system with `phoneNumberId` stored
- Meta Graph API access token is configured in environment variables
- Graph API version is configurable via environment
- Profile data is fetched on-demand and cached via React Query

---

## 2) Domain Model

**Entities**:
- `WhatsappPhoneProfile`: External API response wrapper (not stored in DB)
  - Represents real-time phone number status from Meta Graph API
  - Contains: id, display_phone_number, verified_name, quality_rating, name_status?, code_verification_status?

**Relationships**:
- `WhatsappAccount` (1) ←→ (1) `WhatsappPhoneProfile` (via phoneNumberId)
  - Profile is fetched using account's `phoneNumberId`
  - No persistent relationship; fetched on-demand

**State Machine**:
- **Quality Rating**: GREEN → YELLOW → RED (can degrade over time)
- **Name Status**: NONE → PENDING_REVIEW → APPROVED/DECLINED/EXPIRED/AVAILABLE_WITHOUT_REVIEW
- **Code Verification**: UNVERIFIED → VERIFIED

---

## 3) Database Design (Postgres/Drizzle)

**No new tables required** - Profile data is fetched from external API and cached in React Query, not persisted.

**Existing Table Reference**:
- `whatsapp_accounts` table already contains:
  - `phone_number_id` (text) - used as Graph API phone number ID
  - `company_id` (integer, FK) - multi-tenant scoping
  - `is_active` (boolean) - filter active accounts

**Indexes** (already exist):
- `whatsapp_accounts_company_id_idx` on `company_id`
- `whatsapp_accounts_company_id_is_active_idx` on `company_id, is_active`

**Migration Steps**:
- No database migration required

---

## 4) API / Server Actions Contract

**API Routes**:
- `GET /api/whatsapp-accounts/phone-profile` - Internal API route that proxies to Meta Graph API
  - Query params: `phoneNumberId`, `fields` (optional)
  - Returns: `WhatsappPhoneProfileResponse`
  - Handles Graph API authentication and error mapping

**Actions List**:
- `getWhatsappPhoneProfileAction` - Calls internal API route via server action

**Inputs/Outputs**:

```typescript
// Input
interface GetWhatsappPhoneProfileInput {
  phoneNumberId: string;
  fields?: 'name_status' | 'code_verification_status' | 'both';
}

// Output
interface WhatsappPhoneProfileResponse {
  id: string;
  display_phone_number: string;
  verified_name: string;
  quality_rating: 'GREEN' | 'YELLOW' | 'RED' | 'NA';
  name_status?: 'APPROVED' | 'AVAILABLE_WITHOUT_REVIEW' | 'DECLINED' | 'EXPIRED' | 'PENDING_REVIEW' | 'NONE';
  code_verification_status?: 'VERIFIED' | 'UNVERIFIED';
}
```

**Error Cases**:
- `401` - Invalid or expired access token → Result.fail("WhatsApp API authentication failed")
- `403` - Insufficient permissions → Result.fail("No permission to access phone number")
- `404` - Phone number not found → Result.fail("Phone number not found")
- `429` - Rate limit exceeded → Result.fail("Rate limit exceeded, please retry later")
- `500` - Internal server error → Result.fail("WhatsApp API error, please try again")

**Pagination Strategy**:
- Not applicable (single record fetch)

**API Route Implementation**:

```typescript
// app/api/whatsapp-accounts/phone-profile/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { whatsappPhoneProfileQuerySchema, whatsappPhoneProfileResponseSchema } from '@/features/whatsapp-accounts/schemas/whatsapp-phone-profile.schema';

export async function GET(request: NextRequest) {
  try {
    // Parse query params
    const searchParams = request.nextUrl.searchParams;
    const phoneNumberId = searchParams.get('phoneNumberId');
    const fields = searchParams.get('fields');

    // Validate input
    const validatedInput = whatsappPhoneProfileQuerySchema.parse({
      phoneNumberId,
      fields: fields as any,
    });

    // Build Graph API URL
    const graphApiVersion = process.env.GRAPH_API_VERSION || 'v19.0';
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!accessToken) {
      return NextResponse.json(
        { error: 'WhatsApp access token not configured' },
        { status: 500 }
      );
    }

    const fieldsParam = buildFieldsParam(validatedInput.fields);
    const graphApiUrl = `https://graph.facebook.com/${graphApiVersion}/${validatedInput.phoneNumberId}${fieldsParam}`;

    // Fetch from Meta Graph API
    const response = await fetch(graphApiUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'BitLabs WhatsApp CRM',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.error?.message || 'Failed to fetch profile' },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Validate response
    const validatedData = whatsappPhoneProfileResponseSchema.parse(data);

    return NextResponse.json(validatedData);
  } catch (error) {
    console.error('Phone profile API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function buildFieldsParam(fields?: string): string {
  if (!fields) return '';
  const fieldMap: Record<string, string> = {
    name_status: 'name_status',
    code_verification_status: 'code_verification_status',
    both: 'name_status,code_verification_status',
  };
  return `?fields=${fieldMap[fields] || ''}`;
}
```

---

## 5) Validation (Zod)

**Schemas to Create**:

```typescript
// Profile field options
export const PROFILE_FIELDS = ['name_status', 'code_verification_status', 'both'] as const;
export type ProfileFieldOption = (typeof PROFILE_FIELDS)[number];

// Input schema
export const whatsappPhoneProfileQuerySchema = z.object({
  phoneNumberId: z.string().min(1, 'Phone number ID is required'),
  fields: z.enum(PROFILE_FIELDS).optional(),
});

// Response schema
export const qualityRatingSchema = z.enum(['GREEN', 'YELLOW', 'RED', 'NA']);

export const nameStatusSchema = z.enum([
  'APPROVED',
  'AVAILABLE_WITHOUT_REVIEW',
  'DECLINED',
  'EXPIRED',
  'PENDING_REVIEW',
  'NONE',
]);

export const codeVerificationStatusSchema = z.enum(['VERIFIED', 'UNVERIFIED']);

export const whatsappPhoneProfileResponseSchema = z.object({
  id: z.string(),
  display_phone_number: z.string(),
  verified_name: z.string(),
  quality_rating: qualityRatingSchema,
  name_status: nameStatusSchema.optional(),
  code_verification_status: codeVerificationStatusSchema.optional(),
});

export type WhatsappPhoneProfileResponse = z.infer<typeof whatsappPhoneProfileResponseSchema>;
export type WhatsappPhoneProfileQuery = z.infer<typeof whatsappPhoneProfileQuerySchema>;
```

**Refinements**:
- None required (simple validation)

**Shared Types**:
- `WhatsappPhoneProfileResponse` - exported for UI components

---

## 6) Service Layer Plan

**Service Methods**:

```typescript
class WhatsappPhoneProfileService {
  static async getProfile(input: WhatsappPhoneProfileQuery): Promise<Result<WhatsappPhoneProfileResponse>>
}
```

**Responsibilities**:
- Validate input
- Call internal API route `/api/whatsapp-accounts/phone-profile`
- Parse and validate response
- Handle API errors and map to Result pattern
- Performance logging (operation name: "WhatsappPhoneProfileService.getProfile")

**Transaction Boundaries**:
- No database transactions (external API call only)

**Safety Rules**:
- Never expose access token to client
- Validate all response fields before returning
- Use timeout for external API calls

**Performance Logging**:
```typescript
const perf = createPerformanceLogger("WhatsappPhoneProfileService.getProfile", {
  context: { phoneNumberId: input.phoneNumberId },
});
// ... fetch logic
perf.complete();
```

**Result Mapping**:
- Success: `Result.ok(data, "Profile loaded")`
- Validation error: `Result.fail("Invalid input")`
- API error: `Result.fail("Failed to fetch profile")`
- Network error: `Result.fail("Network error")`

---

## 7) UI/UX Plan (shadcn + TanStack)

**Screens/Components**:

1. **WhatsAppPhoneProfilePage** (`app/(protected)/whatsapp-accounts/[id]/profile/page.tsx`)
   - Main page showing profile for account ID
   - Server component wrapper + client component

2. **WhatsAppPhoneProfileCard** (`features/whatsapp-accounts/components/whatsapp-phone-profile-card.tsx`)
   - Reusable card component for displaying profile
   - Shows all profile fields with proper styling

3. **QualityRatingBadge** (`features/whatsapp-accounts/components/quality-rating-badge.tsx`)
   - Badge component for quality rating
   - Color-coded: GREEN (green), YELLOW (yellow), RED (red), NA (gray)

4. **VerificationStatusBadge** (`features/whatsapp-accounts/components/verification-status-badge.tsx`)
   - Badge component for name status and code verification status
   - Color-coded based on status

**Forms**:
- No forms (read-only view)

**Table**:
- Not applicable (single record view)

**Empty/Loading/Error States**:
- **Loading**: Skeleton cards for each section
- **Error**: Alert with retry button
- **Empty**: "No profile data available" message

**Toast Strategy**:
- Success: "Profile refreshed"
- Error: "Failed to load profile"

---

## 8) Hook/State Plan

**Hooks to Create**:

```typescript
export function useWhatsappPhoneProfile(params: {
  phoneNumberId: string;
  includeNameStatus?: boolean;
  includeCodeVerification?: boolean;
}) {
  return useQuery({
    queryKey: [WHATSAPP_ACCOUNTS_KEY, 'profile', params.phoneNumberId, params.includeNameStatus, params.includeCodeVerification],
    queryFn: async () => {
      const result = await getWhatsappPhoneProfileAction({
        phoneNumberId: params.phoneNumberId,
        fields: buildFieldsParam(params),
      });
      if (!result.ok) throw new Error(result.error);
      return result.data;
    },
    staleTime: 300000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}
```

**Cache Keys**:
- `[WHATSAPP_ACCOUNTS_KEY, 'profile', phoneNumberId, ...flags]`

**Invalidation**:
- Invalidate on account update/deactivate
- Manual refresh via button

**Local State**:
- No Zustand store needed (React Query sufficient)

**Optimistic Updates**:
- Not applicable (read-only view)

---

## 9) Security & Compliance

**Auth Requirements**:
- User must be authenticated
- Session validation via `withAction` wrapper
- Role-based access (inherited from WhatsApp accounts)

**Row-Level Tenant Enforcement**:
- Verify account belongs to user's company before fetching profile
- Use existing `WhatsappAccountService.getById` to validate ownership

**Data Validation at Boundaries**:
- Input validation via Zod schema
- Response validation via Zod schema
- Never trust external API data without validation

**Token Security**:
- Access token stored in server environment variables
- Never exposed to client
- Rotated via deployment process

---

## 10) Testing Plan

**Unit Tests**:
- `WhatsappPhoneProfileService.getProfile`:
  - Valid input returns success
  - Invalid input returns error
  - API error handling (401, 403, 404, 429, 500)
  - Response validation

**Integration Tests**:
- Mock Graph API responses
- Test with all example responses from docs:
  - default_response
  - with_name_status
  - with_verification_status
  - comprehensive_response

**UI Tests**:
- Profile page renders correctly
- Loading states display
- Error states display with retry
- Quality rating badge shows correct colors
- Verification status badges display correctly

**Edge Cases**:
- Empty response from API
- Malformed response
- Timeout scenario
- Rate limit handling
- Network failure

---

## 11) Performance & Observability

**Query Cost Risks**:
- External API call latency (add timeout)
- Rate limiting (implement retry with exponential backoff)
- Concurrent requests (deduplicate via React Query)

**Required Indexes Recap**:
- No new indexes (using existing whatsapp_accounts indexes)

**Logging/Metrics Events**:
- `WhatsappPhoneProfileService.getProfile`:
  - Success: duration, phoneNumberId
  - Failure: duration, error type, phoneNumberId
- Graph API errors: log error codes and messages

**N+1 Avoidance**:
- Single API call per profile (no N+1)

**Batching**:
- Not applicable (single record fetch)

**Debouncing**:
- Not applicable (manual refresh or cache)

---

## 12) Delivery Checklist

**Files/Folders to Create**:

1. `app/api/whatsapp-accounts/phone-profile/route.ts` (NEW) - Internal API route
2. `features/whatsapp-accounts/schemas/whatsapp-phone-profile.schema.ts` (NEW)
3. `features/whatsapp-accounts/services/whatsapp-phone-profile.service.ts` (NEW)
4. `features/whatsapp-accounts/actions/whatsapp-phone-profile.actions.ts` (NEW)
5. `features/whatsapp-accounts/hooks/use-whatsapp-phone-profile.ts` (NEW)
6. `features/whatsapp-accounts/components/whatsapp-phone-profile-card.tsx` (NEW)
7. `features/whatsapp-accounts/components/quality-rating-badge.tsx` (NEW)
8. `features/whatsapp-accounts/components/verification-status-badge.tsx` (NEW)
9. `app/(protected)/whatsapp-accounts/[id]/profile/page.tsx` (NEW)

**Files/Folders to Modify**:
- No existing files modified (new feature)

**Order of Implementation**:

1. **Schema Layer** (5 min)
   - Create `whatsapp-phone-profile.schema.ts`
   - Define all Zod schemas and types

2. **API Route Layer** (15 min)
   - Create `app/api/whatsapp-accounts/phone-profile/route.ts`
   - Implement GET handler that proxies to Meta Graph API
   - Add Graph API authentication using access token
   - Handle Graph API errors and map to HTTP responses

3. **Service Layer** (10 min)
   - Create `whatsapp-phone-profile.service.ts`
   - Implement `getProfile` method that calls internal API route
   - Add performance logging

4. **Action Layer** (10 min)
   - Create `whatsapp-phone-profile.actions.ts`
   - Implement `getWhatsappPhoneProfileAction` with `withAction`

5. **Hook Layer** (10 min)
   - Create `use-whatsapp-phone-profile.ts`
   - Implement React Query hook

6. **Component Layer** (30 min)
   - Create badge components (QualityRatingBadge, VerificationStatusBadge)
   - Create profile card component
   - Create profile page

7. **Environment Setup** (5 min)
   - Add `GRAPH_API_VERSION` to .env
   - Add `WHATSAPP_ACCESS_TOKEN` to .env

8. **Testing** (20 min)
   - Write unit tests for service
   - Write integration tests
   - Test UI components

8. **Lint & Build** (10 min)
   - Run lint on all files
   - Fix any lint errors
   - Run `npm run build`

**Definition of Done**:
- [ ] All schemas created with proper Zod validation
- [ ] Service method fetches and validates Graph API responses
- [ ] Server action wrapped with `withAction` and auth
- [ ] Hook fetches data with proper cache keys
- [ ] Profile page displays all fields with proper styling
- [ ] Quality rating badge shows correct colors
- [ ] Verification status badges display correctly
- [ ] Loading, error, and empty states implemented
- [ ] All touched files pass lint with no errors
- [ ] `npm run build` passes
- [ ] Unit tests written and passing
- [ ] Integration tests written and passing
- [ ] Manual testing completed with example responses

---

## Environment Variables Required

```env
# Meta Graph API Configuration
GRAPH_API_VERSION=v19.0
WHATSAPP_ACCESS_TOKEN=your_access_token_here
```

---

## Example Usage

```typescript
// In a component
const { data: profile, isLoading, error, refetch } = useWhatsappPhoneProfile({
  phoneNumberId: '106853218861309',
  includeNameStatus: true,
  includeCodeVerification: true,
});

// Render profile
<WhatsAppPhoneProfileCard profile={profile} isLoading={isLoading} error={error} onRefresh={refetch} />
```
