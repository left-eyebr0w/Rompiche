import React, { useRef, useEffect, useMemo } from 'react'
import * as THREE from 'three'

/* Token colours (mirrors ds/tokens/colors.css — viewport context) */
const C = {
  wire:     0xffffff,
  wireDim:  0x6e6e6e,
  wireFaint:0x3a3a3a,
  blanc:    0xffffff,
  canvasNoir: '#0d0d0d',
}

function buildCubeEdges(size, color) {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size))
  const mat = new THREE.LineBasicMaterial({ color })
  return new THREE.LineSegments(geo, mat)
}

/* Ground-face hatch geometry — métal = 45° lines, terre = dot grid */
function buildMetalHatch(halfX, halfZ) {
  const pts = []
  const step = 12
  for (let c = -(halfX + halfZ); c <= halfX + halfZ; c += step) {
    // NE diagonal: z = x + c, clipped to rectangle [-halfX,halfX]×[-halfZ,halfZ]
    const x1 = Math.max(-halfX, -halfZ - c), x2 = Math.min(halfX, halfZ - c)
    if (x1 < x2) {
      pts.push(new THREE.Vector3(x1, 0, x1 + c))
      pts.push(new THREE.Vector3(x2, 0, x2 + c))
    }
    // NW diagonal: z = -x + c
    const x3 = Math.max(-halfX, c - halfZ), x4 = Math.min(halfX, c + halfZ)
    if (x3 < x4) {
      pts.push(new THREE.Vector3(x3, 0, -x3 + c))
      pts.push(new THREE.Vector3(x4, 0, -x4 + c))
    }
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: C.wireFaint }))
}

function buildBacheGrid(halfX, halfZ) {
  const pts = []
  const step = 11
  for (let x = -halfX; x <= halfX; x += step) {
    pts.push(new THREE.Vector3(x, 0, -halfZ))
    pts.push(new THREE.Vector3(x, 0,  halfZ))
  }
  for (let z = -halfZ; z <= halfZ; z += step) {
    pts.push(new THREE.Vector3(-halfX, 0, z))
    pts.push(new THREE.Vector3( halfX, 0, z))
  }
  const geo = new THREE.BufferGeometry().setFromPoints(pts)
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: C.wireFaint }))
}

