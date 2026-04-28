/**
 * Owner notification service.
 *
 * Sends a single SMS to the business owner's personal mobile number whenever
 * a caller books, reschedules, or cancels an appointment via the AI receptionist.
 *
 * Failures are logged but never thrown — notifications must never interrupt
 * the response returned to Retell.
 */

import { db, businesses, businessMembers, users } from "@frontdesk/database"
import { eq, and } from "drizzle-orm"
import { sendSms } from "./twilio"

export async function notifyOwnerAppointment(
  businessId: string,
  action: "booked" | "cancelled" | "rescheduled",
  detail: {
    customerName:  string
    customerPhone: string
    when?:         string   // human-readable time string (already formatted for speech)
    reason?:       string
  },
): Promise<void> {
  try {
    // Look up business twilioNumber + owner's personal phone in one round-trip
    const [row] = await db
      .select({
        twilioNumber: businesses.twilioNumber,
        ownerPhone:   users.phone,
        businessName: businesses.name,
      })
      .from(businesses)
      .innerJoin(businessMembers, eq(businessMembers.businessId, businesses.id))
      .innerJoin(users, eq(users.id, businessMembers.userId))
      .where(
        and(
          eq(businesses.id, businessId),
          eq(businessMembers.role, "owner"),
        ),
      )
      .limit(1)

    if (!row?.ownerPhone || !row?.twilioNumber) {
      console.warn(`notifyOwner [${action}]: no owner phone or twilio number for business ${businessId}`)
      return
    }

    const emoji =
      action === "booked"      ? "📅" :
      action === "rescheduled" ? "🔄" :
                                 "❌"

    const lines = [
      `${emoji} Front Desk — Appointment ${action}`,
      `Customer: ${detail.customerName || "Unknown"} (${detail.customerPhone})`,
    ]
    if (detail.when)   lines.push(`Time: ${detail.when}`)
    if (detail.reason) lines.push(`Reason: ${detail.reason}`)
    // No URL — A2P 10DLC campaign was registered without link-sending

    console.log(`notifyOwner [${action}]: sending SMS from ${row.twilioNumber} to ${row.ownerPhone}`)
    await sendSms(row.ownerPhone, row.twilioNumber, lines.join("\n"))
    console.log(`notifyOwner [${action}]: SMS sent OK`)
  } catch (err) {
    // Never let notification errors surface to the caller
    console.error(`notifyOwner [${action}]: SMS failed:`, err)
  }
}
