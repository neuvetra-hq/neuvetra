#!/usr/bin/env bun
/**
 * Deploy the Front Desk conversation flow + agent to Retell.
 *
 * Run from repo root:
 *   cd apps/api && bun run scripts/deploy-retell-agent.ts
 *
 * Prints the agent_id at the end — set it as RETELL_AGENT_ID on Railway.
 *
 * Re-running creates a NEW flow + agent each time.
 * To update an existing flow use retell.conversationFlow.update(id, params).
 */

import Retell from "retell-sdk"
import type { ConversationFlowCreateParams, AgentCreateParams } from "retell-sdk"

const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })

if (!Bun.env.RETELL_API_KEY) {
  console.error("RETELL_API_KEY is not set")
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const WEBHOOK_URL = "https://api.neuvetra.com/webhooks/retell"

// Node IDs — using original canvas IDs where kept, new IDs for new nodes
const IDS = {
  welcome:              "start-node-1775760615870",
  goodbye:              "end-call-node-1775760615870",
  book:                 "node-1775762232766",    // was empty conversation → now SubagentNode
  faq:                  "node-1775762263951",
  emergencyTransfer:    "node-1775762289649",
  speakToSomeone:       "node-1775762369658",
  takeMessageConv:      "node-1775762538467",
  wrapUp:               "node-1775763052801",
  cancelFind:           "node-cancel-find",
  cancelFound:          "node-cancel-found",
  cancelNotFound:       "node-cancel-not-found",
  rescheduleFind:       "node-reschedule-find",
  rescheduleFound:      "node-reschedule-found",
  rescheduleNotFound:   "node-reschedule-not-found",
  takeMessageFn:        "node-take-message-fn",
} as const

const TOOL_IDS = {
  checkAvailability:      "tool_check_availability",
  bookAppointment:        "tool_book_appointment",
  findAppointment:        "tool_find_appointment",
  cancelAppointment:      "tool_cancel_appointment",
  rescheduleAppointment:  "tool_reschedule_appointment",
  takeMessage:            "tool_take_message",
} as const

// ---------------------------------------------------------------------------
// Tools — all POST to the same webhook URL, dispatched by `name`
// ---------------------------------------------------------------------------

const tools: ConversationFlowCreateParams["tools"] = [
  {
    type: "custom",
    tool_id: TOOL_IDS.checkAvailability,
    name: "check_availability",
    description: "Check if a specific time slot is available for booking. Call this when the caller proposes a date/time.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        requested_time: {
          type: "string",
          description: "The requested appointment time as an ISO 8601 string (e.g. 2026-04-21T14:00:00). Use the business timezone.",
        },
        duration_minutes: {
          type: "number",
          description: "Appointment duration in minutes. Default 60 if not specified.",
        },
      },
      required: ["requested_time"],
    },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me check availability for that time.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.bookAppointment,
    name: "book_appointment",
    description: "Book an appointment once a specific time has been confirmed as available. Requires customer name, phone, start time, and reason.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        start_time: {
          type: "string",
          description: "Confirmed appointment start time as ISO 8601 string.",
        },
        duration_minutes: {
          type: "number",
          description: "Appointment duration in minutes. Default 60.",
        },
        customer_name: {
          type: "string",
          description: "Full name of the customer.",
        },
        customer_phone: {
          type: "string",
          description: "Customer callback phone number.",
        },
        customer_email: {
          type: "string",
          description: "Customer email address (optional).",
        },
        reason: {
          type: "string",
          description: "Reason for the appointment or type of service needed.",
        },
      },
      required: ["start_time", "customer_name", "customer_phone", "reason"],
    },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me get that booked for you.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.findAppointment,
    name: "find_appointment",
    description: "Look up the caller's upcoming appointments using their phone number. Takes no parameters — the backend identifies the caller automatically. Always call this first when cancelling or rescheduling.",
    url: WEBHOOK_URL,
    method: "POST",
    // No parameters — backend uses the caller's from_number
    response_variables: {
      // Extracts appointments array from response body so it's available as {{appointments_json}}
      // Only present in response when appointments exist; undefined otherwise
      appointments_json: "appointments",
    },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me look up your appointments, one moment.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.cancelAppointment,
    name: "cancel_appointment",
    description: "Cancel a specific appointment by its event_id. The event_id must come from a prior find_appointment result — never ask the caller for it.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The event_id of the appointment to cancel. Extract this from the appointments_json variable — do NOT ask the caller.",
        },
      },
      required: ["event_id"],
    },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me take care of that cancellation for you.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.rescheduleAppointment,
    name: "reschedule_appointment",
    description: "Reschedule a specific appointment to a new time. The event_id comes from find_appointment — never ask the caller for it.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "The event_id of the appointment to reschedule. Extract from appointments_json — do NOT ask the caller.",
        },
        new_start_time: {
          type: "string",
          description: "The new appointment start time as an ISO 8601 string.",
        },
        duration_minutes: {
          type: "number",
          description: "Appointment duration in minutes. Default 60.",
        },
      },
      required: ["event_id", "new_start_time"],
    },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me get that rescheduled for you.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.takeMessage,
    name: "take_message",
    description: "Save a callback message from the caller. Call this after collecting their name, phone, and reason for calling.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        caller_name: {
          type: "string",
          description: "Full name of the caller.",
        },
        caller_phone: {
          type: "string",
          description: "Callback phone number for the caller.",
        },
        message: {
          type: "string",
          description: "Brief summary of why they called and what they need.",
        },
      },
      required: ["message"],
    },
    speak_during_execution: false,
    speak_after_execution: true,
    execution_message_description: "I've noted that down.",
  },
]

