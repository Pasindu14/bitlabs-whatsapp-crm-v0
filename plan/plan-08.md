---
feature: Chat Groups
planNumber: 08
date: 2026-01-07
---

## 1) Feature Summary

### Goal
Enable users to create, manage, and interact with WhatsApp Business groups within the CRM. This includes creating groups, managing participants, sending messages to groups, and tracking group activity.

### Actors & Permissions
- **Admin**: Full access to create, modify, delete groups and manage all participants
- **Manager**: Can create groups, add/remove participants, send messages
- **User**: Can view groups they're members of, send messages to groups they're in, view group history

### Primary Flows
- Create a new WhatsApp group with name, description, and initial participants
- Add/remove participants from existing groups
- Send messages to groups (broadcast to all members)
- View group conversation history
- List/filter groups with pagination
- Update group metadata (name, description, avatar)
- Deactivate/archive groups
- View group member list and roles

### Interaction-to-Data Flow

**Create Group Flow:**
- User clicks **Create Group** button in Groups page → `<GroupCreateForm/>` → calls `useCreateGroup()` → calls `createGroupAction()` → validates with `groupCreateServerSchema` → calls `GroupService.create()` → transaction: inserts into `groupsTable`, inserts into `groupMembersTable` for each participant, logs audit → returns `Result.ok(groupData)` → hook invalidates `['groups']` query → UI shows success toast and redirects to group details

**Add Participant Flow:**
- User clicks **Add Member** in group details → `<AddMemberDialog/>` → calls `useAddGroupMember()` → calls `addGroupMemberAction()` → validates with `groupMemberAddServerSchema` → calls `GroupService.addMember()` → checks if participant exists, checks if already member, inserts into `groupMembersTable`, logs audit → returns `Result.ok(memberData)` → hook invalidates `['groups', groupId, 'members']` query → UI shows success toast and updates member list

**Send Group Message Flow:**
- User types message and clicks **Send** → `<GroupMessageInput/>` → calls `useSendGroupMessage()` → calls `sendGroupMessageAction()` → validates with `groupMessageSendServerSchema` → calls `GroupService.sendMessage()` → validates user is group member, inserts into `messagesTable` with `groupId`, calls WhatsApp API to broadcast message, logs audit → returns `Result.ok(messageData)` → hook invalidates `['groups', groupId, 'messages']` and `['conversations']` queries → UI displays message and shows success toast

**List Groups Flow:**
- User navigates to Groups page → `<GroupsListPage/>` → calls `useListGroups()` → calls `listGroupsAction()` → validates with `groupListFilterSchema` → calls `GroupService.list()` → queries `groupsTable` with cursor pagination, filters by `companyId`, joins `groupMembersTable` for member count, returns `Result.ok({ groups, nextCursor, hasMore })` → hook caches data → UI renders table with pagination

**Update Group Flow:**
- User clicks **Edit Group** → `<GroupEditForm/>` → calls `useUpdateGroup()` → calls `updateGroupAction()` → validates with `groupUpdateServerSchema` → calls `GroupService.update()` → updates `groupsTable`, logs audit → returns `Result.ok(updatedGroup)` → hook invalidates `['groups']` and `['groups', groupId]` queries → UI shows success toast and updates display

**Remove Participant Flow:**
- User clicks **Remove** on member → `<GroupMemberList/>` → calls `useRemoveGroupMember()` → calls `removeGroupMemberAction()` → validates with `groupMemberRemoveServerSchema` → calls `GroupService.removeMember()` → soft deletes from `groupMembersTable` (sets `isActive: false`), logs audit → returns `Result.ok()` → hook invalidates `['groups', groupId, 'members']` query → UI shows success toast and removes member from list

**Deactivate Group Flow:**
- User clicks **Deactivate Group** → `<GroupDetailsPage/>` → calls `useDeactivateGroup()` → calls `deactivateGroupAction()` → validates with `groupDeactivateServerSchema` → calls `GroupService.deactivate()` → sets `groupsTable.isActive = false`, logs audit → returns `Result.ok()` → hook invalidates `['groups']` queries → UI shows success toast and removes group from list

### Assumptions
- Groups are WhatsApp Business groups synced via WhatsApp API
- Group participants are existing contacts in the system
- Group messages are treated as regular messages but with groupId association
- WhatsApp API provides group metadata and member list via webhooks
- Groups can have up to 1024 participants (WhatsApp Business limit)
- Group roles: admin (can manage group) and member (read/write only)
- Group conversations are separate from 1:1 conversations
- Group avatar images are stored via existing file upload system

---

## 2) Domain Model

### Entities

**Group**
- Represents a WhatsApp Business group
- Has metadata (name, description, avatar, WhatsApp group ID)
- Belongs to a company (multi-tenant)
- Has multiple members (contacts)
- Has a conversation thread

**GroupMember**
- Represents a contact's membership in a group
- Has role (admin/member)
- Tracks joined/left timestamps
- Links group, contact, and company

**GroupMessage** (extends existing messagesTable)
- Message sent to a group
- Links to group via groupId
- Same structure as regular messages

### Relationships

- **Company 1:N Groups** - Each company can have multiple groups
- **Group N:M Contacts** - Groups have many members via GroupMember junction
- **Contact N:M Groups** - Contacts can be members of multiple groups
- **Group 1:N Messages** - Groups have many messages
- **User N:M Groups** - Users can be assigned to manage groups (optional)

### State Machine (Group Status)

```
active → archived → inactive
   ↓
deleted (hard delete - admin only)
```

**Transitions:**
- `active` → `archived`: User archives group
- `archived` → `active`: User unarchives group
- `active/archived` → `inactive`: Admin deactivates group
- `inactive` → `deleted`: Hard delete (data retention policy)

### Invariants

- A group must have at least one admin member
- A group must have at least 2 members (WhatsApp requirement)
- Group name must be unique within a company
- A contact cannot be added to a group twice
- Only admins can add/remove members
- Only active groups can receive messages
- All group operations must be scoped to companyId

---

## 3) Database Design (Postgres/Drizzle)

### Tables

#### groupsTable

```typescript
export const groupsTable = pgTable("groups", {
  // Primary key
  id: serial("id").primaryKey(),
  
  // Foreign keys
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  whatsappAccountId: integer("whatsapp_account_id").references(() => whatsappAccountsTable.id).notNull(),
  
  // WhatsApp integration
  whatsappGroupId: text("whatsapp_group_id").notNull().unique(), // WhatsApp's group ID
  
  // Group metadata
  name: text("name").notNull(),
  description: text("description"),
  avatar: text("avatar"), // File URL from file_uploads
  
  // Group settings
  inviteLink: text("invite_link"), // WhatsApp group invite link
  isRestricted: boolean("is_restricted").notNull().default(false), // Only admins can send
  
  // Audit fields (user-owned domain)
  createdBy: integer("created_by").references(() => usersTable.id),
  updatedBy: integer("updated_by").references(() => usersTable.id),
  
  // Soft delete
  isActive: boolean("is_active").notNull().default(true),
  isArchived: boolean("is_archived").notNull().default(false),
  
  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  // Unique constraint: company + name
  uniqueIndex("groups_company_name_unique")
    .on(table.companyId.asc(), table.name.asc()),
  
  // Unique constraint: whatsapp group ID (global uniqueness)
  uniqueIndex("groups_whatsapp_group_id_unique")
    .on(table.whatsappGroupId.asc()),
  
  // List active groups
  index("groups_company_is_active_idx")
    .on(table.companyId.asc(), table.isActive.asc()),
  
  // List non-archived active groups
  index("groups_company_active_not_archived_idx")
    .on(table.companyId.asc(), table.isActive.asc(), table.isArchived.asc())
    .where(sql`${table.isActive} = true AND ${table.isArchived} = false`),
  
  // Filter by WhatsApp account
  index("groups_company_whatsapp_account_idx")
    .on(table.companyId.asc(), table.whatsappAccountId.asc()),
  
  // Search by name
  index("groups_company_name_idx")
    .on(table.companyId.asc(), table.name.asc()),
  
  // Composite index for cursor pagination (created)
  index("groups_company_created_id_idx")
    .on(table.companyId.asc(), table.createdAt.desc(), table.id.asc()),
  
  // Composite index for cursor pagination (name)
  index("groups_company_name_id_idx")
    .on(table.companyId.asc(), table.name.asc(), table.id.asc()),
]);
```

#### groupMembersTable

