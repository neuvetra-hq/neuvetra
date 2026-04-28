# Spirit Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the bare `/app` status page with "The Spirit" — an animated WebGL particle simulation (65k particles, curl noise, triangle rendering) as a full-screen background, with named preset transitions and looping audio.

**Architecture:** A `SpiritEngine` class owns a Three.js WebGL renderer, a GPGPU simulator (position update via render-to-texture), a particle mesh (triangle or point mode), bloom post-processing via `EffectComposer`, and an `AudioEngine`. Named states live in `spirit-presets.ts`. Calling `transition('name')` smoothstep-lerps all params over 3 s. An auto-cycle timer rotates presets automatically. A `useSpirit` React hook mounts/unmounts the engine into a container div.

**Tech Stack:** Three.js 0.184.0 (WebGL renderer, `WebGLRenderTarget`, `EffectComposer`, `UnrealBloomPass`), GLSL ES 1.00 shaders (curl noise, simplex noise, GPGPU), Web Audio API, React 19, TypeScript, Playwright

**Source reference:** https://github.com/edankwan/The-Spirit (MIT License) — ported from r74, adapted to r184 API, glslify deps inlined, shadows removed, wrapped in Engine/preset/hook pattern.

---

## File Map

| Action | Path | Purpose |
|--------|------|---------|
| Install | `apps/web/package.json` | three@0.184.0 |
| Create | `apps/web/src/lib/spirit/shaders.ts` | All GLSL as TS string constants (glslify deps inlined) |
| Create | `apps/web/src/lib/spirit/simulator.ts` | GPGPU: position texture ping-pong via `WebGLRenderTarget` |
| Create | `apps/web/src/lib/spirit/particles.ts` | Triangle + point particle meshes, EffectComposer + bloom |
| Create | `apps/web/src/data/spirit-presets.ts` | Named presets + AUDIO config + AUTO_CYCLE |
| Create | `apps/web/src/lib/spirit/engine.ts` | `AudioEngine` + `SpiritEngine` (transitions, auto-cycle, tick) |
| Create | `apps/web/src/hooks/useSpirit.ts` | React hook — mounts/unmounts engine |
| Modify | `apps/web/src/pages/AppPage.tsx` | Replace status text with full-screen canvas + z-10 overlay |
| Create | `apps/web/tests/spirit-background.spec.ts` | Playwright DOM structure tests |
| Modify | `apps/web/tests/app-route.spec.ts` | Update content assertions for new layout |

---

### Task 1: Install Three.js

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Install three@0.184.0**

Run (from repo root): `cd apps/web && bun add three@0.184.0`

Expected: `"three": "0.184.0"` (or `^0.184.0`) appears in `apps/web/package.json`.

- [ ] **Step 2: Confirm**

Run: `grep '"three"' apps/web/package.json`

Expected: version 0.184.0 present.

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json bun.lock
git commit -m "chore: add three@0.184.0 to apps/web"
```

---

### Task 2: Write failing Playwright test

**Files:**
- Create: `apps/web/tests/spirit-background.spec.ts`

This test fails now (AppPage has no matching DOM structure). It passes after Task 8.

- [ ] **Step 1: Create the test file**

`apps/web/tests/spirit-background.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test"

async function mockWebGPU(page: Page) {
  await page.addInitScript(() => {
    const fakeAdapter = {
      info: { vendor: "Test Vendor", architecture: "test-arch", device: "", description: "" },
      requestAdapterInfo: async () => ({
        vendor: "Test Vendor",
        architecture: "test-arch",
        device: "",
        description: "",
      }),
    }
    Object.defineProperty(navigator, "gpu", {
      get: () => ({ requestAdapter: () => Promise.resolve(fakeAdapter) }),
      configurable: true,
    })
  })
}

test.describe("spirit background", () => {
  test("renders background container and overlay on /app", async ({ page }) => {
    await mockWebGPU(page)
    await page.goto("/app")
    await expect(page.locator("div.absolute.inset-0")).toBeAttached()
    await expect(page.locator("div.relative.z-10")).toBeAttached()
  })
})
```

- [ ] **Step 2: Run to confirm it fails**

Run: `cd apps/web && bun run test:e2e --grep "spirit background" 2>&1 | tail -20`

Expected: FAIL — `div.absolute.inset-0` not found (current AppPage has different structure).

---

### Task 3: Create shaders.ts

**Files:**
- Create: `apps/web/src/lib/spirit/shaders.ts`

All GLSL shaders as TypeScript string exports. The glslify `#pragma require()` calls from the upstream source are replaced by inlining the dependency directly into the shader string. Shadows are removed (no `chunk(shadowmap_*)` calls).

**Three.js note:** These use GLSL ES 1.00 syntax (`texture2D`, `gl_FragColor`, `attribute`, `varying`). Three.js r184's WebGL 2.0 renderer accepts GLSL ES 1.00 shaders when no `#version` directive is present — backward compatibility is guaranteed by WebGL 2.0.

- [ ] **Step 1: Create shaders.ts**

`apps/web/src/lib/spirit/shaders.ts`:

```ts
// Passthrough vertex shader for GPGPU quad rendering
export const QUAD_VERT = /* glsl */`
attribute vec3 position;
void main() {
  gl_Position = vec4(position, 1.0);
}
`

// Copy fragment shader (used to init position render targets)
export const THROUGH_FRAG = /* glsl */`
precision highp float;
uniform vec2 resolution;
uniform sampler2D texture;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  gl_FragColor = texture2D(texture, uv);
}
`

// Core physics fragment shader.
// Simplex noise derivatives and curl noise are inlined from upstream GLSL helpers.
// Each frame reads particle position + life from texturePosition,
// applies curl noise displacement + attraction toward mouse3d, writes result.
export const POSITION_FRAG = /* glsl */`
precision highp float;
uniform vec2 resolution;
uniform sampler2D texturePosition;
uniform sampler2D textureDefaultPosition;
uniform float time;
uniform float speed;
uniform float dieSpeed;
uniform float radius;
uniform float curlSize;
uniform float attraction;
uniform float initAnimation;
uniform vec3 mouse3d;