// ---------------------------------------------------------------------------
// Nodes
// ---------------------------------------------------------------------------

const nodes: ConversationFlowCreateParams["nodes"] = [

  // -------------------------------------------------------------------------
  // Welcome — agent speaks first, routes to 7 branches
  // -------------------------------------------------------------------------
  {
    id: IDS.welcome,
    type: "conversation",
    name: "Welcome",
    start_speaker: "agent",
    instruction: {
      type: "static_text",
      text: "Thank you for calling {{business_name}}, my name is {{agent_name}}, how can I help you today?",
    },
    edges: [
      {
        id: "edge-welcome-book",
        destination_node_id: IDS.book,
        transition_condition: { type: "prompt", prompt: "Caller wants to schedule, book, or make an appointment" },
      },
      {
        id: "edge-welcome-reschedule",
        destination_node_id: IDS.rescheduleFind,
        transition_condition: { type: "prompt", prompt: "Caller wants to reschedule or modify an appointment" },
      },
      {
        id: "edge-welcome-cancel",
        destination_node_id: IDS.cancelFind,
        transition_condition: { type: "prompt", prompt: "Caller wants to cancel an appointment" },
      },
      {
        id: "edge-welcome-faq",
        destination_node_id: IDS.faq,
        transition_condition: { type: "prompt", prompt: "Caller has a question about hours, services, pricing, or location" },
      },
      {
        id: "edge-welcome-emergency",
        destination_node_id: IDS.emergencyTransfer,
        transition_condition: { type: "prompt", prompt: "Caller describes an urgent or emergency situation" },
      },
      {
        id: "edge-welcome-speak",
        destination_node_id: IDS.speakToSomeone,
        transition_condition: { type: "prompt", prompt: "Caller asks to speak to a person, owner, or staff member" },
      },
      {
        id: "edge-welcome-message",
        destination_node_id: IDS.takeMessageConv,
        transition_condition: { type: "prompt", prompt: "Caller wants to leave a message or be called back" },
      },
    ],
    display_position: { x: 630, y: -522 },
  } as ConversationFlowCreateParams.ConversationNode,

  // -------------------------------------------------------------------------
  // Goodbye — end call
  // -------------------------------------------------------------------------
  {
    id: IDS.goodbye,
    type: "end",
    name: "Goodbye",
    instruction: { type: "prompt", text: "Politely end the call" },
    display_position: { x: 3400, y: 510 },
  } as ConversationFlowCreateParams.EndNode,

  // -------------------------------------------------------------------------
  // Book Appointment — SubagentNode with check_availability + book_appointment
  // LLM handles the full back-and-forth of checking slots and confirming
  // -------------------------------------------------------------------------
  {
    id: IDS.book,
    type: "subagent",
    name: "Book Appointment",
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
    display_position: { x: 1302, y: -1800 },
  } as ConversationFlowCreateParams.SubagentNode,

  // -------------------------------------------------------------------------
  // Answer FAQ
  // -------------------------------------------------------------------------
  {
    id: IDS.faq,
    type: "conversation",
    name: "Answer FAQ",
    instruction: {
      type: "prompt",
      text: `A caller has a question about {{business_name}}. Answer using ONLY the information in {{knowledge_base}}.
If the answer is not in the knowledge base say exactly: "I don't have that information on hand, but I can take a message and have someone call you back."
Never guess or make up details.
After answering, ask: "Is there anything else I can help you with?"`,
    },
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
    display_position: { x: 1590, y: -18 },
  } as ConversationFlowCreateParams.ConversationNode,

  // -------------------------------------------------------------------------
  // Emergency Transfer
  // -------------------------------------------------------------------------
  {
    id: IDS.emergencyTransfer,
    type: "transfer_call",
    name: "Emergency Transfer",
    transfer_destination: { type: "predefined", number: "+16507434932" },
    transfer_option: {
      type: "cold_transfer",
      show_transferee_as_caller: false,
      enable_bridge_audio_cue: true,
    },
    edge: {
      id: "edge-emergency-fallback",
      destination_node_id: IDS.takeMessageConv,
      transition_condition: { type: "prompt", prompt: "Transfer failed" },
    },
    speak_during_execution: false,
    custom_sip_headers: {},
    ignore_e164_validation: false,
    display_position: { x: 1590, y: 558 },
  } as ConversationFlowCreateParams.TransferCallNode,

  // -------------------------------------------------------------------------
  // Speak to Someone
  // -------------------------------------------------------------------------
  {
    id: IDS.speakToSomeone,
    type: "conversation",
    name: "Speak to Someone",
    instruction: {
      type: "prompt",
      text: `The caller wants to speak to a staff member or the owner. Acknowledge them warmly, let them know staff are currently unavailable, and offer two options:
leave a message and someone will call back, or if it's urgent they can be transferred immediately.`,
    },
    edges: [
      {
        id: "edge-speak-message",
        destination_node_id: IDS.takeMessageConv,
        transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" },
      },
      {
        id: "edge-speak-emergency",
        destination_node_id: IDS.emergencyTransfer,
        transition_condition: { type: "prompt", prompt: "Caller says it's urgent or wants immediate transfer" },
      },
    ],
    display_position: { x: 1590, y: 750 },
  } as ConversationFlowCreateParams.ConversationNode,

  // -------------------------------------------------------------------------
  // Take a Message — conversation collects name + phone + reason
  // -------------------------------------------------------------------------
  {
    id: IDS.takeMessageConv,
    type: "conversation",
    name: "Take a Message",
    instruction: {
      type: "prompt",
      text: `Collect the caller's name, callback phone number, and a brief reason for their call. Ask for one piece of information at a time.
Start by saying "I'd be happy to take a message, can I get your name please?"
Do not transition until you have their name, a phone number, and what they need.`,
    },
    edges: [
      {
        id: "edge-takemsg-fn",
        destination_node_id: IDS.takeMessageFn,
        transition_condition: {
          type: "prompt",
          prompt: "Agent has collected caller's full name, callback phone number, and reason for calling",
        },
      },
    ],
    display_position: { x: 1614, y: 1230 },
  } as ConversationFlowCreateParams.ConversationNode,

  // -------------------------------------------------------------------------
  // Take Message — FunctionNode: always saves the message via API
  // -------------------------------------------------------------------------
  {
    id: IDS.takeMessageFn,
    type: "function",
    name: "Save Message",
    tool_id: TOOL_IDS.takeMessage,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "One moment while I note that down." },
    edges: [
      {
        id: "edge-takemsgfn-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: { type: "prompt", prompt: "Function completed" },
      },
    ],
    display_position: { x: 2300, y: 1230 },
  } as ConversationFlowCreateParams.FunctionNode,

  // -------------------------------------------------------------------------
  // Wrap Up
  // -------------------------------------------------------------------------
  {
    id: IDS.wrapUp,
    type: "subagent",
    name: "Wrap Up",
    instruction: {
      type: "prompt",
      text: `You just completed a task for the caller. Ask: "Is there anything else I can help you with today?"

If they have another request, route them to the appropriate flow via the edges below.

If they say no, say thanks, say bye, or indicate they are done:
1. Say a brief warm farewell — thank them by name if you have it, say goodbye on behalf of {{business_name}}, end with "Have a great day!"
2. IMMEDIATELY call end_call to hang up.

CRITICAL: You MUST call end_call when the caller is done. Do not wait for them to hang up.`,
    },
    tools: [
      {
        type: "end_call",
        name: "end_call",
        description: "Terminate the call. Use this immediately after saying goodbye when the caller indicates they are done.",
      },
    ],
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
    ],
    display_position: { x: 2900, y: 294 },
  } as ConversationFlowCreateParams.SubagentNode,

  // =========================================================================
  // CANCEL FLOW
  // =========================================================================

  // -------------------------------------------------------------------------
  // Cancel: Step 1 — FunctionNode always runs find_appointment
  // -------------------------------------------------------------------------
  {
    id: IDS.cancelFind,
    type: "function",
    name: "Find Appointments (Cancel)",
    tool_id: TOOL_IDS.findAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me look up your appointments, one moment." },
    edges: [
      {
        id: "edge-cancelFind-found",
        destination_node_id: IDS.cancelFound,
        transition_condition: {
          type: "equation",
          operator: "&&",
          equations: [{ left: "{{appointments_json}}", operator: "exists" }],
        },
      },
    ],
    else_edge: {
      id: "edge-cancelFind-notfound",
      destination_node_id: IDS.cancelNotFound,
      transition_condition: { type: "prompt", prompt: "Else" },
    },
    display_position: { x: 1302, y: -700 },
  } as ConversationFlowCreateParams.FunctionNode,

  // -------------------------------------------------------------------------
  // Cancel: Step 2a — SubagentNode: present results, confirm, cancel
  // -------------------------------------------------------------------------
  {
    id: IDS.cancelFound,
    type: "subagent",
    name: "Confirm & Cancel",
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
    display_position: { x: 2100, y: -700 },
  } as ConversationFlowCreateParams.SubagentNode,

  // -------------------------------------------------------------------------
  // Cancel: Step 2b — No appointments found
  // -------------------------------------------------------------------------
  {
    id: IDS.cancelNotFound,
    type: "conversation",
    name: "No Appointments (Cancel)",
    instruction: {
      type: "prompt",
      text: `The find_appointment function returned no results — the caller has no upcoming appointments linked to their number. This was already communicated to them. Ask if there's anything else you can help them with today.`,
    },
    edges: [
      {
        id: "edge-cancelNotFound-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: { type: "prompt", prompt: "Caller has no further requests" },
      },
      {
        id: "edge-cancelNotFound-message",
        destination_node_id: IDS.takeMessageConv,
        transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" },
      },
    ],
    display_position: { x: 2100, y: -500 },
  } as ConversationFlowCreateParams.ConversationNode,

  // =========================================================================
  // RESCHEDULE FLOW
  // =========================================================================

  // -------------------------------------------------------------------------
  // Reschedule: Step 1 — FunctionNode always runs find_appointment
  // -------------------------------------------------------------------------
  {
    id: IDS.rescheduleFind,
    type: "function",
    name: "Find Appointments (Reschedule)",
    tool_id: TOOL_IDS.findAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me look up your appointments, one moment." },
    edges: [
      {
        id: "edge-rescheduleFind-found",
        destination_node_id: IDS.rescheduleFound,
        transition_condition: {
          type: "equation",
          operator: "&&",
          equations: [{ left: "{{appointments_json}}", operator: "exists" }],
        },
      },
    ],
    else_edge: {
      id: "edge-rescheduleFind-notfound",
      destination_node_id: IDS.rescheduleNotFound,
      transition_condition: { type: "prompt", prompt: "Else" },
    },
    display_position: { x: 1302, y: -1200 },
  } as ConversationFlowCreateParams.FunctionNode,

  // -------------------------------------------------------------------------
  // Reschedule: Step 2a — SubagentNode: present, collect new time, reschedule
  // -------------------------------------------------------------------------
  {
    id: IDS.rescheduleFound,
    type: "subagent",
    name: "Confirm & Reschedule",
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
    display_position: { x: 2100, y: -1200 },
  } as ConversationFlowCreateParams.SubagentNode,

  // -------------------------------------------------------------------------
  // Reschedule: Step 2b — No appointments found
  // -------------------------------------------------------------------------
  {
    id: IDS.rescheduleNotFound,
    type: "conversation",
    name: "No Appointments (Reschedule)",
    instruction: {
      type: "prompt",
      text: `The find_appointment function returned no results — the caller has no upcoming appointments linked to their number. This was already communicated. Ask if there's anything else you can help them with.`,
    },
    edges: [
      {
        id: "edge-rescheduleNotFound-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: { type: "prompt", prompt: "Caller has no further requests" },
      },
      {
        id: "edge-rescheduleNotFound-message",
        destination_node_id: IDS.takeMessageConv,
        transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" },
      },
    ],
    display_position: { x: 2100, y: -1000 },
  } as ConversationFlowCreateParams.ConversationNode,
]

