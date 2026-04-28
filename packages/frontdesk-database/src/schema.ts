import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core"

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const businessStatusEnum = pgEnum("business_status", [
  "active",
  "inactive",
  "suspended",
])

export const businessTypeEnum = pgEnum("business_type", [
  "medical",
  "dental",
  "spa",
  "salon",
  "plumbing",
  "legal",
  "real_estate",
  "other",
])

export const memberRoleEnum = pgEnum("member_role", [
  "owner",
  "admin",
  "member",
])

export const callStatusEnum = pgEnum("call_status", [
  "in_progress",
  "completed",
  "missed",
  "transferred",
])

export const calendarProviderEnum = pgEnum("calendar_provider", [
  "google",
  "outlook",
  "apple",
  "caldav",
])

// ---------------------------------------------------------------------------
// businesses
// ---------------------------------------------------------------------------

export const businesses = pgTable("businesses", {
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
  stripePlanId:          text("stripe_plan_id"),          // flat price id (e.g. price_growth_flat)
  stripeMeteredItemId:   text("stripe_metered_item_id"),  // subscription item id for usage reporting
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// users  (id mirrors Supabase auth.users.id — no defaultRandom())
// ---------------------------------------------------------------------------

export const users = pgTable("users", {
  id:        uuid("id").primaryKey(),
  email:     text("email").unique(),          // nullable — phone auth users may have no email
  firstName: text("first_name").notNull(),
  lastName:  text("last_name").notNull(),
  phone:     text("phone").unique(),            // verified personal mobile (nullable for legacy rows)
  avatarUrl: text("avatar_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// business_members  (many-to-many: users ↔ businesses)
// ---------------------------------------------------------------------------

export const businessMembers = pgTable(
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
// knowledge_base
// ---------------------------------------------------------------------------

export const knowledgeBase = pgTable("knowledge_base", {
  id:           uuid("id").primaryKey().defaultRandom(),
  businessId:   uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  question:     text("question").notNull(),
  answer:       text("answer").notNull(),
  // Groups entries into labeled sections (e.g. "Emergencies", "Pricing")
  category:     text("category"),
  // Display order within the category
  sortOrder:    integer("sort_order").notNull().default(0),
  createdAt:    timestamp("created_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// calendar_connections  (one row per provider per business)
// ---------------------------------------------------------------------------

export const calendarConnections = pgTable(
  "calendar_connections",
  {
    id:                uuid("id").primaryKey().defaultRandom(),
    businessId:        uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    provider:          calendarProviderEnum("provider").notNull(),
    // Provider-issued account identifier — used to detect re-auth vs new connect
    providerAccountId: text("provider_account_id"),
    // Human-readable display ("Connected as john@gmail.com")
    providerEmail:     text("provider_email"),
    accessToken:       text("access_token"),
    refreshToken:      text("refresh_token"),
    tokenExpiry:       timestamp("token_expiry"),
    isActive:          boolean("is_active").notNull().default(true),
    createdAt:         timestamp("created_at").notNull().defaultNow(),
    updatedAt:         timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    // One active connection per provider per business
    uniqueIndex("uq_calendar_connections").on(t.businessId, t.provider),
  ],
)

// ---------------------------------------------------------------------------
// callback_requests
// Saved by the take_message webhook function when the AI takes a caller's
// name, number, and reason so the business can call them back.
// Used when no calendar is connected OR for businesses that prefer callbacks.
// ---------------------------------------------------------------------------

export const callbackRequests = pgTable("callback_requests", {
  id:          uuid("id").primaryKey().defaultRandom(),
  businessId:  uuid("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  callerPhone: text("caller_phone").notNull(),
  callerName:  text("caller_name"),
  message:     text("message"),
  status:      text("status").notNull().default("pending"), // "pending" | "handled"
  createdAt:   timestamp("created_at").notNull().defaultNow(),
})

// ---------------------------------------------------------------------------
// calls
// ---------------------------------------------------------------------------

export const calls = pgTable("calls", {
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
