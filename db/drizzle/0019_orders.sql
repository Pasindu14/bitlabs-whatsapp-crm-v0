CREATE TABLE IF NOT EXISTS "orders" (
    "id" serial PRIMARY KEY,
    "company_id" integer NOT NULL REFERENCES "companies"("id"),
    "contact_id" integer NOT NULL REFERENCES "contacts"("id"),
    "conversation_id" integer REFERENCES "conversations"("id"),
    "created_by" integer NOT NULL REFERENCES "users"("id"),
    "updated_by" integer REFERENCES "users"("id"),
    "contact_name_snapshot" text NOT NULL,
    "contact_phone_snapshot" text NOT NULL,
    "customer_name" text NOT NULL,
    "customer_phone" text NOT NULL,
    "delivery_address" text NOT NULL,
    "order_description" text NOT NULL,
    "status" text NOT NULL DEFAULT 'draft',
    "notes" text,
    "is_active" boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "updated_at" timestamptz,
    CONSTRAINT orders_status_check CHECK (status IN ('draft','pending','confirmed','shipped','delivered','cancelled'))
);

CREATE INDEX IF NOT EXISTS "orders_company_created_id_idx" ON "orders" ("company_id" ASC, "created_at" DESC, "id" DESC);
CREATE INDEX IF NOT EXISTS "orders_company_status_id_idx" ON "orders" ("company_id" ASC, "status" ASC, "id" DESC);
CREATE INDEX IF NOT EXISTS "orders_company_contact_id_idx" ON "orders" ("company_id" ASC, "contact_id" ASC, "id" DESC);
CREATE INDEX IF NOT EXISTS "orders_company_conversation_id_idx" ON "orders" ("company_id" ASC, "conversation_id" ASC, "id" DESC);
CREATE INDEX IF NOT EXISTS "orders_company_active_idx" ON "orders" ("company_id" ASC, "is_active" ASC);
