# Neuvetra Demo Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy a dedicated Retell AI agent for Neuvetra's own contact number (+16508308181) that answers calls about Front Desk, captures sales leads, and notifies Nima via SMS — with no dependency on the business KB/calendar system used by customer agents.

**Architecture:** A new Retell conversation flow with static Neuvetra knowledge baked into the global prompt, a single `capture_lead` tool that POSTs to a new `/neuvetra/lead` API endpoint, which sends an SMS to Nima's phone. The Neuvetra agent is deployed via its own script (like `deploy-retell-agent.ts`) and wired to `+16508308181` directly in Retell's dashboard. No businessId, no KB lookup, no calendar.

**Tech Stack:** Retell SDK (`retell-sdk@5.12.0`), Elysia (existing), Twilio SMS (`notifyOwner` pattern from `notify.ts`), Bun scripts

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `apps/api/src/routes/neuvetra.ts` | Create | `/neuvetra/lead` POST endpoint + `/neuvetra/webhook` POST endpoint |
| `apps/api/src/index.ts` | Modify | Register `neuvetraRoutes` |
| `apps/api/scripts/deploy-neuvetra-agent.ts` | Create | One-shot script to create Retell flow + agent |
| `apps/api/.env.example` | Modify | Add `NEUVETRA_AGENT_ID` and `NEUVETRA_NOTIFY_PHONE` |

---

## Pre-work: Environment Variables

Before coding, add to Railway API service and `apps/api/.env.local`:

```
NEUVETRA_AGENT_ID=         # filled in after running deploy script
NEUVETRA_NOTIFY_PHONE=     # Nima's personal cell (E.164, e.g. +14155551234)
```

---

## Task 1: Add `/neuvetra/lead` and `/neuvetra/webhook` API routes

**Files:**
- Create: `apps/api/src/routes/neuvetra.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Write the failing build check**

```bash
cd /c/Users/nimab/front-desk/apps/api && bun tsc --noEmit 2>&1 | grep neuvetra
```
Expected: no output (file doesn't exist yet, nothing to fail)

- [ ] **Step 2: Create `apps/api/src/routes/neuvetra.ts`**

```typescript
import { Elysia } from "elysia"
import twilio from "twilio"

const twilioClient = twilio(Bun.env.TWILIO_ACCOUNT_SID, Bun.env.TWILIO_AUTH_TOKEN)

export const neuvetraRoutes = new Elysia()

  // Called by Retell during live calls when the agent invokes `capture_lead`
  .post("/neuvetra/lead", async ({ body }) => {
    const b = body as Record<string, string>
    const name      = b.caller_name     ?? "Unknown"
    const company   = b.caller_company  ?? ""
    const email     = b.caller_email    ?? ""
    const phone     = b.caller_phone    ?? ""
    const useCase   = b.use_case        ?? ""

    const notifyPhone = Bun.env.NEUVETRA_NOTIFY_PHONE
    if (notifyPhone) {
      const lines = [
        `🎯 New Front Desk lead`,
        `Name: ${name}`,
        company  ? `Company: ${company}` : null,
        phone    ? `Phone: ${phone}`     : null,
        email    ? `Email: ${email}`     : null,
        useCase  ? `Interest: ${useCase}` : null,
      ].filter(Boolean).join("\n")

      await twilioClient.messages.create({
        to:   notifyPhone,
        from: Bun.env.TWILIO_PHONE_NUMBER!,
        body: lines,
      }).catch(() => {/* fire-and-forget */})
    }

    return { result: "Got it — someone from Neuvetra will be in touch within one business day." }
  })

  // Receives call_ended / call_analyzed events from Retell for the Neuvetra agent
  // Lightweight — just acknowledges, no DB write needed
  .post("/neuvetra/webhook", () => ({ received: true }))
```

- [ ] **Step 3: Register in `apps/api/src/index.ts`**

Add import and `.use()` call:

```typescript
import { neuvetraRoutes } from "./routes/neuvetra"
```

```typescript
  .use(voiceRoutes)
  .use(neuvetraRoutes)   // ← add this line
```

- [ ] **Step 4: Type-check**

```bash
cd /c/Users/nimab/front-desk/apps/api && bun tsc --noEmit 2>&1 | grep -v "billing.ts"
```
Expected: no output (billing.ts errors are pre-existing, ignore them)

- [ ] **Step 5: Build check**

```bash
cd /c/Users/nimab/front-desk/apps/web && bun run build 2>&1 | tail -3
```
Expected: `✓ built in X.XXs`

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/routes/neuvetra.ts apps/api/src/index.ts
git commit -m "feat: add /neuvetra/lead and /neuvetra/webhook endpoints"
```

---

## Task 2: Update `.env.example`

**Files:**
- Modify: `apps/api/.env.example`

- [ ] **Step 1: Add new env vars**

Add below the existing `TWILIO_*` block:

```
# Neuvetra demo agent
NEUVETRA_AGENT_ID=          # set after running deploy-neuvetra-agent.ts
NEUVETRA_NOTIFY_PHONE=      # Nima's cell for lead SMS notifications (E.164)
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/.env.example
git commit -m "chore: add NEUVETRA_AGENT_ID and NEUVETRA_NOTIFY_PHONE to env.example"
```

