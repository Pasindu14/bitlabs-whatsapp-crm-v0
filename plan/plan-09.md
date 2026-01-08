---
feature: Order Management (Orders)
planNumber: 09
date: 2026-01-08
---

## 1) Feature Summary
### Goal
Add order management within conversations: allow creating an order directly from a conversation (prefilled with contact name/phone), manage order records (list, view, update status), and present an orders table similar to the users table.

### Actors & Permissions
- Authenticated users within a company (multi-tenant).
- Roles (assume): admin/manager can create/update orders; agents can create and update status for their conversations; viewers read-only. (Adjust if actual roles differ.)

### Primary Flows
- Create order from conversation: open dialog, prefill contact name/phone, submit order.
- Update order status/details.
- List/search/filter/paginate orders.
- View order detail (inline panel or drawer).
- Optional deactivate/cancel order (soft delete via isActive).

### Interaction-to-Data Flow (examples)
- Create: User clicks **Create Order** in conversation → `<CreateOrderDialog>` → `useCreateOrder()` → `createOrderAction()` → `OrderService.create()` → `db.insert(ordersTable)` → `Result.ok` → query invalidation `orderKeys.lists()` → UI closes dialog, toast success.
- Update status: User changes status in row action → `useUpdateOrderStatus()` → `updateOrderStatusAction()` → `OrderService.updateStatus()` → `db.update` → invalidate `orderKeys.byId(orderId)` + `orderKeys.lists()` → toast.
- List: Orders page/table mounts → `useOrders(filters)` → `listOrdersAction()` → `OrderService.list()` (cursor pagination) → return data + hasMore → cache → render table.
- View details: User opens row → `useOrder(orderId)` → `getOrderByIdAction()` → `OrderService.getById()` → return DTO → render detail panel.
- Deactivate/Cancel: User clicks **Cancel Order** → `useDeactivateOrder()` → `deactivateOrderAction()` → `OrderService.deactivate()` (set isActive=false, status="cancelled") → invalidate lists/detail → toast.

### Assumptions
- Conversations already provide contact object with `name` and `phone` (string) scoped to company.
- No payment processing; this is order tracking only.
- Status state machine: `draft` → `pending` → `confirmed` → `shipped` → `delivered` (terminal) or `cancelled` (terminal). Agents can move forward; cancel anytime.
- Address is free-form text (deliveryAddress). Add optional `notes` field.
- Orders belong to a single company and (optionally) to a conversation/contact.
- No line items for now; single description string. (Extensible later.)

---

## 2) Domain Model
- Order: represents a customer order tied to a contact and optionally a conversation.
- Contact: existing entity with name/phone; referenced by order.
- Conversation: existing entity; referenced optionally for context.
- User: creator/updater references.

Relationships: company 1–many orders; contact 1–many orders; conversation 1–many orders (nullable); user 1–many created/updated orders.

State machine: `draft` → `pending` → `confirmed` → `shipped` → `delivered`; `cancelled` can be set from any non-terminal. Terminal states: `delivered`, `cancelled`.

Invariants:
- order.companyId matches contact.companyId and conversation.companyId (if present).
- phone/name on order should mirror contact at creation time (denormalized snapshot fields allowed: contactName, contactPhone).
- isActive=false implies status must be `cancelled`.

---

## 3) Database Design (Postgres/Drizzle)
### Table: orders
Columns:
- id (serial PK)
- companyId (int, FK companies, not null)
- contactId (int, FK contacts, not null)
- conversationId (int, FK conversations, nullable)
- createdBy (int FK users, not null)
- updatedBy (int FK users, nullable)
- contactNameSnapshot (text, not null)
- contactPhoneSnapshot (text, not null)
- customerName (text, not null) // editable display name
- customerPhone (text, not null) // editable phone
- deliveryAddress (text, not null)
- orderDescription (text, not null)
- status (text, not null, default "draft", enum constrained to allowed statuses)
- notes (text, nullable)
- isActive (boolean, not null, default true)
- createdAt (timestamptz, default now, not null)
- updatedAt (timestamptz, nullable)

Constraints:
- PK(id)
- FKs to companies, contacts, conversations, users.
- Check status in allowed set.
- companyId required everywhere.

Soft delete: isActive boolean; status set to `cancelled` when deactivated.

Indexes (by query pattern):
- idx_orders_company_created_id: (companyId asc, createdAt desc, id desc) for lists/sorts.
- idx_orders_company_status_id: (companyId asc, status asc, id desc) for status filter.
- idx_orders_company_contact_id: (companyId asc, contactId asc, id desc) for contact drill-down.
- idx_orders_company_conversation_id: (companyId asc, conversationId asc, id desc) for conversation view.
- idx_orders_company_active: (companyId asc, isActive asc) for active filters.

Expected Queries → Index mapping:
- List with status filter/sort by createdAt: use idx_orders_company_status_id.
- List default sort by createdAt: idx_orders_company_created_id.
- View by contact: idx_orders_company_contact_id.
- View by conversation: idx_orders_company_conversation_id.
- Soft-delete/active filter: idx_orders_company_active.

Migration Plan:
1) Create table orders with columns, constraints, default status check.
2) Add indexes above.
3) (No backfill; new feature.)
4) Rollback: drop indexes then table.

