export interface SpiritPreset {
  speed: number           // 0–3
  dieSpeed: number        // 0.0005–0.05
  radius: number          // 0.2–3
  curlSize: number        // 0.001–0.05
  attraction: number      // -2 to 2
  followSpeed: number     // multiplier on follow-point animation speed
  color1: string          // CSS hex — bright/alive particle color
  color2: string          // CSS hex — dim/dying particle color
  bgColor: string         // CSS hex — background + fog
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  useTriangles: boolean
  soundEffect?: string
}

const defaultPreset: SpiritPreset = {
  speed: 0.28,        // overall velocity — lower = more dreamlike
  dieSpeed: 0.016,    // how fast particles die/respawn — lower = smoother, fewer sudden bursts
  radius: 1.0,        // spawn spread — wider = particles appear over a larger area, less clustered
  curlSize: 0.014,    // curl noise scale — higher = tighter more organic waves, lower = big slow rolls
  attraction: 0.15,   // pull toward follow point — very low so curl noise dominates, no surging
  followSpeed: 0.12,  // how fast the invisible follow point drifts — very slow = barely perceptible direction
  // Brighter color1 so particles register as themselves — was '#001020' (near-black), which let bloom
  // dominate and produced the "white halo around nothing" effect.
  color1: '#3080e0',
  color2: '#001540',
  bgColor: '#0b0c0d',
  // Reduced bloom — was 0.55/0.4, which over-glowed dim particles into a featureless blob.
  // 0.30/0.22 keeps a subtle aura without obscuring particle structure.
  bloomStrength: 0.30,
  bloomRadius: 0.22,
  bloomThreshold: 0.15,
  useTriangles: true,
}

const howItWorksPreset: SpiritPreset = {
  speed: 0.32,
  dieSpeed: 0.004,
  radius: 1.1,
  curlSize: 0.016,
  attraction: 0.18,
  followSpeed: 0.18,
  color1: '#001508',
  color2: '#005228',
  bgColor: '#0b0c0d',
  bloomStrength: 0.55,
  bloomRadius: 0.4,
  bloomThreshold: 0.15,
  useTriangles: true,
}

const pricingPreset: SpiritPreset = {
  speed: 0.28,
  dieSpeed: 0.003,
  radius: 0.9,
  curlSize: 0.011,
  attraction: 0.12,
  followSpeed: 0.14,
  color1: '#0a0015',
  color2: '#340060',
  bgColor: '#0b0c0d',
  bloomStrength: 0.7,
  bloomRadius: 0.4,
  bloomThreshold: 0.15,
  useTriangles: true,
}

const signInPreset: SpiritPreset = {
  speed: 0.55,
  dieSpeed: 0.005,
  radius: 1.5,
  curlSize: 0.022,
  attraction: 1.0,
  followSpeed: 1.4,
  color1: '#001518',
  color2: '#005568',
  bgColor: '#0b0c0d',
  bloomStrength: 0.7,
  bloomRadius: 0.5,
  bloomThreshold: 0.15,
  useTriangles: false,
}

const getStartedPreset: SpiritPreset = {
  speed: 0.38,
  dieSpeed: 0.004,
  radius: 1.2,
  curlSize: 0.018,
  attraction: 0.22,
  followSpeed: 0.28,
  color1: '#180a00',
  color2: '#6b3200',
  bgColor: '#0b0c0d',
  bloomStrength: 0.65,
  bloomRadius: 0.4,
  bloomThreshold: 0.15,
  useTriangles: true,
}

const stormPreset: SpiritPreset = {
  speed: 2.5,
  dieSpeed: 0.04,
  radius: 1.2,
  curlSize: 0.04,
  attraction: 1.8,
  followSpeed: 2.0,
  color1: '#66aaff',
  color2: '#ff6644',
  bgColor: '#0a0a18',
  bloomStrength: 1.2,
  bloomRadius: 0.6,
  bloomThreshold: 0.1,
  useTriangles: true,
  soundEffect: '/audio/sfx/storm.mp3',
}

const driftPreset: SpiritPreset = {
  speed: 0.4,
  dieSpeed: 0.003,
  radius: 0.3,
  curlSize: 0.008,
  attraction: 0.3,
  followSpeed: 0.5,
  color1: '#88ffcc',
  color2: '#1a4455',
  bgColor: '#000d1a',
  bloomStrength: 0.8,
  bloomRadius: 0.5,
  bloomThreshold: 0.0,
  useTriangles: false,
  soundEffect: '/audio/sfx/drift.mp3',
}

export const PRESETS: Record<string, SpiritPreset> = {
  default: defaultPreset,
  howItWorks: howItWorksPreset,
  pricing: pricingPreset,
  signIn: signInPreset,
  getStarted: getStartedPreset,
  storm: stormPreset,
  drift: driftPreset,
}

export const TRANSITION_DURATION_MS = 1400

export const AUTO_CYCLE: { preset: string; holdMs: number }[] = [
  { preset: 'default', holdMs: 9999999 },
]

export const AUDIO = {
  ambientLoop:   '/audio/ambient.wav',
  ambientVolume: 0.3,
  sfxVolume:     0.7,
  hover:         '/audio/air-whoosh.mp3',
  hoverVolume:   0.5,
  hoverInRate:   0.8,
  hoverOutRate:  1.2,
  nav:           '/audio/wosoh-soft.mp3',
}

export const SFX: Record<string, string> = {
  whoosh: "/audio/sfx/whoosh.mp3",
  click:  "/audio/sfx/click.mp3",
  chime:  "/audio/sfx/chime.mp3",
  surge:  "/audio/sfx/surge.mp3",
}
