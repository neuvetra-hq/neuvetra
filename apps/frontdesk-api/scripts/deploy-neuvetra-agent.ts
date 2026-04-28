#!/usr/bin/env bun
/**
 * Deploy the Neuvetra demo agent to Retell.
 *
 * Run from repo root:
 *   cd apps/api && bun run scripts/deploy-neuvetra-agent.ts
 *
 * After running:
 *   1. Set NEUVETRA_AGENT_ID=<printed id> in Railway + .env.local
 *   2. Retell dashboard → Phone Numbers → import +16508308181 → link to this agent
 *   3. Twilio Console → +16508308181 → Voice URL → Retell inbound URL shown in dashboard
 */

import Retell from "retell-sdk"
import type { ConversationFlowCreateParams, AgentCreateParams } from "retell-sdk"

const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })

if (!Bun.env.RETELL_API_KEY) {
  console.error("RETELL_API_KEY is not set")
  process.exit(1)
}

const LEAD_URL    = "https://api.neuvetra.com/neuvetra/lead"
const WEBHOOK_URL = "https://api.neuvetra.com/neuvetra/webhook"

const IDS = {
  welcome:     "nv-welcome",
  productInfo: "nv-product-info",
  pricing:     "nv-pricing",
  leadCollect: "nv-lead-collect",
  wrapUp:      "nv-wrap-up",
  end:         "nv-end",
} as const

const TOOL_IDS = {
  captureLead: "nv_tool_capture_lead",
} as const

const tools: ConversationFlowCreateParams["tools"] = [
  {
    type: "custom",
    tool_id: TOOL_IDS.captureLead,
    name: "capture_lead",
    description: "Save the caller's contact info and interest in Front Desk. Call after collecting their name, phone, and what they're looking for.",
    url: LEAD_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        caller_name:    { type: "string", description: "Full name of the caller." },
        caller_company: { type: "string", description: "Company or business name (if provided)." },
        caller_phone:   { type: "string", description: "Callback phone number." },
        caller_email:   { type: "string", description: "Email address (if provided)." },
        use_case:       { type: "string", description: "Why they're interested in Front Desk and what kind of business they run." },
      },
      required: ["caller_name", "caller_phone", "use_case"],
    },
    speak_during_execution: true,
    speak_after_execution: true,
    execution_message_description: "Let me make a note of that for our team.",
  },
]

const GLOBAL_PROMPT = `# IDENTITY
You are Aria, an AI receptionist for Neuvetra — the company that builds Front Desk, an AI voice receptionist for small businesses.

You answer calls to Neuvetra's contact line. Your job is to answer questions about Front Desk and collect caller contact info so the team can follow up.

# ABOUT FRONT DESK
Front Desk is an AI voice receptionist that answers every call 24/7, books appointments, takes messages, and handles FAQs — so small business owners never miss a customer again.

Key facts:
- Works for any phone-based business (dental, legal, home services, beauty, automotive, restaurants, etc.)
- Setup takes about 10 minutes — no technical knowledge needed
- Answers calls in natural conversation — callers often don't know it's AI
- Integrates with Google Calendar, Outlook, and iCloud for appointment booking
- Pricing: Starter $49/mo · Growth $99/mo · Pro $199/mo
- Free 7-day trial, no credit card required
- Sign up at neuvetra.com

# YOUR JOB
1. Answer questions about Front Desk warmly and honestly
2. Ask what kind of business they run and what pain points they have (missed calls? after-hours? booking?)
3. Collect their contact info so the Neuvetra team can do a personalized demo or follow up
4. Never pressure — be helpful and let the product speak for itself

# RULES
- You represent Neuvetra only — do not discuss competitors by name
- If unsure about a feature, say "I can have someone from our team confirm that for you"
- Never invent features that don't exist
- If asked to speak to a human: "Our team is currently unavailable, but I'll make sure they get your info and reach out shortly."
- Sound natural and conversational — phone call, not a sales pitch
- Never mention Retell, OpenAI, or any technology vendor`

