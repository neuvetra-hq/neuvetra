import * as THREE from 'three'
import { SpiritSimulator } from './simulator'
import { SpiritParticles } from './particles'
import {
  PRESETS,
  AUDIO,
  type SpiritPreset,
} from '../../data/spirit-presets'

// ─── AudioEngine ──────────────────────────────────────────────────────────────

// iOS Safari uses webkitAudioContext on older versions.
const AC: typeof AudioContext =
  window.AudioContext ??
  (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!

class AudioEngine {
  private ctx: AudioContext | null = null
  private ambientGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private ambientSource: AudioBufferSourceNode | null = null
  private sfxBuffers = new Map<string, AudioBuffer>()
  private _unlocked = false
  private _disposed = false

  dispose(): void {
    this._disposed = true
    this.ambientSource?.stop()
    this.ctx?.close()
    this.ctx = null
    this.sfxBuffers.clear()
  }

  // Called synchronously from within a user gesture handler (via XState action).
  // AudioContext creation and resume() MUST stay synchronous on the call stack
  // for iOS Safari to allow audio playback.
  unlock(): void {
    if (this._unlocked || this._disposed || !AC) return
    this._unlocked = true

    this.ctx = new AC()

    // resume() is called synchronously here, still within the gesture call stack.
    this.ctx.resume()
      .then(() => {
        // Prime iOS AudioContext: play a silent 1-sample buffer so subsequent
        // sources aren't silently blocked by the OS.
        this._prime()
        return this._loadBuffers()
      })
      .catch(err => console.warn('[AudioEngine] unlock failed', err))
  }

  // Plays a silent 1-sample buffer — required to prime iOS AudioContext.
  private _prime(): void {
    if (!this.ctx) return
    const buf = this.ctx.createBuffer(1, 1, this.ctx.sampleRate)
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.ctx.destination)
    src.start(0)
  }

  private async _loadBuffers(): Promise<void> {
    if (this._disposed || !this.ctx) return

    this.ambientGain = this.ctx.createGain()
    this.ambientGain.gain.value = AUDIO.ambientVolume
    this.ambientGain.connect(this.ctx.destination)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = AUDIO.sfxVolume
    this.sfxGain.connect(this.ctx.destination)

    try {
      const res = await fetch(AUDIO.ambientLoop)
      if (!res.ok || this._disposed || !this.ctx) return
      const buf = await res.arrayBuffer()
      if (this._disposed || !this.ctx) return
      const decoded = await this.ctx.decodeAudioData(buf)
      if (this._disposed || !this.ctx) return
      this.ambientSource = this.ctx.createBufferSource()
      this.ambientSource.buffer = decoded
      this.ambientSource.loop = true
      this.ambientSource.connect(this.ambientGain)
      this.ambientSource.start()
    } catch (e) {
      console.warn('[AudioEngine] ambient failed to load', e)
    }

    const sfxPaths = new Set<string>()
    sfxPaths.add(AUDIO.hover)
    sfxPaths.add(AUDIO.nav)
    for (const preset of Object.values(PRESETS)) {
      if (preset.soundEffect) sfxPaths.add(preset.soundEffect)
    }
    await Promise.allSettled(
      [...sfxPaths].map(async (path) => {
        try {
          const res = await fetch(path)
          if (!res.ok || this._disposed || !this.ctx) return
          const buf = await res.arrayBuffer()
          if (this._disposed || !this.ctx) return
          const decoded = await this.ctx.decodeAudioData(buf)
          this.sfxBuffers.set(path, decoded)
        } catch (e) {
          console.warn(`[AudioEngine] SFX ${path} failed to load`, e)
        }
      }),
    )
  }

  setMuted(muted: boolean): void {
    if (this.ambientGain) this.ambientGain.gain.value = muted ? 0 : AUDIO.ambientVolume
  }

  playSFX(path: string, rate = 1, volume = 1): void {
    if (!this.ctx || !this.sfxGain) return
    const buf = this.sfxBuffers.get(path)
    if (!buf) { console.warn(`[AudioEngine] SFX not preloaded: ${path}`); return }
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.playbackRate.value = rate
    if (volume !== 1) {
      const gain = this.ctx.createGain()
      gain.gain.value = volume
      src.connect(gain)
      gain.connect(this.sfxGain)
    } else {
      src.connect(this.sfxGain)
    }
    src.start()
  }
}

