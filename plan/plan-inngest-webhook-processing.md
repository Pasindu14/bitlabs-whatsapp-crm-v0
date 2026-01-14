# Plan: Inngest Background Processing for WhatsApp Webhook Events

## 1) Feature Summary

### Goal
Migrate synchronous WhatsApp webhook message processing to asynchronous background jobs using Inngest, enabling reliable execution, automatic retries, and bypassing Vercel's execution time limits.

### Actors & Permissions
- **WhatsApp Webhook**: Unauthenticated POST endpoint receiving Meta webhook events
- **Inngest Platform**: Orchestrates background job execution with retries
- **WebhookIngestService**: Processes events (message/status updates) in background
- **Client Hooks**: Query database for processed messages (no API changes needed)

### Primary Flows
1. **Webhook Ingestion Flow:**
   - WhatsApp sends webhook event to `/api/webhooks/whatsapp`
   - Webhook validates signature, logs event to DB (deduplicated)
   - Webhook sends event to Inngest: `whatsapp/webhook.received`
   - Webhook returns 200 OK immediately (fast response)

2. **Background Processing Flow:**
   - Inngest receives event, triggers `processWebhookEvent` function
   - Function retrieves log from DB, checks if already processed
   - Function processes message/status update (creates contact, conversation, message)
   - Function marks log as processed
   - On failure: Inngest retries with exponential backoff (up to configurable limit)

3. **Client Data Flow:**
   - Client hooks query DB for messages/conversations
   - Real-time updates via polling or WebSocket (unchanged)
   - Data appears as processing completes

### Interaction-to-Data Flow (EXTREME DETAIL REQUIRED)

**Flow: Webhook receives message event**

**Visual Journey:**
1. **Initial State:**
   - WhatsApp webhook endpoint at `/api/webhooks/whatsapp`
   - Current: processing happens synchronously in webhook
   - Issue: Vercel 10-60s timeout, no retries on failure

2. **User Action (WhatsApp sends webhook):**
   - POST request with JSON payload containing message data
   - Headers include `x-hub-signature-256` for verification

3. **Webhook Processing:**
   - Extract `phone_number_id` from payload
   - Query `whatsappAccountsTable` to find account
   - Query `whatsappWebhookConfigsTable` for config
   - Verify signature using `appSecret`
   - Call `WebhookIngestService.logEvent()` → inserts to `whatsappWebhookEventLogsTable`
   - Deduplication via `companyId + dedupKey` unique constraint
   - Returns `logId` (or 0 if duplicate)

4. **Send to Inngest:**
   - If `logId > 0`, call `inngest.send()` with event name `whatsapp/webhook.received`
   - Event data: `{ logId }`
   - Inngest acknowledges receipt immediately

5. **Response:**
   - Webhook returns `{ success: true }` with 200 status
   - Total time: < 500ms (vs potentially 10-60s with synchronous processing)

6. **Background Processing (Inngest):**
   - Inngest receives event, queues `processWebhookEvent` function
   - Function executes in Vercel serverless function
   - Calls `WebhookIngestService.processEvent(logId)`
   - Processes message: creates contact, conversation, message records
   - Updates `whatsappWebhookEventLogsTable.processed = true`
   - On success: marks step complete
   - On failure: Inngest retries (default: 3 attempts with exponential backoff)

7. **Success State:**
   - Webhook responds quickly to WhatsApp (prevents timeout)
   - Message processed reliably in background
   - All data persisted to DB
   - Client sees message after processing completes

8. **Error Scenarios:**
   - **Duplicate webhook**: `logEvent` returns `logId: 0`, no Inngest event sent
   - **Inngest send failure**: webhook still returns 200, event logged for manual retry
   - **Processing failure**: Inngest retries automatically; after max retries → manual intervention
   - **DB transaction failure**: Inngest retries with same logId (idempotent)
   - **Signature verification failure**: webhook returns 403, no processing

---

## 2) Domain Model

### Entities
- **InngestClient**: Singleton client for sending events and serving functions
  - Core properties: `id`, `eventKey`, `signingKey`
  - Lifecycle: app-wide singleton

