import { setup, assign, enqueueActions } from "xstate"

export interface ActiveScene {
  scenarioId: string
  /** Name of the component to mount, looked up in the scene registry. */
  component: string
  /** Props passed to the component. */
  props: Record<string, unknown>
}

export interface SceneContext {
  active: ActiveScene | null
}

export type SceneEvent =
  | {
      type: "ACTIVATE"
      scenarioId: string
      component: string
      props: Record<string, unknown>
    }
  | { type: "DEACTIVATE" }
  | { type: "DONE"; output: unknown }
  | { type: "FAIL"; reason: string }

export type SceneEmitted =
  | { type: "SCENARIO_DONE"; scenarioId: string; output: unknown }
  | { type: "SCENARIO_FAILED"; scenarioId: string; reason: string }

/**
 * Scene region's actor. Holds at most one active scene at a time; future
 * ACTIVATE events replace the current one (no stack). Components mounted
 * by the SceneRegion call `actor.send({ type: 'DONE', output })` to
 * signal completion; the machine emits SCENARIO_DONE upward and clears
 * the active slot.
 */
export const sceneMachine = setup({
  types: {} as {
    context: SceneContext
    events: SceneEvent
    emitted: SceneEmitted
  },
  actions: {
    setActive: assign(({ event }) => {
      const e = event as Extract<SceneEvent, { type: "ACTIVATE" }>
      return {
        active: {
          scenarioId: e.scenarioId,
          component: e.component,
          props: e.props,
        },
      }
    }),
    clearActive: assign({ active: null }),
    emitDone: enqueueActions(({ context, event, enqueue }) => {
      const e = event as Extract<SceneEvent, { type: "DONE" }>
      if (!context.active) return
      enqueue.emit({
        type: "SCENARIO_DONE",
        scenarioId: context.active.scenarioId,
        output: e.output,
      })
    }),
    emitFailed: enqueueActions(({ context, event, enqueue }) => {
      const e = event as Extract<SceneEvent, { type: "FAIL" }>
      if (!context.active) return
      enqueue.emit({
        type: "SCENARIO_FAILED",
        scenarioId: context.active.scenarioId,
        reason: e.reason,
      })
    }),
  },
}).createMachine({
  id: "scene",
  context: { active: null },
  initial: "idle",
  states: {
    idle: {
      on: {
        ACTIVATE: { target: "active", actions: "setActive" },
      },
    },
    active: {
      on: {
        ACTIVATE: { target: "active", reenter: true, actions: "setActive" },
        DEACTIVATE: { target: "idle", actions: "clearActive" },
        DONE: { target: "idle", actions: ["emitDone", "clearActive"] },
        FAIL: { target: "idle", actions: ["emitFailed", "clearActive"] },
      },
    },
  },
})
