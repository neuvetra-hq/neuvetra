import type { ComponentType } from "react"
import type { ActorRefFrom } from "xstate"
import type { sceneMachine } from "@/actors/scene.actor"
import { OtpInput } from "./OtpInput"

/**
 * Props every scene component receives. The component is responsible for
 * sending DONE / FAIL events back to the scene actor when its work
 * completes — that's how the orchestration up-chain learns about the
 * outcome.
 */
export interface SceneComponentProps {
  /** Scene actor ref — components send DONE/FAIL here. */
  sceneActor: ActorRefFrom<typeof sceneMachine>
  /** Scenario-specific props (e.g., phone for OtpInput). */
  props: Record<string, unknown>
}

export type SceneComponent = ComponentType<SceneComponentProps>

/**
 * Registry of scene components. New scenes register here.
 * Names must match the `component` field of their scenario descriptor.
 *
 * Empty in M2.1 task 10; Task 11 adds the first entry (otp_input).
 */
export const SCENE_REGISTRY: Record<string, SceneComponent> = {
  otp_input: OtpInput,
}
