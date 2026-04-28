export type ScenarioSurface = "chat" | "scene" | "hybrid"

/**
 * The composable unit of agent behavior + UI state.
 *
 * A scenario has both a *descriptor* (id, name, description, goal, surface,
 * scene component reference) — readable by the agent's prompt to decide
 * when to invoke — and a *runtime* — the tool that fires it server-side
 * and the UI component the scene region mounts client-side.
 *
 * M2.1 ships this primitive plus the first concrete scenario,
 * `collect_otp_verification`. M2.3 layers in more scenarios; the
 * agent's library grows; the surface stays the same.
 */
export interface ScenarioDescriptor {
  /** Stable id — referenced in agent prompt + lifecycle events. */
  id: string
  /** Human-readable name. Surfaces in agent identity / debug. */
  name: string
  /** Why this exists. The agent reads this when deciding when to invoke. */
  description: string
  /** What success means. The "goal-completion" metric for autoresearch. */
  goal: string
  /** Where the user-visible part lives. */
  surface: ScenarioSurface
  /**
   * For scene/hybrid scenarios — which component the scene region should
   * mount, and the prop names the activate event will populate. The
   * actual component lives in `apps/web/src/scenes/registry.ts`.
   */
  scene?: {
    component: string
    propNames: readonly string[]
  }
}

/**
 * Lifecycle event the agent emits via tool calls. The orchestrator on
 * the client routes these to the scene actor.
 */
export interface ScenarioActivatePayload {
  id: string
  /** Component-specific props — phone for OtpInput, etc. */
  props: Record<string, unknown>
}