---

## Task 3: Write the Neuvetra agent deploy script

**Files:**
- Create: `apps/api/scripts/deploy-neuvetra-agent.ts`

This is a one-shot script (run once manually, not on deploy). It creates the Retell flow + agent and prints the agent_id to set in Railway.

- [ ] **Step 1: Create `apps/api/scripts/deploy-neuvetra-agent.ts`**

```typescript
#!/usr/bin/env bun
/**
 * Deploy the Neuvetra demo agent to Retell.
 *
 * Run from repo root:
 *   cd apps/api && RETELL_API_KEY=key_... bun run scripts/deploy-neuvetra-agent.ts
 *
 * After running:
 *   1. Copy the printed NEUVETRA_AGENT_ID → set in Railway + .env.local
 *   2. In Retell dashboard → Phone Numbers → import +16508308181 → link to this agent
 *   3. In Twilio Console → +16508308181 → Voice URL → set to Retell's inbound URL for this agent
 */

import Retell from "retell-sdk"
import type { ConversationFlowCreateParams, AgentCreateParams } from "retell-sdk"

const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })

if (!Bun.env.RETELL_API_KEY) {
  console.error("RETELL_API_KEY is not set")
  process.exit(1)
}

const WEBHOOK_URL = "https://api.neuvetra.com/neuvetra/lead"
const NEUVETRA_WEBHOOK_URL = "https://api.neuvetra.com/neuvetra/webhook"

const IDS = {
  welcome:        "nv-welcome",
  productInfo:    "nv-product-info",
  pricing:        "nv-pricing",
  leadCollect:    "nv-lead-collect",
  saveLead:       "nv-save-lead",
  wrapUp:         "nv-wrap-up",
  end:            "nv-end",
} as const

const TOOL_IDS = {
  captureLead: "nv_tool_capture_lead",
} as const

const tools: ConversationFlowCreateParams["tools"] = [
  {
    type: "custom",
    tool_id: TOOL_IDS.captureLead,
    name: "capture_lead",
    description: "Save the caller's contact information and interest in Front Desk. Call this after collecting their name, phone number, and what they're looking for.",
    url: WEBHOOK_URL,
    method: "POST",
    parameters: {
      type: "object",
      properties: {
        caller_name: {
          type: "string",
          description: "Full name of the caller.",
        },
        caller_company: {
          type: "string",
          description: "Company or business name (if provided).",
        },
        caller_phone: {
          type: "string",
          description: "Callback phone number.",
        },
        caller_email: {
          type: "string",
          description: "Email address (if provided).",
        },
        use_case: {
          type: "string",
          description: "Brief summary of why they're interested in Front Desk and what kind of business they run.",
        },
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

You answer calls to Neuvetra's contact line. Your job is to answer questions about Front Desk, understand the caller's business, and collect their contact info so the Neuvetra team can follow up.

# ABOUT FRONT DESK
Front Desk is an AI voice receptionist that answers every call 24/7, books appointments, takes messages, and handles FAQs — so small business owners never miss a customer again.

Key facts:
- Works for any business that receives inbound calls (dental, legal, home services, beauty, automotive, restaurants, etc.)
- Setup takes about 10 minutes
- Answers calls in natural conversation — callers often don't know it's AI
- Integrates with Google Calendar, Outlook, and iCloud for appointment booking
- Pricing: Starter $49/mo, Growth $99/mo, Pro $199/mo (all include unlimited calls)
- Free 7-day trial, no credit card required
- Sign up at neuvetra.com

# YOUR JOB
1. Answer questions about Front Desk warmly and honestly
2. Ask what kind of business they run and what pain points they have (missed calls? after-hours calls? booking management?)
3. Collect their contact info so the team can do a personalized demo or follow up
4. Never pressure — be helpful and let the product speak for itself

# RULES
- You represent Neuvetra only — do not discuss competitors
- If asked pricing questions you're unsure about, say "I can have someone from our team send you the full breakdown"
- Never invent features that don't exist
- If asked to speak to a human, say: "Our team is currently unavailable, but I'll make sure they get your info and reach out shortly."
- Sound natural and conversational — this is a phone call, not a sales pitch`

