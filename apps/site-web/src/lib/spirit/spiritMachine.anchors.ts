import { ORTHO_HALF_H } from "./engine"
import type { NamedAnchor } from "./spiritMachine.types"

// Anchors are computed at call-time from the live aspect ratio so they always
// map to the actual screen corners regardless of window size or orientation.
// 0.88 margin keeps the cloud slightly inset from the hard viewport edge.
const MARGIN = 0.88

function anchors() {
  const H  = ORTHO_HALF_H * MARGIN
  const W  = ORTHO_HALF_H * (window.innerWidth / window.innerHeight) * MARGIN
  return {
    center:      { x:  0,  y:  0,  z: 0 },
    top:         { x:  0,  y:  H,  z: 0 },
    bottom:      { x:  0,  y: -H,  z: 0 },
    left:        { x: -W,  y:  0,  z: 0 },
    right:       { x:  W,  y:  0,  z: 0 },
    topLeft:     { x: -W,  y:  H,  z: 0 },
    topRight:    { x:  W,  y:  H,  z: 0 },
    bottomLeft:  { x: -W,  y: -H,  z: 0 },
    bottomRight: { x:  W,  y: -H,  z: 0 },
  } satisfies Record<NamedAnchor, { x: number; y: number; z: number }>
}

export function resolveTarget(
  target: NamedAnchor | { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return typeof target === "string" ? anchors()[target] : target
}