// ─── SpiritEngine ─────────────────────────────────────────────────────────────

// Half-height of the viewport in world units at z=0.
// Must stay in sync with spiritMachine.anchors.ts so anchor positions
// correspond to actual viewport positions at z=0.
export const ORTHO_HALF_H = 500

// Perspective camera: fov chosen so visible half-height at z=0 == ORTHO_HALF_H.
// camera.z = ORTHO_HALF_H / tan(fov/2)
const CAMERA_FOV = 60
const CAMERA_Z   = ORTHO_HALF_H / Math.tan((CAMERA_FOV * Math.PI) / 360)

const FOLLOW_R = 200
const FOLLOW_H = 60

export class SpiritEngine {
  private renderer: THREE.WebGLRenderer | null = null
  private scene: THREE.Scene | null = null
  private camera: THREE.PerspectiveCamera | null = null
  private simulator: SpiritSimulator | null = null
  private particles: SpiritParticles | null = null
  private audio: AudioEngine | null = null
  private raf: number | null = null
  private lastFrameTime = 0
  private resizeObserver: ResizeObserver | null = null

  private followTime = 0
  private followPoint = new THREE.Vector3()
  private initTime = 0
  private initDone = false

  private currentPreset: SpiritPreset = PRESETS.default
  private visualLerp: { from: SpiritPreset; to: SpiritPreset; elapsed: number; durationMs: number; active: boolean } | null = null
  private attractorTarget: { x: number; y: number; z: number } | null = null
  private attractorKickAngle = 0
  private surgeState: { elapsed: number; intensity: number; durationMs: number } | null = null
  private bgColor = new THREE.Color()

  async init(container: HTMLElement): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = false
    this.renderer.setClearColor(0x000000, 0)
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    const preset = this.currentPreset
    this.bgColor.setStyle(preset.bgColor)
    this.scene.fog = new THREE.Fog(this.bgColor.getHex(), 800, 1800)

