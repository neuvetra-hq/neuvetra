#!/usr/bin/env bun
/**
 * Full flow refactor — replaces SubagentNode API calls with:
 *   SubagentNode (conversation only) → ExtractDynamicVariablesNode → FunctionNode (guaranteed API call) → ConversationNode (confirm)
 *
 * New architecture per flow:
 *
 * BOOK:    Welcome → book-collect (SubagentNode: check_availability, collect info)
 *                  → book-extract (ExtractDynamic: start_time, customer_name, customer_phone, reason)
 *                  → book-api    (FunctionNode: book_appointment — guaranteed)
 *                  → book-confirm (ConversationNode: read back result)
 *                  → Wrap Up
 *
 * CANCEL:  cancelFind (FunctionNode: find_appointment) → branch
 *                  → cancel-present (ConversationNode: present, select, confirm)
 *                  → cancel-extract (ExtractDynamic: event_id)
 *                  → cancel-api    (FunctionNode: cancel_appointment — guaranteed)
 *                  → cancel-confirm (ConversationNode: confirm cancellation)
 *                  → Wrap Up
 *
 * RESCHEDULE: rescheduleFind → branch
 *                  → reschedule-collect (SubagentNode: select appt, get new time, check_availability)
 *                  → reschedule-extract (ExtractDynamic: event_id, new_start_time)
 *                  → reschedule-api    (FunctionNode: reschedule_appointment — guaranteed)
 *                  → reschedule-confirm (ConversationNode: confirm new appt)
 *                  → Wrap Up
 *
 * TAKE MSG: takeMessageConv → take-msg-extract (ExtractDynamic) → takeMessageFn → Wrap Up
 *
 * Run: cd apps/api && RETELL_API_KEY=... bun run scripts/refactor-retell-flow.ts
 */

import Retell from "retell-sdk"
import type { ConversationFlowCreateParams } from "retell-sdk"

const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })

if (!Bun.env.RETELL_API_KEY) {
  console.error("RETELL_API_KEY is not set")
  process.exit(1)
}

const FLOW_ID      = "conversation_flow_f581aa0a8f5f"
const WEBHOOK_URL  = "https://api.neuvetra.com/webhooks/retell"

// ---------------------------------------------------------------------------
// IDs
// ---------------------------------------------------------------------------

const IDS = {
  // Existing — kept
  welcome:              "start-node-1775760615870",
  goodbye:              "end-call-node-1775760615870",
  faq:                  "node-1775762263951",
  emergencyTransfer:    "node-1775762289649",
  speakToSomeone:       "node-1775762369658",
  takeMessageConv:      "node-1775762538467",
  takeMessageFn:        "node-take-message-fn",
  wrapUp:               "node-1775763052801",
  cancelFind:           "node-cancel-find",
  cancelNotFound:       "node-cancel-not-found",
  rescheduleFind:       "node-reschedule-find",
  rescheduleNotFound:   "node-reschedule-not-found",

  // Book flow — new nodes
  bookCollect:          "node-book-collect",
  bookExtract:          "node-book-extract",
  bookApi:              "node-book-api",
  bookConfirm:          "node-book-confirm",

  // Cancel flow — new nodes (replaces cancelFound SubagentNode)
  cancelPresent:        "node-cancel-present",
  cancelExtract:        "node-cancel-extract",
  cancelApi:            "node-cancel-api",
  cancelConfirm:        "node-cancel-confirm",

  // Reschedule flow — new nodes (replaces rescheduleFound SubagentNode)
  rescheduleCollect:    "node-reschedule-collect",
  rescheduleExtract:    "node-reschedule-extract",
  rescheduleApi:        "node-reschedule-api",
  rescheduleConfirm:    "node-reschedule-confirm",

  // Take message — new extract node
  takeMsgExtract:       "node-take-msg-extract",
} as const

const TOOL_IDS = {
  checkAvailability:     "tool_check_availability",
  bookAppointment:       "tool_book_appointment",
  findAppointment:       "tool_find_appointment",
  cancelAppointment:     "tool_cancel_appointment",
  rescheduleAppointment: "tool_reschedule_appointment",
  takeMessage:           "tool_take_message",
} as const