- **WebhookEventFunction**: Inngest function definition
  - Core properties: `id`, `event` (trigger), `steps`
  - Lifecycle: registered with Inngest, executed on event

- **WebhookEvent**: Event sent to Inngest
  - Core properties: `name` (string), `data` (object with `logId`)
  - Lifecycle: created by webhook, consumed by function

### Invariants
1. Every webhook event must be logged to DB before sending to Inngest
2. Inngest function must check `processed` flag before processing (idempotent)
3. Webhook must return 200 within Vercel timeout (10-60s)
4. Inngest retries must be idempotent (same logId can be retried)
5. Signature verification must happen before any processing

---

## 3) Database Design

### Existing Tables (No Changes)
- `whatsappWebhookEventLogsTable`: Already has `processed` flag and `processedAt` timestamp
- `whatsappWebhookConfigsTable`: Already stores `appSecret` for signature verification
- `whatsappAccountsTable`: Already stores `phoneNumberId` for account lookup
- `contactsTable`, `conversationsTable`, `messagesTable`: No changes

### New Tables
None required. Existing schema supports the flow.

### Indexes
Existing indexes are sufficient:
- `whatsappWebhookEventLogsTable`: unique on `(companyId, dedupKey)` for deduplication
- `whatsappAccountsTable`: index on `phoneNumberId` for fast lookup
- `whatsappWebhookConfigsTable`: composite index on `(companyId, whatsappAccountId)`

---

## 4) Server Actions Contract

### Actions (No Changes)
Existing server actions remain unchanged:
- `upsertWebhookConfigAction`: Configures webhook
- `listWebhookEventLogsAction`: Lists event logs
- `getWebhookConfigAction`: Gets config

### New Actions
None required. Webhook is an API route, not a server action.

---

## 5) Validation (Zod)

### Schemas (No Changes)
Existing schemas remain sufficient:
- `webhookEventPayloadSchema`: Validates webhook payload
- `webhookMessagePayloadSchema`: Validates message data
- `webhookStatusPayloadSchema`: Validates status updates

### New Schemas
None required. Inngest event data is minimal (`{ logId: number }`).

---

## 6) Service Layer

### Existing Services (No Changes)
- `WebhookIngestService`: Already has `logEvent()` and `processEvent()` methods
  - `logEvent()`: Logs event to DB with deduplication
  - `processEvent()`: Processes event (idempotent, checks `processed` flag)
  - `processMessage()`: Handles message creation
  - `processStatus()`: Handles status updates

- `WebhookConfigService`: Already handles config management

### New Services
None required. Existing services support the flow.

---

## 7) UI/UX Plan

### UI Components (No Changes)
No UI changes required. Existing components work as-is:
- `WebhookConfigForm`: Configure webhook settings
- `WebhookEventLogs`: View event logs and processing status
- Message/conversation UI: Displays processed messages

### User Experience Improvements
- **Faster webhook responses**: WhatsApp won't timeout on high-volume events
- **Reliability**: Automatic retries on transient failures
- **Observability**: Inngest dashboard shows all job executions, retries, failures
- **Event logs**: Can see processing status (pending/processed/failed)

---

## 8) Hook/State Plan

### Hooks (No Changes)
Existing hooks remain unchanged:
- `useWebhookConfig`: Fetches webhook config
- `useWebhookEventLogs`: Lists event logs
- `useUpsertWebhookConfig`: Upserts config

### New Hooks
None required. Hooks query DB; processing happens in background via Inngest.

### State Management (No Changes)
No changes to Zustand stores. Data flows from DB to UI as before.

---

## 9) Security & Compliance

### Security Considerations
1. **Inngest Keys**: Store in environment variables, never commit to git
   - `INNGEST_EVENT_KEY`: For sending events
   - `INNGEST_SIGNING_KEY`: For securing serve endpoint

2. **Signature Verification**: Continue verifying `x-hub-signature-256` before processing

3. **Multi-tenant Isolation**: Existing `companyId` filtering ensures tenant isolation

4. **Idempotency**: Inngest retries must be idempotent (already implemented via `processed` flag)

