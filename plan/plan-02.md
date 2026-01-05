---
feature: WhatsApp Webhook Ingestion (Meta)
date: 2026-01-05
plan: 02
---

1) **Feature Summary**
- Goal: Enable inbound WhatsApp message delivery from Meta via a secure webhook endpoint, supporting local dev via ngrok and production via first-party HTTPS. Persist events and transform them into conversations/messages tied to the correct company/account with auditing.
- Actors & permissions: Authenticated users with role `admin`/`manager` can configure the webhook (view secrets, rotate tokens). System receives webhooks unauthenticated (verified via Meta challenge + app secret) and processes as background job/service. Read-only users can view delivery logs.
- Primary flows: (a) Configure webhook verify token + app secret per WhatsApp account, (b) Expose callback URL (ngrok for dev), (c) Meta challenge verification, (d) Receive message/status notifications, (e) Idempotent processing into domain messages/conversations, (f) View webhook delivery log.
- Assumptions: One WhatsApp Business Account (WABA) per company; existing `whatsapp_accounts` table holds access tokens and phone numbers; conversations/messages feature already exists to persist chat history; production domain is available (no need for ngrok in prod); ngrok is for dev only and not stored in DB.

2) **Domain Model**
- Entities:
  - WhatsAppWebhookConfig: per company/account secrets (verifyToken, appSecret, callbackPath, status).
  - WebhookEventLog: raw inbound event for auditing/idempotency.
  - Conversation/Message: existing domain objects populated via service pipeline.
- Relationships: WhatsAppWebhookConfig 1—1 WhatsAppAccount; WebhookEventLog many—1 WhatsAppAccount; Messages many—1 Conversation; all scoped by companyId.
- State machine: WebhookConfig status {unverified → verified → disabled}. Transitions triggered by successful challenge or admin toggling.

3) **Database Design (Postgres/Drizzle)**
- Table: `whatsapp_webhook_configs`
  - id (uuid PK), companyId (uuid, FK companies), whatsappAccountId (uuid FK), verifyToken (text, hashed), appSecret (text, hashed/enc), callbackPath (text), status (text enum: unverified/verified/disabled), lastVerifiedAt (timestamptz), createdAt/updatedAt (timestamptz default now), createdBy/updatedBy (uuid), isActive (boolean default true).
  - Constraints: unique(companyId, whatsappAccountId); check status in enum; FK to whatsapp_accounts.
- Table: `whatsapp_webhook_event_logs`
  - id (uuid PK), companyId (uuid), whatsappAccountId (uuid), objectId (text nullable), eventType (text), eventTs (timestamptz), payload (jsonb), signature (text), dedupKey (text), processed (boolean default false), processedAt (timestamptz), createdAt/updatedAt, createdBy/updatedBy nullable system, isActive (boolean default true).
  - Constraints: check payload is jsonb; unique(companyId, dedupKey) for idempotency; FK whatsappAccountId.
- Indexes:
  - webhook_configs: idx on (companyId, whatsappAccountId) unique; idx on (companyId, status).
  - event_logs: idx on (companyId, whatsappAccountId, processed, eventTs desc) for dashboard; idx on (companyId, dedupKey) unique; GIN on payload for JSON filtering if needed.
- Expected queries mapped:
  - Fetch config by accountId/companyId → unique index.
  - List recent events filtered by processed + ts → processed/ts index.
  - Idempotency check on dedupKey → unique index.
- Migration steps: create webhook_configs; create event_logs; add FKs and checks; add indexes; backfill existing accounts with unverified configs (status unverified, callbackPath default `/api/webhooks/whatsapp`).

4) **API / Server Actions Contract**
- Actions (server actions / route handlers):
  - `getWebhookConfig(accountId)`: returns config sans secrets.
  - `upsertWebhookConfig(accountId, verifyToken, appSecret, callbackPath, status?)`: admin only, hashes secrets.
  - `rotateVerifyToken(accountId)`: admin only, returns new token (show once).
  - `setWebhookStatus(accountId, status)`: enable/disable.
  - Route handler `POST /api/webhooks/whatsapp`: handles Meta challenge (GET) and incoming events (POST).
- Inputs/outputs:
  - Upsert input includes companyId/userId from session; outputs config summary + public callback URL (constructed from env DOMAIN or dev ngrok URL).
  - Webhook handler input: headers (`x-hub-signature-256`), body JSON from Meta; outputs 200/403/400 accordingly.
- Error cases: validation errors, unauthorized role, account not found for company, signature mismatch, status disabled, idempotency conflicts.
- Pagination: event log list uses cursor (id, eventTs desc) with limit+1 pattern.