```typescript
export const groupMembersTable = pgTable("group_members", {
  // Primary key
  id: serial("id").primaryKey(),
  
  // Foreign keys
  groupId: integer("group_id").references(() => groupsTable.id).notNull(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
  
  // Member role
  role: text("role").notNull().default("member"), // "admin" or "member"
  
  // WhatsApp integration
  whatsappParticipantId: text("whatsapp_participant_id"), // WhatsApp's participant ID
  
  // Audit fields
  createdBy: integer("created_by").references(() => usersTable.id),
  updatedBy: integer("updated_by").references(() => usersTable.id),
  
  // Soft delete
  isActive: boolean("is_active").notNull().default(true),
  
  // Timestamps
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
  leftAt: timestamp("left_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  // Unique constraint: group + contact (active membership)
  uniqueIndex("group_members_group_contact_active_unique")
    .on(table.groupId.asc(), table.contactId.asc())
    .where(sql`${table.isActive} = true`),
  
  // List active members of a group
  index("group_members_group_is_active_idx")
    .on(table.groupId.asc(), table.isActive.asc()),
  
  // List groups a contact is in
  index("group_members_contact_is_active_idx")
    .on(table.contactId.asc(), table.isActive.asc()),
  
  // Filter by role
  index("group_members_group_role_idx")
    .on(table.groupId.asc(), table.role.asc()),
  
  // Company-scoped queries
  index("group_members_company_id_idx")
    .on(table.companyId.asc()),
  
  // Composite index for sorting (joined date)
  index("group_members_group_joined_idx")
    .on(table.groupId.asc(), table.joinedAt.desc(), table.id.desc()),
  
  // WhatsApp participant lookup
  index("group_members_whatsapp_participant_id_idx")
    .on(table.whatsappParticipantId.asc()),
]);
```

#### messagesTable Extension

Add columns to existing `messagesTable`:

```typescript
// Add to existing messagesTable
groupId: integer("group_id").references(() => groupsTable.id),
```

Add indexes:

```typescript
// Add to messagesTable indexes
// Fetch messages for a group
index("messages_group_created_at_idx")
  .on(table.groupId.asc(), table.createdAt.desc()),

// Composite index for group message cursor pagination
index("messages_group_created_at_id_idx")
  .on(table.groupId.asc(), table.createdAt.desc(), table.id.asc()),
```

### Indexes (Exact + Justification)

| Index | Purpose | Expected Query |
|-------|---------|----------------|
| `groups_company_name_unique` | Enforce unique group names per company | Create/update group validation |
| `groups_whatsapp_group_id_unique` | Prevent duplicate WhatsApp groups | Webhook sync |
| `groups_company_is_active_idx` | List active groups | List groups page |
| `groups_company_active_not_archived_idx` | List non-archived groups | Default groups list |
| `groups_company_whatsapp_account_idx` | Filter by WhatsApp account | Multi-account support |
| `groups_company_name_idx` | Search groups by name | Group search |
| `groups_company_created_id_idx` | Cursor pagination by created date | Groups list (sort by newest) |
| `groups_company_name_id_idx` | Cursor pagination by name | Groups list (sort by name) |
| `group_members_group_contact_active_unique` | Prevent duplicate memberships | Add member validation |
| `group_members_group_is_active_idx` | List group members | Group member list |
| `group_members_contact_is_active_idx` | List user's groups | User's groups page |
| `group_members_group_role_idx` | Filter by role | Admin-only operations |
| `group_members_group_joined_idx` | Sort members by join date | Member list display |
| `messages_group_created_at_idx` | Fetch group messages | Group conversation view |
| `messages_group_created_at_id_idx` | Cursor pagination for messages | Message history |

### Expected Queries → Index Mapping

**List Groups:**
```sql
SELECT * FROM groups
WHERE companyId = $1 AND isActive = true AND isArchived = false
ORDER BY createdAt DESC, id DESC
LIMIT $2
```
→ Uses: `groups_company_active_not_archived_idx`, `groups_company_created_id_idx`

**Search Groups:**
```sql
SELECT * FROM groups
WHERE companyId = $1 AND isActive = true AND name ILIKE $2
ORDER BY name ASC, id ASC
LIMIT $3
```
→ Uses: `groups_company_name_idx`, `groups_company_name_id_idx`

**Get Group Members:**
```sql
SELECT gm.*, c.name, c.phone, c.avatar
FROM group_members gm
JOIN contacts c ON c.id = gm.contactId
WHERE gm.groupId = $1 AND gm.isActive = true
ORDER BY gm.joinedAt DESC, gm.id DESC
```
→ Uses: `group_members_group_is_active_idx`, `group_members_group_joined_idx`

**Get User's Groups:**
```sql
SELECT g.*, gm.role
FROM groups g
JOIN group_members gm ON gm.groupId = g.id
WHERE gm.contactId = $1 AND gm.isActive = true AND g.isActive = true
ORDER BY g.name ASC
```
→ Uses: `group_members_contact_is_active_idx`, `groups_company_name_id_idx`

**Get Group Messages:**
```sql
SELECT m.*, c.name, c.avatar
FROM messages m
JOIN contacts c ON c.id = m.contactId
WHERE m.groupId = $1 AND m.isActive = true
ORDER BY m.createdAt DESC, m.id DESC
LIMIT $2
```
→ Uses: `messages_group_created_at_idx`, `messages_group_created_at_id_idx`

**Check Admin Count:**
```sql
SELECT COUNT(*) FROM group_members
WHERE groupId = $1 AND role = 'admin' AND isActive = true
```
→ Uses: `group_members_group_role_idx`

### Migration Plan

**Step 1: Create tables**
```sql
-- Create groups table
CREATE TABLE groups (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id),
  whatsapp_account_id INTEGER NOT NULL REFERENCES whatsapp_accounts(id),
  whatsapp_group_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  avatar TEXT,
  invite_link TEXT,
  is_restricted BOOLEAN NOT NULL DEFAULT false,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create group_members table
CREATE TABLE group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL REFERENCES groups(id),
  company_id INTEGER NOT NULL REFERENCES companies(id),
  contact_id INTEGER NOT NULL REFERENCES contacts(id),
  role TEXT NOT NULL DEFAULT 'member',
  whatsapp_participant_id TEXT,
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  left_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);
```

**Step 2: Add group_id to messages table**
```sql
ALTER TABLE messages
ADD COLUMN group_id INTEGER REFERENCES groups(id);
```

**Step 3: Create indexes**
```sql
-- Groups indexes
CREATE UNIQUE INDEX groups_company_name_unique ON groups(company_id, name);
CREATE UNIQUE INDEX groups_whatsapp_group_id_unique ON groups(whatsapp_group_id);
CREATE INDEX groups_company_is_active_idx ON groups(company_id, is_active);
CREATE INDEX groups_company_active_not_archived_idx ON groups(company_id, is_active, is_archived)
  WHERE is_active = true AND is_archived = false;
CREATE INDEX groups_company_whatsapp_account_idx ON groups(company_id, whatsapp_account_id);
CREATE INDEX groups_company_name_idx ON groups(company_id, name);
CREATE INDEX groups_company_created_id_idx ON groups(company_id, created_at DESC, id DESC);
CREATE INDEX groups_company_name_id_idx ON groups(company_id, name, id);

-- Group members indexes
CREATE UNIQUE INDEX group_members_group_contact_active_unique ON group_members(group_id, contact_id)
  WHERE is_active = true;
CREATE INDEX group_members_group_is_active_idx ON group_members(group_id, is_active);
CREATE INDEX group_members_contact_is_active_idx ON group_members(contact_id, is_active);
CREATE INDEX group_members_group_role_idx ON group_members(group_id, role);
CREATE INDEX group_members_company_id_idx ON group_members(company_id);
CREATE INDEX group_members_group_joined_idx ON group_members(group_id, joined_at DESC, id DESC);
CREATE INDEX group_members_whatsapp_participant_id_idx ON group_members(whatsapp_participant_id);

-- Messages indexes for groups
CREATE INDEX messages_group_created_at_idx ON messages(group_id, created_at DESC);
CREATE INDEX messages_group_created_at_id_idx ON messages(group_id, created_at DESC, id DESC);
```

**Step 4: Add constraints**
```sql
-- Ensure group name is not empty
ALTER TABLE groups ADD CONSTRAINT groups_name_not_empty CHECK (length(trim(name)) > 0);

-- Ensure role is valid
ALTER TABLE group_members ADD CONSTRAINT group_members_role_valid 
  CHECK (role IN ('admin', 'member'));

-- Ensure at least one admin when deactivating (application-level check)
```

**Step 5: Backfill (not applicable - new feature)**