// ── simplex noise derivatives (4D) ───────────────────────────────────────────
vec4 sn_mod289v4(vec4 x){return x-floor(x*(1./289.))*289.;}
float sn_mod289f(float x){return x-floor(x*(1./289.))*289.;}
vec4 sn_permv4(vec4 x){return sn_mod289v4(((x*34.)+1.)*x);}
float sn_permf(float x){return sn_mod289f(((x*34.)+1.)*x);}
vec4 sn_taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float sn_taylorInvSqrtF(float r){return 1.79284291400159-0.85373472095314*r;}
vec4 sn_grad4(float j,vec4 ip){
  const vec4 ones=vec4(1.,1.,1.,-1.);
  vec4 p,s;
  p.xyz=floor(fract(vec3(j)*ip.xyz)*7.)*ip.z-1.;
  p.w=1.5-dot(abs(p.xyz),ones.xyz);
  s=vec4(lessThan(p,vec4(0.)));
  p.xyz=p.xyz+(s.xyz*2.-1.)*s.www;
  return p;
}
#define SN_F4 0.309016994374947451
vec4 snoise4(vec4 v){
  const vec4 C=vec4(.138196601125011,.276393202250021,.414589803375032,-.447213595499958);
  vec4 i=floor(v+dot(v,vec4(SN_F4)));
  vec4 x0=v-i+dot(i,C.xxxx);
  vec4 i0;
  vec3 isX=step(x0.yzw,x0.xxx);
  vec3 isYZ=step(x0.zww,x0.yyz);
  i0.x=isX.x+isX.y+isX.z;
  i0.yzw=1.-isX;
  i0.y+=isYZ.x+isYZ.y;
  i0.zw+=1.-isYZ.xy;
  i0.z+=isYZ.z;
  i0.w+=1.-isYZ.z;
  vec4 i3=clamp(i0,0.,1.);
  vec4 i2=clamp(i0-1.,0.,1.);
  vec4 i1=clamp(i0-2.,0.,1.);
  vec4 x1=x0-i1+C.xxxx;
  vec4 x2=x0-i2+C.yyyy;
  vec4 x3=x0-i3+C.zzzz;
  vec4 x4=x0+C.wwww;
  i=sn_mod289v4(i);
  float j0=sn_permf(sn_permf(sn_permf(sn_permf(i.w)+i.z)+i.y)+i.x);
  vec4 j1=sn_permv4(sn_permv4(sn_permv4(sn_permv4(
    i.w+vec4(i1.w,i2.w,i3.w,1.))+
    i.z+vec4(i1.z,i2.z,i3.z,1.))+
    i.y+vec4(i1.y,i2.y,i3.y,1.))+
    i.x+vec4(i1.x,i2.x,i3.x,1.));
  vec4 ip=vec4(1./294.,1./49.,1./7.,0.);
  vec4 p0=sn_grad4(j0,ip);
  vec4 p1=sn_grad4(j1.x,ip);
  vec4 p2=sn_grad4(j1.y,ip);
  vec4 p3=sn_grad4(j1.z,ip);
  vec4 p4=sn_grad4(j1.w,ip);
  vec4 norm=sn_taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  p4*=sn_taylorInvSqrtF(dot(p4,p4));
  vec3 v0=vec3(dot(p0,x0),dot(p1,x1),dot(p2,x2));
  vec2 v1=vec2(dot(p3,x3),dot(p4,x4));
  vec3 m0=max(.5-vec3(dot(x0,x0),dot(x1,x1),dot(x2,x2)),0.);
  vec2 m1=max(.5-vec2(dot(x3,x3),dot(x4,x4)),0.);
  vec3 t0=-6.*m0*m0*v0;
  vec2 t1=-6.*m1*m1*v1;
  vec3 mm0=m0*m0*m0;
  vec2 mm1=m1*m1*m1;
  float dx=t0[0]*x0.x+t0[1]*x1.x+t0[2]*x2.x+t1[0]*x3.x+t1[1]*x4.x+mm0[0]*p0.x+mm0[1]*p1.x+mm0[2]*p2.x+mm1[0]*p3.x+mm1[1]*p4.x;
  float dy=t0[0]*x0.y+t0[1]*x1.y+t0[2]*x2.y+t1[0]*x3.y+t1[1]*x4.y+mm0[0]*p0.y+mm0[1]*p1.y+mm0[2]*p2.y+mm1[0]*p3.y+mm1[1]*p4.y;
  float dz=t0[0]*x0.z+t0[1]*x1.z+t0[2]*x2.z+t1[0]*x3.z+t1[1]*x4.z+mm0[0]*p0.z+mm0[1]*p1.z+mm0[2]*p2.z+mm1[0]*p3.z+mm1[1]*p4.z;
  float dw=t0[0]*x0.w+t0[1]*x1.w+t0[2]*x2.w+t1[0]*x3.w+t1[1]*x4.w+mm0[0]*p0.w+mm0[1]*p1.w+mm0[2]*p2.w+mm1[0]*p3.w+mm1[1]*p4.w;
  return vec4(dx,dy,dz,dw)*49.;
}

