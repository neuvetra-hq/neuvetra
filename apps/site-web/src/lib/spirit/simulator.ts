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
    this.gpgpuMesh.material = this.copyMaterial
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

    this.gpgpuMesh.material = this.positionMaterial
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