**Rollback Notes:**
- Breaking: Any groups created will be lost
- Breaking: Group messages will lose group association
- Safe to rollback if no data exists
- To rollback: Drop tables and column, indexes will be dropped automatically
- Data loss: All groups, memberships, and group message associations

---

## 4) API / Server Actions Contract

### Actions

#### createGroup

**Input DTO:**
```typescript
{
  name: string; // min 1, max 120
  description?: string; // max 500
  whatsappAccountId: number;
  initialMemberIds: number[]; // array of contact IDs (min 2)
  avatar?: string; // file URL
}
```

**Output DTO:**
```typescript
{
  id: number;
  companyId: number;
  whatsappGroupId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  memberCount: number;
  createdAt: Date;
}
```

**Error Cases:**
- `validation`: Invalid name length, description too long, < 2 initial members
- `notFound`: WhatsApp account not found, contacts not found
- `conflict`: Group name already exists in company
- `forbidden`: User not authorized to create groups
- `unexpected`: Database error, WhatsApp API error

**Cache Invalidation:**
- `['groups']`
- `['groups', companyId]`

---

#### updateGroup

**Input DTO:**
```typescript
{
  groupId: number;
  name?: string; // min 1, max 120
  description?: string; // max 500
  avatar?: string; // file URL
  isRestricted?: boolean;
}
```

**Output DTO:**
```typescript
{
  id: number;
  name: string;
  description: string | null;
  avatar: string | null;
  isRestricted: boolean;
  updatedAt: Date;
}
```

**Error Cases:**
- `validation`: Invalid name/description length
- `notFound`: Group not found
- `conflict`: New name already exists in company
- `forbidden`: User not group admin
- `unexpected`: Database error

**Cache Invalidation:**
- `['groups']`
- `['groups', groupId]`
- `['groups', companyId]`

---

#### deactivateGroup

**Input DTO:**
```typescript
{
  groupId: number;
}
```

**Output DTO:**
```typescript
{
  id: number;
  isActive: boolean;
  deactivatedAt: Date;
}
```

**Error Cases:**
- `notFound`: Group not found
- `forbidden`: User not authorized
- `conflict`: Cannot deactivate group with active members (optional)
- `unexpected`: Database error

**Cache Invalidation:**
- `['groups']`
- `['groups', groupId]`
- `['groups', companyId]`

---

#### listGroups

**Input DTO:**
```typescript
{
  cursor?: string; // base64 encoded { id, createdAt }
  limit: number; // 1-100, default 50
  search?: string; // search by name
  whatsappAccountId?: number;
  includeArchived?: boolean;
  sort?: 'createdAt' | 'name';
  order?: 'asc' | 'desc';
}
```

**Output DTO:**
```typescript
{
  groups: Array<{
    id: number;
    name: string;
    description: string | null;
    avatar: string | null;
    memberCount: number;
    messageCount: number;
    lastMessageTime: Date | null;
    lastMessagePreview: string | null;
    isActive: boolean;
    isArchived: boolean;
    createdAt: Date;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
}
```

**Error Cases:**
- `validation`: Invalid cursor, limit out of range
- `unexpected`: Database error

**Pagination Strategy:**
- Cursor-based pagination using `id` + sort field
- `fetchLimit = limit + 1`, return `hasMore: data.length > limit`

**Cache Strategy:**
- Cache by query key: `['groups', filter]`
- No invalidation needed (read-only)

---

#### getGroupById

**Input DTO:**
```typescript
{
  groupId: number;
}
```

**Output DTO:**
```typescript
{
  id: number;
  companyId: number;
  whatsappAccountId: number;
  whatsappGroupId: string;
  name: string;
  description: string | null;
  avatar: string | null;
  inviteLink: string | null;
  isRestricted: boolean;
  memberCount: number;
  messageCount: number;
  lastMessageTime: Date | null;
  isActive: boolean;
  isArchived: boolean;
  createdAt: Date;
  updatedAt: Date | null;
}
```

**Error Cases:**
- `notFound`: Group not found
- `forbidden`: User not authorized to view group
- `unexpected`: Database error

**Cache Strategy:**
- Cache by key: `['groups', groupId]`
- Invalidate on update/deactivate

---

#### addGroupMember

**Input DTO:**
```typescript
{
  groupId: number;
  contactId: number;
  role?: 'admin' | 'member'; // default 'member'
}
```

**Output DTO:**
```typescript
{
  id: number;
  groupId: number;
  contactId: number;
  role: string;
  joinedAt: Date;
}
```

**Error Cases:**
- `validation`: Invalid role
- `notFound`: Group or contact not found
- `conflict`: Contact already member of group
- `forbidden`: User not group admin
- `unexpected`: Database error, WhatsApp API error

**Cache Invalidation:**
- `['groups', groupId, 'members']`
- `['groups', groupId]` (member count)

---

#### removeGroupMember

**Input DTO:**
```typescript
{
  groupId: number;
  contactId: number;
}
```

**Output DTO:**
```typescript
{
  success: boolean;
  removedAt: Date;
}
```

**Error Cases:**
- `notFound`: Group, contact, or membership not found
- `forbidden`: User not group admin
- `conflict`: Cannot remove last admin
- `unexpected`: Database error, WhatsApp API error

**Cache Invalidation:**
- `['groups', groupId, 'members']`
- `['groups', groupId]` (member count)

---

#### listGroupMembers

**Input DTO:**
```typescript
{
  groupId: number;
  cursor?: string;
  limit: number; // 1-100, default 50
  role?: 'admin' | 'member';
}
```

**Output DTO:**
```typescript
{
  members: Array<{
    id: number;
    contactId: number;
    contactName: string;
    contactPhone: string;
    contactAvatar: string | null;
    role: string;
    joinedAt: Date;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
}
```

**Error Cases:**
- `notFound`: Group not found
- `forbidden`: User not authorized to view group
- `validation`: Invalid cursor, limit out of range
- `unexpected`: Database error

**Pagination Strategy:**
- Cursor-based using `id` + `joinedAt`

**Cache Strategy:**
- Cache by key: `['groups', groupId, 'members', filter]`
- Invalidate on add/remove member

---

#### sendGroupMessage

**Input DTO:**
```typescript
{
  groupId: number;
  content: string; // min 1, max 4096
  mediaUrl?: string;
  mediaType?: string;
  mediaId?: string;
  mediaMimeType?: string;
  mediaCaption?: string;
}
```

**Output DTO:**
```typescript
{
  id: number;
  groupId: number;
  conversationId: number | null;
  contactId: number;
  content: string;
  mediaUrl: string | null;
  status: 'sending' | 'sent';
  createdAt: Date;
}
```

**Error Cases:**
- `validation`: Invalid content length
- `notFound`: Group not found
- `forbidden`: User not group member or group is restricted
- `unexpected`: Database error, WhatsApp API error

**Cache Invalidation:**
- `['groups', groupId, 'messages']`
- `['groups', groupId]` (last message)
- `['conversations']` (if group has linked conversation)

---

#### getGroupMessages

**Input DTO:**
```typescript
{
  groupId: number;
  cursor?: string;
  limit: number; // 1-100, default 50
}
```

**Output DTO:**
```typescript
{
  messages: Array<{
    id: number;
    groupId: number;
    conversationId: number | null;
    contactId: number;
    contactName: string;
    contactPhone: string;
    contactAvatar: string | null;
    direction: 'inbound' | 'outbound';
    status: string;
    content: string;
    mediaUrl: string | null;
    mediaType: string | null;
    mediaCaption: string | null;
    createdAt: Date;
  }>;
  nextCursor: string | null;
  hasMore: boolean;
}
```

**Error Cases:**
- `notFound`: Group not found
- `forbidden`: User not authorized to view group
- `validation`: Invalid cursor, limit out of range
- `unexpected`: Database error

**Pagination Strategy:**
- Cursor-based using `id` + `createdAt` (reverse chronological)

**Cache Strategy:**
- Cache by key: `['groups', groupId, 'messages', cursor]`
- Invalidate on new message

---

#### updateGroupMemberRole

**Input DTO:**
```typescript
{
  groupId: number;
  contactId: number;
  role: 'admin' | 'member';
}
```

**Output DTO:**
```typescript
{
  id: number;
  contactId: number;
  role: string;
  updatedAt: Date;
}
```

**Error Cases:**
- `validation`: Invalid role
- `notFound`: Group, contact, or membership not found
- `forbidden`: User not group admin
- `conflict`: Cannot demote last admin
- `unexpected`: Database error

**Cache Invalidation:**
- `['groups', groupId, 'members']`

