import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { Coords, Vector3 } from '../engine/context/coords.js'
import { HEAD_FACES } from '../engine/context/coords.js'
import type { Terrain } from '../engine/world/Terrain.js'
import { MATERIALS } from '../engine/components/materials.js'
import type { RenderTarget, RenderWorld } from './RenderTarget.js'

const WIRE_DIM = 0x888888
const WIRE_FAINT = 0x444444
const HC_COLOR = 0xffffff

export class ThreeRenderer implements RenderTarget {
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private size: number
  private coords: Coords

  private headGroup: THREE.Group
  private listening = true
  private headPos: Vector3 = { x: 0, y: 0, z: 0 }

  private reliefMeshes: THREE.Mesh[] = []
  private reliefEdges: THREE.LineSegments[] = []

  private rainGroup?: THREE.Group
  private rainPosAttr?: THREE.BufferAttribute
  private rainSpeeds: Float32Array = new Float32Array(80)
  private rainDensity = 0.5
  private rainWindRot = 0
  private rainWindForce = 0
  private _rainOn = false
  private _lastRainTime = 0

  private fieldGroup?: THREE.Group
  private _fieldVizOn = false
  private _fieldKey = ''

  private voiceGroup?: THREE.Group

  get canvas(): HTMLCanvasElement { return this.renderer.domElement }

  constructor(coords: Coords, terrain: Terrain, canvas?: HTMLCanvasElement) {
    this.coords = coords
    this.size = coords.size

    const canvasEl = canvas ?? document.createElement('canvas')
    this.renderer = new THREE.WebGLRenderer({ canvas: canvasEl, antialias: true, alpha: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setClearColor(0x000000, 0)

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 5000)

    this.buildWorldCube()
    this.buildGroundGrid()
    this.buildRelief(terrain)
    this.headGroup = this.buildHead()
    this.scene.add(this.headGroup)
    this.buildRain()
    this.buildFieldShells()
    this.buildVoiceMarkers()

    window.addEventListener('resize', this.onResize)
  }

  private onResize = (): void => {
    this.camera.aspect = window.innerWidth / window.innerHeight
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  private buildWorldCube(): void {
    const geo = new THREE.BoxGeometry(this.size, this.size, this.size)
    const edges = new THREE.EdgesGeometry(geo)
    const mat = new THREE.LineBasicMaterial({ color: WIRE_DIM, transparent: true, opacity: 0.3 })
    const wire = new THREE.LineSegments(edges, mat)
    this.scene.add(wire)
  }

  private buildGroundGrid(): void {
    const { size, half, ground } = this.coords
    const step = size / 25
    const pts: THREE.Vector3[] = []
    for (let i = -half; i <= half + 1e-9; i += step) {
      pts.push(new THREE.Vector3(i, ground, -half))
      pts.push(new THREE.Vector3(i, ground, half))
      pts.push(new THREE.Vector3(-half, ground, i))
      pts.push(new THREE.Vector3(half, ground, i))
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts)
    const mat = new THREE.LineBasicMaterial({ color: WIRE_FAINT, transparent: true, opacity: 0.15 })
    const lines = new THREE.LineSegments(geo, mat)
    this.scene.add(lines)
  }

  private buildRain(): void {
    const count = 80
    const { half, ground } = this.coords
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() * 2 - 1) * half
      pos[i * 3 + 1] = ground + Math.random() * this.size
      pos[i * 3 + 2] = (Math.random() * 2 - 1) * half
      this.rainSpeeds[i] = 8 + Math.random() * 10
    }
    const attr = new THREE.BufferAttribute(pos, 3)
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', attr)
    this.rainPosAttr = attr
    const mat = new THREE.PointsMaterial({
      color: 0xcfe0ff, size: 2, transparent: true, opacity: 0.6,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: false,
    })
    const pts = new THREE.Points(geo, mat)
    this.rainGroup = new THREE.Group()
    this.rainGroup.add(pts)
    this.rainGroup.visible = false
    this.scene.add(this.rainGroup)
  }