// ── 3-octave curl noise ───────────────────────────────────────────────────────
vec3 curl(vec3 p,float noiseTime,float persistence){
  vec4 xD=vec4(0.),yD=vec4(0.),zD=vec4(0.);
  for(int i=0;i<3;++i){
    float tw=pow(2.,float(i));
    float sc=.5*tw*pow(persistence,float(i));
    xD+=snoise4(vec4(p*tw,noiseTime))*sc;
    yD+=snoise4(vec4((p+vec3(123.4,129845.6,-1239.1))*tw,noiseTime))*sc;
    zD+=snoise4(vec4((p+vec3(-9519.,9051.,-123.))*tw,noiseTime))*sc;
  }
  return vec3(zD[1]-yD[2],xD[2]-zD[0],yD[0]-xD[1]);
}

// ── main: update position + life ──────────────────────────────────────────────
void main(){
  vec2 uv=gl_FragCoord.xy/resolution.xy;
  vec4 positionInfo=texture2D(texturePosition,uv);
  vec3 position=mix(vec3(0.,-200.,0.),positionInfo.xyz,smoothstep(0.,.3,initAnimation));
  float life=positionInfo.a-dieSpeed;
  vec3 followPos=mix(vec3(0.,-(1.-initAnimation)*200.,0.),mouse3d,smoothstep(.2,.7,initAnimation));
  if(life<0.){
    positionInfo=texture2D(textureDefaultPosition,uv);
    position=positionInfo.xyz*(1.+sin(time*15.)*.2+(1.-initAnimation))*.4*radius;
    position+=followPos;
    life=.5+fract(positionInfo.w*21.4131+time);
  } else {
    vec3 delta=followPos-position;
    position+=delta*(.005+life*.01)*attraction*(1.-smoothstep(50.,350.,length(delta)))*speed;
    position+=curl(position*curlSize,time,.1+(1.-life)*.1)*speed;
  }
  gl_FragColor=vec4(position,life);
}
`

// Point particle vertex — position.xy = FBO UV, reads actual position from texture
export const PARTICLES_VERT = /* glsl */`
uniform sampler2D texturePosition;
varying float vLife;
void main(){
  vec4 positionInfo=texture2D(texturePosition,position.xy);
  vec4 mvPosition=modelViewMatrix*vec4(positionInfo.xyz,1.);
  vLife=positionInfo.w;
  gl_PointSize=1300./length(mvPosition.xyz)*smoothstep(0.,.2,positionInfo.w);
  gl_Position=projectionMatrix*mvPosition;
}
`

// Triangle particle vertex — fboUV samples the position texture;
// position and positionFlip are 2D triangle corner offsets that flip each frame.
export const TRIANGLES_VERT = /* glsl */`
uniform sampler2D texturePosition;
uniform float flipRatio;
uniform mat4 cameraMatrix;
attribute vec3 positionFlip;
attribute vec2 fboUV;
varying float vLife;
void main(){
  vec4 positionInfo=texture2D(texturePosition,fboUV);
  vec4 mvPosition=modelViewMatrix*vec4(positionInfo.xyz,1.);
  vLife=positionInfo.w;
  mvPosition+=vec4((position+(positionFlip-position)*flipRatio)*smoothstep(0.,.2,positionInfo.w),0.);
  gl_Position=projectionMatrix*mvPosition;
}
`

// Shared fragment shader — color interpolated from life value
export const PARTICLES_FRAG = /* glsl */`
precision highp float;
varying float vLife;
uniform vec3 color1;
uniform vec3 color2;
void main(){
  vec3 color=mix(color2,color1,smoothstep(0.,.7,vLife));
  gl_FragColor=vec4(color,1.);
}
`
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && bun run build 2>&1 | grep -i error | head -10`

Expected: No errors from shaders.ts.

---

### Task 4: Create simulator.ts

**Files:**
- Create: `apps/web/src/lib/spirit/simulator.ts`

The GPGPU simulator maintains two `WebGLRenderTarget` buffers (ping-pong). Each frame it renders the position update shader (reading from one target, writing to the other). The current position texture is exposed for the particle renderer.

**Three.js r74 → r184 API changes applied here:**
- `renderer.render(scene, cam, target)` → `renderer.setRenderTarget(target); renderer.render(scene, cam); renderer.setRenderTarget(null)`
- `new THREE.PlaneBufferGeometry` → `new THREE.PlaneGeometry`
- `geometry.addAttribute` → `geometry.setAttribute`
- `{ type: 't', value: null }` uniform syntax → drop the `type` field (deprecated but functional; dropped here for cleanliness)

- [ ] **Step 1: Create simulator.ts**

`apps/web/src/lib/spirit/simulator.ts`:

```ts
import * as THREE from 'three'
import { QUAD_VERT, THROUGH_FRAG, POSITION_FRAG } from './shaders'

export interface SimulatorSettings {
  speed: number
  dieSpeed: number
  radius: number
  curlSize: number
  attraction: number
}

export class SpiritSimulator {
  readonly textureWidth: number
  readonly textureHeight: number
  readonly amount: number

  positionRenderTarget: THREE.WebGLRenderTarget
  prevPositionRenderTarget: THREE.WebGLRenderTarget

  private renderer: THREE.WebGLRenderer
  private gpgpuScene: THREE.Scene
  private gpgpuCamera: THREE.Camera
  private gpgpuMesh: THREE.Mesh
  private copyMaterial: THREE.RawShaderMaterial
  private positionMaterial: THREE.RawShaderMaterial
  private defaultPositionTexture: THREE.DataTexture

  initAnimation = 0

  constructor(renderer: THREE.WebGLRenderer, textureWidth = 256, textureHeight = 256) {
    this.renderer = renderer
    this.textureWidth = textureWidth
    this.textureHeight = textureHeight
    this.amount = textureWidth * textureHeight

    this.gpgpuScene = new THREE.Scene()
    this.gpgpuCamera = new THREE.Camera()
    this.gpgpuCamera.position.z = 1

    const geo = new THREE.PlaneGeometry(2, 2)
    this.gpgpuMesh = new THREE.Mesh(geo)
    this.gpgpuScene.add(this.gpgpuMesh)

    const rawPrefix = `precision ${renderer.capabilities.precision} float;\n`

    this.copyMaterial = new THREE.RawShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(textureWidth, textureHeight) },
        texture: { value: null },
      },
      vertexShader: rawPrefix + QUAD_VERT,
      fragmentShader: rawPrefix + THROUGH_FRAG,
    })

    this.positionMaterial = new THREE.RawShaderMaterial({
      uniforms: {
        resolution: { value: new THREE.Vector2(textureWidth, textureHeight) },
        texturePosition: { value: null },
        textureDefaultPosition: { value: null },
        mouse3d: { value: new THREE.Vector3() },
        speed: { value: 1 },
        dieSpeed: { value: 0.015 },
        radius: { value: 0.6 },
        curlSize: { value: 0.02 },
        attraction: { value: 1 },
        time: { value: 0 },
        initAnimation: { value: 0 },
      },
      vertexShader: rawPrefix + QUAD_VERT,
      fragmentShader: rawPrefix + POSITION_FRAG,
      blending: THREE.NoBlending,
      transparent: false,
      depthWrite: false,
      depthTest: false,
    })

    const rtOpts: THREE.RenderTargetOptions = {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      type: THREE.FloatType,
      depthBuffer: false,
      stencilBuffer: false,
    }
    this.positionRenderTarget = new THREE.WebGLRenderTarget(textureWidth, textureHeight, rtOpts)
    this.prevPositionRenderTarget = this.positionRenderTarget.clone()

    this.defaultPositionTexture = this._createDefaultTexture()
    this._copyTexture(this.defaultPositionTexture, this.positionRenderTarget)
    this._copyTexture(this.positionRenderTarget, this.prevPositionRenderTarget)
  }

  private _createDefaultTexture(): THREE.DataTexture {
    const data = new Float32Array(this.amount * 4)
    for (let i = 0; i < this.amount; i++) {
      const i4 = i * 4
      const r = (0.5 + Math.random() * 0.5) * 50
      const phi = (Math.random() - 0.5) * Math.PI
      const theta = Math.random() * Math.PI * 2
      data[i4 + 0] = r * Math.cos(theta) * Math.cos(phi)
      data[i4 + 1] = r * Math.sin(phi)
      data[i4 + 2] = r * Math.sin(theta) * Math.cos(phi)
      data[i4 + 3] = Math.random()
    }
    const tex = new THREE.DataTexture(data, this.textureWidth, this.textureHeight, THREE.RGBAFormat, THREE.FloatType)
    tex.minFilter = THREE.NearestFilter
    tex.magFilter = THREE.NearestFilter
    tex.needsUpdate = true
    tex.generateMipmaps = false
    tex.flipY = false
    return tex
  }

  private _copyTexture(
    input: THREE.Texture | THREE.WebGLRenderTarget,
    output: THREE.WebGLRenderTarget,
  ) {
    this.copyMaterial.uniforms.texture.value =
      input instanceof THREE.WebGLRenderTarget ? input.texture : input
    this.gpgpuMesh.material = this.copyMaterial as any
    this.renderer.setRenderTarget(output)
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera)
    this.renderer.setRenderTarget(null)
  }

  update(dt: number, followPoint: THREE.Vector3, settings: SimulatorSettings) {
    // Swap render targets
    const tmp = this.positionRenderTarget
    this.positionRenderTarget = this.prevPositionRenderTarget
    this.prevPositionRenderTarget = tmp

    const u = this.positionMaterial.uniforms
    u.texturePosition.value = this.prevPositionRenderTarget.texture
    u.textureDefaultPosition.value = this.defaultPositionTexture
    u.mouse3d.value.lerp(followPoint, 0.2)
    u.time.value += dt * 0.001
    u.speed.value = settings.speed * (dt / 16.667)
    u.dieSpeed.value = settings.dieSpeed * (dt / 16.667)
    u.radius.value = settings.radius
    u.curlSize.value = settings.curlSize
    u.attraction.value = settings.attraction
    u.initAnimation.value = this.initAnimation

    this.gpgpuMesh.material = this.positionMaterial as any
    this.renderer.setRenderTarget(this.positionRenderTarget)
    this.renderer.render(this.gpgpuScene, this.gpgpuCamera)
    this.renderer.setRenderTarget(null)
  }

  dispose() {
    this.positionRenderTarget.dispose()
    this.prevPositionRenderTarget.dispose()
    this.defaultPositionTexture.dispose()
    this.copyMaterial.dispose()
    this.positionMaterial.dispose()
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && bun run build 2>&1 | grep -i error | head -10`

Expected: No errors from simulator.ts. If `THREE.Camera` constructor is flagged, use `new THREE.PerspectiveCamera()` instead and set `camera.position.z = 1`.

---

### Task 5: Create particles.ts

**Files:**
- Create: `apps/web/src/lib/spirit/particles.ts`

Creates both a triangle mesh and a point mesh. Uses `EffectComposer` + `UnrealBloomPass` for bloom. The triangle mesh uses the distinctive flipping animation (alternating orientation each frame via `flipRatio`).

- [ ] **Step 1: Create particles.ts**

`apps/web/src/lib/spirit/particles.ts`:

```ts
import * as THREE from 'three'
// @ts-ignore
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
// @ts-ignore
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
// @ts-ignore
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { SpiritSimulator } from './simulator'
import { PARTICLES_VERT, TRIANGLES_VERT, PARTICLES_FRAG } from './shaders'

export interface ParticlesSettings {
  color1: string
  color2: string
  bloomStrength: number
  bloomRadius: number
  bloomThreshold: number
  useTriangles: boolean
}

export class SpiritParticles {
  container: THREE.Object3D

  private triangleMesh: THREE.Mesh
  private pointMesh: THREE.Points
  private color1: THREE.Color
  private color2: THREE.Color
  private tmpColor: THREE.Color
  private composer: InstanceType<typeof EffectComposer>
  private bloomPass: InstanceType<typeof UnrealBloomPass>
  private flipRatio = 0

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    simulator: SpiritSimulator,
  ) {
    this.container = new THREE.Object3D()
    this.color1 = new THREE.Color('#ffffff')
    this.color2 = new THREE.Color('#9b8cff')
    this.tmpColor = new THREE.Color()

    const W = simulator.textureWidth
    const H = simulator.textureHeight
    const AMOUNT = simulator.amount

    this.pointMesh = this._buildPointMesh(AMOUNT, W, H)
    this.triangleMesh = this._buildTriangleMesh(AMOUNT, W, H, camera)
    this.container.add(this.pointMesh, this.triangleMesh)

    // Post-processing
    this.composer = new EffectComposer(renderer)
    this.composer.addPass(new RenderPass(scene, camera))
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, 0.3, 0.0,
    )
    this.composer.addPass(this.bloomPass)
  }

  private _buildPointMesh(amount: number, W: number, H: number): THREE.Points {
    const position = new Float32Array(amount * 3)
    for (let i = 0; i < amount; i++) {
      const i3 = i * 3
      position[i3 + 0] = (i % W) / W
      position[i3 + 1] = Math.floor(i / W) / H
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(position, 3))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        color1: { value: this.color1 },
        color2: { value: this.color2 },
      },
      vertexShader: PARTICLES_VERT,
      fragmentShader: PARTICLES_FRAG,
      blending: THREE.NoBlending,
    })
    return new THREE.Points(geo, mat)
  }

  private _buildTriangleMesh(
    amount: number,
    W: number,
    H: number,
    camera: THREE.PerspectiveCamera,
  ): THREE.Mesh {
    const PI = Math.PI
    const angle = (PI * 2) / 3
    // Two sets of triangle corners (alternating each frame)
    const cornerAngles = [
      Math.sin(angle * 2 + PI), Math.cos(angle * 2 + PI),
      Math.sin(angle + PI),     Math.cos(angle + PI),
      Math.sin(angle * 3 + PI), Math.cos(angle * 3 + PI),
      Math.sin(angle * 2),      Math.cos(angle * 2),
      Math.sin(angle),          Math.cos(angle),
      Math.sin(angle * 3),      Math.cos(angle * 3),
    ]
    const position     = new Float32Array(amount * 9)
    const positionFlip = new Float32Array(amount * 9)
    const fboUV        = new Float32Array(amount * 6)
    for (let i = 0; i < amount; i++) {
      const i6 = i * 6
      const i9 = i * 9
      const even = i % 2 === 0
      const [aSet, bSet] = even ? [6, 0] : [0, 6]
      for (let v = 0; v < 3; v++) {
        position[i9 + v * 3]     = cornerAngles[aSet + v * 2]
        position[i9 + v * 3 + 1] = cornerAngles[aSet + v * 2 + 1]
        positionFlip[i9 + v * 3]     = cornerAngles[bSet + v * 2]
        positionFlip[i9 + v * 3 + 1] = cornerAngles[bSet + v * 2 + 1]
        fboUV[i6 + v * 2]     = (i % W) / W
        fboUV[i6 + v * 2 + 1] = Math.floor(i / W) / H
      }
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position',     new THREE.BufferAttribute(position,     3))
    geo.setAttribute('positionFlip', new THREE.BufferAttribute(positionFlip, 3))
    geo.setAttribute('fboUV',        new THREE.BufferAttribute(fboUV,        2))
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        texturePosition: { value: null },
        color1: { value: this.color1 },
        color2: { value: this.color2 },
        flipRatio: { value: 0 },
        cameraMatrix: { value: camera.matrixWorld },
      },
      vertexShader: TRIANGLES_VERT,
      fragmentShader: PARTICLES_FRAG,
      blending: THREE.NoBlending,
      side: THREE.DoubleSide,
    })
    return new THREE.Mesh(geo, mat)
  }

  resize(width: number, height: number) {
    this.composer.setSize(width, height)
    this.bloomPass.resolution.set(width, height)
  }

  update(simulator: SpiritSimulator, settings: ParticlesSettings) {
    this.triangleMesh.visible = settings.useTriangles
    this.pointMesh.visible = !settings.useTriangles

    // Lerp colors
    this.tmpColor.setStyle(settings.color1)
    this.color1.lerp(this.tmpColor, 0.05)
    this.tmpColor.setStyle(settings.color2)
    this.color2.lerp(this.tmpColor, 0.05)

    // Flip triangles each frame
    this.flipRatio ^= 1

    const posRT = simulator.positionRenderTarget.texture
    const tMat = this.triangleMesh.material as THREE.ShaderMaterial
    tMat.uniforms.texturePosition.value = posRT
    tMat.uniforms.flipRatio.value = this.flipRatio

    const pMat = this.pointMesh.material as THREE.ShaderMaterial
    pMat.uniforms.texturePosition.value = posRT

    // Bloom
    this.bloomPass.strength = settings.bloomStrength
    this.bloomPass.radius = settings.bloomRadius
    this.bloomPass.threshold = settings.bloomThreshold
  }

  render() {
    this.composer.render()
  }

  dispose() {
    this.triangleMesh.geometry.dispose()
    ;(this.triangleMesh.material as THREE.Material).dispose()
    this.pointMesh.geometry.dispose()
    ;(this.pointMesh.material as THREE.Material).dispose()
    this.composer.dispose()
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && bun run build 2>&1 | grep -i error | head -20`