---

## 5) Validation (Zod)

### Schemas to Create

#### group-create-schema.ts

```typescript
import { z } from 'zod';

// Constants
export const GROUP_ROLES = ['admin', 'member'] as const;
export type GroupRole = (typeof GROUP_ROLES)[number];

export const GROUP_SORT_FIELDS = ['createdAt', 'name'] as const;
export type GroupSortField = (typeof GROUP_SORT_FIELDS)[number];

// Group name validation
export const groupNameSchema = z
  .string()
  .min(1, 'Group name is required')
  .max(120, 'Group name must be less than 120 characters')
  .trim();

// Group description validation
export const groupDescriptionSchema = z
  .string()
  .max(500, 'Description must be less than 500 characters')
  .trim()
  .optional();

// Create group - Client schema
export const groupCreateClientSchema = z.object({
  name: groupNameSchema,
  description: groupDescriptionSchema,
  whatsappAccountId: z.number().int().positive(),
  initialMemberIds: z.array(z.number().int().positive())
    .min(2, 'Group must have at least 2 members'),
  avatar: z.string().url().optional(),
});

export type GroupCreateInput = z.infer<typeof groupCreateClientSchema>;

// Create group - Server schema
export const groupCreateServerSchema = groupCreateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupCreateServerInput = z.infer<typeof groupCreateServerSchema>;

// Update group - Client schema
export const groupUpdateClientSchema = z.object({
  groupId: z.number().int().positive(),
  name: groupNameSchema.optional(),
  description: groupDescriptionSchema.optional(),
  avatar: z.string().url().optional(),
  isRestricted: z.boolean().optional(),
}).refine(
  (data) => data.name || data.description || data.avatar || data.isRestricted !== undefined,
  'At least one field must be provided'
);

export type GroupUpdateInput = z.infer<typeof groupUpdateClientSchema>;

// Update group - Server schema
export const groupUpdateServerSchema = groupUpdateClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupUpdateServerInput = z.infer<typeof groupUpdateServerSchema>;

// Deactivate group - Server schema
export const groupDeactivateServerSchema = z.object({
  groupId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupDeactivateInput = z.infer<typeof groupDeactivateServerSchema>;

// List groups filter schema
export const groupListFilterSchema = z.object({
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  search: z.string().max(100).optional(),
  whatsappAccountId: z.number().int().positive().optional(),
  includeArchived: z.boolean().default(false),
  sort: z.enum(GROUP_SORT_FIELDS).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export type GroupListFilter = z.infer<typeof groupListFilterSchema>;

// Get group by ID schema
export const getGroupSchema = z.object({
  groupId: z.number().int().positive(),
});

export type GetGroupInput = z.infer<typeof getGroupSchema>;

// Add group member - Client schema
export const groupMemberAddClientSchema = z.object({
  groupId: z.number().int().positive(),
  contactId: z.number().int().positive(),
  role: z.enum(GROUP_ROLES).default('member'),
});

export type GroupMemberAddInput = z.infer<typeof groupMemberAddClientSchema>;

// Add group member - Server schema
export const groupMemberAddServerSchema = groupMemberAddClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupMemberAddServerInput = z.infer<typeof groupMemberAddServerSchema>;

// Remove group member - Server schema
export const groupMemberRemoveServerSchema = z.object({
  groupId: z.number().int().positive(),
  contactId: z.number().int().positive(),
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupMemberRemoveInput = z.infer<typeof groupMemberRemoveServerSchema>;

// List group members filter schema
export const groupMemberListFilterSchema = z.object({
  groupId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  role: z.enum(GROUP_ROLES).optional(),
});

export type GroupMemberListFilter = z.infer<typeof groupMemberListFilterSchema>;

// Update group member role - Server schema
export const groupMemberRoleUpdateServerSchema = z.object({
  groupId: z.number().int().positive(),
  contactId: z.number().int().positive(),
  role: z.enum(GROUP_ROLES),
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupMemberRoleUpdateInput = z.infer<typeof groupMemberRoleUpdateServerSchema>;

// Send group message - Client schema
export const groupMessageSendClientSchema = z.object({
  groupId: z.number().int().positive(),
  content: z.string().min(1).max(4096),
  mediaUrl: z.string().url().optional(),
  mediaType: z.string().optional(),
  mediaId: z.string().optional(),
  mediaMimeType: z.string().optional(),
  mediaCaption: z.string().max(2000).optional(),
}).refine(
  (data) => data.content || data.mediaUrl,
  'Either content or mediaUrl is required'
);

export type GroupMessageSendInput = z.infer<typeof groupMessageSendClientSchema>;

// Send group message - Server schema
export const groupMessageSendServerSchema = groupMessageSendClientSchema.extend({
  companyId: z.number().int().positive(),
  userId: z.number().int().positive(),
});

export type GroupMessageSendServerInput = z.infer<typeof groupMessageSendServerSchema>;

// Get group messages schema
export const groupMessageListSchema = z.object({
  groupId: z.number().int().positive(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

export type GroupMessageListInput = z.infer<typeof groupMessageListSchema>;

// Response schemas
export const groupResponseSchema = z.object({
  id: z.number().int(),
  companyId: z.number().int(),
  whatsappAccountId: z.number().int(),
  whatsappGroupId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  avatar: z.string().nullable(),
  inviteLink: z.string().nullable(),
  isRestricted: z.boolean(),
  memberCount: z.number().int(),
  messageCount: z.number().int(),
  lastMessageTime: z.date().nullable(),
  lastMessagePreview: z.string().nullable(),
  isActive: z.boolean(),
  isArchived: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date().nullable(),
});

export type GroupResponse = z.infer<typeof groupResponseSchema>;

export const groupMemberResponseSchema = z.object({
  id: z.number().int(),
  groupId: z.number().int(),
  contactId: z.number().int(),
  contactName: z.string(),
  contactPhone: z.string(),
  contactAvatar: z.string().nullable(),
  role: z.enum(GROUP_ROLES),
  joinedAt: z.date(),
});

export type GroupMemberResponse = z.infer<typeof groupMemberResponseSchema>;

export const groupListOutputSchema = z.object({
  groups: z.array(groupResponseSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type GroupListOutput = z.infer<typeof groupListOutputSchema>;

export const groupMemberListOutputSchema = z.object({
  members: z.array(groupMemberResponseSchema),
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
});

export type GroupMemberListOutput = z.infer<typeof groupMemberListOutputSchema>;
```

### Refinements

**Group Creation:**
- Ensure all initial member contacts exist and belong to same company
- Ensure at least one admin is assigned (first member or creator)

**Member Management:**
- Ensure contact is not already a member (active membership)
- Ensure at least one admin remains after removal
- Ensure user has admin role to perform actions

**Group Messaging:**
- Ensure sender is group member
- If group is restricted, ensure sender is admin

### Shared Exported Types

- `GroupCreateInput`, `GroupUpdateInput`, `GroupDeactivateInput`
- `GroupListFilter`, `GroupMemberListFilter`
- `GroupResponse`, `GroupMemberResponse`
- `GroupListOutput`, `GroupMemberListOutput`
- `GroupRole`

### DRY Rule

- Client schemas used for form validation
- Server schemas extend client schemas with `companyId` and `userId`
- Response schemas reused across service, actions, and hooks
- Constants exported for use in components and enums

---

## 6) Service Layer Plan

### GroupService

#### create

**Responsibility:**
Create a new group with initial members via transaction

**Inputs:**
- `GroupCreateServerInput` (name, description, whatsappAccountId, initialMemberIds, avatar, companyId, userId)

**Outputs:**
- `Promise<Result<GroupResponse>>`

**Transaction Boundaries:**
- Single transaction wrapping:
  1. Insert group
  2. Insert group members (first member as admin, rest as members)
  3. Log audit

**Safety Rules:**
- Always filter by `companyId`
- Validate all contacts exist and belong to same company
- Validate WhatsApp account belongs to company
- Select only required columns
- Return only required columns

**Performance Logging:**
- Operation: `GroupService.create`
- Timing: Full transaction duration
- Row counts: Groups inserted, members inserted

**Result Mapping:**
- `ok`: Group created successfully
- `notFound`: WhatsApp account or contacts not found
- `conflict`: Group name already exists
- `validation`: Invalid input
- `unexpected`: Database error

---

#### update

**Responsibility:**
Update group metadata (name, description, avatar, isRestricted)

**Inputs:**
- `GroupUpdateServerInput` (groupId, name, description, avatar, isRestricted, companyId, userId)

**Outputs:**
- `Promise<Result<GroupResponse>>`