// ---------------------------------------------------------------------------
// Global Prompt — kept from original canvas export
// ---------------------------------------------------------------------------

const GLOBAL_PROMPT = `# IDENTITY
You are {{agent_name}}, a professional AI receptionist for {{business_name}}, a {{business_type}} business. You answer inbound calls on behalf of this business 24/7 when staff are unavailable.

# YOUR JOB
Your only job is to:
1. Greet the caller warmly and represent the business professionally
2. Answer questions using ONLY the knowledge base provided
3. Check availability and book appointments when requested
4. Transfer emergencies to the owner immediately
5. Take a message if you cannot help

# STRICT RULES — FOLLOW THESE WITHOUT EXCEPTION

## Hallucination Prevention
- NEVER invent prices, hours, services, or policies not in your knowledge base
- If you do not know the answer, say exactly: "I don't have that information on hand, but I can take your name and number and have someone call you back."
- NEVER guess or estimate. No "I think" or "probably" about business details.

## Stay In Scope
- You represent {{business_name}} ONLY. Do not discuss competitors.
- Do not answer questions unrelated to this business (no general advice, no medical diagnoses, no legal advice, no weather, etc.)
- If asked something off-topic, redirect: "I'm only able to help with questions about {{business_name}}. Is there something I can help you with?"

## Identity
- Never reveal you are an AI unless directly and sincerely asked
- If asked, say: "I'm a virtual receptionist for {{business_name}}."
- Never mention Retell, OpenAI, or any technology vendor

## Tone & Style
- Speak in short, natural sentences — this is a phone call, not an email
- Never say "Certainly!", "Absolutely!", or "Of course!" — sound human, not robotic
- Use the caller's name once you have it
- Be warm but efficient — respect the caller's time

## Booking
- Only offer times that come back from the availability check tool
- Never promise a time without checking first
- Always confirm: name, callback number, and appointment time before booking

## Emergencies
- If the caller describes an urgent situation (flooding, burst pipe, chest pain, severe injury, fire), immediately say: "I'm going to connect you with someone right now" and trigger the transfer — do not delay

## Ending a Call
- Always end with the business name: "Thanks for calling {{business_name}}, have a great day!"
- Never just hang up without a closing

# KNOWLEDGE BASE
{{knowledge_base}}

# BUSINESS CONTEXT
- Business name: {{business_name}}
- Business type: {{business_type}}
- Owner emergency contact: {{owner_phone}}`

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------

