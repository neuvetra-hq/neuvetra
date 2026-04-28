#!/usr/bin/env bun
/**
 * Patch all SubagentNodes on the live conversation flow to fix:
 * 1. Book Appointment — LLM was skipping book_appointment tool call
 * 2. Cancel Found    — LLM was skipping cancel_appointment tool call
 * 3. Reschedule Found — LLM was skipping reschedule_appointment tool call
 * 4. Wrap Up         — Add edges back to book/cancel/reschedule for multi-task calls
 * 5. FAQ             — Add edges to cancel/reschedule
 * 6. Timezone        — Add timezone guidance to booking nodes
 *
 * Run: cd apps/api && RETELL_API_KEY=... bun run scripts/update-book-node.ts
 */

import Retell from "retell-sdk"

const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })

if (!Bun.env.RETELL_API_KEY) {
  console.error("RETELL_API_KEY is not set")
  process.exit(1)
}

const FLOW_ID = "conversation_flow_f581aa0a8f5f"

const IDS = {
  welcome:            "start-node-1775760615870",
  goodbye:            "end-call-node-1775760615870",
  book:               "node-1775762232766",
  faq:                "node-1775762263951",
  emergencyTransfer:  "node-1775762289649",
  speakToSomeone:     "node-1775762369658",
  takeMessageConv:    "node-1775762538467",
  wrapUp:             "node-1775763052801",
  cancelFind:         "node-cancel-find",
  cancelFound:        "node-cancel-found",
  cancelNotFound:     "node-cancel-not-found",
  rescheduleFind:     "node-reschedule-find",
  rescheduleFound:    "node-reschedule-found",
  rescheduleNotFound: "node-reschedule-not-found",
  takeMessageFn:      "node-take-message-fn",
} as const

const TOOL_IDS = {
  checkAvailability:     "tool_check_availability",
  bookAppointment:       "tool_book_appointment",
  findAppointment:       "tool_find_appointment",
  cancelAppointment:     "tool_cancel_appointment",
  rescheduleAppointment: "tool_reschedule_appointment",
  takeMessage:           "tool_take_message",
} as const