**Transaction Boundaries:**
- Single transaction:
  1. Update group
  2. Log audit (if changes made)

**Safety Rules:**
- Always filter by `companyId` and `groupId`
- Validate user is group admin
- Check for name conflicts (if name changed)
- Select only required columns

**Performance Logging:**
- Operation: `GroupService.update`
- Timing: Update duration
- Row counts: Groups updated

**Result Mapping:**
- `ok`: Group updated
- `notFound`: Group not found
- `conflict`: New name already exists
- `forbidden`: User not admin
- `unexpected`: Database error

---

#### deactivate

**Responsibility:**
Deactivate a group (soft delete)

**Inputs:**
- `GroupDeactivateInput` (groupId, companyId, userId)

**Outputs:**
- `Promise<Result<{ id: number; isActive: boolean; deactivatedAt: Date }>>`

**Transaction Boundaries:**
- Single transaction:
  1. Set `isActive = false`
  2. Log audit

**Safety Rules:**
- Always filter by `companyId` and `groupId`
- Validate user has permission (admin role)

**Performance Logging:**
- Operation: `GroupService.deactivate`
- Timing: Update duration

**Result Mapping:**
- `ok`: Group deactivated
- `notFound`: Group not found
- `forbidden`: User not authorized
- `unexpected`: Database error

---

#### list

**Responsibility:**
List groups with pagination, filtering, and sorting

**Inputs:**
- `GroupListFilter` (cursor, limit, search, whatsappAccountId, includeArchived, sort, order)

**Outputs:**
- `Promise<Result<GroupListOutput>>`

**Transaction Boundaries:**
- Read-only, no transaction needed

**Safety Rules:**
- Always filter by `companyId` (from session)
- Apply cursor pagination correctly
- Use parameterized queries for search
- Select only required columns

**Performance Logging:**
- Operation: `GroupService.list`
- Timing: Query duration
- Row counts: Groups returned

**Result Mapping:**
- `ok`: Groups list with pagination
- `validation`: Invalid cursor or limit
- `unexpected`: Database error

---

#### getById

**Responsibility:**
Get group details by ID

**Inputs:**
- `GetGroupInput` (groupId)

**Outputs:**
- `Promise<Result<GroupResponse>>`

**Transaction Boundaries:**
- Read-only, no transaction needed

**Safety Rules:**
- Always filter by `companyId` (from session)
- Select only required columns
- Include member count and message count via subqueries

**Performance Logging:**
- Operation: `GroupService.getById`
- Timing: Query duration

**Result Mapping:**
- `ok`: Group details
- `notFound`: Group not found
- `unexpected`: Database error

---

#### addMember

**Responsibility:**
Add a contact to a group

**Inputs:**
- `GroupMemberAddServerInput` (groupId, contactId, role, companyId, userId)

**Outputs:**
- `Promise<Result<GroupMemberResponse>>`

**Transaction Boundaries:**
- Single transaction:
  1. Validate group exists and user is admin
  2. Validate contact exists
  3. Check not already member
  4. Insert member
  5. Call WhatsApp API to add participant (outside transaction)
  6. Log audit

**Safety Rules:**
- Always filter by `companyId`
- Validate user is group admin
- Check for duplicate membership
- Call WhatsApp API after DB commit

**Performance Logging:**
- Operation: `GroupService.addMember`
- Timing: DB insert + API call
- Row counts: Members inserted

**Result Mapping:**
- `ok`: Member added
- `notFound`: Group or contact not found
- `conflict`: Already member
- `forbidden`: User not admin
- `unexpected`: Database or API error

---

#### removeMember

**Responsibility:**
Remove a contact from a group (soft delete)

**Inputs:**
- `GroupMemberRemoveInput` (groupId, contactId, companyId, userId)

**Outputs:**
- `Promise<Result<{ success: boolean; removedAt: Date }>>`

**Transaction Boundaries:**
- Single transaction:
  1. Validate group exists and user is admin
  2. Check not removing last admin
  3. Soft delete member (set `isActive = false`, `leftAt = NOW()`)
  4. Log audit
  5. Call WhatsApp API to remove participant (outside transaction)

**Safety Rules:**
- Always filter by `companyId`
- Validate user is group admin
- Ensure at least one admin remains
- Call WhatsApp API after DB commit

**Performance Logging:**
- Operation: `GroupService.removeMember`
- Timing: DB update + API call
- Row counts: Members updated

**Result Mapping:**
- `ok`: Member removed
- `notFound`: Group, contact, or membership not found
- `forbidden`: User not admin or removing last admin
- `unexpected`: Database or API error

---

#### listMembers

**Responsibility:**
List group members with pagination

**Inputs:**
- `GroupMemberListFilter` (groupId, cursor, limit, role)

**Outputs:**
- `Promise<Result<GroupMemberListOutput>>`

**Transaction Boundaries:**
- Read-only, no transaction needed

**Safety Rules:**
- Always filter by `groupId` and `isActive = true`
- Apply cursor pagination
- Join with contacts table for names/phones
- Select only required columns

**Performance Logging:**
- Operation: `GroupService.listMembers`
- Timing: Query duration
- Row counts: Members returned

**Result Mapping:**
- `ok`: Members list with pagination
- `notFound`: Group not found
- `validation`: Invalid cursor or limit
- `unexpected`: Database error

---

#### updateMemberRole

**Responsibility:**
Update a member's role

**Inputs:**
- `GroupMemberRoleUpdateInput` (groupId, contactId, role, companyId, userId)

**Outputs:**
- `Promise<Result<GroupMemberResponse>>`

**Transaction Boundaries:**
- Single transaction:
  1. Validate group exists and user is admin
  2. Check not demoting last admin
  3. Update member role
  4. Log audit

**Safety Rules:**
- Always filter by `companyId`
- Validate user is group admin
- Ensure at least one admin remains after role change

**Performance Logging:**
- Operation: `GroupService.updateMemberRole`
- Timing: Update duration
- Row counts: Members updated

**Result Mapping:**
- `ok`: Role updated
- `notFound`: Group, contact, or membership not found
- `forbidden`: User not admin or demoting last admin
- `unexpected`: Database error

---

#### sendMessage

**Responsibility:**
Send a message to a group

**Inputs:**
- `GroupMessageSendServerInput` (groupId, content, mediaUrl, mediaType, etc., companyId, userId)

**Outputs:**
- `Promise<Result<{ id: number; groupId: number; conversationId: number | null; contactId: number; content: string; mediaUrl: string | null; status: string; createdAt: Date }>>`

**Transaction Boundaries:**
- Single transaction:
  1. Validate group exists and is active
  2. Validate user is member (or admin if restricted)
  3. Insert message
  4. Update group's last message preview/time
  5. Log audit
  6. Call WhatsApp API to broadcast message (outside transaction)

**Safety Rules:**
- Always filter by `companyId`
- Validate user membership
- Check group restriction rules
- Call WhatsApp API after DB commit

**Performance Logging:**
- Operation: `GroupService.sendMessage`
- Timing: DB insert + API call
- Row counts: Messages inserted

**Result Mapping:**
- `ok`: Message sent
- `notFound`: Group not found
- `forbidden`: User not member or group restricted
- `unexpected`: Database or API error

---

#### getMessages

**Responsibility:**
Get group messages with pagination

**Inputs:**
- `GroupMessageListInput` (groupId, cursor, limit)

**Outputs:**
- `Promise<Result<{ messages: Array<MessageWithContact>; nextCursor: string | null; hasMore: boolean }>>`

**Transaction Boundaries:**
- Read-only, no transaction needed

**Safety Rules:**
- Always filter by `groupId` and `isActive = true`
- Apply cursor pagination (reverse chronological)
- Join with contacts table for sender info
- Select only required columns

**Performance Logging:**
- Operation: `GroupService.getMessages`
- Timing: Query duration
- Row counts: Messages returned

**Result Mapping:**
- `ok`: Messages list with pagination
- `notFound`: Group not found
- `validation`: Invalid cursor or limit
- `unexpected`: Database error

---

## 7) UI/UX Plan (shadcn + TanStack)

### Screens/Pages to Add

**Routes:**
1. `/groups` - Groups list page
2. `/groups/[groupId]` - Group details page
3. `/groups/[groupId]/members` - Group members management page

### Components to Add

**Forms:**
- `<GroupCreateForm/>` - Dialog with form fields:
  - Name (text input, required)
  - Description (textarea, optional)
  - WhatsApp Account (select, required)
  - Initial Members (multi-select, min 2)
  - Avatar (file upload, optional)
  - Submit button with loading state