Expected: No errors. The `@ts-ignore` lines suppress missing declarations for Three.js addons.

---

### Task 6: Create spirit-presets.ts

**Files:**
- Create: `apps/web/src/data/spirit-presets.ts`

Single source of truth for all visual + audio states. All numeric params smoothstep-lerp between presets. `useTriangles` is fixed per-preset (not lerped — boolean). To add a new state: add one object to `PRESETS` and one entry to `AUTO_CYCLE`.

- [ ] **Step 1: Create spirit-presets.ts**

`apps/web/src/data/spirit-presets.ts`:

```ts
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
  speed: 1.0,
  dieSpeed: 0.015,
  radius: 0.6,
  curlSize: 0.02,
  attraction: 1.0,
  followSpeed: 1.0,
  color1: '#ffffff',
  color2: '#9b8cff',
  bgColor: '#1a1a2e',
  bloomStrength: 0.5,
  bloomRadius: 0.3,
  bloomThreshold: 0.0,
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
  storm: stormPreset,
  drift: driftPreset,
}

export const TRANSITION_DURATION_MS = 3000

export const AUTO_CYCLE: { preset: string; holdMs: number }[] = [
  { preset: 'default', holdMs: 10000 },
  { preset: 'storm',   holdMs: 8000  },
  { preset: 'drift',   holdMs: 9000  },
]

export const AUDIO = {
  ambientLoop: '/audio/ambient.mp3',
  ambientVolume: 0.3,
  sfxVolume: 0.7,
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && bun run build 2>&1 | grep -i error | head -10`

Expected: No errors.

---

### Task 7: Create engine.ts (AudioEngine + SpiritEngine)

**Files:**
- Create: `apps/web/src/lib/spirit/engine.ts`

`AudioEngine` is identical in purpose to the galaxy plan: Web Audio API, gapless ambient loop, SFX preload, autoplay unlock. `SpiritEngine` owns the renderer, simulator, particles, follow-point animation, smoothstep transition lerper, and auto-cycle timer.

**Follow-point animation:** When not tracking mouse (HTML overlay takes pointer events), the follow point traces a Lissajous figure-8 path — `(cos(t)·r, cos(4t)·h, sin(2t)·r)`. This is the auto-follow path from the upstream source. `followSpeed` preset param scales the time multiplier.

**initAnimation ramp:** On mount, `initAnimation` goes from 0→1 over 3 s. This drives the intro sweep in `position.frag` where particles rise from below.

- [ ] **Step 1: Create engine.ts**

`apps/web/src/lib/spirit/engine.ts`:

