import { Elysia } from "elysia"
import { authMiddleware } from "../middleware/auth"
import { sendOptinConfirmation } from "../services/twilio"
import { db, users } from "@frontdesk/database"
import { eq } from "drizzle-orm"

export const authRoutes = new Elysia()
  .use(authMiddleware)

  // Send the A2P opt-in confirmation SMS immediately after signup verification.
  // Called once per new user — fire-and-forget from the client.
  .post("/auth/optin-confirm", async ({ user }) => {
    try {
      const [row] = await db
        .select({ phone: users.phone })
        .from(users)
        .where(eq(users.id, user!.id))
        .limit(1)

      if (!row?.phone) return { ok: true }
      await sendOptinConfirmation(row.phone)
    } catch (err) {
      console.error("[optin-confirm] failed:", err)
    }
    return { ok: true }
  })