- `<GroupEditForm/>` - Dialog with form fields:
  - Name (text input)
  - Description (textarea)
  - Avatar (file upload)
  - Is Restricted (toggle switch)
  - Save button with loading state

- `<AddMemberDialog/>` - Dialog to add member:
  - Contact search (autocomplete)
  - Role selection (radio buttons)
  - Add button with loading state

**Cards:**
- `<GroupCard/>` - Display group in list:
  - Avatar (circular)
  - Name (bold)
  - Description (truncated)
  - Member count (badge)
  - Last message preview
  - Last message time (relative)
  - Actions menu (edit, archive, deactivate)

- `<GroupMemberCard/>` - Display member:
  - Contact avatar
  - Contact name
  - Contact phone
  - Role badge
  - Joined date
  - Actions menu (change role, remove)

**Tables:**
- `<GroupsTable/>` - TanStack Table with columns:
  - Avatar (image)
  - Name (sortable)
  - Description (truncated)
  - Members (count, sortable)
  - Messages (count, sortable)
  - Last Activity (date, sortable)
  - Status (badge: active/archived)
  - Actions (dropdown menu)

- `<GroupMembersTable/>` - TanStack Table with columns:
  - Contact (avatar + name)
  - Phone
  - Role (badge, filterable)
  - Joined At (date, sortable)
  - Actions (dropdown menu)

**Dialogs:**
- `<GroupCreateDialog/>` - Wraps `<GroupCreateForm/>`
- `<GroupEditDialog/>` - Wraps `<GroupEditForm/>`
- `<AddMemberDialog/>` - Wraps add member form
- `<RemoveMemberDialog/>` - Confirmation dialog
- `<DeactivateGroupDialog/>` - Confirmation dialog

**Other Components:**
- `<GroupMessageList/>` - Display group messages (reuse existing message list component)
- `<GroupMessageInput/>` - Input for sending group messages (reuse existing message input)
- `<GroupEmptyState/>` - Empty state illustration when no groups exist
- `<GroupMembersEmptyState/>` - Empty state when no members

### Forms

**react-hook-form + zodResolver:**
- Reuse existing form patterns from conversations
- All forms use client schemas for validation
- Submit buttons disabled during loading
- Error messages displayed inline

**Fields + Validation Behaviors:**
- Name: Required, min 1, max 120, real-time validation
- Description: Optional, max 500, character counter
- Initial Members: Required, min 2, multi-select with search
- Role: Required, enum selection with icons
- Content (message): Required, min 1, max 4096, character counter

**Submit States:**
- Button shows spinner during submission
- Button disabled during submission
- Success toast on completion
- Error toast on failure

### Tables

**TanStack Table Columns:**
- Avatar: Circular image with fallback
- Name: Sortable, clickable to navigate to details
- Description: Truncated with tooltip
- Members: Count badge, sortable
- Messages: Count badge, sortable
- Last Activity: Relative time, sortable
- Status: Color-coded badge (green=active, gray=archived)
- Actions: Dropdown with Edit, Archive, Deactivate options

**Server-Driven Filters/Sort:**
- Filter by status (active/archived)
- Filter by WhatsApp account
- Search by name
- Sort by name, created date, member count, message count
- All filters sent to server action

**Cursor Pagination UX:**
- "Load More" button at bottom
- Auto-load on scroll (optional)
- "Showing X of Y groups" counter
- Smooth loading state

### Empty/Loading/Error States

**Empty State:**
- Illustration (users icon)
- Message: "No groups found"
- Action: "Create your first group" button
- Shown when list is empty

**Loading State:**
- Skeleton loaders for table rows
- Spinner for initial load
- Shimmer effect for cards

**Error State:**
- Error message with retry button
- Specific error details (validation, not found, etc.)
- Fallback to cached data if available

### Toast Strategy (Sonner)

**Success Messages:**
- "Group created successfully"
- "Group updated"
- "Member added to group"
- "Member removed from group"
- "Message sent to group"
- "Group deactivated"

**Failure Messages:**
- "Failed to create group: [specific error]"
- "Failed to add member: [specific error]"
- "Failed to send message: [specific error]"
- User-readable, not technical

---

## 8) Hook/State Plan

### Hooks to Create

#### useListGroups

**Purpose:**
Fetch paginated list of groups with filters

**Query Key:**
`['groups', filter]` where filter includes cursor, limit, search, whatsappAccountId, includeArchived, sort, order

**Invalidation Rules:**
- Invalidate on: createGroup, updateGroup, deactivateGroup

**Implementation:**
```typescript
export function useListGroups(filter: GroupListFilter) {
  return useQuery({
    queryKey: ['groups', filter],
    queryFn: () => listGroupsAction(filter),
    staleTime: 30 * 1000, // 30 seconds
  });
}
```

---

#### useGroupById

**Purpose:**
Fetch single group by ID

**Query Key:**
`['groups', groupId]`

**Invalidation Rules:**
- Invalidate on: updateGroup, deactivateGroup, addGroupMember, removeGroupMember, sendGroupMessage

**Implementation:**
```typescript
export function useGroupById(groupId: number) {
  return useQuery({
    queryKey: ['groups', groupId],
    queryFn: () => getGroupAction({ groupId }),
    enabled: !!groupId,
    staleTime: 60 * 1000, // 1 minute
  });
}
```

---

#### useCreateGroup

**Purpose:**
Create a new group

**Mutation:**
```typescript
export function useCreateGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GroupCreateInput) => createGroupAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group created successfully');
    },
    onError: (error) => {
      toast.error(`Failed to create group: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- None (too complex with member creation)

---

#### useUpdateGroup

**Purpose:**
Update group metadata

**Mutation:**
```typescript
export function useUpdateGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GroupUpdateInput) => updateGroupAction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId] });
      toast.success('Group updated');
    },
    onError: (error) => {
      toast.error(`Failed to update group: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- Update group in cache immediately
- Rollback on error

---

#### useDeactivateGroup

**Purpose:**
Deactivate a group

**Mutation:**
```typescript
export function useDeactivateGroup() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { groupId: number }) => deactivateGroupAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      toast.success('Group deactivated');
    },
    onError: (error) => {
      toast.error(`Failed to deactivate group: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- Remove group from list cache immediately
- Rollback on error

---

#### useListGroupMembers

**Purpose:**
Fetch paginated list of group members

**Query Key:**
`['groups', groupId, 'members', filter]`

**Invalidation Rules:**
- Invalidate on: addGroupMember, removeGroupMember, updateGroupMemberRole

**Implementation:**
```typescript
export function useListGroupMembers(groupId: number, filter: GroupMemberListFilter) {
  return useQuery({
    queryKey: ['groups', groupId, 'members', filter],
    queryFn: () => listGroupMembersAction({ ...filter, groupId }),
    enabled: !!groupId,
    staleTime: 30 * 1000,
  });
}
```

---

#### useAddGroupMember

**Purpose:**
Add a member to a group

**Mutation:**
```typescript
export function useAddGroupMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GroupMemberAddInput) => addGroupMemberAction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId] });
      toast.success('Member added to group');
    },
    onError: (error) => {
      toast.error(`Failed to add member: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- Add member to list cache immediately
- Rollback on error

---

#### useRemoveGroupMember

**Purpose:**
Remove a member from a group

**Mutation:**
```typescript
export function useRemoveGroupMember() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GroupMemberRemoveInput) => removeGroupMemberAction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'members'] });
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId] });
      toast.success('Member removed from group');
    },
    onError: (error) => {
      toast.error(`Failed to remove member: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- Remove member from list cache immediately
- Rollback on error

---

#### useUpdateGroupMemberRole

**Purpose:**
Update a member's role

**Mutation:**
```typescript
export function useUpdateGroupMemberRole() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GroupMemberRoleUpdateInput) => updateGroupMemberRoleAction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'members'] });
      toast.success('Member role updated');
    },
    onError: (error) => {
      toast.error(`Failed to update role: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- Update role in cache immediately
- Rollback on error

---

#### useSendGroupMessage

**Purpose:**
Send a message to a group

**Mutation:**
```typescript
export function useSendGroupMessage() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: GroupMessageSendInput) => sendGroupMessageAction(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId, 'messages'] });
      queryClient.invalidateQueries({ queryKey: ['groups', variables.groupId] });
      toast.success('Message sent');
    },
    onError: (error) => {
      toast.error(`Failed to send message: ${error.message}`);
    },
  });
}
```

