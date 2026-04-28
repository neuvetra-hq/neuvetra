import type { SpiritPreset } from "@/data/spirit-presets"

export type NamedAnchor =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "topLeft"
  | "topRight"
  | "bottomLeft"
  | "bottomRight"

export interface SpiritMachineContext {
  // visual
  currentPreset:    SpiritPreset
  fromPreset:       SpiritPreset
  toPreset:         SpiritPreset | null
  visualDurationMs: number
  // attractor
  attractorTarget:  { x: number; y: number; z: number } | null
  holdMs:           number
  returnMs:         number
  kickAngle:        number
  // motion
  surgeIntensity:   number
  surgeDurationMs:  number
}

export type SpiritEvent =
  | { type: "SET_PRESET";    name: string; durationMs?: number; color1?: string; color2?: string }
  | { type: "CHANGE_COLORS"; color1?: string; color2?: string; bgColor?: string; durationMs?: number }
  | { type: "MOVE_TO";       target: NamedAnchor | { x: number; y: number; z: number }; holdMs?: number; returnMs?: number }
  | { type: "WANDER" }
  | { type: "SURGE";         intensity?: number; durationMs?: number; kickAngle?: number }
  | { type: "SET_SPEED";     speed: number; followSpeed?: number }
  | { type: "SET_CURL";      curlSize: number; attraction?: number }
  | { type: "PLAY_SFX";      name: string; rate?: number; volume?: number }
  | { type: "USER_INTERACTED" }
  | { type: "TOGGLE_MUTE" }
  | { type: "RESET" }