const nodes: ConversationFlowCreateParams["nodes"] = [

  {
    id: IDS.welcome,
    type: "conversation",
    name: "Welcome",
    start_speaker: "agent",
    instruction: {
      type: "static_text",
      text: "Thanks for calling Neuvetra! I'm Aria, how can I help you today?",
    },
    edges: [
      {
        id: "edge-welcome-product",
        destination_node_id: IDS.productInfo,
        transition_condition: { type: "prompt", prompt: "Caller asks what Front Desk is, how it works, or what Neuvetra does" },
      },
      {
        id: "edge-welcome-pricing",
        destination_node_id: IDS.pricing,
        transition_condition: { type: "prompt", prompt: "Caller asks about pricing, cost, or plans" },
      },
      {
        id: "edge-welcome-lead",
        destination_node_id: IDS.leadCollect,
        transition_condition: { type: "prompt", prompt: "Caller wants a demo, wants to sign up, wants more info, or wants to be contacted" },
      },
    ],
    display_position: { x: 0, y: 0 },
  } as ConversationFlowCreateParams.ConversationNode,

  {
    id: IDS.productInfo,
    type: "conversation",
    name: "Product Info",
    instruction: {
      type: "prompt",
      text: `Answer the caller's question about Front Desk using the product knowledge in your global prompt. Keep answers concise.
After answering, ask: "What kind of business do you run? I'd love to give you a sense of how this would work for you."
Then naturally transition to collecting their contact info.`,
    },
    edges: [
      {
        id: "edge-product-pricing",
        destination_node_id: IDS.pricing,
        transition_condition: { type: "prompt", prompt: "Caller asks about pricing or cost" },
      },
      {
        id: "edge-product-lead",
        destination_node_id: IDS.leadCollect,
        transition_condition: { type: "prompt", prompt: "Caller is interested or wants follow-up or a demo" },
      },
      {
        id: "edge-product-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: { type: "prompt", prompt: "Caller has no further questions and doesn't want follow-up" },
      },
    ],
    display_position: { x: 600, y: -300 },
  } as ConversationFlowCreateParams.ConversationNode,

  {
    id: IDS.pricing,
    type: "conversation",
    name: "Pricing",
    instruction: {
      type: "prompt",
      text: `Share the pricing clearly: Starter $49/mo, Growth $99/mo, Pro $199/mo. All include a free 7-day trial. Sign up at neuvetra.com.
After sharing, ask: "Would it help to have someone from our team walk you through which plan fits your business? I can grab your contact info."`,
    },
    edges: [
      {
        id: "edge-pricing-lead",
        destination_node_id: IDS.leadCollect,
        transition_condition: { type: "prompt", prompt: "Caller wants follow-up or to be contacted" },
      },
      {
        id: "edge-pricing-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: { type: "prompt", prompt: "Caller is satisfied and doesn't need further help" },
      },
    ],
    display_position: { x: 600, y: 300 },
  } as ConversationFlowCreateParams.ConversationNode,

  {
    id: IDS.leadCollect,
    type: "subagent",
    name: "Collect Lead Info",
    instruction: {
      type: "prompt",
      text: `Collect the caller's contact info conversationally — don't make it feel like a form.

Steps:
1. Ask what kind of business they run (if not already known)
2. Get their name
3. Get their best callback number
4. Ask if they have an email (optional — "no worries if not")
5. Ask what's driving their interest — missed calls? after-hours? booking?
6. YOU MUST call capture_lead with all collected info before saying anyone will follow up

CRITICAL:
- Do NOT say "our team will reach out" until AFTER capture_lead returns successfully
- Keep tone warm and curious — you're learning about their business, not interrogating them`,
    },
    tool_ids: [TOOL_IDS.captureLead],
    edges: [
      {
        id: "edge-lead-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: {
          type: "prompt",
          prompt: "capture_lead was called successfully AND caller was told the team will follow up",
        },
      },
    ],
    display_position: { x: 600, y: 0 },
  } as ConversationFlowCreateParams.SubagentNode,

  {
    id: IDS.wrapUp,
    type: "subagent",
    name: "Wrap Up",
    instruction: {
      type: "prompt",
      text: `Wrap up the call warmly.

If the caller has another question, route them via the edge below.

Otherwise:
1. Thank them and remind them they can sign up at neuvetra.com anytime
2. Wish them a great day and say goodbye — keep it to 1-2 sentences
3. IMMEDIATELY call end_call to hang up

CRITICAL: You MUST call end_call when the caller is done. Do not wait for them to hang up.`,
    },
    tools: [
      {
        type: "end_call",
        name: "end_call",
        description: "Terminate the call. Use this immediately after saying goodbye.",
      },
    ],
    edges: [
      {
        id: "edge-wrapup-product",
        destination_node_id: IDS.productInfo,
        transition_condition: { type: "prompt", prompt: "Caller has another question" },
      },
    ],
    display_position: { x: 1200, y: 0 },
  } as ConversationFlowCreateParams.SubagentNode,
]

console.log("Creating Neuvetra conversation flow...")

const flow = await retell.conversationFlow.create({
  start_speaker:         "agent",
  model_choice:          { type: "cascading", model: "gpt-5.1" },
  start_node_id:         IDS.welcome,
  global_prompt:         GLOBAL_PROMPT,
  tool_call_strict_mode: true,
  knowledge_base_ids:    [],
  tools,
  nodes,
})

console.log(`✓ Flow created: ${flow.conversation_flow_id}`)
console.log("Creating Neuvetra agent...")

const agent = await retell.agent.create({
  response_engine: {
    type: "conversation-flow",
    conversation_flow_id: flow.conversation_flow_id,
  },
  voice_id:                 "retell-Cimo",
  agent_name:               "Neuvetra Receptionist",
  webhook_url:              WEBHOOK_URL,
  max_call_duration_ms:     600000,
  interruption_sensitivity: 0.9,
  normalize_for_speech:     false,
  language:                 "en-US",
  handbook_config: {
    default_personality: true,
    natural_filler_words: true,
    ai_disclosure:        true,
  },
} as AgentCreateParams)

console.log(`✓ Agent created: ${agent.agent_id}`)
console.log("")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
console.log("Next steps:")
console.log(`  1. Set NEUVETRA_AGENT_ID=${agent.agent_id} in Railway + .env.local`)
console.log("  2. Retell dashboard → Phone Numbers → import +16508308181 → link to this agent")
console.log("  3. Twilio Console → +16508308181 → Voice URL → Retell's inbound URL")
console.log("     (Retell shows the exact URL after importing the number)")
console.log("  4. Set NEUVETRA_NOTIFY_PHONE=<your cell> in Railway + .env.local")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