/* Build rain buffer — random (x,z) fixed, y animated via shader time uniform */
function buildRain(half, count) {
  const positions = []
  const speeds   = []
  const offsets  = []
  for (let i = 0; i < count; i++) {
    positions.push(
      (Math.random() * 2 - 1) * (half - 14),
      (Math.random() * 2 - 1) * (half - 14),
      (Math.random() * 2 - 1) * (half - 14),
    )
    speeds.push(0.55 + Math.random() * 0.7)
    offsets.push(Math.random())
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('speed',    new THREE.Float32BufferAttribute(speeds,    1))
  geo.setAttribute('offset',   new THREE.Float32BufferAttribute(offsets,   1))
  return geo
}

const RAIN_VERT = /* glsl */`
attribute float speed;
attribute float offset;
uniform float uTime;
uniform float uHalf;
uniform float uWindTilt;     /* radians, tilt magnitude */
uniform float uWindRotation; /* radians, direction in XZ plane */
void main() {
  float t = mod(offset + uTime / speed, 1.0);
  float y = mix(uHalf, -uHalf, t);
  vec3 p = vec3(position.x, y, position.z);
  float disp = sin(uWindTilt) * (y - position.y);
  p.x += cos(uWindRotation) * disp;
  p.z += sin(uWindRotation) * disp;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = 1.5;
}
`
const RAIN_FRAG = /* glsl */`
uniform float uOpacity;
void main() {
  gl_FragColor = vec4(1.0, 1.0, 1.0, uOpacity);
}
`

const RAIN_POOL = 80

/* Couleurs de l'overlay debug des voix (une par matériau) — palette dédiée au
   diagnostic, volontairement distincte du monochrome de la scène. */
const VOICE_COLORS = { metal: 0xe8c96d, bache: 0x7ec8e3, terre: 0x9ae87a }

export default function WireframeCube({
  size = 360, terrain = null, head = { x: 0, y: 0, z: 0 },
  rain = true, metal = true, bache = true, listening = false,
  spin = -32, zoom = 1, density = 0.5, wind = false, windTilt = 0.5, windRotation = 0, windForce = 0.5,
  onImpact = null,
  samplerRef = null, debug = false,
}) {
  const canvasRef   = useRef(null)
  const threeRef    = useRef(null)
  const impactState = useRef({ metal, bache, onImpact, terrain })
  const debugState  = useRef({ debug, samplerRef })

  const half = size / 2
  const dropCount = rain ? Math.round(12 + density * (RAIN_POOL - 12)) : 0

  /* ── Init Three.js once ─────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setClearColor(0x000000, 0)
    renderer.setPixelRatio(window.devicePixelRatio)

    const scene = new THREE.Scene()

    const w = canvas.clientWidth  || canvas.offsetWidth  || 800
    const h = canvas.clientHeight || canvas.offsetHeight || 600
    renderer.setSize(w, h, false)

    const camera = new THREE.PerspectiveCamera(45, w / h, 1, 5000)
    camera.position.set(0, 0, size * 2.1 / zoom)
    camera.lookAt(0, 0, 0)

    /* World cube — 5 dim edges + 1 bright front-facing edge group */
    const worldEdges = buildCubeEdges(size, C.wireDim)
    scene.add(worldEdges)

    /* Ground plane split — left=métal, right=bâche (cf. terrain par défaut) */
    const metalHatch = buildMetalHatch(half / 2, half)
    metalHatch.position.set(-half / 2, -half, 0)
    scene.add(metalHatch)

    const bacheGrid = buildBacheGrid(half / 2, half)
    bacheGrid.position.set(half / 2, -half, 0)
    scene.add(bacheGrid)

    /* Ground divider */
    const divGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -half, -half),
      new THREE.Vector3(0, -half,  half),
    ])
    const divLine = new THREE.Line(divGeo, new THREE.LineBasicMaterial({ color: C.wireFaint }))
    scene.add(divLine)

    /* Head cube */
    const HC = Math.round(size * 0.26)
    const headEdges = buildCubeEdges(HC, C.wire)
    scene.add(headEdges)

    /* Listener dot */
    const headDotGeo = new THREE.SphereGeometry(6.5, 10, 10)
    const headDotMat = new THREE.MeshBasicMaterial({ color: C.blanc })
    const headDot    = new THREE.Mesh(headDotGeo, headDotMat)
    scene.add(headDot)

    /* Speaker dots on head-cube faces */
    const HCH = HC / 2
    const speakerDots = []
    const faceOffsets = [
      [0, 0, HCH], [0, 0, -HCH],
      [HCH, 0, 0], [-HCH, 0, 0],
      [0, HCH, 0], [0, -HCH, 0],
    ]
    faceOffsets.forEach(([fx, fy, fz], i) => {
      const g = new THREE.SphereGeometry(i === 0 ? 3.5 : 3, 8, 8)
      const m = new THREE.MeshBasicMaterial({ color: i === 0 ? C.blanc : C.wireDim })
      const mesh = new THREE.Mesh(g, m)
      mesh.position.set(fx, fy, fz)
      headEdges.add(mesh)
      speakerDots.push(mesh)
    })

    /* Rain */
    const rainGeo = buildRain(half, RAIN_POOL)
    const _speeds    = rainGeo.attributes.speed.array
    const _offsets   = rainGeo.attributes.offset.array
    const _positions = rainGeo.attributes.position.array
    const prevPhases = new Float64Array(RAIN_POOL)   /* tracks floor(offset + uTime/speed) */

    const rainMat = new THREE.ShaderMaterial({
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      uniforms: {
        uTime:       { value: 0 },
        uHalf:       { value: half },
        uOpacity:    { value: 0.6 },
        uWindTilt:     { value: 0 },
        uWindRotation: { value: 0 },
      },
      transparent: true,
    })
    const rainPoints = new THREE.Points(rainGeo, rainMat)
    scene.add(rainPoints)

    /* ── Overlay 3D debug des voix audio ────────────────────────────────────
       Un marqueur par voix ACTIVE du pool, à sa position MONDE réelle — celle
       que Resonance entend (donc Y_FLATTEN visible : les losanges flottent
       au-dessus du sol, le pied les ancre sur l'impact). Couleur = matériau,
       taille + opacité = niveau RMS du grain. Togglé avec le mode debug. */
    const voiceGroup = new THREE.Group()
    voiceGroup.visible = false
    scene.add(voiceGroup)
    const voiceGeo = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(8))
    const stemGeo  = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0), // unitaire, scale.y = hauteur
    ])
    const voiceMarkers = [] // créés paresseusement jusqu'à la taille du pool
    function makeVoiceMarker() {
      const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
      const group = new THREE.Group()
      const diamond = new THREE.LineSegments(voiceGeo, mat)
      const stem = new THREE.Line(stemGeo, mat)
      group.add(diamond)
      group.add(stem)
      group.visible = false
      voiceGroup.add(group)
      const mk = { group, diamond, stem, mat }
      voiceMarkers.push(mk)
      return mk
    }

    /* Resize observer */
    const ro = new ResizeObserver(() => {
      const el = canvas.parentElement
      if (!el) return
      const W = el.clientWidth, H = el.clientHeight
      renderer.setSize(W, H, false)
      camera.aspect = W / H
      camera.updateProjectionMatrix()
    })
    ro.observe(canvas.parentElement)

    /* RAF loop */
    let rafId
    const clock = new THREE.Clock()
    function animate() {
      rafId = requestAnimationFrame(animate)
      const uTime = clock.getElapsedTime()
      rainMat.uniforms.uTime.value = uTime

      /* Impact detection: fire onImpact when a grain phase wraps past an integer */
      const { metal: mActive, bache: bActive, onImpact: cb, terrain: terr } = impactState.current
      if (cb) {
        const wTilt = rainMat.uniforms.uWindTilt.value
        const wRot  = rainMat.uniforms.uWindRotation.value
        const drawCount = Math.min(rainGeo.drawRange.count, RAIN_POOL)
        for (let i = 0; i < drawCount; i++) {
          const phase    = _offsets[i] + uTime / _speeds[i]
          const floorNow = Math.floor(phase)
          if (floorNow > prevPhases[i]) {
            prevPhases[i] = floorNow
            /* Recalcule la position au sol en tenant compte du vent (même logique que le shader) */
            const baseX = _positions[i * 3]
            const baseY = _positions[i * 3 + 1]
            const baseZ = _positions[i * 3 + 2]
            const disp  = Math.sin(wTilt) * (-half - baseY)
            const ix    = baseX + Math.cos(wRot) * disp
            const iz    = baseZ + Math.sin(wRot) * disp
            /* Visuel seulement : cb peut être utilisé pour un flash visuel mais
               ne déclenche plus de son. L'audio est piloté par tickPoisson (T-0.H1). */
            const base = terr?.cellAt(ix, iz)?.material?.id ?? 'terre'
            let surface = base
            if (base === 'metal' && !mActive) surface = 'terre'
            else if (base === 'bache' && !bActive) surface = 'terre'
            cb(surface, { x: ix, z: iz }) // callback conservé pour usage visuel uniquement
          }
        }
      }

      /* Overlay debug : reflète l'état du pool de voix à chaque frame */
      const { debug: dbg, samplerRef: sref } = debugState.current
      const sampler = sref?.current
      voiceGroup.visible = !!(dbg && sampler?.ready)
      if (voiceGroup.visible) {
        const voices = sampler.debugVoices()
        while (voiceMarkers.length < voices.length) makeVoiceMarker()
        for (let i = 0; i < voiceMarkers.length; i++) {
          const mk = voiceMarkers[i]
          const v = voices[i]
          if (!v?.busy) { mk.group.visible = false; continue }
          mk.group.visible = true
          mk.group.position.set(v.x, v.y, v.z)
          /* niveau RMS [−50, −5] dB → présence [0, 1] */
          const lin = isFinite(v.level) ? Math.min(1, Math.max(0, (v.level + 50) / 45)) : 0
          mk.diamond.scale.setScalar(0.5 + 1.3 * lin)
          mk.mat.opacity = 0.2 + 0.7 * lin
          mk.mat.color.setHex(VOICE_COLORS[v.materialId] ?? 0xffffff)
          mk.stem.scale.y = v.y + half // pied jusqu'au sol (y = −half)
        }
      }

      renderer.render(scene, camera)
    }
    animate()

    threeRef.current = {
      renderer, scene, camera, clock,
      worldEdges, metalHatch, bacheGrid, divLine,
      headEdges, headDot,
      rainPoints, rainMat, rainGeo,
      HC, HCH,
    }

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      renderer.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  /* Keep impactState ref in sync with latest props (no re-render needed) */
  impactState.current = { metal, bache, onImpact, terrain }
  debugState.current  = { debug, samplerRef }

  /* ── Sync props → Three.js objects ─────────────────────── */

  /* spin (camera azimuth) + zoom (camera Z) */
  useEffect(() => {
    const r = threeRef.current
    if (!r) return
    const spinRad = THREE.MathUtils.degToRad(spin)
    const tiltRad = THREE.MathUtils.degToRad(22.5)
    const dist = size * 2.1 / zoom
    r.camera.position.set(
      dist * Math.sin(spinRad) * Math.cos(tiltRad),
      dist * Math.sin(tiltRad),
      dist * Math.cos(spinRad) * Math.cos(tiltRad),
    )
    r.camera.lookAt(0, 0, 0)
  }, [spin, zoom, size])

  /* head position */
  useEffect(() => {
    const r = threeRef.current
    if (!r) return
    const { HC, HCH, headEdges, headDot } = r
    const limit = half - HCH - 10
    const pos = new THREE.Vector3(head.x * limit, head.y * limit, -head.z * limit)
    headEdges.position.copy(pos)
    headDot.position.copy(pos)
  }, [head.x, head.y, head.z, half])

  /* rain visibility + density + wind */
  useEffect(() => {
    const r = threeRef.current
    if (!r) return
    r.rainPoints.visible = rain
    r.rainMat.uniforms.uOpacity.value = rain ? 0.55 : 0
    r.rainMat.uniforms.uWindTilt.value     = wind ? windTilt * windForce * (Math.PI / 4) : 0
    r.rainMat.uniforms.uWindRotation.value = windRotation * (Math.PI / 180)
    /* show only dropCount points by adjusting drawRange */
    r.rainGeo.setDrawRange(0, dropCount)
  }, [rain, dropCount, wind, windTilt, windForce, windRotation])

  /* metal / bache ground zones */
  useEffect(() => {
    const r = threeRef.current
    if (!r) return
    r.metalHatch.visible = metal
    r.bacheGrid.visible  = bache
  }, [metal, bache])

  /* listening pulse — scale headDot */
  useEffect(() => {
    const r = threeRef.current
    if (!r) return
    let rafId
    if (!listening) {
      r.headDot.scale.setScalar(1)
      return
    }
    const start = performance.now()
    function pulse(now) {
      const t = ((now - start) / 1800) % 1
      const s = 1 + 0.4 * Math.sin(t * Math.PI * 2)
      r.headDot.scale.setScalar(s)
      rafId = requestAnimationFrame(pulse)
    }
    rafId = requestAnimationFrame(pulse)
    return () => cancelAnimationFrame(rafId)
  }, [listening])

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    />
  )
}
