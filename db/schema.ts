import { pgTable, text, timestamp, serial, integer, boolean, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

export const companiesTable = pgTable("companies", {
    id: serial("id").primaryKey(),
    name: text("name"), // nullable
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    role: text("role").notNull().default("admin"),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    // Track auditing users - use explicit type cast to avoid circular reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdBy: integer("created_by").references((): any => usersTable.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedBy: integer("updated_by").references((): any => usersTable.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    startDateTime: timestamp("start_date_time", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    // Primary query index: company_id
    index("users_company_id_idx")
        .on(table.companyId.asc()),

    // Composite index for filtering: company_id + is_active
    index("users_company_id_is_active_idx")
        .on(table.companyId.asc(), table.isActive.asc())
        .where(sql`${table.isActive} = true`),

    // Email index for authentication
    index("users_email_idx")
        .on(table.email.asc()),

    // Role-based queries
    index("users_company_id_role_idx")
        .on(table.companyId.asc(), table.role.asc()),

    // CRITICAL: Composite index for default sorting (createdAt) - fixes slow queries
    index("users_company_id_created_at_id_idx")
        .on(table.companyId.asc(), table.createdAt.desc(), table.id.asc()),

    // CRITICAL: Composite index for name sorting with cursor pagination
    index("users_company_id_name_id_idx")
        .on(table.companyId.asc(), table.name.asc(), table.id.asc()),

    // CRITICAL: Composite index for email sorting with cursor pagination
    index("users_company_id_email_id_idx")
        .on(table.companyId.asc(), table.email.asc(), table.id.asc()),

    // CRITICAL: Composite index for role sorting with cursor pagination
    index("users_company_id_role_id_idx")
        .on(table.companyId.asc(), table.role.asc(), table.id.asc()),
]);


export const auditLogsTable = pgTable("audit_logs", {
    id: serial("id").primaryKey(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id").notNull(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    action: text("action").notNull(),
    oldValues: jsonb("old_values"),
    newValues: jsonb("new_values"),
    // Track auditing users - use explicit type cast to avoid circular reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    changedBy: integer("changed_by").references((): any => usersTable.id).notNull(),
    changeReason: text("change_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
    // Primary query index: company_id
    index("audit_logs_company_id_idx")
        .on(table.companyId.asc()),

    // Entity queries
    index("audit_logs_entity_type_entity_id_idx")
        .on(table.entityType.asc(), table.entityId.asc()),

    // Entity type filtering within company
    index("audit_logs_company_id_entity_type_idx")
        .on(table.companyId.asc(), table.entityType.asc()),

    // User activity queries
    index("audit_logs_changed_by_idx")
        .on(table.changedBy.asc()),

    // User activity within company
    index("audit_logs_company_id_changed_by_idx")
        .on(table.companyId.asc(), table.changedBy.asc()),

    // Chronological sorting
    index("audit_logs_created_at_idx")
        .on(table.createdAt.asc()),

    // Composite index for entity history queries
    index("audit_logs_company_id_entity_type_entity_id_idx")
        .on(table.companyId.asc(), table.entityType.asc(), table.entityId.asc()),
]);

// WhatsApp Business Account credentials (multiple per company)
export const whatsappAccountsTable = pgTable("whatsapp_accounts", {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    name: text("name").notNull(), // Human-friendly account name
    phoneNumberId: text("phone_number_id").notNull(),
    businessAccountId: text("business_account_id").notNull(),
    accessToken: text("access_token").notNull(), // Store encrypted in production
    isActive: boolean("is_active").notNull().default(true),
    isDefault: boolean("is_default").notNull().default(false),
    // Track auditing users - use explicit type cast to avoid circular reference
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdBy: integer("created_by").references((): any => usersTable.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedBy: integer("updated_by").references((): any => usersTable.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    // Primary query index: company_id
    index("whatsapp_accounts_company_id_idx")
        .on(table.companyId.asc()),

    // Unique per company
    uniqueIndex("whatsapp_accounts_company_phone_unique")
        .on(table.companyId.asc(), table.phoneNumberId.asc()),

    uniqueIndex("whatsapp_accounts_company_name_unique")
        .on(table.companyId.asc(), table.name.asc()),

    // Partial unique for default account per company
    uniqueIndex("whatsapp_accounts_company_default_unique")
        .on(table.companyId.asc())
        .where(sql`${table.isDefault} = true`),

    // Composite index for filtering active accounts
    index("whatsapp_accounts_company_active_created_idx")
        .on(table.companyId.asc(), table.isActive.asc(), table.createdAt.desc()),

    // Composite index for cursor pagination
    index("whatsapp_accounts_company_created_id_idx")
        .on(table.companyId.asc(), table.createdAt.desc(), table.id.asc()),

    // Composite index for name sorting/search
    index("whatsapp_accounts_company_name_id_idx")
        .on(table.companyId.asc(), table.name.asc(), table.id.asc()),

    // Lookup indexes
    index("whatsapp_accounts_company_phone_idx")
        .on(table.companyId.asc(), table.phoneNumberId.asc()),

    index("whatsapp_accounts_company_business_id_idx")
        .on(table.companyId.asc(), table.businessAccountId.asc()),
]);

// Contacts Table
export const contactsTable = pgTable("contacts", {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    phone: text("phone").notNull(),
    name: text("name"),
    avatar: text("avatar"),
    isGroup: boolean("is_group").notNull().default(false),
    presence: text("presence"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdBy: integer("created_by").references((): any => usersTable.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedBy: integer("updated_by").references((): any => usersTable.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    // Unique constraint: one contact per company + phone
    uniqueIndex("contacts_company_phone_unique")
        .on(table.companyId.asc(), table.phone.asc()),

    // List active contacts
    index("contacts_company_is_active_idx")
        .on(table.companyId.asc(), table.isActive.asc()),

    // Search by name
    index("contacts_company_name_idx")
        .on(table.companyId.asc(), table.name.asc()),

    // Composite index for cursor pagination
    index("contacts_company_created_id_idx")
        .on(table.companyId.asc(), table.createdAt.desc(), table.id.asc()),
]);

// Conversations Table
export const conversationsTable = pgTable("conversations", {
    id: serial("id").primaryKey(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
    whatsappAccountId: integer("whatsapp_account_id").references(() => whatsappAccountsTable.id),
    lastMessageId: integer("last_message_id"),
    lastMessagePreview: text("last_message_preview"),
    lastMessageTime: timestamp("last_message_time", { withTimezone: true }),
    unreadCount: integer("unread_count").notNull().default(0),
    isFavorite: boolean("is_favorite").notNull().default(false),
    isArchived: boolean("is_archived").notNull().default(false),
    assignedToUserId: integer("assigned_to_user_id").references(() => usersTable.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdBy: integer("created_by").references((): any => usersTable.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedBy: integer("updated_by").references((): any => usersTable.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    // Unique constraint: one conversation per company + contact + whatsapp account
    uniqueIndex("conversations_company_contact_whatsapp_account_unique")
        .on(table.companyId.asc(), table.contactId.asc(), table.whatsappAccountId.asc()),

    // List active conversations
    index("conversations_company_is_active_is_archived_idx")
        .on(table.companyId.asc(), table.isActive.asc(), table.isArchived.asc()),

    // Filter by favorite
    index("conversations_company_is_favorite_is_active_idx")
        .on(table.companyId.asc(), table.isFavorite.asc(), table.isActive.asc()),

    // Filter by unread
    index("conversations_company_unread_count_idx")
        .on(table.companyId.asc(), table.unreadCount.asc()),

    // Sort by recency
    index("conversations_company_last_message_time_idx")
        .on(table.companyId.asc(), table.lastMessageTime.desc()),

    // Find conversations assigned to user
    index("conversations_assigned_to_user_company_idx")
        .on(table.assignedToUserId.asc(), table.companyId.asc()),

    // Composite index for cursor pagination
    index("conversations_company_last_message_time_id_idx")
        .on(table.companyId.asc(), table.lastMessageTime.desc(), table.id.asc()),
]);

export const messagesTable = pgTable("messages", {
    id: serial("id").primaryKey(),
    conversationId: integer("conversation_id").references(() => conversationsTable.id).notNull(),
    companyId: integer("company_id").references(() => companiesTable.id).notNull(),
    contactId: integer("contact_id").references(() => contactsTable.id).notNull(),
    whatsappAccountId: integer("whatsapp_account_id").references(() => whatsappAccountsTable.id),
    direction: text("direction").notNull(),
    status: text("status").notNull().default("sending"),
    content: text("content").notNull(),
    mediaUrl: text("media_url"),
    mediaType: text("media_type"),
    mediaId: text("media_id"),
    mediaMimeType: text("media_mime_type"),
    mediaCaption: text("media_caption"),
    providerMessageId: text("provider_message_id"),
    providerStatus: text("provider_status"),
    errorCode: text("error_code"),
    errorMessage: text("error_message"),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdBy: integer("created_by").references((): any => usersTable.id),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedBy: integer("updated_by").references((): any => usersTable.id),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    // Fetch messages for conversation (paginated)
    index("messages_conversation_created_at_idx")
        .on(table.conversationId.asc(), table.createdAt.desc()),

    // Find messages by status (for polling/retry)
    index("messages_company_status_idx")
        .on(table.companyId.asc(), table.status.asc()),

    // Find message by provider ID (for webhook updates)
    index("messages_provider_message_id_idx")
        .on(table.providerMessageId.asc()),

    // Active messages only
    index("messages_conversation_is_active_idx")
        .on(table.conversationId.asc(), table.isActive.asc()),

    // Composite index for cursor pagination
    index("messages_conversation_created_at_id_idx")
        .on(table.conversationId.asc(), table.createdAt.desc(), table.id.asc()),
]);

export const conversationRelations = relations(conversationsTable, ({ one }) => ({
  contact: one(contactsTable, {
    fields: [conversationsTable.contactId],
    references: [contactsTable.id],
  }),
}));

export const messageRelations = relations(messagesTable, ({ one }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversationId],
    references: [conversationsTable.id],
  }),
  contact: one(contactsTable, {
    fields: [messagesTable.contactId],
    references: [contactsTable.id],
  }),
}));

// Conversation Notes Table
export const conversationNotesTable = pgTable("conversation_notes", {
    // Primary key
    id: serial("id").primaryKey(),

    // Foreign keys
    conversationId: integer("conversation_id")
        .references(() => conversationsTable.id)
        .notNull(),
    companyId: integer("company_id")
        .references(() => companiesTable.id)
        .notNull(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdBy: integer("created_by").references((): any => usersTable.id).notNull(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updatedBy: integer("updated_by").references((): any => usersTable.id),

    // Content
    content: text("content").notNull(),

    // Metadata
    isPinned: boolean("is_pinned").notNull().default(false),

    // Audit fields
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
    // Primary query index: conversation_id + is_active
    index("conversation_notes_conversation_active_idx")
        .on(table.conversationId.asc(), table.isActive.desc()),

    // Company-scoped queries
    index("conversation_notes_company_id_idx")
        .on(table.companyId.asc()),

    // Find notes by creator
    index("conversation_notes_created_by_idx")
        .on(table.createdBy.asc()),

    // Composite index for sorting (newest first)
    index("conversation_notes_conversation_created_idx")
        .on(table.conversationId.asc(), table.createdAt.desc(), table.id.desc()),

    // Pinned notes (show first)
    index("conversation_notes_conversation_pinned_idx")
        .on(table.conversationId.asc(), table.isPinned.desc(), table.createdAt.desc()),

    // Company + conversation filtering
    index("conversation_notes_company_conversation_idx")
        .on(table.companyId.asc(), table.conversationId.asc()),
]);

export const conversationNoteRelations = relations(conversationNotesTable, ({ one }) => ({
  conversation: one(conversationsTable, {
    fields: [conversationNotesTable.conversationId],
    references: [conversationsTable.id],
  }),
  creator: one(usersTable, {
    fields: [conversationNotesTable.createdBy],
    references: [usersTable.id],
  }),
  updater: one(usersTable, {
    fields: [conversationNotesTable.updatedBy],
    references: [usersTable.id],
  }),
}));

export const whatsappWebhookConfigsTable = pgTable("whatsapp_webhook_configs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  whatsappAccountId: integer("whatsapp_account_id").references(() => whatsappAccountsTable.id).notNull(),
  appSecret: text("app_secret").notNull(),
  callbackPath: text("callback_path").notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdBy: integer("created_by").references((): any => usersTable.id),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedBy: integer("updated_by").references((): any => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("whatsapp_webhook_configs_company_account_unique")
    .on(table.companyId.asc(), table.whatsappAccountId.asc()),
]);

export const whatsappWebhookEventLogsTable = pgTable("whatsapp_webhook_event_logs", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  whatsappAccountId: integer("whatsapp_account_id").references(() => whatsappAccountsTable.id).notNull(),
  objectId: text("object_id"),
  eventType: text("event_type").notNull(),
  eventTs: timestamp("event_ts", { withTimezone: true }).notNull(),
  payload: jsonb("payload").notNull(),
  signature: text("signature"),
  dedupKey: text("dedup_key").notNull(),
  processed: boolean("processed").notNull().default(false),
  processedAt: timestamp("processed_at", { withTimezone: true }),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createdBy: integer("created_by").references((): any => usersTable.id),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updatedBy: integer("updated_by").references((): any => usersTable.id),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  uniqueIndex("whatsapp_webhook_event_logs_company_dedup_unique")
    .on(table.companyId.asc(), table.dedupKey.asc()),
  index("whatsapp_webhook_event_logs_company_account_processed_ts_idx")
    .on(table.companyId.asc(), table.whatsappAccountId.asc(), table.processed.asc(), table.eventTs.desc()),
  index("whatsapp_webhook_event_logs_payload_gin_idx")
    .using("gin", table.payload),
]);

export const fileUploadsTable = pgTable("file_uploads", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companiesTable.id).notNull(),
  conversationId: integer("conversation_id").references(() => conversationsTable.id).notNull(),
  fileKey: text("file_key").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: text("file_type").notNull(),
  mimeType: text("mime_type").notNull(),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  uploadedBy: integer("uploaded_by").references((): any => usersTable.id).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }),
}, (table) => [
  index("file_uploads_company_id_idx").on(table.companyId.asc()),
  uniqueIndex("file_uploads_file_key_unique").on(table.fileKey.asc()),
  index("file_uploads_conversation_id_idx").on(table.conversationId.asc()),
  index("file_uploads_uploaded_by_idx").on(table.uploadedBy.asc()),
  index("file_uploads_company_created_id_idx").on(table.companyId.asc(), table.createdAt.desc(), table.id.asc()),
  index("file_uploads_company_file_type_idx").on(table.companyId.asc(), table.fileType.asc()),
]);

export const fileUploadRelations = relations(fileUploadsTable, ({ one }) => ({
  company: one(companiesTable, {
    fields: [fileUploadsTable.companyId],
    references: [companiesTable.id],
  }),
  conversation: one(conversationsTable, {
    fields: [fileUploadsTable.conversationId],
    references: [conversationsTable.id],
  }),
  uploader: one(usersTable, {
    fields: [fileUploadsTable.uploadedBy],
    references: [usersTable.id],
  }),
}));