  private buildRelief(terrain: Terrain): void {
    const { half, ground, BLOCK } = this.coords
    const groups = new Map<number, THREE.BoxGeometry[]>()

    for (let br = 0; br < terrain.brows; br++) {
      for (let bc = 0; bc < terrain.bcols; bc++) {
        const bh = terrain.height[br * terrain.bcols + bc]
        if (bh === 0) continue
        const cx = (bc + 0.5) * BLOCK - half
        const cz = (br + 0.5) * BLOCK - half
        const hWorld = bh * BLOCK

        const cell = terrain.cellAt(cx, cz)
        const matId = cell ? MATERIALS.findIndex(m => m.id === cell.material.id) : 0

        const box = new THREE.BoxGeometry(BLOCK, hWorld, BLOCK)
        box.translate(cx, ground + hWorld / 2, cz)

        if (!groups.has(matId)) groups.set(matId, [])
        groups.get(matId)!.push(box)
      }
    }

    for (const [matIndex, boxes] of groups) {
      if (boxes.length === 0) continue
      const merged = boxes.length === 1 ? boxes[0] : mergeGeometries(boxes)
      const color = MATERIALS[matIndex]?.debugColor ?? WIRE_DIM

      const faceMat = new THREE.MeshBasicMaterial({ color: 0x000000, polygonOffset: true, polygonOffsetFactor: 1 })
      const mesh = new THREE.Mesh(merged.clone(), faceMat)
      this.scene.add(mesh)
      this.reliefMeshes.push(mesh)

      const edgeGeo = new THREE.EdgesGeometry(merged)
      const edgeMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.2 })
      const edges = new THREE.LineSegments(edgeGeo, edgeMat)
      this.scene.add(edges)
      this.reliefEdges.push(edges)
    }
  }

  private buildFieldShells(): void {
    const group = new THREE.Group()
    group.visible = false
    this.fieldGroup = group
    this.scene.add(group)
    /* Les coquilles sont construites à la première activation (setFieldViz). */
  }

  private rebuildShells(field?: { core?: number; sigma?: number; p?: number; floor?: number; ky?: number }): void {
    if (!this.fieldGroup) return
    while (this.fieldGroup.children.length) {
      const c = this.fieldGroup.children[0]
      c.parent?.remove(c)
      if (c instanceof THREE.LineSegments) {
        c.geometry?.dispose()
        if (Array.isArray(c.material)) c.material.forEach(m => m.dispose())
        else c.material?.dispose()
      }
    }

    if (!field) return
    const { core = 0, sigma = 6, p = 1, floor = 0.05, ky = 0.6 } = field
    const weights = [0.75, 0.5, 0.25, 0.1]
    const segs = 20
    const SHELL_COLOR = 0xe8c96d

    for (const wt of weights) {
      if (wt <= floor) continue
      const r = core + sigma * Math.pow(-2 * Math.log((wt - floor) / (1 - floor)), 1 / p)
      if (!isFinite(r) || r <= 0) continue

      const geo = new THREE.SphereGeometry(r, segs, segs)
      const edges = new THREE.EdgesGeometry(geo)
      const mat = new THREE.LineBasicMaterial({
        color: SHELL_COLOR, transparent: true, opacity: 0.15, depthWrite: false,
      })
      const shell = new THREE.LineSegments(edges, mat)
      shell.scale.y = ky
      this.fieldGroup.add(shell)
    }
  }

  setFieldViz(on: boolean, field?: { core?: number; sigma?: number; p?: number; floor?: number; ky?: number }): void {
    this._fieldVizOn = on
    if (!this.fieldGroup) return
    if (on) {
      const key = field ? `${field.core},${field.sigma},${field.p},${field.floor},${field.ky}` : ''
      if (key !== this._fieldKey) {
        this._fieldKey = key
        this.rebuildShells(field)
      }
    }
    this.fieldGroup.visible = on
  }

  private buildVoiceMarkers(): void {
    const group = new THREE.Group()
    group.visible = false
    this.voiceGroup = group
    this.scene.add(group)
    const n = 40
    const geo = new THREE.SphereGeometry(0.05, 8, 8)
    for (let i = 0; i < n; i++) {
      const mat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.5 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.visible = false
      group.add(mesh)
    }
  }

  setDebugVoices(
    voices: { x: number; y: number; z: number; level: number; materialId: string }[],
    on: boolean,
  ): void {
    if (!this.voiceGroup) return
    this.voiceGroup.visible = on && voices.length > 0
    const markers = this.voiceGroup.children as THREE.Mesh[]
    for (let i = 0; i < markers.length; i++) {
      if (i < voices.length) {
        const v = voices[i]
        const m = markers[i]
        m.visible = true
        m.position.set(v.x, v.y, v.z)
        const color = MATERIALS.find(mat => mat.id === v.materialId)?.debugColor ?? 0x888888
        const mat = (Array.isArray(m.material) ? m.material[0] : m.material) as THREE.MeshBasicMaterial
        mat.color.setHex(color)
        const s = Math.max(0.5, Math.min(2, (v.level + 50) / 50))
        m.scale.setScalar(s)
      } else {
        markers[i].visible = false
      }
    }
  }

  private buildHead(): THREE.Group {
    const group = new THREE.Group()
    const { HC } = this.coords

    const cubeGeo = new THREE.BoxGeometry(HC, HC, HC)
    const cubeEdges = new THREE.EdgesGeometry(cubeGeo)
    const cubeMat = new THREE.LineBasicMaterial({ color: HC_COLOR })
    const cube = new THREE.LineSegments(cubeEdges, cubeMat)
    group.add(cube)

    const dotGeo = new THREE.SphereGeometry(0.03 * HC, 8, 8)
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    const dot = new THREE.Mesh(dotGeo, dotMat)
    group.add(dot)

    const hs = HC / 2
    for (const face of HEAD_FACES) {
      const fg = new THREE.SphereGeometry(0.015 * HC, 8, 8)
      const fm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 })
      const fmesh = new THREE.Mesh(fg, fm)
      fmesh.position.set(face.n[0] * hs, face.n[1] * hs, face.n[2] * hs)
      group.add(fmesh)
    }

    return group
  }

  setHeadPosition(pos: Vector3): void {
    this.headPos = pos
  }

  setListening(v: boolean): void {
    this.listening = v
  }

  setRain(active: boolean, density: number, wind?: { rot: number; force: number }): void {
    this._rainOn = active
    this.rainDensity = density
    if (wind) {
      this.rainWindRot = wind.rot
      this.rainWindForce = wind.force
    }
    if (this.rainGroup) this.rainGroup.visible = active && density > 0
  }

  draw(_world: RenderWorld, _alpha: number): void {
    const { half, HC } = this.coords
    const { headPos } = this

    const s = this.listening
      ? 1 + 0.03 * Math.sin(performance.now() / 1000 * 3)
      : 1
    this.headGroup.position.set(headPos.x, headPos.y, headPos.z)
    this.headGroup.scale.set(s, s, s)
    if (this.fieldGroup) this.fieldGroup.position.set(headPos.x, headPos.y, headPos.z)

    const spinRad = this.spin * Math.PI / 180
    const tiltRad = 22.5 * Math.PI / 180
    const dist = this.size * 2.1 / this.zoom
    this.camera.position.set(
      dist * Math.sin(spinRad) * Math.cos(tiltRad),
      dist * Math.sin(tiltRad),
      dist * Math.cos(spinRad) * Math.cos(tiltRad),
    )
    this.camera.lookAt(0, 0, 0)

    this._tickRain()
    this.renderer.render(this.scene, this.camera)
  }

  private _tickRain(): void {
    if (!this.rainGroup || !this._rainOn || this.rainDensity <= 0) return
    const now = performance.now()
    if (this._lastRainTime === 0) { this._lastRainTime = now; return }
    const dt = Math.min((now - this._lastRainTime) / 1000, 0.05)
    this._lastRainTime = now

    const count = 80
    const visible = Math.round(count * this.rainDensity)
    const pos = this.rainPosAttr!.array as Float32Array
    const { half, ground } = this.coords

    const wdx = this.rainWindForce > 0
      ? Math.sin(this.rainWindRot * Math.PI / 180) * this.rainWindForce * 2
      : 0
    const wdz = this.rainWindForce > 0
      ? Math.cos(this.rainWindRot * Math.PI / 180) * this.rainWindForce * 2
      : 0

    for (let i = 0; i < count; i++) {
      if (i < visible) {
        pos[i * 3 + 1] -= this.rainSpeeds[i] * dt
        pos[i * 3] += wdx * dt
        pos[i * 3 + 2] += wdz * dt
        if (pos[i * 3 + 1] < ground) {
          pos[i * 3 + 1] = +half
          pos[i * 3] = (Math.random() * 2 - 1) * half
          pos[i * 3 + 2] = (Math.random() * 2 - 1) * half
        }
        if (pos[i * 3] > half) pos[i * 3] = -half
        if (pos[i * 3] < -half) pos[i * 3] = half
        if (pos[i * 3 + 2] > half) pos[i * 3 + 2] = -half
        if (pos[i * 3 + 2] < -half) pos[i * 3 + 2] = half
      } else {
        pos[i * 3 + 1] = ground - 100
      }
    }
    this.rainPosAttr!.needsUpdate = true
  }

  dispose(): void {
    window.removeEventListener('resize', this.onResize)
    this.scene.traverse(child => {
      if (child instanceof THREE.Mesh || child instanceof THREE.LineSegments) {
        child.geometry?.dispose()
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose())
        } else {
          child.material?.dispose()
        }
      }
    })
    this.renderer.dispose()
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement)
    }
  }

  spin = 0
  zoom = 1
}
