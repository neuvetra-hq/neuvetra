import { describe, expect, mock, test } from "bun:test"
import { streamChat } from "./chat-handler"
import type { Agent } from "../agents/types"

const stubAgent = (): Agent => ({
  id: "test-agent",
  promptKey: "test-agent:v1",
  systemPrompt: "you are a test",
  model: { specificationVersion: "v1", provider: "test", modelId: "test-model" } as any,
  tools: { fake_tool: { description: "fake" } } as any,
  subAgents: [],
})

describe("streamChat()", () => {
  test("calls streamText with the agent's model + system + messages + tools, returns the stream result", () => {
    const fakeStreamResult = { __mock: "stream-result" }
    const fakeStreamText = mock((_args: any) => fakeStreamResult as any)

    const result = streamChat(
      {
        agent: stubAgent(),
        messages: [{ role: "user", content: "hello" }],
      },
      { streamText: fakeStreamText as any },
    )

    expect(result).toBe(fakeStreamResult as any)
    expect(fakeStreamText).toHaveBeenCalledTimes(1)
    const callArgs = fakeStreamText.mock.calls[0]![0]
    expect(callArgs.system).toBe("you are a test")
    expect(callArgs.messages).toEqual([{ role: "user", content: "hello" }])
    expect(callArgs.stopWhen).toBeDefined()
    expect(callArgs.tools).toEqual({ fake_tool: { description: "fake" } } as any)
    expect(callArgs.experimental_telemetry).toEqual({
      isEnabled: true,
      functionId: "chat:test-agent",
      metadata: { agentId: "test-agent", authenticated: "false" },
    })
  })

  test("re-throws synchronously if streamText throws (pre-stream config error)", () => {
    const fakeStreamText = mock((_args: any) => {
      throw new Error("bad config")
    })

    expect(() =>
      streamChat(
        {
          agent: stubAgent(),
          messages: [{ role: "user", content: "hi" }],
        },
        { streamText: fakeStreamText as any },
      ),
    ).toThrow("bad config")
  })

  test("when input.user is present, telemetry metadata flags authenticated and the system prompt builder is invoked", () => {
    const fakeStreamResult = { __mock: "stream-result" }
    const fakeStreamText = mock((_args: any) => fakeStreamResult as any)

    // Use a stub agent with id 'greeter' to trigger the buildGreeterSystemPrompt branch.
    const greeterStub: Agent = {
      ...stubAgent(),
      id: "greeter",
      promptKey: "greeter:v2-auth",
    }

    streamChat(
      {
        agent: greeterStub,
        messages: [{ role: "user", content: "hi" }],
        user: { id: "u1", phone: "+15551234567", email: null, fullName: "Alice" },
      },
      { streamText: fakeStreamText as any },
    )

    expect(fakeStreamText).toHaveBeenCalledTimes(1)
    const callArgs = fakeStreamText.mock.calls[0]![0]
    expect(callArgs.experimental_telemetry.metadata.authenticated).toBe("true")
    // The dynamic prompt should mention the user's name explicitly.
    expect(callArgs.system).toContain("Alice")
    // And the static body's KB block should still be present.
    expect(callArgs.system).toContain("KNOWLEDGE BASE")
  })
})
