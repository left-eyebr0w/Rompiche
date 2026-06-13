import React, { useRef, useMemo, useLayoutEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { makeCoords } from './coords.js'
import { materialById } from './materials.js'

/* Token colours (mirrors ds/tokens/colors.css — viewport context) */
const C = {
  wire:      0xffffff,
  wireDim:   0x6e6e6e,
  wireFaint: 0x3a3a3a,
  blanc:     0xffffff,
  canvasNoir:0x0d0d0d, // fond du viewport — sert de remplissage opaque aux volumes
}

const RAIN_POOL = 80

/* ── Fabriques de géométries filaires (Three.js pur, mémorisées) ───────────── */

function cubeEdges(size) {
  return new THREE.EdgesGeometry(new THREE.BoxGeometry(size, size, size))
}

/* Grille de sol NEUTRE — une seule trame uniforme sur toute l'emprise du monde.
   En wireframe, le matériau ne pilote aucune texture (métal ≡ bâche ≡ terre) : la
   localisation des matériaux est une affaire d'audio + overlay debug, pas de la
   vue de base. Remplace les anciennes hachures 45° / grilles codées en dur. */
function groundGridGeo(half, size) {
  const pts = []
  const step = Math.max(0.5, size / 25)
  for (let x = -half; x <= half + 1e-6; x += step) {
    pts.push(new THREE.Vector3(x, 0, -half), new THREE.Vector3(x, 0, half))
  }
  for (let z = -half; z <= half + 1e-6; z += step) {
    pts.push(new THREE.Vector3(-half, 0, z), new THREE.Vector3(half, 0, z))
  }
  return new THREE.BufferGeometry().setFromPoints(pts)
}

/* ── SolidWire — LE look partagé des volumes (relief + objets) ────────────────
   Face pleine opaque (canvas-noir, écrit dans le depth buffer) + arêtes par-dessus.
   La face occulte les arêtes du fond → on ne voit plus « à travers » le volume.
   polygonOffset pousse la face légèrement en arrière pour éviter le z-fighting
   face/arêtes. Monochrome : le matériau ne change pas la couleur ici. */
function SolidWire({ box, edges, position, color = C.wireDim, opacity = 1, visible = true }) {
  return (
    <group position={position} visible={visible}>
      <mesh geometry={box}>
        <meshBasicMaterial color={C.canvasNoir} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
      </mesh>
      <lineSegments geometry={edges}>
        <lineBasicMaterial color={color} transparent={opacity < 1} opacity={opacity} />
      </lineSegments>
    </group>
  )
}

/* Build rain buffer — random (x,z) fixed, y animated via shader time uniform */
function buildRain(half, count, size) {
  const positions = [], speeds = [], offsets = []
  const margin = half * 0.92
  for (let i = 0; i < count; i++) {
    positions.push(
      (Math.random() * 2 - 1) * margin,
      (Math.random() * 2 - 1) * margin,
      (Math.random() * 2 - 1) * margin,
    )
    speeds.push(0.55 + Math.random() * 0.7)
    offsets.push(Math.random())
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('speed',    new THREE.Float32BufferAttribute(speeds, 1))
  geo.setAttribute('offset',   new THREE.Float32BufferAttribute(offsets, 1))
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

/* ── Caméra : orbite (spin) + zoom, repère partagé avec coords.js ──────────── */
function CameraRig({ size, spin, zoom }) {
  const { camera } = useThree()
  useLayoutEffect(() => {
    const spinRad = THREE.MathUtils.degToRad(spin)
    const tiltRad = THREE.MathUtils.degToRad(22.5)
    const dist = size * 2.1 / zoom
    camera.position.set(
      dist * Math.sin(spinRad) * Math.cos(tiltRad),
      dist * Math.sin(tiltRad),
      dist * Math.cos(spinRad) * Math.cos(tiltRad),
    )
    camera.lookAt(0, 0, 0)
  }, [camera, size, spin, zoom])
  return null
}

/* ── Cube monde + sol (grille neutre uniforme) ─────────────────────────────── */
function WorldScene({ size, half }) {
  const worldGeo = useMemo(() => cubeEdges(size), [size])
  const groundGeo = useMemo(() => groundGridGeo(half, size), [half, size])
  return (
    <>
      {/* Cube-monde : arêtes seules (la pièce qu'on regarde de l'intérieur — pas de face) */}
      <lineSegments geometry={worldGeo}>
        <lineBasicMaterial color={C.wireDim} />
      </lineSegments>
      {/* Sol : trame neutre unique, sans distinction de matériau */}
      <lineSegments geometry={groundGeo} position={[0, -half, 0]}>
        <lineBasicMaterial color={C.wireFaint} />
      </lineSegments>
    </>
  )
}

/* ── Relief : volume plein par bloc surélevé (porte la hauteur des points bakés) ──
   Substrat STATIQUE dérivé du terrain. Rendu monochrome via SolidWire (face opaque
   + arêtes) : le matériau ne sert plus qu'au toggle de visibilité (concept audio/UX),
   pas à la couleur. */
function Relief({ terrain, half, metal, bache }) {
  const blocks = useMemo(() => {
    if (!terrain) return []
    const block = terrain.block
    const out = []
    for (let br = 0; br < terrain.brows; br++) {
      for (let bc = 0; bc < terrain.bcols; bc++) {
        const h = terrain.height[br * terrain.bcols + bc]
        if (!h) continue
        const hWorld = h * block
        const cx = (bc + 0.5) * block - half
        const cz = (br + 0.5) * block - half
        const matId = terrain.cellAt(cx, cz)?.material?.id ?? 'terre'
        const boxGeo = new THREE.BoxGeometry(block, hWorld, block)
        const edges = new THREE.EdgesGeometry(boxGeo)
        out.push({ box: boxGeo, edges, matId, pos: [cx, -half + hWorld / 2, cz] })
      }
    }
    return out
  }, [terrain, half])

  /* Visibilité par matériau (suit metal/bache ; terre toujours visible) */
  const visFor = { metal, bache, terre: true }

  return (
    <group>
      {blocks.map((b, i) => (
        <SolidWire key={i} box={b.box} edges={b.edges} position={b.pos}
          color={C.wireDim} visible={visFor[b.matId] !== false} />
      ))}
    </group>
  )
}

/* ── Objets : couche de props placés (objects.js) — même renderer que le relief ──
   Volumes pleins monochromes. Le matériau est porté par la donnée (audio/futur),
   invisible ici. Liste vide par défaut → ne rend rien tant qu'aucun objet n'est placé. */
function Objects({ objects = [] }) {
  const built = useMemo(() => objects.map(o => {
    const [w, h, d] = o.size
    const box = new THREE.BoxGeometry(w, h, d)
    return { id: o.id, box, edges: new THREE.EdgesGeometry(box), pos: o.position }
  }), [objects])

  return (
    <group>
      {built.map(o => (
        <SolidWire key={o.id} box={o.box} edges={o.edges} position={o.pos} color={C.wire} />
      ))}
    </group>
  )
}

/* ── Cube-tête + auditeur + 6 points haut-parleurs ─────────────────────────── */
function HeadCube({ size, head, listening }) {
  const HC = Math.round(size * 0.26)
  const HCH = HC / 2
  const dotRef = useRef()
  const headGeo = useMemo(() => cubeEdges(HC), [HC])
  const dotRadius = Math.max(0.2, HC * 0.25)
  const faceOffsets = [
    [0, 0, HCH], [0, 0, -HCH], [HCH, 0, 0], [-HCH, 0, 0], [0, HCH, 0], [0, -HCH, 0],
  ]

  /* Repère partagé avec l'audio (coords.js) → tête visuelle et auditeur Resonance
     occupent EXACTEMENT le même point monde (I5). */
  const { limit } = makeCoords(size)
  const pos = [head.x * limit, head.y * limit, -head.z * limit]

  /* listening pulse — scale du dot auditeur */
  useFrame(({ clock }) => {
    const d = dotRef.current
    if (!d) return
    if (!listening) { d.scale.setScalar(1); return }
    const t = (clock.getElapsedTime() / 1.8) % 1
    d.scale.setScalar(1 + 0.4 * Math.sin(t * Math.PI * 2))
  })

  return (
    <group position={pos}>
      <lineSegments geometry={headGeo}>
        <lineBasicMaterial color={C.wire} />
      </lineSegments>
      <mesh ref={dotRef}>
        <sphereGeometry args={[dotRadius, 8, 8]} />
        <meshBasicMaterial color={C.blanc} transparent opacity={0.5} />
      </mesh>
      {faceOffsets.map(([fx, fy, fz], i) => (
        <mesh key={i} position={[fx, fy, fz]}>
          <sphereGeometry args={[Math.max(0.1, HC * (i === 0 ? 0.08 : 0.06)), 6, 6]} />
          <meshBasicMaterial color={i === 0 ? C.blanc : C.wireDim} transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

/* ── Pluie : Points + ShaderMaterial GLSL (conservé) + détection d'impact visuel ── */
function Rain({ half, size, rain, density, wind, windTilt, windRotation, windForce, terrain, metal, bache, onImpact }) {
  const geo = useMemo(() => buildRain(half, RAIN_POOL, size), [half, size])
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: {
      uTime:         { value: 0 },
      uHalf:         { value: half },
      uOpacity:      { value: 0.6 },
      uWindTilt:     { value: 0 },
      uWindRotation: { value: 0 },
    },
    transparent: true,
  }), [half])

  const prevPhases = useRef(new Float64Array(RAIN_POOL))
  const dropCount = rain ? Math.round(density * RAIN_POOL) : 0

  /* Sync uniforms + drawRange (visibilité, densité, vent) */
  useLayoutEffect(() => {
    mat.uniforms.uHalf.value = half
    mat.uniforms.uOpacity.value = rain ? 0.55 : 0
    mat.uniforms.uWindTilt.value = wind ? windTilt * windForce * (Math.PI / 4) : 0
    mat.uniforms.uWindRotation.value = windRotation * (Math.PI / 180)
    geo.setDrawRange(0, dropCount)
  }, [mat, geo, half, rain, dropCount, wind, windTilt, windForce, windRotation])

  /* Refs synchrones pour le callback d'impact (visuel uniquement). */
  const cb = useRef()
  cb.current = { metal, bache, onImpact, terrain }

  useFrame(({ clock }) => {
    const uTime = clock.getElapsedTime()
    mat.uniforms.uTime.value = uTime

    /* Impact detection: fire onImpact when a grain phase wraps past an integer.
       Visuel seulement — l'audio est piloté par tickPoisson (T-0.H1). */
    const { metal: mA, bache: bA, onImpact: fn, terrain: terr } = cb.current
    if (!fn) return
    const _pos = geo.attributes.position.array
    const _spd = geo.attributes.speed.array
    const _off = geo.attributes.offset.array
    const wTilt = mat.uniforms.uWindTilt.value
    const wRot = mat.uniforms.uWindRotation.value
    const drawCount = Math.min(geo.drawRange.count, RAIN_POOL)
    const prev = prevPhases.current
    for (let i = 0; i < drawCount; i++) {
      const floorNow = Math.floor(_off[i] + uTime / _spd[i])
      if (floorNow > prev[i]) {
        prev[i] = floorNow
        const baseX = _pos[i * 3], baseY = _pos[i * 3 + 1], baseZ = _pos[i * 3 + 2]
        const disp = Math.sin(wTilt) * (-half - baseY)
        const ix = baseX + Math.cos(wRot) * disp
        const iz = baseZ + Math.sin(wRot) * disp
        const base = terr?.cellAt(ix, iz)?.material?.id ?? 'terre'
        let surface = base
        if (base === 'metal' && !mA) surface = 'terre'
        else if (base === 'bache' && !bA) surface = 'terre'
        fn(surface, { x: ix, z: iz })
      }
    }
  })

  return <points geometry={geo} material={mat} visible={rain} />
}

/* ── Overlay 3D debug des voix audio ──────────────────────────────────────────
   Un marqueur (octaèdre filaire + pied) par voix ACTIVE du pool, à sa position
   MONDE réelle. Couleur = matériau, taille + opacité = niveau RMS du grain. */
function VoiceOverlay({ size, half, samplerRef }) {
  const HC = Math.round(size * 0.26)
  const markerSize = Math.max(0.3, HC * 0.8)
  const diamondGeo = useMemo(() => new THREE.EdgesGeometry(new THREE.OctahedronGeometry(markerSize)), [markerSize])
  const stemGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0),
  ]), [])

  const groupRef = useRef()
  const markers = useRef([])

  function makeMarker(parent) {
    const mat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    const g = new THREE.Group()
    const diamond = new THREE.LineSegments(diamondGeo, mat)
    const stem = new THREE.Line(stemGeo, mat)
    g.add(diamond); g.add(stem); g.visible = false
    parent.add(g)
    const mk = { group: g, diamond, stem, mat }
    markers.current.push(mk)
    return mk
  }

  useFrame(() => {
    const grp = groupRef.current
    const sampler = samplerRef?.current
    if (!grp) return
    if (!sampler?.ready) { grp.visible = false; return }
    grp.visible = true
    const voices = sampler.debugVoices()
    while (markers.current.length < voices.length) makeMarker(grp)
    for (let i = 0; i < markers.current.length; i++) {
      const mk = markers.current[i]
      const v = voices[i]
      if (!v?.busy) { mk.group.visible = false; continue }
      mk.group.visible = true
      mk.group.position.set(v.x, v.y, v.z)
      const lin = isFinite(v.level) ? Math.min(1, Math.max(0, (v.level + 50) / 45)) : 0
      mk.diamond.scale.setScalar(0.5 + 1.3 * lin)
      mk.mat.opacity = 0.2 + 0.7 * lin
      mk.mat.color.setHex(materialById(v.materialId)?.debugColor ?? 0xffffff)
      mk.stem.scale.y = v.y + half // pied jusqu'au sol (y = −half)
    }
  })

  return <group ref={groupRef} visible={false} />
}

/* ── Composant racine — interface identique à l'ancien WireframeCube ─────────── */
export default function WireframeCube({
  size = 360, terrain = null, objects = [], head = { x: 0, y: 0, z: 0 },
  rain = true, metal = true, bache = true, listening = false,
  spin = -32, zoom = 1, density = 0.5, wind = false, windTilt = 0.5, windRotation = 0, windForce = 0.5,
  onImpact = null,
  samplerRef = null, debug = false,
}) {
  const half = size / 2
  return (
    <Canvas
      gl={{ antialias: true, alpha: true }}
      camera={{ fov: 45, near: 1, far: 5000, position: [0, 0, size * 2.1] }}
      onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
    >
      <CameraRig size={size} spin={spin} zoom={zoom} />
      <WorldScene size={size} half={half} />
      <Relief terrain={terrain} half={half} metal={metal} bache={bache} />
      <Objects objects={objects} />
      <HeadCube size={size} head={head} listening={listening} />
      <Rain
        half={half} size={size} rain={rain} density={density}
        wind={wind} windTilt={windTilt} windRotation={windRotation} windForce={windForce}
        terrain={terrain} metal={metal} bache={bache} onImpact={onImpact}
      />
      {debug && <VoiceOverlay size={size} half={half} samplerRef={samplerRef} />}
    </Canvas>
  )
}