```ts
import * as THREE from 'three'
import { SpiritSimulator } from './simulator'
import { SpiritParticles } from './particles'
import {
  PRESETS,
  TRANSITION_DURATION_MS,
  AUTO_CYCLE,
  AUDIO,
  type SpiritPreset,
} from '../../data/spirit-presets'

// ─── AudioEngine ──────────────────────────────────────────────────────────────

class AudioEngine {
  private ctx: AudioContext | null = null
  private ambientGain: GainNode | null = null
  private sfxGain: GainNode | null = null
  private ambientSource: AudioBufferSourceNode | null = null
  private sfxBuffers = new Map<string, AudioBuffer>()
  private unlocked = false

  async init(): Promise<void> {
    this.ctx = new AudioContext()

    this.ambientGain = this.ctx.createGain()
    this.ambientGain.gain.value = AUDIO.ambientVolume
    this.ambientGain.connect(this.ctx.destination)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = AUDIO.sfxVolume
    this.sfxGain.connect(this.ctx.destination)

    try {
      const res = await fetch(AUDIO.ambientLoop)
      const buf = await res.arrayBuffer()
      const decoded = await this.ctx.decodeAudioData(buf)
      this.ambientSource = this.ctx.createBufferSource()
      this.ambientSource.buffer = decoded
      this.ambientSource.loop = true
      this.ambientSource.connect(this.ambientGain)
      this.ambientSource.start()
    } catch (e) {
      console.warn('[AudioEngine] ambient MP3 failed to load', e)
    }

    const sfxPaths = new Set<string>()
    for (const preset of Object.values(PRESETS)) {
      if (preset.soundEffect) sfxPaths.add(preset.soundEffect)
    }
    await Promise.allSettled(
      [...sfxPaths].map(async (path) => {
        try {
          const res = await fetch(path)
          const buf = await res.arrayBuffer()
          const ctx = this.ctx!
          const decoded = await ctx.decodeAudioData(buf)
          this.sfxBuffers.set(path, decoded)
        } catch (e) {
          console.warn(`[AudioEngine] SFX ${path} failed to load`, e)
        }
      }),
    )

    const unlock = () => this.unlock()
    document.addEventListener('click', unlock, { once: true })
    document.addEventListener('keydown', unlock, { once: true })
    document.addEventListener('touchstart', unlock, { once: true })
  }

  dispose(): void {
    this.ambientSource?.stop()
    this.ctx?.close()
    this.ctx = null
    this.sfxBuffers.clear()
  }

  playSFX(path: string): void {
    if (!this.ctx || !this.sfxGain) return
    const buf = this.sfxBuffers.get(path)
    if (!buf) { console.warn(`[AudioEngine] SFX not preloaded: ${path}`); return }
    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.connect(this.sfxGain)
    src.start()
  }

  unlock(): void {
    if (this.unlocked || !this.ctx) return
    this.ctx.resume()
    this.unlocked = true
  }
}

// ─── SpiritEngine ─────────────────────────────────────────────────────────────

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
  private cycleTimer: ReturnType<typeof setTimeout> | null = null
  private cycleIndex = 0
  private lastFrameTime = 0
  private resizeObserver: ResizeObserver | null = null

  private followTime = 0
  private followPoint = new THREE.Vector3()
  private initTime = 0
  private initDone = false

  private currentPreset: SpiritPreset = PRESETS.default
  private lerpState: { from: SpiritPreset; to: SpiritPreset; elapsed: number; active: boolean } | null = null
  private bgColor = new THREE.Color()

  async init(container: HTMLElement): Promise<void> {
    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(container.clientWidth, container.clientHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = false
    container.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    const preset = this.currentPreset
    this.bgColor.setStyle(preset.bgColor)
    this.renderer.setClearColor(this.bgColor)
    this.scene.fog = new THREE.FogExp2(this.bgColor.getHex(), 0.001)

    this.camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 10, 3000)
    this.camera.position.set(300, 60, 300).normalize().multiplyScalar(1000)
    this.camera.lookAt(0, 50, 0)

    // Default texture size = 256×256 = 65,536 particles
    this.simulator = new SpiritSimulator(this.renderer, 256, 256)
    this.particles = new SpiritParticles(this.renderer, this.scene, this.camera, this.simulator)
    this.scene.add(this.particles.container)

    this.audio = new AudioEngine()
    await this.audio.init()

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
    this._scheduleCycle()
  }

  dispose(): void {
    if (this.raf !== null) cancelAnimationFrame(this.raf)
    if (this.cycleTimer !== null) clearTimeout(this.cycleTimer)
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

  transition(presetName: string): void {
    const preset = PRESETS[presetName]
    if (!preset) { console.warn(`[SpiritEngine] unknown preset: ${presetName}`); return }
    if (preset.soundEffect) this.audio?.playSFX(preset.soundEffect)
    const from = this.lerpState?.active ? this._snapshot() : { ...this.currentPreset }
    this.lerpState = { from, to: preset, elapsed: 0, active: true }
    if (this.cycleTimer !== null) clearTimeout(this.cycleTimer)
    const idx = AUTO_CYCLE.findIndex((c) => c.preset === presetName)
    if (idx !== -1) this.cycleIndex = idx
    this._scheduleCycle()
  }

  private _scheduleCycle(): void {
    const current = AUTO_CYCLE[this.cycleIndex]
    if (!current) return
    this.cycleTimer = setTimeout(() => {
      this.cycleIndex = (this.cycleIndex + 1) % AUTO_CYCLE.length
      const name = AUTO_CYCLE[this.cycleIndex].preset
      const next = PRESETS[name]
      if (!next) return
      if (next.soundEffect) this.audio?.playSFX(next.soundEffect)
      const from = this.lerpState?.active ? this._snapshot() : { ...this.currentPreset }
      this.lerpState = { from, to: next, elapsed: 0, active: true }
      this._scheduleCycle()
    }, current.holdMs)
  }

  private _snapshot(): SpiritPreset {
    if (!this.lerpState) return { ...this.currentPreset }
    const { from, to, elapsed } = this.lerpState
    const t = Math.min(elapsed / TRANSITION_DURATION_MS, 1)
    return this._lerp(from, to, t * t * (3 - 2 * t))
  }

  private _lerp(from: SpiritPreset, to: SpiritPreset, t: number): SpiritPreset {
    const colorKeys = new Set<keyof SpiritPreset>(['color1', 'color2', 'bgColor'])
    const result: any = { ...from }
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
    return result as SpiritPreset
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

    // Advance transition
    let current = this.currentPreset
    if (this.lerpState?.active) {
      this.lerpState.elapsed += dt
      const t = Math.min(this.lerpState.elapsed / TRANSITION_DURATION_MS, 1)
      const eased = t * t * (3 - 2 * t)
      current = this._lerp(this.lerpState.from, this.lerpState.to, eased)
      if (t >= 1) {
        this.currentPreset = this.lerpState.to
        this.lerpState.active = false
      }
    }

    // Animate follow point (figure-8 Lissajous path)
    this.followTime += dt * 0.001 * current.followSpeed
    this.followPoint.set(
      Math.cos(this.followTime) * FOLLOW_R,
      Math.cos(this.followTime * 4) * FOLLOW_H,
      Math.sin(this.followTime * 2) * FOLLOW_R,
    )

    // Update background color + fog
    this.bgColor.setStyle(current.bgColor)
    this.renderer.setClearColor(this.bgColor)
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.copy(this.bgColor)
    }

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && bun run build 2>&1 | grep -i error | head -20`

Expected: No errors from engine.ts.

---

### Task 8: Create useSpirit hook

**Files:**
- Create: `apps/web/src/hooks/useSpirit.ts`

- [ ] **Step 1: Create useSpirit.ts**

`apps/web/src/hooks/useSpirit.ts`:

```ts
import { useRef, useEffect, useCallback, type RefObject } from 'react'
import { SpiritEngine } from '@/lib/spirit/engine'

export function useSpirit(containerRef: RefObject<HTMLDivElement | null>): {
  transition: (presetName: string) => void
} {
  const engineRef = useRef<SpiritEngine | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const engine = new SpiritEngine()
    engineRef.current = engine
    engine.init(container).catch((err) => {
      console.error('[useSpirit] engine init failed', err)
    })
    return () => {
      engine.dispose()
      engineRef.current = null
    }
  }, [])

  const transition = useCallback((presetName: string) => {
    engineRef.current?.transition(presetName)
  }, [])

  return { transition }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd apps/web && bun run build 2>&1 | grep -i error | head -10`

Expected: No errors.

---

### Task 9: Update AppPage.tsx and app-route.spec.ts

**Files:**
- Modify: `apps/web/src/pages/AppPage.tsx`
- Modify: `apps/web/tests/app-route.spec.ts`