---

## 4) API / Server Actions Contract
Actions (server actions via withAction):
- createOrder(input)
- updateOrder(input)
- updateOrderStatus(input)
- deactivateOrder(input)
- getOrderById(params)
- listOrders(filters)

DTOs:
- createOrder input: { companyId, userId, contactId, conversationId?, customerName, customerPhone, deliveryAddress, orderDescription, status?, notes? }
- updateOrder input: { companyId, userId, orderId, customerName?, customerPhone?, deliveryAddress?, orderDescription?, notes? }
- updateOrderStatus input: { companyId, userId, orderId, status }
- deactivateOrder input: { companyId, userId, orderId }
- getOrderById params: { companyId, orderId }
- listOrders filters: { companyId, cursor?, limit, status?, searchTerm?, contactId?, conversationId? }

Outputs: Result<{ order }> or Result<{ orders, nextCursor, hasMore }>.

Error cases: validation fail, not found (company-scoped), forbidden (role), conflict (none expected), unexpected.

Pagination: cursor-based (createdAt, id) with limit+1.
Cache invalidation: after mutations invalidate `orderKeys.lists()` and relevant `orderKeys.detail(orderId)`.

---

## 5) Validation (Zod)
Schemas:
- orderStatusEnum: ["draft","pending","confirmed","shipped","delivered","cancelled"].
- createOrderClientSchema (no company/user) and server schema extends with companyId, userId.
- updateOrderClientSchema / server.
- updateOrderStatus schema (status enum).
- deactivateOrder schema (id + company/user).
- getOrderById schema.
- listOrders schema: cursor (base64), limit (1-100), status optional enum, searchTerm optional trimmed, contactId optional int, conversationId optional int.
Refinements: ensure deliveryAddress not empty; phone trimmed; when status is terminal, isActive false handled in service.

---

## 6) Service Layer Plan
Service: OrderService with methods create, update, updateStatus, deactivate, getById, list.
- Use performance logger per method.
- Always filter by companyId and isActive where appropriate.
- create: insert order, snapshot contact name/phone from contact, default status draft if not provided.
- update: update mutable fields; updatedBy set.
- updateStatus: enforce valid transition (e.g., cannot move from delivered/cancelled to others). If status becomes cancelled, set isActive=false.
- deactivate: set isActive=false and status=cancelled.
- getById: companyId+id filter, select minimal columns.
- list: cursor pagination (orderBy createdAt desc, id desc), optional filters (status, searchTerm on customerName/description, contactId, conversationId, isActive=true).
Returns Result<T>; no thrown errors for expected cases.

---

## 7) UI/UX Plan (shadcn + TanStack)
- Conversation view: add **Create Order** button under add/edit note area; opens `<CreateOrderDialog>`.
- Dialog form fields: Contact Name (prefilled from contact, editable), Contact Phone (prefilled), Delivery Address (textarea), Order Description (textarea), Status (select default draft), Notes (optional). Submit via react-hook-form + zodResolver. Disable/ loading states.
- Orders page: new route `/orders` (or within protected area) showing table similar to users-table with columns: ID, Contact, Customer Name, Status (badge), Created At, Updated At, Actions (View, Edit, Update Status, Cancel).
- Order detail panel/drawer: shows fields, status history (basic), actions to update status or edit fields.
- Empty/loading/error states and toasts on success/failure.

---

## 8) Hook/State Plan
React Query hooks:
- useOrders(filters): list with cursor.
- useOrder(orderId): detail.
- useCreateOrder(), useUpdateOrder(), useUpdateOrderStatus(), useDeactivateOrder().
Query keys: orderKeys.lists(filterKey), orderKeys.detail(id).
Invalidation: create/update/deactivate/status → invalidate lists and detail.
Zustand: not needed beyond existing store; use local state for dialogs.

---

## 9) Security & Compliance
- Require session; actions wrapped with withAction for companyId/userId injection.
- All queries include companyId (tenant guard) and isActive where needed.
- Role/permission checks in service (assumed admin/manager/agent); adjust once roles clarified.
- Validate inputs with Zod both client and server schemas.

---

## 10) Testing Plan
- Service unit tests: create, update, status transitions, deactivate, list filters, not-found, tenant isolation.
- Integration: cursor pagination correctness; search filter; status transition enforcement.
- UI smoke: create order dialog flow; status update action; orders table render with pagination.
- Edge: attempting to update cancelled/delivered; missing contact; cross-company access denied.

---

## 11) Performance & Observability
- Indexes aligned to list/status/contact/conversation queries.
- Performance logging in services with row counts.
- Avoid N+1 by selecting only needed columns; join only when necessary.
- Debounce search input on list.

---

## 12) Delivery Checklist
- DB: add orders table + indexes.
- Schemas: Zod create/update/status/list/id.
- Service: OrderService methods.
- Actions: create/update/updateStatus/deactivate/getById/list.
- Hooks: useOrders/useOrder/useCreateOrder/useUpdateOrder/useUpdateOrderStatus/useDeactivateOrder.
- UI: CreateOrderDialog; OrdersPage with table; OrderDetail panel; add button in conversation UI.
- Tests: service + integration + UI smoke.
- Verify tenant isolation, status transitions, toasts, loading/disabled states.
