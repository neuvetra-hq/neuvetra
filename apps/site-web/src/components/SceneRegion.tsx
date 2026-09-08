import { useSelector } from "@xstate/react"
import type { ActorRefFrom } from "xstate"
import type { sceneMachine } from "@/actors/scene.actor"
import { SCENE_REGISTRY } from "@/scenes/registry"

interface SceneRegionProps {
  sceneActor: ActorRefFrom<typeof sceneMachine>
}

/**
 * The right-hand pane (or bottom sheet on mobile, future) that mounts
 * whichever scene is currently active. When no scene is active, renders
 * nothing — the chat region takes the full available space.
 *
 * The active scene is read from the scene actor's context; the component
 * to mount is looked up in SCENE_REGISTRY by name. The component itself
 * is responsible for completing the scenario (sending DONE/FAIL).
 */
export function SceneRegion({ sceneActor }: SceneRegionProps) {
  const active = useSelector(sceneActor, (s) => s.context.active)

  if (!active) return null

  const Component = SCENE_REGISTRY[active.component]
  if (!Component) {
    console.warn("[SceneRegion] no component registered for:", active.component)
    return null
  }

  return (
    <div className="pointer-events-auto fixed inset-x-4 bottom-4 z-40 mx-auto max-w-sm md:top-1/2 md:right-6 md:bottom-auto md:left-auto md:mx-0 md:-translate-y-1/2">
      <Component sceneActor={sceneActor} props={active.props} />
    </div>
  )
}