- [ ] **Step 1: Replace AppPage.tsx**

`apps/web/src/pages/AppPage.tsx`:

```tsx
import { useRef } from 'react'
import { useSpirit } from '@/hooks/useSpirit'

export function AppPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  useSpirit(containerRef)

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black">
      <div ref={containerRef} className="absolute inset-0" />
      <div className="relative z-10" />
    </div>
  )
}
```

- [ ] **Step 2: Update app-route.spec.ts**

`apps/web/tests/app-route.spec.ts`:

```ts
import { test, expect, type Page } from "@playwright/test"

async function mockNoWebGPU(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "gpu", {
      get: () => undefined,
      configurable: true,
    })
  })
}

async function mockWebGPU(page: Page) {
  await page.addInitScript(() => {
    const fakeAdapter = {
      info: { vendor: "Test Vendor", architecture: "test-arch", device: "", description: "" },
      requestAdapterInfo: async () => ({
        vendor: "Test Vendor",
        architecture: "test-arch",
        device: "",
        description: "",
      }),
    }
    Object.defineProperty(navigator, "gpu", {
      get: () => ({ requestAdapter: () => Promise.resolve(fakeAdapter) }),
      configurable: true,
    })
  })
}

test.describe("/app route", () => {
  test("redirects to home when WebGPU is not supported", async ({ page }) => {
    await mockNoWebGPU(page)
    await page.goto("/app")
    await expect(page).toHaveURL("/")
  })

  test("renders spirit layout when WebGPU is available", async ({ page }) => {
    await mockWebGPU(page)
    await page.goto("/app")
    await expect(page.locator("div.absolute.inset-0")).toBeAttached()
    await expect(page.locator("div.relative.z-10")).toBeAttached()
  })
})
```

- [ ] **Step 3: Run spirit-background.spec.ts — confirm passes**

Run: `cd apps/web && bun run test:e2e --grep "spirit background" 2>&1 | tail -20`

Expected: PASS

- [ ] **Step 4: Run app-route.spec.ts — confirm passes**

Run: `cd apps/web && bun run test:e2e --grep "/app route" 2>&1 | tail -20`

Expected: PASS (2 tests)

---

### Task 10: Verify build and commit

**Files:**
- Create: `tasks/40-spirit-background.md`

- [ ] **Step 1: Run full TypeScript build**

Run: `cd apps/web && bun run build 2>&1 | tail -20`

Expected: Build succeeds with no errors. If Three.js addon imports cause type errors despite `@ts-ignore`, try replacing the named imports with default import + destructure: `import EC from 'three/addons/postprocessing/EffectComposer.js'; const EffectComposer = EC.EffectComposer ?? EC`.

- [ ] **Step 2: Run all E2E tests**

Run: `cd apps/web && bun run test:e2e 2>&1 | tail -30`

Expected:
- `spirit-background.spec.ts` — 1/1 PASS
- `app-route.spec.ts` — 2/2 PASS
- `calendar.spec.ts` + `call-logs.spec.ts` — 13 pre-existing failures, unrelated

- [ ] **Step 3: Create tasks/40-spirit-background.md**

`tasks/40-spirit-background.md`:

```
---
status: done
---
# Task 40: The Spirit WebGL Background for /app

## What was done
- Installed three@0.184.0 in apps/web
- Created apps/web/src/lib/spirit/shaders.ts — all GLSL as TS string constants
  (glslify deps inlined: simplexNoiseDerivatives4 + curl4; shadows removed)
- Created apps/web/src/lib/spirit/simulator.ts — SpiritSimulator GPGPU class
  (position update via WebGLRenderTarget ping-pong; adapted r74→r184 API)
- Created apps/web/src/lib/spirit/particles.ts — SpiritParticles class
  (triangle mesh + point mesh; EffectComposer + UnrealBloomPass)
- Created apps/web/src/data/spirit-presets.ts — default/storm/drift presets + AUDIO + AUTO_CYCLE
- Created apps/web/src/lib/spirit/engine.ts — AudioEngine + SpiritEngine
  (smoothstep transitions, auto-cycle timer, figure-8 follow point, init ramp)
- Created apps/web/src/hooks/useSpirit.ts — React hook
- Replaced AppPage.tsx with full-screen canvas background + z-10 HTML overlay
- Added apps/web/tests/spirit-background.spec.ts
- Updated apps/web/tests/app-route.spec.ts

## Key decisions
- Source: edankwan/The-Spirit (MIT) — ported r74→r184, glslify inlined, shadows removed
- WebGL GPGPU (not WebGPU compute): particle positions stored in float texture,
  updated each frame via fragment shader render-to-texture (two ping-pong targets)
- curl noise: 3-octave 4D simplex noise derivatives — gives the organic fluid movement
- Triangle particles: two alternating corner sets flip each frame (flipRatio XOR)
  creating the shimmery crystalline appearance
- follow point: auto-animated Lissajous figure-8 path — HTML overlay takes pointer events
- initAnimation: ramps 0→1 over 3 s driving the particle rise-from-below intro
- useTriangles is NOT lerped between presets (boolean, switches immediately)
- AudioEngine: Web Audio API gapless loop, unlock() on first user interaction
```

- [ ] **Step 4: Commit**

```bash
git add \
  apps/web/src/lib/spirit/ \
  apps/web/src/hooks/useSpirit.ts \
  apps/web/src/data/spirit-presets.ts \
  apps/web/src/pages/AppPage.tsx \
  apps/web/tests/spirit-background.spec.ts \
  apps/web/tests/app-route.spec.ts \
  apps/web/package.json \
  bun.lock \
  tasks/40-spirit-background.md
git commit -m "feat: add The Spirit WebGL particle background to /app"
```
