import { db } from "@frontdesk/database"
import { sql } from "drizzle-orm"

console.log("🔄 Backfilling existing auth users into public.users...")

await db.execute(sql`
  INSERT INTO public.users (id, email, full_name, phone, avatar_url, created_at, updated_at)
  SELECT
    id,
    email,
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name'),
    raw_user_meta_data->>'phone',
    raw_user_meta_data->>'avatar_url',
    created_at,
    NOW()
  FROM auth.users
  ON CONFLICT (id) DO NOTHING
`)

console.log("✅ Done — existing users synced to public.users")
