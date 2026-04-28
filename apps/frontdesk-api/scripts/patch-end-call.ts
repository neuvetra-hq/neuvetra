#!/usr/bin/env bun
/**
 * Patch both live agents to use the end_call tool in the WrapUp node.
 *
 * Root cause: Retell agents don't hang up by default — you must explicitly
 * call the end_call tool. WrapUp was a ConversationNode (no tools), so the
 * agent could never hang up. This changes WrapUp to a SubagentNode with
 * the end_call tool so the agent terminates the call itself.
 *
 * Run:
 *   cd apps/api && RETELL_API_KEY=key_... RETELL_AGENT_ID=agent_... bun run scripts/patch-end-call.ts
 */

import Retell from "retell-sdk"

const retell = new Retell({ apiKey: Bun.env.RETELL_API_KEY ?? "" })

if (!Bun.env.RETELL_API_KEY) {
  console.error("RETELL_API_KEY is not set"); process.exit(1)
}

const NEUVETRA_FLOW_ID = "conversation_flow_66f88e7e0583"

const END_CALL_TOOL = {
  type: "end_call" as const,
  name: "end_call",
  description: "Terminate the call. Use this immediately after saying goodbye when the caller indicates they are done.",
}

function patchWrapUp(nodes: any[], opts: { businessName: string }): any[] {
  return nodes.map((node: any) => {
    if (node.name !== "Wrap Up") return node

    // Remove the goodbye edge — end_call handles termination now
    const edges = (node.edges ?? []).filter((e: any) => {
      const dest: string = e.destination_node_id ?? ""
      const prompt: string = e.transition_condition?.prompt ?? ""
      return !dest.includes("end") && !dest.includes("goodbye") &&
             !prompt.toLowerCase().includes("hang up") &&
             !prompt.toLowerCase().includes("ready to hang")
    })

    return {
      ...node,
      type: "subagent",
      instruction: {
        type: "prompt",
        text: opts.businessName === "Neuvetra"
          ? `Wrap up the call warmly.

If the caller has another question, route them via the edge below.

Otherwise:
1. Thank them and remind them they can sign up at neuvetra.com anytime
2. Wish them a great day and say goodbye — keep it to 1-2 sentences
3. IMMEDIATELY call end_call to hang up

CRITICAL: You MUST call end_call when the caller is done. Do not wait for them to hang up.`
          : `You just completed a task for the caller. Ask: "Is there anything else I can help you with today?"

If they have another request, route them via the edges below.

If they say no, say thanks, say bye, or indicate they are done:
1. Say a brief warm farewell — thank them by name if you have it, say goodbye on behalf of {{business_name}}, end with "Have a great day!"
2. IMMEDIATELY call end_call to hang up.

CRITICAL: You MUST call end_call when the caller is done. Do not wait for them to hang up.`,
      },
      tools: [END_CALL_TOOL],
      edges,
    }
  })
}

async function patchFlow(flowId: string, label: string, businessName: string) {
  console.log(`Fetching ${label} flow ${flowId}...`)
  const flow = await retell.conversationFlow.retrieve(flowId)
  const patched = patchWrapUp(flow.nodes as any[], { businessName })
  await retell.conversationFlow.update(flowId, { nodes: patched })
  console.log(`✓ ${label} patched`)
}

// Neuvetra agent
await patchFlow(NEUVETRA_FLOW_ID, "Neuvetra", "Neuvetra")

// Customer agent
if (Bun.env.RETELL_AGENT_ID) {
  const agent = await retell.agent.retrieve(Bun.env.RETELL_AGENT_ID)
  const flowId = (agent.response_engine as any)?.conversation_flow_id
  if (flowId) {
    await patchFlow(flowId, "Customer", "business")
  } else {
    console.warn("Could not find customer agent flow ID")
  }
} else {
  console.warn("RETELL_AGENT_ID not set — skipping customer agent")
}

console.log("\nDone — both agents will now call end_call to hang up.")
