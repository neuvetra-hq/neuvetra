import postgres from "postgres"

const sql = postgres(process.env.DATABASE_URL!)

const [authUsers] = await sql`SELECT COUNT(*)::int AS count FROM auth.users`
const [users] = await sql`SELECT COUNT(*)::int AS count FROM public.users`
const [businesses] = await sql`SELECT COUNT(*)::int AS count FROM public.businesses`
const [members] = await sql`SELECT COUNT(*)::int AS count FROM public.business_members`

console.log(`auth.users:    ${authUsers.count}`)
console.log(`public.users:  ${users.count}`)
console.log(`businesses:    ${businesses.count}`)
console.log(`members:       ${members.count}`)

await sql.end()