**Optimistic Updates:**
- Add message to list cache with status 'sending'
- Update status to 'sent' on success
- Remove message on error

---

#### useGroupMessages

**Purpose:**
Fetch paginated group messages

**Query Key:**
`['groups', groupId, 'messages', cursor]`

**Invalidation Rules:**
- Invalidate on: sendGroupMessage

**Implementation:**
```typescript
export function useGroupMessages(groupId: number, cursor?: string, limit = 50) {
  return useQuery({
    queryKey: ['groups', groupId, 'messages', cursor, limit],
    queryFn: () => getGroupMessagesAction({ groupId, cursor, limit }),
    enabled: !!groupId,
    staleTime: 10 * 1000, // 10 seconds (messages change frequently)
  });
}
```

---

### Query Keys (Stable, Tenant-Aware)

```typescript
export const groupQueryKeys = {
  all: ['groups'] as const,
  lists: () => [...groupQueryKeys.all, 'list'] as const,
  list: (filter: GroupListFilter) => [...groupQueryKeys.lists(), filter] as const,
  details: () => [...groupQueryKeys.all, 'detail'] as const,
  detail: (groupId: number) => [...groupQueryKeys.details(), groupId] as const,
  members: (groupId: number) => [...groupQueryKeys.detail(groupId), 'members'] as const,
  membersList: (groupId: number, filter: GroupMemberListFilter) => 
    [...groupQueryKeys.members(groupId), filter] as const,
  messages: (groupId: number) => [...groupQueryKeys.detail(groupId), 'messages'] as const,
  messagesList: (groupId: number, cursor?: string, limit?: number) => 
    [...groupQueryKeys.messages(groupId), cursor, limit] as const,
};
```

### Invalidation Rules

| Mutation | Queries to Invalidate |
|----------|----------------------|
| createGroup | `['groups']` |
| updateGroup | `['groups']`, `['groups', groupId]` |
| deactivateGroup | `['groups']`, `['groups', groupId]` |
| addGroupMember | `['groups', groupId, 'members']`, `['groups', groupId]` |
| removeGroupMember | `['groups', groupId, 'members']`, `['groups', groupId]` |
| updateGroupMemberRole | `['groups', groupId, 'members']` |
| sendGroupMessage | `['groups', groupId, 'messages']`, `['groups', groupId]` |

### Optimistic Updates

Justified for:
- ✅ removeGroupMember (simple removal, rollback easy)
- ✅ updateGroupMemberRole (simple field update)
- ✅ sendGroupMessage (add with 'sending' status)

Not justified for:
- ❌ createGroup (complex with member creation)
- ❌ addGroupMember (requires validation)
- ❌ updateGroup (potential conflicts)

### Zustand

**Not needed** - All state can be managed with React Query + local component state. No complex transient state required for groups feature.

---

## 9) Security & Compliance

### Auth Requirements

**Session Required:**
- All actions require authenticated session
- Session provides `companyId` and `userId`

**Role-Based Permissions:**

| Action | Admin | Manager | User |
|--------|-------|---------|------|
| Create group | ✅ | ✅ | ❌ |
| Update group | ✅ (if admin) | ✅ (if admin) | ❌ |
| Deactivate group | ✅ | ❌ | ❌ |
| View group | ✅ | ✅ | ✅ (if member) |
| Add member | ✅ (if admin) | ✅ (if admin) | ❌ |
| Remove member | ✅ (if admin) | ✅ (if admin) | ❌ |
| Update member role | ✅ (if admin) | ✅ (if admin) | ❌ |
| Send message | ✅ (if member) | ✅ (if member) | ✅ (if member) |
| View messages | ✅ (if member) | ✅ (if member) | ✅ (if member) |

### Tenant Enforcement Strategy

**Service-Level Enforcement (Mandatory):**
- Every query includes `WHERE companyId = $1`
- Every mutation validates `companyId` matches session
- Cross-tenant access prevented at service layer

**DB Constraints:**
- Foreign keys enforce company relationships
- Unique constraints scoped by company
- No cross-company joins allowed

**Examples:**
```typescript
// Service always filters by company
await db.query.groupsTable.findMany({
  where: eq(groupsTable.companyId, companyId),
});

// Service validates company ownership
const group = await db.query.groupsTable.findFirst({
  where: and(
    eq(groupsTable.id, groupId),
    eq(groupsTable.companyId, companyId)
  ),
});
if (!group) return Result.fail('Group not found');
```

### Input Validation Boundaries

**Server Action Layer:**
- Validate with Zod schemas
- Check user permissions (role-based)
- Validate company ownership

**Service Layer:**
- Additional business logic validation
- Check invariants (e.g., at least one admin)
- Validate WhatsApp API constraints

**Examples:**
```typescript
// Server action validation
const validated = groupCreateServerSchema.parse(data);

// Service validation
if (initialMemberIds.length < 2) {
  return Result.fail('Group must have at least 2 members');
}
```

---

## 10) Testing Plan

### Unit Tests (Service Methods)

**GroupService:**
- `create`: Valid group creation, duplicate name, invalid contacts, < 2 members
- `update`: Valid update, name conflict, not found, forbidden
- `deactivate`: Valid deactivate, not found, forbidden
- `list`: Pagination, search, filters, sorting
- `getById`: Valid group, not found
- `addMember`: Valid add, duplicate member, not found, forbidden
- `removeMember`: Valid remove, not found, removing last admin, forbidden
- `listMembers`: Pagination, role filter
- `updateMemberRole`: Valid update, demoting last admin, not found, forbidden
- `sendMessage`: Valid send, not member, restricted group, not found
- `getMessages`: Pagination, empty group

**Coverage Target:**
- 90%+ line coverage for service layer
- All error paths tested
- Edge cases covered

### Integration Tests (DB + Service)

**Critical Paths:**
1. Create group with members → Verify group and members created
2. Add member → Verify member added and audit logged
3. Remove member → Verify member soft deleted
4. Send message → Verify message created and WhatsApp API called
5. Deactivate group → Verify group marked inactive
6. List groups with pagination → Verify cursor works
7. Search groups → Verify search returns correct results

**Test Setup:**
- Use test database with migrations
- Seed test data (companies, users, contacts, whatsapp accounts)
- Mock WhatsApp API calls
- Clean up after each test

### UI Tests (Smoke Tests)

**Critical Flows:**
1. Navigate to groups page → Verify list loads
2. Click "Create Group" → Verify dialog opens
3. Fill form and submit → Verify group created and appears in list
4. Click group → Verify details page loads
5. Click "Add Member" → Verify dialog opens
6. Add member → Verify member appears in list
7. Send message → Verify message appears in chat
8. Search groups → Verify results update

**Tools:**
- Playwright for E2E tests
- React Testing Library for component tests

### Edge Cases Checklist

**Validation:**
- [ ] Group name empty or too long
- [ ] Group description too long
- [ ] < 2 initial members
- [ ] Duplicate member addition
- [ ] Removing last admin
- [ ] Demoting last admin
- [ ] Invalid role value
- [ ] Invalid cursor/base64
- [ ] Limit out of range

**Permissions:**
- [ ] Non-admin tries to update group
- [ ] Non-admin tries to add/remove members
- [ ] Non-member tries to send message
- [ ] User tries to access other company's group
- [ ] User tries to deactivate without permission

**Pagination:**
- [ ] Empty list (no groups)
- [ ] Single page (no more results)
- [ ] Multiple pages (cursor navigation)
- [ ] Large result set (100+ groups)

**Data Integrity:**
- [ ] Group name uniqueness per company
- [ ] WhatsApp group ID uniqueness
- [ ] Member uniqueness per group
- [ ] At least one admin invariant
- [ ] Soft delete works correctly
- [ ] Audit logs created for all mutations

**API Integration:**
- [ ] WhatsApp API failure handling
- [ ] Webhook sync for group creation
- [ ] Webhook sync for member changes
- [ ] Webhook sync for messages

---

## 11) Performance & Observability

### Query Cost Risks + Mitigations

**High-Risk Queries:**

1. **List groups with member/message counts**
   - Risk: N+1 queries for counts
   - Mitigation: Use subqueries or window functions for counts
   - Example:
     ```sql
     SELECT g.*, 
       (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = true) as member_count,
       (SELECT COUNT(*) FROM messages WHERE group_id = g.id AND is_active = true) as message_count
     FROM groups g
     WHERE g.company_id = $1
     ```

2. **List group members with contact details**
   - Risk: N+1 for contact lookups
   - Mitigation: Single query with JOIN
   - Example:
     ```sql
     SELECT gm.*, c.name, c.phone, c.avatar
     FROM group_members gm
     JOIN contacts c ON c.id = gm.contact_id
     WHERE gm.group_id = $1 AND gm.is_active = true
     ```