console.log("Creating conversation flow...")

const flow = await retell.conversationFlow.create({
  start_speaker:        "agent",
  model_choice:         { type: "cascading", model: "gpt-5.1" },
  start_node_id:        IDS.welcome,
  global_prompt:        GLOBAL_PROMPT,
  tool_call_strict_mode: true,
  knowledge_base_ids:   [],
  kb_config:            { top_k: 3, filter_score: 0.6 },
  tools,
  nodes,
})

console.log(`✓ Conversation flow created: ${flow.conversation_flow_id}`)

console.log("Creating agent...")

const agent = await retell.agent.create({
  response_engine: {
    type: "conversation-flow",
    conversation_flow_id: flow.conversation_flow_id,
  },
  voice_id:                 "retell-Cimo",
  agent_name:               "Front Desk Agent",
  webhook_url:              WEBHOOK_URL,
  max_call_duration_ms:     3600000,
  interruption_sensitivity: 0.9,
  normalize_for_speech:     false,
  allow_user_dtmf:          true,
  post_call_analysis_model: "gpt-4.1-mini",
  language:                 "en-US",
  handbook_config: {
    default_personality: true,
    natural_filler_words: true,
    ai_disclosure:        true,
  },
} as AgentCreateParams)

console.log(`✓ Agent created: ${agent.agent_id}`)
console.log("")
console.log("Next steps:")
console.log(`  1. Set RETELL_AGENT_ID=${agent.agent_id} on Railway`)
console.log(`  2. Set webhook URL in Retell dashboard → ${WEBHOOK_URL}`)
console.log(`  3. Check the agent in Retell canvas: https://app.retellai.com`)