console.log("Fetching current flow...")
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const flow = await retell.conversationFlow.retrieve(FLOW_ID) as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodes = flow.nodes as any[]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const updatedNodes = nodes.map((node: any) => {

  // -------------------------------------------------------------------------
  // Book Appointment — enforce tool call before confirming
  // -------------------------------------------------------------------------
  if (node.id === IDS.book) {
    return {
      ...node,
      instruction: {
        type: "prompt",
        text: `Help the caller book an appointment at {{business_name}}.

Steps:
1. Ask for their preferred date and time, and the reason/service if not already known
2. Call check_availability with requested_time as ISO 8601 — NEVER promise a time before checking
   - Times are in the business local timezone. If the caller says "Monday at 11 AM", use that literally as the local time (e.g. 2026-04-21T11:00:00)
3. If available, confirm with the caller: "I have [day] at [time] available, shall I book that for you?"
4. Collect full name and callback phone number
5. YOU MUST call book_appointment with all details before saying anything is confirmed

CRITICAL:
- Do NOT say "booked", "confirmed", "all set", or any synonym until AFTER book_appointment returns successfully
- Do NOT exit or wrap up this node until book_appointment has been called and returned a success result
- If book_appointment returns an error or alternative times, relay that to the caller and try again
- Read the confirmed time back from the tool result, not from memory`,
      },
      tool_ids: [TOOL_IDS.checkAvailability, TOOL_IDS.bookAppointment],
      edges: [
        {
          id: "edge-book-wrapup",
          destination_node_id: IDS.wrapUp,
          transition_condition: {
            type: "prompt",
            prompt: "book_appointment tool was called and returned successfully AND the confirmed booking was read back to the caller",
          },
        },
      ],
    }
  }

  // -------------------------------------------------------------------------
  // Confirm & Cancel — enforce cancel_appointment tool call
  // -------------------------------------------------------------------------
  if (node.id === IDS.cancelFound) {
    return {
      ...node,
      instruction: {
        type: "prompt",
        text: `You have just retrieved the caller's upcoming appointments. They are in {{appointments_json}} as a JSON array with fields: eventId, summary, startTime.

Steps:
1. Present the appointments clearly — e.g. "I see you have: 1. [reason] on [date], 2. [reason] on [date]. Which would you like to cancel?"
2. When the caller identifies one, match it to the correct eventId from {{appointments_json}}
3. Confirm: "Just to confirm — you'd like to cancel [description] on [date]. Is that correct?"
4. YOU MUST call cancel_appointment with the correct event_id

CRITICAL:
- Do NOT say "cancelled", "done", "taken care of", or any synonym until AFTER cancel_appointment returns successfully
- Do NOT exit or wrap up until cancel_appointment has been called and returned a success result
- Never ask the caller for an event_id — extract it from {{appointments_json}} yourself
- If cancel_appointment returns an error, tell the caller and offer to take a message`,
      },
      tool_ids: [TOOL_IDS.cancelAppointment],
      edges: [
        {
          id: "edge-cancelFound-wrapup",
          destination_node_id: IDS.wrapUp,
          transition_condition: {
            type: "prompt",
            prompt: "cancel_appointment tool was called and returned successfully AND cancellation confirmed to caller, OR caller decided not to cancel",
          },
        },
      ],
    }
  }

  // -------------------------------------------------------------------------
  // Confirm & Reschedule — enforce reschedule_appointment tool call
  // -------------------------------------------------------------------------
  if (node.id === IDS.rescheduleFound) {
    return {
      ...node,
      instruction: {
        type: "prompt",
        text: `You have just retrieved the caller's upcoming appointments. They are in {{appointments_json}} as a JSON array with fields: eventId, summary, startTime.

Steps:
1. Present the appointments — ask which one they want to reschedule
2. When identified, match it to the correct eventId from {{appointments_json}}
3. Ask for their preferred new date and time
4. Call check_availability with the new time as ISO 8601 local time (e.g. 2026-04-21T11:00:00) — NEVER promise a time before checking
5. Once availability is confirmed, confirm: "I can reschedule [old appointment] to [new time] — does that work?"
6. YOU MUST call reschedule_appointment with event_id and new_start_time

CRITICAL:
- Do NOT say "rescheduled", "updated", "all set", or any synonym until AFTER reschedule_appointment returns successfully
- Do NOT exit or wrap up until reschedule_appointment has been called and returned a success result
- Never ask the caller for an event_id — extract it from {{appointments_json}} yourself
- If reschedule_appointment returns an error or the slot is taken, relay that to the caller and offer alternatives`,
      },
      tool_ids: [TOOL_IDS.checkAvailability, TOOL_IDS.rescheduleAppointment],
      edges: [
        {
          id: "edge-rescheduleFound-wrapup",
          destination_node_id: IDS.wrapUp,
          transition_condition: {
            type: "prompt",
            prompt: "reschedule_appointment tool was called and returned successfully AND new appointment details confirmed to caller, OR caller decided not to reschedule",
          },
        },
      ],
    }
  }

  // -------------------------------------------------------------------------
  // Wrap Up — add edges so caller can do a second task instead of just hanging up
  // -------------------------------------------------------------------------
  if (node.id === IDS.wrapUp) {
    return {
      ...node,
      instruction: {
        type: "prompt",
        text: `You just completed a task for the caller. Ask: "Is there anything else I can help you with today?" If not, thank them by name if you have it, say goodbye on behalf of {{business_name}}, and end with "Have a great day!" Keep it to 1-2 sentences.`,
      },
      edges: [
        {
          id: "edge-wrapup-book",
          destination_node_id: IDS.book,
          transition_condition: { type: "prompt", prompt: "Caller wants to book an appointment" },
        },
        {
          id: "edge-wrapup-cancel",
          destination_node_id: IDS.cancelFind,
          transition_condition: { type: "prompt", prompt: "Caller wants to cancel an appointment" },
        },
        {
          id: "edge-wrapup-reschedule",
          destination_node_id: IDS.rescheduleFind,
          transition_condition: { type: "prompt", prompt: "Caller wants to reschedule an appointment" },
        },
        {
          id: "edge-wrapup-faq",
          destination_node_id: IDS.faq,
          transition_condition: { type: "prompt", prompt: "Caller has another question" },
        },
        {
          id: "edge-wrapup-message",
          destination_node_id: IDS.takeMessageConv,
          transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" },
        },
        {
          id: "edge-wrapup-goodbye",
          destination_node_id: IDS.goodbye,
          transition_condition: { type: "prompt", prompt: "Caller has no more requests and is ready to hang up" },
        },
      ],
    }
  }

  // -------------------------------------------------------------------------
  // FAQ — add edges to cancel and reschedule (were missing before)
  // -------------------------------------------------------------------------
  if (node.id === IDS.faq) {
    return {
      ...node,
      edges: [
        {
          id: "edge-faq-wrapup",
          destination_node_id: IDS.wrapUp,
          transition_condition: { type: "prompt", prompt: "Caller has no more questions and is satisfied" },
        },
        {
          id: "edge-faq-book",
          destination_node_id: IDS.book,
          transition_condition: { type: "prompt", prompt: "Caller wants to book an appointment" },
        },
        {
          id: "edge-faq-cancel",
          destination_node_id: IDS.cancelFind,
          transition_condition: { type: "prompt", prompt: "Caller wants to cancel an appointment" },
        },
        {
          id: "edge-faq-reschedule",
          destination_node_id: IDS.rescheduleFind,
          transition_condition: { type: "prompt", prompt: "Caller wants to reschedule an appointment" },
        },
        {
          id: "edge-faq-message",
          destination_node_id: IDS.takeMessageConv,
          transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" },
        },
        {
          id: "edge-faq-speak",
          destination_node_id: IDS.speakToSomeone,
          transition_condition: { type: "prompt", prompt: "Caller wants to be called back or speak to someone" },
        },
      ],
    }
  }

  return node
})

console.log("Pushing updated nodes to flow...")
await retell.conversationFlow.update(FLOW_ID, { nodes: updatedNodes })

console.log("✅ Flow updated successfully. Changes:")
console.log("  - Book Appointment: enforced book_appointment tool call before confirming")
console.log("  - Cancel Found:     enforced cancel_appointment tool call before confirming")
console.log("  - Reschedule Found: enforced reschedule_appointment tool call before confirming")
console.log("  - Wrap Up:          added edges back to all task nodes (multi-task calls)")
console.log("  - FAQ:              added edges to cancel and reschedule")
console.log("  - Booking nodes:    added timezone guidance for ISO time formatting")