const nodes: ConversationFlowCreateParams["nodes"] = [

  // Welcome
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

  // Product Info
  {
    id: IDS.productInfo,
    type: "conversation",
    name: "Product Info",
    instruction: {
      type: "prompt",
      text: `Answer the caller's question about Front Desk using the product knowledge in your global prompt. Keep answers concise and conversational.
After answering, ask: "What kind of business do you run? I'd love to give you a sense of how this would work for you specifically."
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

  // Pricing
  {
    id: IDS.pricing,
    type: "conversation",
    name: "Pricing",
    instruction: {
      type: "prompt",
      text: `Share the pricing information from your global prompt clearly:
- Starter: $49/mo
- Growth: $99/mo
- Pro: $199/mo
- All plans include a free 7-day trial
- Sign up at neuvetra.com

After sharing, ask: "Would it help to have someone from our team walk you through which plan fits your business? I can grab your contact info."`,
    },
    edges: [
      {
        id: "edge-pricing-lead",
        destination_node_id: IDS.leadCollect,
        transition_condition: { type: "prompt", prompt: "Caller wants follow-up, a demo, or to be contacted" },
      },
      {
        id: "edge-pricing-wrapup",
        destination_node_id: IDS.wrapUp,
        transition_condition: { type: "prompt", prompt: "Caller is satisfied and doesn't need further help" },
      },
    ],
    display_position: { x: 600, y: 300 },
  } as ConversationFlowCreateParams.ConversationNode,

  // Lead Collection — SubagentNode
  {
    id: IDS.leadCollect,
    type: "subagent",
    name: "Collect Lead Info",
    instruction: {
      type: "prompt",
      text: `Collect the caller's contact information to pass to the Neuvetra team. Do it conversationally — don't make it feel like a form.

Steps:
1. Ask what kind of business they run (if not already known)
2. Get their name
3. Get their best callback number
4. Ask if they have an email (optional — "no worries if not")
5. Ask what's driving their interest — missed calls? after-hours? booking headaches?
6. YOU MUST call capture_lead with all collected info before saying anyone will follow up

CRITICAL:
- Do NOT say "our team will reach out" or "you're on the list" until AFTER capture_lead returns successfully
- Keep the tone warm and curious — you're learning about their business, not interrogating them`,
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

  // Wrap Up
  {
    id: IDS.wrapUp,
    type: "conversation",
    name: "Wrap Up",
    instruction: {
      type: "prompt",
      text: `Wrap up the call warmly. Thank them for their time, remind them they can sign up at neuvetra.com anytime, and wish them a great day. Keep it to 1-2 sentences.`,
    },
    edges: [
      {
        id: "edge-wrapup-end",
        destination_node_id: IDS.end,
        transition_condition: { type: "prompt", prompt: "Caller is ready to hang up" },
      },
      {
        id: "edge-wrapup-product",
        destination_node_id: IDS.productInfo,
        transition_condition: { type: "prompt", prompt: "Caller has another question" },
      },
    ],
    display_position: { x: 1200, y: 0 },
  } as ConversationFlowCreateParams.ConversationNode,

  // End
  {
    id: IDS.end,
    type: "end",
    name: "End Call",
    instruction: { type: "prompt", text: "End the call politely" },
    display_position: { x: 1800, y: 0 },
  } as ConversationFlowCreateParams.EndNode,
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
  webhook_url:              NEUVETRA_WEBHOOK_URL,
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
console.log("  3. Twilio Console → +16508308181 → Voice URL → set to Retell's inbound URL")
console.log("     (Retell shows the exact URL after you import the number)")
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
```

- [ ] **Step 2: Verify the script type-checks**

```bash
cd /c/Users/nimab/front-desk/apps/api && bun tsc --noEmit 2>&1 | grep "neuvetra-agent"
```
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add apps/api/scripts/deploy-neuvetra-agent.ts
git commit -m "feat: add Neuvetra demo agent deploy script"
```

---

## Task 4: Build check + push

- [ ] **Step 1: Full web build**

```bash
cd /c/Users/nimab/front-desk/apps/web && bun run build 2>&1 | tail -3
```
Expected: `✓ built in X.XXs`

- [ ] **Step 2: Push**

```bash
git push origin master
```

---

## Task 5: Run the deploy script

This is a one-time manual step after Railway has deployed the API with the new routes.

- [ ] **Step 1: Run the script**

```bash
cd /c/Users/nimab/front-desk/apps/api && RETELL_API_KEY=key_d00aca5c91a5ce6d8f7fffc59afa bun run scripts/deploy-neuvetra-agent.ts
```
Expected output: prints agent_id

- [ ] **Step 2: Copy the agent_id → set in Railway and `.env.local`**

```
NEUVETRA_AGENT_ID=agent_...
```

- [ ] **Step 3: In Retell dashboard → Phone Numbers → Import Twilio Number**
  - Enter `+16508308181`
  - Link to "Neuvetra Receptionist" agent
  - Copy the Retell inbound webhook URL shown (looks like `https://api.retellai.com/twilio-voice-webhook/agent_...`)

- [ ] **Step 4: In Twilio Console → Phone Numbers → +16508308181**
  - Voice Configuration → A call comes in: **Webhook**
  - URL: paste the Retell inbound webhook URL from Step 3
  - Method: **HTTP POST**
  - Save

- [ ] **Step 5: Test — call +16508308181 from your phone**

Expected: Aria answers with "Thanks for calling Neuvetra! I'm Aria, how can I help you today?"

- [ ] **Step 6: Add NEUVETRA_NOTIFY_PHONE to Railway**

Set to Nima's personal cell so lead SMS notifications are delivered.

- [ ] **Step 7: Create task file**

```bash
# Create tasks/39-neuvetra-demo-agent.md with status: done
```
