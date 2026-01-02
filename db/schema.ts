import { pgTable, text, timestamp, serial, integer, boolean, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
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
    webhookUrl: text("webhook_url"),
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