5) **Validation (Zod)**
- Schemas:
  - `webhookConfigUpsertClientSchema` (verifyToken min length, appSecret min length, callbackPath URL/path).
  - `webhookConfigUpsertServerSchema` (extends client + companyId/userId + whatsappAccountId).
  - `webhookConfigResponseSchema`.
  - `webhookEventLogListQuerySchema` (cursor, limit, processed filter).
  - `webhookEventPayloadSchema` minimal shape per Meta (object, entry array, changes messages/status).
- Refinements: verifyToken/appSecret trimmed; callbackPath must start with `/` or full https URL.
- Shared types exported for DTOs and TanStack query keys.

6) **Service Layer Plan**
- `WebhookConfigService`:
  - `getByAccount(companyId, accountId)`: safe select.
  - `upsert(data)`: hash secrets, save callbackPath, set status unverified, log perf.
  - `rotateVerifyToken(data)`: generate strong random token, hash, return plain once.
  - `setStatus(data)`: toggle, record updatedBy.
- `WebhookIngestService`:
  - `handleChallenge(query, config)`: compare verifyToken, update status verified.
  - `verifySignature(headers, rawBody, appSecret)`: HMAC SHA256.
  - `logEvent(data)`: persist WebhookEventLog with dedupKey (objectId+ts or Meta message id).
  - `processEvent(logId)`: parse payload, upsert conversation/contact, append message, mark processed; calls existing Conversation/Message services with companyId/userId=system.
- Transaction boundaries: upsert/rotate/status in single tx; ingest path uses two-phase (log → process) to keep webhook fast.
- Safety: select only needed columns; returning clauses for ids; use performance logger per operation; Result<T> for all methods.

7) **UI/UX Plan (shadcn + TanStack)**
- Screen in WhatsApp Accounts detail: “Webhook” tab.
- Components:
  - Config form: verify token (show copy once), app secret (masked), callbackPath (readonly when generated), status badge.
  - “Generate ngrok URL” helper (dev only flag) with info text to run ngrok command.
  - Event log table: columns (eventType, eventTs, processed, objectId, dedupKey, actions view JSON).
  - Empty/loading/error states; toasts for save/rotate.
- Forms: react-hook-form + zodResolver; submit via server action; disable inputs if status disabled.
- Table: TanStack table with cursor pagination; filters by processed and date range.

8) **Hook/State Plan**
- React Query hooks:
  - `useWebhookConfig(accountId)` → server action get.
  - `useUpsertWebhookConfig()` → invalidate config + event logs.
  - `useRotateVerifyToken()` → returns token; invalidates config.
  - `useWebhookEventLogs(accountId, query)` → cursor pagination.
- Local state: minimal; maybe modal for “Show raw payload”.
- Optimistic: none for secrets; use invalidate pattern.

9) **Security & Compliance**
- Auth: server actions require session + role check; route handler bypasses auth but verifies signature + verifyToken; company scoping on every read/write.
- Secret handling: hash verifyToken/appSecret at rest (or encrypt appSecret if needed); never return hashed values; show rotate tokens once.
- Multi-tenant: where clauses include companyId; unique constraints include companyId.
- Input validation on all boundaries; reject unverified/disabled configs for ingestion.

10) **Testing Plan**
- Unit: signature verification (good/bad), dedupKey generation, status transitions.
- Integration (DB + service): upsert/rotate, challenge handling updates status, idempotent event logging, processEvent creates messages and marks processed.
- Route handler tests: GET challenge success/forbidden, POST with/without signature, disabled config returns 403.
- UI tests: config form submit, rotate token flow, event log pagination.
- Edge cases: invalid payload shape, missing account, stale ngrok URL, duplicate event, large payload.

11) **Performance & Observability**
- Keep webhook handler fast: log event then enqueue processing; consider background job queue (cron/worker).
- Index recap: unique (companyId, dedupKey); ts/processed index for listing.
- Logging: performance logger for upsert/process; audit log entries on config changes and processed events; metrics counters for received/processed/failed.
- N+1 avoidance: batch fetch conversations by customer/phone when processing entries.

12) **Delivery Checklist**
- Files/folders to create:
  - `db/schema/whatsapp-webhook.ts` (or extend existing schema.ts) with tables + indexes.
  - Feature folder `features/whatsapp-webhook/` with schemas, services, actions, hooks, components (tab + event log table).
  - API route `app/api/webhooks/whatsapp/route.ts`.
- Order: migration → schemas → services → actions/route → hooks → UI → tests.
- Definition of Done: all actions validated, multi-tenant enforced, secrets hashed, webhook verified via Meta sandbox, event log list works with pagination, tests pass, lint passes.
