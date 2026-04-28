import { Elysia } from "elysia"
import { createClient } from "@supabase/supabase-js"

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * Scoped middleware: validates a Supabase JWT from the Authorization header.
 * Use with .use(authMiddleware) on any route group that requires authentication.
 */
export const authMiddleware = new Elysia({ name: "auth" })
  .derive({ as: "scoped" }, async ({ headers }) => {
    const token = headers["authorization"]?.slice(7) // strip "Bearer "
    if (!token) return { user: null }
    const { data } = await supabase.auth.getUser(token)
    return { user: data.user ?? null }
  })
  .onBeforeHandle({ as: "scoped" }, ({ user, set }) => {
    if (!user) {
      set.status = 401
      return "Unauthorized"
    }
  })