// ---------------------------------------------------------------------------
// Flow-level tools (used by FunctionNodes via tool_id)
// ---------------------------------------------------------------------------

const tools: ConversationFlowCreateParams["tools"] = [
  {
    type: "custom",
    tool_id: TOOL_IDS.checkAvailability,
    name: "check_availability",
    description: "Check if a specific time slot is available. Pass requested_time as ISO 8601 local time (e.g. 2026-04-21T11:00:00). Returns available confirmation or closest alternatives.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        requested_time: {
          type: "string",
          description: "Requested appointment time as ISO 8601 local time string",
        },
        duration_minutes: {
          type: "number",
          description: "Duration in minutes. Default 60.",
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
    description: "Create a confirmed appointment on the calendar. Only call after availability is confirmed and caller has given name, phone, and reason.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        // FunctionNode: use const + dynamic variables — no LLM inference needed
        start_time:       { type: "string", const: "{{start_time}}" },
        duration_minutes: { type: "number", description: "Duration in minutes. Default 60." },
        customer_name:    { type: "string", const: "{{customer_name}}" },
        customer_phone:   { type: "string", const: "{{customer_phone}}" },
        customer_email:   { type: "string", description: "Customer email (optional)" },
        reason:           { type: "string", const: "{{reason}}" },
      },
      required: ["start_time", "customer_name", "customer_phone", "reason"],
    },
    speak_during_execution: true,
    speak_after_execution: false,
    execution_message_description: "Let me get that booked for you.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.findAppointment,
    name: "find_appointment",
    description: "Look up the caller's upcoming appointments. No parameters needed — uses caller phone automatically.",
    url: WEBHOOK_URL,
    method: "POST",
    response_variables: { appointments_json: "appointments" },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me look up your appointments.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.cancelAppointment,
    name: "cancel_appointment",
    description: "Cancel a specific appointment by event_id. The event_id must come from find_appointment — never ask the caller.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        // FunctionNode: event_id is extracted by cancelExtract — use const, no LLM inference
        event_id: { type: "string", const: "{{event_id}}" },
      },
      required: ["event_id"],
    },
    speak_during_execution: true,
    speak_after_execution: false,
    execution_message_description: "Cancelling that appointment now.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.rescheduleAppointment,
    name: "reschedule_appointment",
    description: "Reschedule an appointment to a new time. The event_id comes from find_appointment.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        // FunctionNode: both extracted by rescheduleExtract — use const, no LLM inference
        event_id:         { type: "string", const: "{{event_id}}" },
        new_start_time:   { type: "string", const: "{{new_start_time}}" },
        duration_minutes: { type: "number", description: "Duration in minutes. Default 60." },
      },
      required: ["event_id", "new_start_time"],
    },
    speak_during_execution: true,
    speak_after_execution: false,
    execution_message_description: "Rescheduling your appointment now.",
  },
  {
    type: "custom",
    tool_id: TOOL_IDS.takeMessage,
    name: "take_message",
    description: "Save a callback message from the caller.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        // FunctionNode: all extracted by takeMsgExtract — use const, no LLM inference
        caller_name:  { type: "string", const: "{{caller_name}}" },
        caller_phone: { type: "string", const: "{{caller_phone}}" },
        message:      { type: "string", const: "{{message}}" },
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const nodes: any[] = [

  // =========================================================================
  // WELCOME
  // =========================================================================
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
      { id: "edge-welcome-book",      destination_node_id: IDS.bookCollect,        transition_condition: { type: "prompt", prompt: "Caller wants to book or schedule an appointment" } },
      { id: "edge-welcome-reschedule",destination_node_id: IDS.rescheduleFind,     transition_condition: { type: "prompt", prompt: "Caller wants to reschedule or change an appointment" } },
      { id: "edge-welcome-cancel",    destination_node_id: IDS.cancelFind,         transition_condition: { type: "prompt", prompt: "Caller wants to cancel an appointment" } },
      { id: "edge-welcome-faq",       destination_node_id: IDS.faq,               transition_condition: { type: "prompt", prompt: "Caller has a question about hours, services, pricing, or location" } },
      { id: "edge-welcome-emergency", destination_node_id: IDS.emergencyTransfer, transition_condition: { type: "prompt", prompt: "Caller describes an urgent or emergency situation" } },
      { id: "edge-welcome-speak",     destination_node_id: IDS.speakToSomeone,    transition_condition: { type: "prompt", prompt: "Caller asks to speak to a person, owner, or staff member" } },
      { id: "edge-welcome-message",   destination_node_id: IDS.takeMessageConv,   transition_condition: { type: "prompt", prompt: "Caller wants to leave a message or be called back" } },
    ],
    display_position: { x: 630, y: -522 },
  },

  // =========================================================================
  // BOOK FLOW
  // =========================================================================

  // Step 1 — SubagentNode: conversational availability check + collect all booking info
  {
    id: IDS.bookCollect,
    type: "subagent",
    name: "Book — Collect & Confirm",
    instruction: {
      type: "prompt",
      text: `Help the caller find a suitable appointment time at {{business_name}} and collect their details.

Your job in this node:
1. Ask for their preferred date and time, and the reason/service if not already known
2. Call check_availability with the requested_time as ISO 8601 local time (e.g. 2026-04-21T11:00:00)
3. If the time is taken or outside hours, the result will include alternatives — offer them and let the caller choose
4. Once the caller confirms a time, collect their full name and callback phone number
5. Repeat the confirmed time, name, and phone back to the caller for verification

STOP here. Do NOT book the appointment — that happens in the next step automatically.
Exit this node only when you have: confirmed time, full name, and phone number.`,
    },
    tool_ids: [TOOL_IDS.checkAvailability],
    edges: [
      {
        id: "edge-bookCollect-extract",
        destination_node_id: IDS.bookExtract,
        transition_condition: {
          type: "prompt",
          prompt: "Caller has confirmed a specific time AND provided their full name and callback phone number",
        },
      },
    ],
    display_position: { x: 1302, y: -1800 },
  },

  // Step 2 — ExtractDynamicVariablesNode: pull booking details into variables
  {
    id: IDS.bookExtract,
    type: "extract_dynamic_variables",
    name: "Book — Extract Details",
    variables: [
      { type: "string", name: "start_time",      description: "The confirmed appointment start time in ISO 8601 format extracted from the conversation", required: true },
      { type: "string", name: "customer_name",   description: "The full name of the customer as they stated it", required: true },
      { type: "string", name: "customer_phone",  description: "The callback phone number provided by the customer", required: true },
      { type: "string", name: "reason",          description: "The reason for the appointment or service needed", required: false },
    ],
    edges: [
      {
        id: "edge-bookExtract-api",
        destination_node_id: IDS.bookApi,
        transition_condition: { type: "prompt", prompt: "Variables extracted" },
      },
    ],
    display_position: { x: 1800, y: -1800 },
  },

  // Step 3 — FunctionNode: guaranteed book_appointment API call
  {
    id: IDS.bookApi,
    type: "function",
    name: "Book — Create Booking",
    tool_id: TOOL_IDS.bookAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me get that booked for you, one moment." },
    edges: [
      {
        id: "edge-bookApi-confirm",
        destination_node_id: IDS.bookConfirm,
        transition_condition: { type: "prompt", prompt: "Function completed" },
      },
    ],
    display_position: { x: 2300, y: -1800 },
  },

  // Step 4 — ConversationNode: read confirmed booking back to caller
  {
    id: IDS.bookConfirm,
    type: "conversation",
    name: "Book — Confirm to Caller",
    instruction: {
      type: "prompt",
      text: `The appointment was just booked. Read the confirmed booking details from the function result back to the caller — include the date, time, and their name. Keep it to 1-2 sentences. Then ask if there's anything else you can help with.`,
    },
    edges: [
      { id: "edge-bookConfirm-wrapup", destination_node_id: IDS.wrapUp, transition_condition: { type: "prompt", prompt: "Caller acknowledged the booking confirmation" } },
    ],
    display_position: { x: 2800, y: -1800 },
  },

  // =========================================================================
  // FAQ
  // =========================================================================
  {
    id: IDS.faq,
    type: "conversation",
    name: "Answer FAQ",
    instruction: {
      type: "prompt",
      text: `A caller has a question about {{business_name}}. Answer using ONLY the information in {{knowledge_base}}.
If the answer is not in the knowledge base say: "I don't have that information on hand, but I can take a message and have someone call you back."
Never guess or make up details.
After answering, ask: "Is there anything else I can help you with?"`,
    },
    edges: [
      { id: "edge-faq-wrapup",       destination_node_id: IDS.wrapUp,          transition_condition: { type: "prompt", prompt: "Caller is satisfied and has no more questions" } },
      { id: "edge-faq-book",         destination_node_id: IDS.bookCollect,     transition_condition: { type: "prompt", prompt: "Caller wants to book an appointment" } },
      { id: "edge-faq-cancel",       destination_node_id: IDS.cancelFind,      transition_condition: { type: "prompt", prompt: "Caller wants to cancel an appointment" } },
      { id: "edge-faq-reschedule",   destination_node_id: IDS.rescheduleFind,  transition_condition: { type: "prompt", prompt: "Caller wants to reschedule an appointment" } },
      { id: "edge-faq-message",      destination_node_id: IDS.takeMessageConv, transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" } },
      { id: "edge-faq-speak",        destination_node_id: IDS.speakToSomeone,  transition_condition: { type: "prompt", prompt: "Caller wants to speak to a person" } },
    ],
    display_position: { x: 1590, y: -18 },
  },

  // =========================================================================
  // EMERGENCY TRANSFER
  // =========================================================================
  {
    id: IDS.emergencyTransfer,
    type: "transfer_call",
    name: "Emergency Transfer",
    transfer_destination: { type: "predefined", number: "{{owner_phone}}" },
    transfer_option: { type: "cold_transfer", show_transferee_as_caller: false, enable_bridge_audio_cue: true },
    edge: {
      id: "edge-emergency-fallback",
      destination_node_id: IDS.takeMessageConv,
      transition_condition: { type: "prompt", prompt: "Transfer failed" },
    },
    speak_during_execution: false,
    custom_sip_headers: {},
    ignore_e164_validation: false,
    display_position: { x: 1590, y: 558 },
  },

  // =========================================================================
  // SPEAK TO SOMEONE
  // =========================================================================
  {
    id: IDS.speakToSomeone,
    type: "conversation",
    name: "Speak to Someone",
    instruction: {
      type: "prompt",
      text: `The caller wants to speak to a staff member or the owner. Acknowledge them warmly, let them know staff are currently unavailable, and offer two options: leave a message and someone will call back, or if it's urgent they can be transferred immediately.`,
    },
    edges: [
      { id: "edge-speak-message",   destination_node_id: IDS.takeMessageConv,  transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" } },
      { id: "edge-speak-emergency", destination_node_id: IDS.emergencyTransfer, transition_condition: { type: "prompt", prompt: "Caller says it's urgent or wants immediate transfer" } },
    ],
    display_position: { x: 1590, y: 750 },
  },

  // =========================================================================
  // TAKE A MESSAGE FLOW
  // =========================================================================

  // Step 1 — ConversationNode: collect message details
  {
    id: IDS.takeMessageConv,
    type: "conversation",
    name: "Take a Message",
    instruction: {
      type: "prompt",
      text: `Collect the caller's name, callback phone number, and a brief reason for their call. Ask one at a time.
Start with: "I'd be happy to take a message, can I get your name please?"
Do not move on until you have all three: name, phone number, and reason.`,
    },
    edges: [
      {
        id: "edge-takemsg-extract",
        destination_node_id: IDS.takeMsgExtract,
        transition_condition: { type: "prompt", prompt: "Caller provided their name, phone number, and reason for calling" },
      },
    ],
    display_position: { x: 1614, y: 1230 },
  },

  // Step 2 — ExtractDynamicVariablesNode: extract message details
  {
    id: IDS.takeMsgExtract,
    type: "extract_dynamic_variables",
    name: "Take Message — Extract",
    variables: [
      { type: "string", name: "caller_name",  description: "The full name of the caller as they stated it", required: false },
      { type: "string", name: "caller_phone", description: "The callback phone number provided by the caller", required: false },
      { type: "string", name: "message",      description: "Brief summary of why the caller is calling and what they need", required: true },
    ],
    edges: [
      {
        id: "edge-takeMsgExtract-fn",
        destination_node_id: IDS.takeMessageFn,
        transition_condition: { type: "prompt", prompt: "Variables extracted" },
      },
    ],
    display_position: { x: 2000, y: 1230 },
  },

  // Step 3 — FunctionNode: save message via API
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
    display_position: { x: 2400, y: 1230 },
  },

  // =========================================================================
  // WRAP UP
  // =========================================================================
  {
    id: IDS.wrapUp,
    type: "conversation",
    name: "Wrap Up",
    instruction: {
      type: "prompt",
      text: `You just completed a task for the caller. Ask: "Is there anything else I can help you with today?" If not, thank them by name if you have it, say goodbye on behalf of {{business_name}}, and end with "Have a great day!"`,
    },
    edges: [
      { id: "edge-wrapup-book",       destination_node_id: IDS.bookCollect,    transition_condition: { type: "prompt", prompt: "Caller wants to book an appointment" } },
      { id: "edge-wrapup-cancel",     destination_node_id: IDS.cancelFind,     transition_condition: { type: "prompt", prompt: "Caller wants to cancel an appointment" } },
      { id: "edge-wrapup-reschedule", destination_node_id: IDS.rescheduleFind, transition_condition: { type: "prompt", prompt: "Caller wants to reschedule an appointment" } },
      { id: "edge-wrapup-faq",        destination_node_id: IDS.faq,            transition_condition: { type: "prompt", prompt: "Caller has another question" } },
      { id: "edge-wrapup-message",    destination_node_id: IDS.takeMessageConv,transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" } },
      { id: "edge-wrapup-goodbye",    destination_node_id: IDS.goodbye,        transition_condition: { type: "prompt", prompt: "Caller has no more requests and is ready to hang up" } },
    ],
    display_position: { x: 2900, y: 294 },
  },

  // =========================================================================
  // GOODBYE
  // =========================================================================
  {
    id: IDS.goodbye,
    type: "end",
    name: "Goodbye",
    instruction: { type: "prompt", text: "Politely end the call" },
    display_position: { x: 3400, y: 510 },
  },

  // =========================================================================
  // CANCEL FLOW
  // =========================================================================

  // Step 1 — FunctionNode: always find appointments first
  {
    id: IDS.cancelFind,
    type: "function",
    name: "Cancel — Find Appointments",
    tool_id: TOOL_IDS.findAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me look up your appointments, one moment." },
    edges: [
      {
        id: "edge-cancelFind-found",
        destination_node_id: IDS.cancelPresent,
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
  },

  // Step 2 — ConversationNode: present appointments, ask which, get confirmation
  {
    id: IDS.cancelPresent,
    type: "conversation",
    name: "Cancel — Select Appointment",
    instruction: {
      type: "prompt",
      text: `The caller's upcoming appointments are in {{appointments_json}} — a JSON array with fields: eventId, summary, startTime.

Present them clearly: "I found [N] appointment(s): 1. [reason] on [date], 2. [reason] on [date]. Which would you like to cancel?"
Once the caller identifies one, confirm: "Just to confirm — cancel [description] on [date]?"
Wait for their yes before moving on.

Do NOT cancel anything yet — just identify and confirm which appointment they want cancelled.`,
    },
    edges: [
      {
        id: "edge-cancelPresent-extract",
        destination_node_id: IDS.cancelExtract,
        transition_condition: { type: "prompt", prompt: "Caller confirmed which specific appointment they want to cancel" },
      },
    ],
    display_position: { x: 1900, y: -700 },
  },

  // Step 3 — ExtractDynamicVariablesNode: extract event_id
  {
    id: IDS.cancelExtract,
    type: "extract_dynamic_variables",
    name: "Cancel — Extract Event ID",
    variables: [
      {
        type: "string",
        name: "event_id",
        description: "The eventId of the appointment the caller wants to cancel, extracted from appointments_json based on their selection",
        required: true,
      },
    ],
    edges: [
      {
        id: "edge-cancelExtract-api",
        destination_node_id: IDS.cancelApi,
        transition_condition: { type: "prompt", prompt: "Variables extracted" },
      },
    ],
    display_position: { x: 2400, y: -700 },
  },

  // Step 4 — FunctionNode: guaranteed cancel_appointment API call
  {
    id: IDS.cancelApi,
    type: "function",
    name: "Cancel — Execute Cancellation",
    tool_id: TOOL_IDS.cancelAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me take care of that cancellation for you." },
    edges: [
      {
        id: "edge-cancelApi-confirm",
        destination_node_id: IDS.cancelConfirm,
        transition_condition: { type: "prompt", prompt: "Function completed" },
      },
    ],
    display_position: { x: 2900, y: -700 },
  },

  // Step 5 — ConversationNode: confirm cancellation to caller
  {
    id: IDS.cancelConfirm,
    type: "conversation",
    name: "Cancel — Confirm to Caller",
    instruction: {
      type: "prompt",
      text: `The cancellation just completed. Tell the caller it's done — e.g. "Done, your appointment has been cancelled." Keep it brief. Then ask if there's anything else you can help with.`,
    },
    edges: [
      { id: "edge-cancelConfirm-wrapup", destination_node_id: IDS.wrapUp, transition_condition: { type: "prompt", prompt: "Caller acknowledged the cancellation" } },
    ],
    display_position: { x: 3300, y: -700 },
  },

  // No appointments found
  {
    id: IDS.cancelNotFound,
    type: "conversation",
    name: "Cancel — No Appointments",
    instruction: {
      type: "prompt",
      text: `No upcoming appointments were found for this caller's number. Let them know: "I don't see any upcoming appointments linked to your number." Ask if there's anything else you can help with.`,
    },
    edges: [
      { id: "edge-cancelNotFound-wrapup",   destination_node_id: IDS.wrapUp,          transition_condition: { type: "prompt", prompt: "Caller has no further requests" } },
      { id: "edge-cancelNotFound-message",  destination_node_id: IDS.takeMessageConv,  transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" } },
    ],
    display_position: { x: 1900, y: -500 },
  },

  // =========================================================================
  // RESCHEDULE FLOW
  // =========================================================================

  // Step 1 — FunctionNode: always find appointments first
  {
    id: IDS.rescheduleFind,
    type: "function",
    name: "Reschedule — Find Appointments",
    tool_id: TOOL_IDS.findAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me look up your appointments, one moment." },
    edges: [
      {
        id: "edge-rescheduleFind-found",
        destination_node_id: IDS.rescheduleCollect,
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
  },

  // Step 2 — SubagentNode: select appointment + find new time via check_availability
  {
    id: IDS.rescheduleCollect,
    type: "subagent",
    name: "Reschedule — Select & Find New Time",
    instruction: {
      type: "prompt",
      text: `The caller's appointments are in {{appointments_json}} (fields: eventId, summary, startTime).

Your job in this node:
1. Present the appointments clearly and ask which one to reschedule
2. Once identified, ask for their preferred new date and time
3. Call check_availability with the new time as ISO 8601 local time (e.g. 2026-04-21T14:00:00)
4. If that time is taken, offer the alternatives from the result
5. Once the caller confirms a new time, repeat back: "So I'll reschedule [old appointment] to [new time] — is that right?"

STOP here. Do NOT call reschedule_appointment — that happens automatically next.
Exit only when you have: the correct event_id from {{appointments_json}} AND the confirmed new_start_time.`,
    },
    tool_ids: [TOOL_IDS.checkAvailability],
    edges: [
      {
        id: "edge-rescheduleCollect-extract",
        destination_node_id: IDS.rescheduleExtract,
        transition_condition: {
          type: "prompt",
          prompt: "Caller confirmed which appointment to reschedule AND confirmed the new date and time",
        },
      },
    ],
    display_position: { x: 1900, y: -1200 },
  },

  // Step 3 — ExtractDynamicVariablesNode: extract event_id + new_start_time
  {
    id: IDS.rescheduleExtract,
    type: "extract_dynamic_variables",
    name: "Reschedule — Extract Details",
    variables: [
      {
        type: "string",
        name: "event_id",
        description: "The eventId of the appointment to reschedule, from appointments_json based on caller's selection",
        required: true,
      },
      {
        type: "string",
        name: "new_start_time",
        description: "The confirmed new appointment start time in ISO 8601 local format (e.g. 2026-04-21T14:00:00)",
        required: true,
      },
    ],
    edges: [
      {
        id: "edge-rescheduleExtract-api",
        destination_node_id: IDS.rescheduleApi,
        transition_condition: { type: "prompt", prompt: "Variables extracted" },
      },
    ],
    display_position: { x: 2400, y: -1200 },
  },

  // Step 4 — FunctionNode: guaranteed reschedule_appointment API call
  {
    id: IDS.rescheduleApi,
    type: "function",
    name: "Reschedule — Execute Reschedule",
    tool_id: TOOL_IDS.rescheduleAppointment,
    tool_type: "local",
    wait_for_result: true,
    speak_during_execution: true,
    instruction: { type: "static_text", text: "Let me get that rescheduled for you." },
    edges: [
      {
        id: "edge-rescheduleApi-confirm",
        destination_node_id: IDS.rescheduleConfirm,
        transition_condition: { type: "prompt", prompt: "Function completed" },
      },
    ],
    display_position: { x: 2900, y: -1200 },
  },

  // Step 5 — ConversationNode: confirm new appointment to caller
  {
    id: IDS.rescheduleConfirm,
    type: "conversation",
    name: "Reschedule — Confirm to Caller",
    instruction: {
      type: "prompt",
      text: `The reschedule just completed. Read the new appointment details back from the function result — include the new date and time. Keep it to 1-2 sentences. Then ask if there's anything else you can help with.`,
    },
    edges: [
      { id: "edge-rescheduleConfirm-wrapup", destination_node_id: IDS.wrapUp, transition_condition: { type: "prompt", prompt: "Caller acknowledged the reschedule confirmation" } },
    ],
    display_position: { x: 3300, y: -1200 },
  },

  // No appointments found
  {
    id: IDS.rescheduleNotFound,
    type: "conversation",
    name: "Reschedule — No Appointments",
    instruction: {
      type: "prompt",
      text: `No upcoming appointments were found for this caller's number. Let them know and ask if there's anything else you can help with.`,
    },
    edges: [
      { id: "edge-rescheduleNotFound-wrapup",  destination_node_id: IDS.wrapUp,          transition_condition: { type: "prompt", prompt: "Caller has no further requests" } },
      { id: "edge-rescheduleNotFound-message", destination_node_id: IDS.takeMessageConv, transition_condition: { type: "prompt", prompt: "Caller wants to leave a message" } },
    ],
    display_position: { x: 1900, y: -1000 },
  },
]

// ---------------------------------------------------------------------------
// Push to live flow
// ---------------------------------------------------------------------------

console.log(`Pushing refactored flow to ${FLOW_ID}...`)
console.log(`  ${nodes.length} nodes total`)

await retell.conversationFlow.update(FLOW_ID, {
  nodes: nodes as ConversationFlowCreateParams["nodes"],
  tools,
})

console.log("")
console.log("✅ Flow refactored successfully.")
console.log("")
console.log("New architecture:")
console.log("  BOOK:       book-collect (SubagentNode) → book-extract (ExtractDynamic) → book-api (FunctionNode) → book-confirm")
console.log("  CANCEL:     cancel-find (Fn) → cancel-present (Conv) → cancel-extract (ExtractDynamic) → cancel-api (Fn) → cancel-confirm")
console.log("  RESCHEDULE: reschedule-find (Fn) → reschedule-collect (SubagentNode) → reschedule-extract (ExtractDynamic) → reschedule-api (Fn) → reschedule-confirm")
console.log("  TAKE MSG:   takeMessageConv → take-msg-extract (ExtractDynamic) → takeMessageFn (Fn)")
console.log("  WRAP UP:    routes back to all tasks for multi-task calls")