### Compliance
- Audit logging already implemented in `WebhookConfigService`
- Event logs track all webhook events with timestamps
- Inngest provides execution logs for compliance auditing

---

## 10) Testing Plan

### Unit Tests
- **Inngest client initialization:**
  - Given env vars, assert client is created with correct config
  - Missing env vars should throw error

- **Inngest function:**
  - Mock `WebhookIngestService.processEvent()`
  - Assert function calls processEvent with correct logId
  - Assert function throws on failure (triggers Inngest retry)

- **Webhook route:**
  - Mock `inngest.send()`
  - Assert webhook sends event after successful log
  - Assert webhook returns 200 even if Inngest send fails
  - Assert webhook doesn't send event for duplicate (logId: 0)

### Integration Tests
- **End-to-end flow:**
  1. Send webhook payload to `/api/webhooks/whatsapp`
  2. Assert event logged to DB
  3. Assert Inngest event sent
  4. Mock Inngest function execution
  5. Assert message/contact/conversation created in DB
  6. Assert event log marked as processed

- **Retry logic:**
  1. Send webhook
  2. Make `processEvent()` fail first time
  3. Assert Inngest retries
  4. Make `processEvent()` succeed second time
  5. Assert event log marked as processed

### UI Tests
No new UI tests required. Existing tests cover UI components.

---

## 11) Performance & Observability

### Performance Improvements
- **Webhook response time**: < 500ms (vs 10-60s with synchronous processing)
- **Throughput**: Can handle high-volume webhook bursts without timeout
- **Scalability**: Inngest scales automatically with Vercel

### Observability
- **Inngest Dashboard**: View all function executions, retries, failures
- **Event Logs**: Track processing status via `processed` flag
- **Performance Logging**: Existing `createPerformanceLogger()` in services
- **Error Tracking**: Sentry integration (already configured)

### Metrics to Track
- Webhook response time (p50, p95, p99)
- Inngest function execution time
- Retry rate and failure rate
- Event processing lag (time from webhook to processed)

---

## 12) Delivery Checklist

### Files to Create
1. `lib/inngest.ts`: Inngest client singleton
2. `features/whatsapp-webhook/inngest/process-message.ts`: Inngest function for processing webhook events
3. `app/api/inngest/route.ts`: Inngest serve endpoint

### Files to Update
1. `app/api/webhooks/whatsapp/route.ts`: Replace `.catch()` with `inngest.send()`
2. `package.json`: Add `inngest` dependency
3. `.env`: Add `INNGEST_EVENT_KEY` and `INNGEST_SIGNING_KEY`

### Environment Variables
```
INNGEST_EVENT_KEY=evt_xxxxxxxxxxxxx
INNGEST_SIGNING_KEY=sign_xxxxxxxxxxxxx
```

### Definition of Done
- ✅ Inngest package installed
- ✅ Inngest client created with environment variables
- ✅ Inngest function defined and registered
- ✅ Inngest serve route created at `/api/inngest`
- ✅ Webhook route updated to send events to Inngest
- ✅ Webhook sends event only if `logId > 0`
- ✅ Environment variables documented in `.env.example`
- ✅ Inngest dashboard shows functions registered
- ✅ Test webhook event triggers Inngest function
- ✅ Message processing completes successfully in background
- ✅ Event log marked as processed after successful execution
- ✅ Retry logic tested (simulate failure, verify retry)
- ✅ Existing hooks/UI work without changes
- ✅ No breaking changes to existing functionality

---

# Required End-of-Plan Flow Snippet (Verbatim)

- User list page with table (columns: name, email, role, status, actions)
- "Add User" button top-right opens dialog
- Dialog has fields: name (text, required), email (email, required), role (dropdown, default: user), isActive (checkbox, default: checked)
- Submit creates user → shows toast → closes dialog → table updates
- Each row has edit icon (opens same dialog pre-filled) and delete icon (confirmation dialog)
- Database: users table with companyId, name, email, role, isActive, audit fields
- Indexes for: list by company, unique email per company, search by name
- Service methods: create, update, deactivate, getById, list
- Actions: createUserAction, updateUserAction, etc.
- Hooks: useUsers (list), useUser (detail)
- Zustand store: usersStore
