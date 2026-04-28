import type { NamedAnchor } from "./spiritMachine.types"

export const ANCHORS: Record<NamedAnchor, { x: number; y: number; z: number }> = {
  center:      { x:    0, y:   0, z:    0 },
  top:         { x:    0, y:  80, z:    0 },
  bottom:      { x:    0, y: -60, z:    0 },
  topLeft:     { x: -180, y:  80, z: -180 },
  topRight:    { x:  180, y:  80, z: -180 },
  bottomLeft:  { x: -180, y: -60, z:  180 },
  bottomRight: { x:  180, y: -60, z:  180 },
}

export function resolveTarget(
  target: NamedAnchor | { x: number; y: number; z: number },
): { x: number; y: number; z: number } {
  return typeof target === "string" ? ANCHORS[target] : target
}