    // Perspective camera — z translation produces visible depth.
    // fov + camera.z chosen so visible half-height at z=0 equals ORTHO_HALF_H,
    // preserving anchor→viewport mapping from the previous ortho setup.
    const aspect = container.clientWidth / container.clientHeight
    this.camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 1, 4000)
    this.camera.position.set(0, 0, CAMERA_Z)
    this.camera.lookAt(0, 0, 0)

    // 180×180 = 32,400 particles (~32k target).
    this.simulator = new SpiritSimulator(this.renderer, 180, 180)
    this.particles = new SpiritParticles(this.renderer, this.scene, this.camera, this.simulator, preset.color1, preset.color2)
    this.scene.add(this.particles.container)

    this.audio = new AudioEngine()
    // No eager init — audio starts lazily when unlockAudio() is called after first user gesture.

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.renderer || !this.camera) return
      const w = container.clientWidth, h = container.clientHeight
      this.camera.aspect = w / h
      this.camera.updateProjectionMatrix()
      this.renderer.setSize(w, h)
      this.particles?.resize(w, h)
    })
    this.resizeObserver.observe(container)

    this.lastFrameTime = performance.now()
    this._tick()
  }

  dispose(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    this.resizeObserver?.disconnect()
    this.audio?.dispose()
    this.particles?.dispose()
    this.simulator?.dispose()
    const canvas = this.renderer?.domElement
    this.renderer?.dispose()
    canvas?.parentElement?.removeChild(canvas)
    this.scene = null
    this.renderer = null
    this.camera = null
    this.simulator = null
    this.particles = null
    this.audio = null
  }

  setVisualTarget(from: SpiritPreset, to: SpiritPreset, durationMs: number): void {
    this.visualLerp = { from, to, elapsed: 0, durationMs, active: true }
  }

  setAttractorTarget(pos: { x: number; y: number; z: number } | null, kickAngle: number): void {
    this.attractorTarget = pos
    this.attractorKickAngle = kickAngle
  }

  setSurge(intensity: number, durationMs: number, kickAngle?: number): void {
    this.surgeState = { elapsed: 0, intensity, durationMs }
    if (kickAngle !== undefined) this.attractorKickAngle = kickAngle
  }

  unlockAudio(): void {
    this.audio?.unlock()
  }

  setMuted(muted: boolean): void {
    this.audio?.setMuted(muted)
  }

  playSFX(name: string, rate?: number, volume?: number): void {
    this.audio?.playSFX(name, rate, volume)
  }

  private _lerp(from: SpiritPreset, to: SpiritPreset, t: number): SpiritPreset {
    const colorKeys = new Set<keyof SpiritPreset>(['color1', 'color2', 'bgColor'])
    const result: Record<string, unknown> = { ...from }
    for (const key of Object.keys(from) as (keyof SpiritPreset)[]) {
      if (key === 'useTriangles' || key === 'soundEffect') continue
      if (colorKeys.has(key)) {
        const fc = new THREE.Color(from[key] as string)
        result[key] = '#' + fc.lerp(new THREE.Color(to[key] as string), t).getHexString()
      } else {
        result[key] = (from[key] as number) + ((to[key] as number) - (from[key] as number)) * t
      }
    }
    result.useTriangles = to.useTriangles
    result.soundEffect = to.soundEffect
    return result as unknown as SpiritPreset
  }

  private _tick = (): void => {
    this.raf = requestAnimationFrame(this._tick)
    if (!this.renderer || !this.scene || !this.camera || !this.simulator || !this.particles) return

    const now = performance.now()
    const dt = Math.min(now - this.lastFrameTime, 50)
    this.lastFrameTime = now

    // Init animation ramp
    if (!this.initDone) {
      this.initTime += dt
      this.simulator.initAnimation = Math.min(this.initTime / 3000, 1)
      if (this.simulator.initAnimation >= 1) this.initDone = true
    }

    // ── Visual lerp ──────────────────────────────────────────────────────────────
    let current = this.currentPreset
    if (this.visualLerp?.active) {
      this.visualLerp.elapsed += dt
      const t = Math.min(this.visualLerp.elapsed / this.visualLerp.durationMs, 1)
      const eased = t * t * (3 - 2 * t)
      current = this._lerp(this.visualLerp.from, this.visualLerp.to, eased)
      if (t >= 1) {
        this.currentPreset = this.visualLerp.to
        this.visualLerp.active = false
      }
    }

    // ── Surge overlay ─────────────────────────────────────────────────────────────
    let surgeFactor = 0
    if (this.surgeState) {
      this.surgeState.elapsed += dt
      const t = Math.min(this.surgeState.elapsed / this.surgeState.durationMs, 1)
      surgeFactor = Math.sin(Math.PI * t) * this.surgeState.intensity
      if (t >= 1) this.surgeState = null
    }
    current = { ...current, speed: current.speed + surgeFactor }

    // ── Follow point ──────────────────────────────────────────────────────────────
    const effectiveFollowSpeed = current.followSpeed * (1 + surgeFactor * 7)
    this.followTime += dt * 0.001 * effectiveFollowSpeed
    const wanderX = Math.cos(this.followTime) * FOLLOW_R
    const wanderY = Math.cos(this.followTime * 4) * FOLLOW_H
    const wanderZ = Math.sin(this.followTime * 2) * FOLLOW_R

    if (this.attractorTarget) {
      // Lerp toward machine-specified target
      this.followPoint.lerp(
        new THREE.Vector3(this.attractorTarget.x, this.attractorTarget.y, this.attractorTarget.z),
        0.04,
      )
    } else {
      // Wander / returning — ease back to Lissajous orbit
      this.followPoint.lerp(new THREE.Vector3(wanderX, wanderY, wanderZ), 0.04)
    }

    // Kick offset riding on surge
    if (surgeFactor > 0) {
      const kick = surgeFactor * 420
      this.followPoint.x += Math.cos(this.attractorKickAngle) * kick
      this.followPoint.z += Math.sin(this.attractorKickAngle) * kick
      this.followPoint.y += surgeFactor * 100
    }

    // Update fog color
    this.bgColor.setStyle(current.bgColor)
    if (this.scene.fog) this.scene.fog.color.copy(this.bgColor)

    // Update simulator
    this.simulator.update(dt, this.followPoint, {
      speed: current.speed,
      dieSpeed: current.dieSpeed,
      radius: current.radius,
      curlSize: current.curlSize,
      attraction: current.attraction,
    })

    // Update particles + render via EffectComposer
    this.particles.update(this.simulator, {
      color1: current.color1,
      color2: current.color2,
      bloomStrength: current.bloomStrength,
      bloomRadius: current.bloomRadius,
      bloomThreshold: current.bloomThreshold,
      useTriangles: current.useTriangles,
    })
    this.particles.render()
  }
}
