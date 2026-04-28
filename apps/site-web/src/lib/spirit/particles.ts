import * as THREE from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { AfterimagePass } from 'three/addons/postprocessing/AfterimagePass.js'
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
  private afterimagePass: InstanceType<typeof AfterimagePass>
  private flipRatio = 0

  constructor(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    simulator: SpiritSimulator,
    initialColor1 = '#001020',
    initialColor2 = '#00446d',
  ) {
    this.container = new THREE.Object3D()
    this.color1 = new THREE.Color(initialColor1)
    this.color2 = new THREE.Color(initialColor2)
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
    // AfterimagePass — feeds previous frame back. damp closer to 1 = longer
    // trails / heavier motion blur. 0.97 produced a soft glowing blob
    // dominated by the trail; 0.85 keeps individual particle silhouettes
    // visible while still adding a sense of motion.
    this.afterimagePass = new AfterimagePass(0.85)
    this.composer.addPass(this.afterimagePass)
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

    // Lerp colors — 0.12 per frame keeps up with the 600ms transition window
    this.tmpColor.setStyle(settings.color1)
    this.color1.lerp(this.tmpColor, 0.12)
    this.tmpColor.setStyle(settings.color2)
    this.color2.lerp(this.tmpColor, 0.12)

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
