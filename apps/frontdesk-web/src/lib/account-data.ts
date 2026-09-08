import type { SupabaseClient } from "@supabase/supabase-js"

export interface UserProfile {
  id: string
  firstName: string
  lastName: string
  phone: string
}

export interface Business {
  id: string
  name: string
  status: "active" | "inactive" | "suspended"
  businessType: string | null
  twilioNumber: string | null
  stripePlanId: string | null
  stripeSubscriptionId: string | null
  aiConfig: Record<string, unknown> | null
}

// Identity is shared across products; business data moved to frontdesk in migration 0007.
export async function loadUserProfile(client: SupabaseClient, userId: string): Promise<UserProfile | null> {
  const { data } = await client
    .schema("public")
    .from("users")
    .select("id, first_name, last_name, phone")
    .eq("id", userId)
    .maybeSingle()

  if (!data) return null
  return {
    id: data.id as string,
    firstName: data.first_name as string,
    lastName: data.last_name as string,
    phone: data.phone as string,
  }
}

export async function loadOwnedBusiness(client: SupabaseClient, userId: string): Promise<Business | null> {
  const { data } = await client
    .schema("frontdesk")
    .from("business_members")
    .select("businesses(id, name, status, business_type, twilio_number, stripe_plan_id, stripe_subscription_id, ai_config)")
    .eq("user_id", userId)
    .eq("role", "owner")
    .limit(1)
    .maybeSingle()

  if (!data?.businesses) return null
  const business = data.businesses as unknown as Record<string, unknown>
  return {
    id: business.id as string,
    name: business.name as string,
    status: business.status as Business["status"],
    businessType: (business.business_type as string) ?? null,
    twilioNumber: (business.twilio_number as string) ?? null,
    stripePlanId: (business.stripe_plan_id as string) ?? null,
    stripeSubscriptionId: (business.stripe_subscription_id as string) ?? null,
    aiConfig: (business.ai_config as Record<string, unknown>) ?? null,
  }
}

export async function findBusinessMembership(client: SupabaseClient, userId: string) {
  const { data } = await client
    .schema("frontdesk")
    .from("business_members")
    .select("business_id")
    .eq("user_id", userId)
    .limit(1)
    .maybeSingle()

  return data as { business_id: string } | null
}