3. **Search groups with pagination**
   - Risk: Full table scan on ILIKE
   - Mitigation: Use `groups_company_name_idx` index, limit search to 100 chars
   - Consider: Full-text search for large datasets

4. **Get group messages**
   - Risk: Large result sets for active groups
   - Mitigation: Cursor pagination with limit 100, index on `group_id + created_at`

### Index Recap

| Query Pattern | Index Used |
|---------------|------------|
| List groups (active, not archived) | `groups_company_active_not_archived_idx` |
| List groups (sorted by created) | `groups_company_created_id_idx` |
| List groups (sorted by name) | `groups_company_name_id_idx` |
| Search groups by name | `groups_company_name_idx` |
| Get group members | `group_members_group_is_active_idx` |
 Get user's groups | `group_members_contact_is_active_idx` |
| Get group messages | `messages_group_created_at_idx` |
| Check admin count | `group_members_group_role_idx` |

### Logging/Metrics Events

**Service-Level Logging:**

```typescript
// GroupService.create
logger.info('Group created', {
  operation: 'GroupService.create',
  groupId: group.id,
  companyId: group.companyId,
  memberCount: initialMemberIds.length,
  duration: logger.getDuration(),
});

// GroupService.sendMessage
logger.info('Group message sent', {
  operation: 'GroupService.sendMessage',
  groupId: message.groupId,
  messageId: message.id,
  hasMedia: !!message.mediaUrl,
  duration: logger.getDuration(),
});

// GroupService.addMember
logger.info('Group member added', {
  operation: 'GroupService.addMember',
  groupId: groupId,
  contactId: contactId,
  role: role,
  duration: logger.getDuration(),
});
```

**Metrics to Track:**
- Group creation rate (per company)
- Group message volume (per group)
- Member add/remove rate
- Average group size
- Query latency (p50, p95, p99)
- WhatsApp API call success rate

### Avoid N+1

**Pattern: Use JOINs instead of separate queries**

❌ Bad:
```typescript
const groups = await db.query.groupsTable.findMany({ where: eq(groupsTable.companyId, companyId) });
for (const group of groups) {
  group.memberCount = await db.query.groupMembersTable.findMany({ 
    where: eq(groupMembersTable.groupId, group.id) 
  }).then(m => m.length);
}
```

✅ Good:
```typescript
const groups = await db.query.groupsTable.findMany({
  where: eq(groupsTable.companyId, companyId),
  with: {
    members: {
      where: eq(groupMembersTable.isActive, true),
    },
  },
});
```

**Pattern: Use subqueries for counts**

❌ Bad:
```typescript
const groups = await db.query.groupsTable.findMany({ where: eq(groupsTable.companyId, companyId) });
for (const group of groups) {
  group.memberCount = await db.select({ count: sql<number>`count(*)` })
    .from(groupMembersTable)
    .where(eq(groupMembersTable.groupId, group.id));
}
```

✅ Good:
```sql
SELECT g.*, 
  (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND is_active = true) as member_count
FROM groups g
WHERE g.company_id = $1
```

### Search Debouncing + Safe LIKE

**UI Debouncing:**
```typescript
const debouncedSearch = useDebounce(searchTerm, 300);
useListGroups({ ...filter, search: debouncedSearch });
```

**Server-Side Safe LIKE:**
```typescript
// Use parameterized query with proper escaping
const searchPattern = `%${search}%`;
await db.query.groupsTable.findMany({
  where: and(
    eq(groupsTable.companyId, companyId),
    ilike(groupsTable.name, searchPattern)
  ),
});
```

---

## 12) Delivery Checklist

### Files/Folders to Create (By Layer)

**Database Layer:**
- [ ] `db/schema/groups.ts` - groupsTable definition
- [ ] `db/schema/group-members.ts` - groupMembersTable definition
- [ ] `db/drizzle/0008_add_groups.sql` - migration file

**Schemas Layer:**
- [ ] `features/groups/schemas/group-schema.ts` - All Zod schemas

**Service Layer:**
- [ ] `features/groups/services/group.service.ts` - GroupService class

**Actions Layer:**
- [ ] `features/groups/actions/group.actions.ts` - All server actions

**Hooks Layer:**
- [ ] `features/groups/hooks/use-list-groups.ts`
- [ ] `features/groups/hooks/use-group-by-id.ts`
- [ ] `features/groups/hooks/use-create-group.ts`
- [ ] `features/groups/hooks/use-update-group.ts`
- [ ] `features/groups/hooks/use-deactivate-group.ts`
- [ ] `features/groups/hooks/use-list-group-members.ts`
- [ ] `features/groups/hooks/use-add-group-member.ts`
- [ ] `features/groups/hooks/use-remove-group-member.ts`
- [ ] `features/groups/hooks/use-update-group-member-role.ts`
- [ ] `features/groups/hooks/use-send-group-message.ts`
- [ ] `features/groups/hooks/use-group-messages.ts`

**Components Layer:**
- [ ] `features/groups/components/group-create-dialog.tsx`
- [ ] `features/groups/components/group-create-form.tsx`
- [ ] `features/groups/components/group-edit-dialog.tsx`
- [ ] `features/groups/components/group-edit-form.tsx`
- [ ] `features/groups/components/group-card.tsx`
- [ ] `features/groups/components/groups-table.tsx`
- [ ] `features/groups/components/add-member-dialog.tsx`
- [ ] `features/groups/components/group-member-card.tsx`
- [ ] `features/groups/components/group-members-table.tsx`
- [ ] `features/groups/components/group-empty-state.tsx`
- [ ] `features/groups/components/group-members-empty-state.tsx`
- [ ] `features/groups/components/group-message-list.tsx`
- [ ] `features/groups/components/group-message-input.tsx`

**Pages Layer:**
- [ ] `app/(protected)/groups/page.tsx` - Groups list page
- [ ] `app/(protected)/groups/[groupId]/page.tsx` - Group details page
- [ ] `app/(protected)/groups/[groupId]/members/page.tsx` - Group members page

**Tests:**
- [ ] `features/groups/services/__tests__/group.service.test.ts`
- [ ] `features/groups/components/__tests__/groups-table.test.tsx`

### Order of Implementation

1. **Database** (30 min)
   - Create migration file
   - Run migration
   - Verify tables created

2. **Schemas** (30 min)
   - Create all Zod schemas
   - Export types
   - Verify types compile

3. **Service** (2 hours)
   - Implement GroupService methods
   - Add performance logging
   - Write unit tests

4. **Actions** (1 hour)
   - Create all server actions
   - Add withAction wrapper
   - Add validation

5. **Hooks** (1 hour)
   - Create all React Query hooks
   - Add query keys
   - Add invalidation logic

6. **Components - Forms** (2 hours)
   - Create form components
   - Add validation
   - Add loading states

7. **Components - Tables** (2 hours)
   - Create table components
   - Add TanStack Table setup
   - Add filters/sorting

8. **Components - Other** (1 hour)
   - Create cards, dialogs, empty states
   - Add toast notifications

9. **Pages** (1 hour)
   - Create page components
   - Wire up hooks and components
   - Add navigation

10. **Integration** (1 hour)
    - Add routes to sidebar/navigation
    - Test end-to-end flows
    - Fix bugs

11. **Tests** (2 hours)
    - Write integration tests
    - Write UI smoke tests
    - Verify all tests pass

12. **Polish** (1 hour)
    - Fix linting errors
    - Add error handling
    - Improve UX

**Total Estimated Time: ~15 hours**

### Definition of Done

- [ ] All flows work end-to-end (create, update, list, view, add/remove members, send messages)
- [ ] Tenant isolation verified (cannot access other company's groups)
- [ ] All tests pass (unit + integration + smoke)
- [ ] No unused columns or indexes
- [ ] User-facing errors are readable and actionable
- [ ] Performance logging added to all service methods
- [ ] Audit logs created for all mutations
- [ ] WhatsApp API integration tested (mocked)
- [ ] Linting passes with no errors
- [ ] TypeScript compilation with no errors
- [ ] Responsive design works on mobile/tablet/desktop
- [ ] Loading states displayed for all async operations
- [ ] Toast notifications for all user actions
- [ ] Empty states handled gracefully
- [ ] Pagination works correctly
- [ ] Search and filters work correctly
- [ ] Permission checks enforced at service layer
- [ ] Soft delete implemented correctly
- [ ] At least one admin invariant enforced
