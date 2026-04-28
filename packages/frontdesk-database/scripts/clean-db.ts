import postgres from "postgres"

const sql = postgres(process.env.DATABASE_URL!)

// Delete in order respecting foreign keys
await sql`DELETE FROM public.calls`
await sql`DELETE FROM public.knowledge_base`
await sql`DELETE FROM public.business_members`
await sql`DELETE FROM public.businesses`
await sql`DELETE FROM public.users`

// Also clear Supabase auth users
const authUsers = await sql`SELECT id FROM auth.users`
for (const user of authUsers) {
  await sql`DELETE FROM auth.users WHERE id = ${user.id}`
}

console.log("✅ Database cleaned — all users, businesses, and calls deleted")
await sql.end()
