import {
  pgTable,
  pgSchema,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------
// FrontDesk-specific tables live in the `frontdesk` Postgres schema.
// `public.users` stays shared across all Neuvetra products and mirrors `auth.users`
// via the `on_auth_user_created` trigger (see migration 0007_neuvetra_namespace_reorg).

export const frontdesk = pgSchema("frontdesk")

// ---------------------------------------------------------------------------
// Enums (frontdesk schema)
// ---------------------------------------------------------------------------

export const businessStatusEnum = frontdesk.enum("business_status", [
  "active",
  "inactive",
  "suspended",
])

export const businessTypeEnum = frontdesk.enum("business_type", [
  "medical",
  "dental",
  "spa",
  "salon",
  "plumbing",
  "legal",
  "real_estate",
  "other",
])

export const memberRoleEnum = frontdesk.enum("member_role", [
  "owner",
  "admin",
  "member",
])

export const callStatusEnum = frontdesk.enum("call_status", [
  "in_progress",
  "completed",
  "missed",
  "transferred",
])

export const calendarProviderEnum = frontdesk.enum("calendar_provider", [
  "google",
  "outlook",
  "apple",
  "caldav",
])

// ---------------------------------------------------------------------------
// users (public schema — shared identity across all Neuvetra products)
// id mirrors Supabase auth.users.id — no defaultRandom()
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id:        uuid("id").primaryKey(),
  email:     text("email").unique(),
  firstName: text("first_name").notNull(),
  lastName:  text("last_name").notNull(),
  phone:     text("phone").unique(),
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// businesses (frontdesk schema)
// ---------------------------------------------------------------------------

export const businesses = frontdesk.table("businesses", {
  id:            uuid("id").primaryKey().defaultRandom(),
  name:          text("name").notNull(),
  slug:          text("slug").notNull().unique(),
  twilioNumber:    text("twilio_number").unique(),
  twilioNumberSid: text("twilio_number_sid").unique(),
  aiConfig:      jsonb("ai_config"),
  status:        businessStatusEnum("status").notNull().default("active"),
  businessType:  businessTypeEnum("business_type"),
  stripeCustomerId:      text("stripe_customer_id").unique(),
  stripeSubscriptionId:  text("stripe_subscription_id").unique(),
  stripePlanId:          text("stripe_plan_id"),
  stripeMeteredItemId:   text("stripe_metered_item_id"),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// business_members (frontdesk schema — many-to-many: users ↔ businesses)
// Cross-schema FK to public.users.id is supported by Postgres natively.
// ---------------------------------------------------------------------------

export const businessMembers = frontdesk.table(
  "business_members",
  {
    id:         uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    userId:     uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role:       memberRoleEnum("role").notNull().default("member"),
    createdAt:  timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uq_business_members").on(t.businessId, t.userId)],
)

// ---------------------------------------------------------------------------
// knowledge_base (frontdesk schema)
// ---------------------------------------------------------------------------

export const knowledgeBase = frontdesk.table("knowledge_base", {
  id:           uuid("id").primaryKey().defaultRandom(),
  businessId:   uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  question:     text("question").notNull(),
  answer:       text("answer").notNull(),
  category:     text("category"),
  sortOrder:    integer("sort_order").notNull().default(0),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// calendar_connections (frontdesk schema — one row per provider per business)
// ---------------------------------------------------------------------------

export const calendarConnections = frontdesk.table(
  "calendar_connections",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    businessId:        uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    provider:          calendarProviderEnum("provider").notNull(),
    providerAccountId: text("provider_account_id"),
    providerEmail:     text("provider_email"),
    accessToken:       text("access_token"),
    refreshToken:      text("refresh_token"),
    tokenExpiry:       timestamp("token_expiry"),
    isActive:          boolean("is_active").notNull().default(true),
    createdAt:         timestamp("created_at").notNull().defaultNow(),
    updatedAt:         timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_calendar_connections").on(t.businessId, t.provider),
  ],
)

// ---------------------------------------------------------------------------
// callback_requests (frontdesk schema)
// Saved by the take_message webhook when the AI captures a caller's name,
// number, and reason. Used when no calendar is connected or the business
// prefers a callback model.
// ---------------------------------------------------------------------------

export const callbackRequests = frontdesk.table("callback_requests", {
  id:          uuid("id").primaryKey().defaultRandom(),
  businessId:  uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  callerPhone: text("caller_phone").notNull(),
  callerName:  text("caller_name"),
  message:     text("message"),
  status:      text("status").notNull().default("pending"),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// calls (frontdesk schema)
// ---------------------------------------------------------------------------

export const calls = frontdesk.table("calls", {
  id:              uuid("id").primaryKey().defaultRandom(),
  businessId:      uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  callerNumber:    text("caller_number").notNull(),
  status:          callStatusEnum("status").notNull().default("in_progress"),
  summary:         text("summary"),
  durationSeconds: integer("duration_seconds"),
  retellCallId:    text("retell_call_id").unique(),
  transcript:      text("transcript"),
  recordingUrl:    text("recording_url"),
  startedAt:       timestamp("started_at").notNull().defaultNow(),
  endedAt:         timestamp("ended_at"),
})
