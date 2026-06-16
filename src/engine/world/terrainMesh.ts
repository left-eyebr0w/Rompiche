/* ── TerrainMesh — remplace BakedSet comme source unique des candidats ────────
   Construit un vertex par cellule de la grille fine du terrain. Chaque vertex
   porte sa position, son matériau (tel que baké depuis le Terrain), sa normale
   et son exposition au ciel. Le mesh sert à la fois :
     • pool unique de candidats pour pickImpact (simu pluie)
     • source de géométrie pour ThreeRenderer (J4)

   PAS de dépendance three.js : données pures, typées. */

import type { Terrain } from './Terrain.js'
import type { Coords, Vector3 } from '../context/coords.js'
import type { MaterialId } from '../components/materials.js'

export interface TerrainVertex {
  position: Vector3
  normale: Vector3
  matériau: MaterialId
  expoCiel: number
}

export interface TerrainMesh {
  vertices: TerrainVertex[]
}

interface Prng { aléa(): number }

function cellKey(col: number, row: number, cols: number): number {
  return row * cols + col
}

/** Construit le mesh depuis le Terrain : un vertex par cellule fine. */
export function buildTerrainMesh(terrain: Terrain, coords: Coords): TerrainMesh {
  const { size, CELL, ground } = coords
  const half = size / 2
  const vertices: TerrainVertex[] = []
  const index = new Map<number, number[]>()

  for (let row = 0; row < terrain.rows; row++) {
    for (let col = 0; col < terrain.cols; col++) {
      const cx = (col + 0.5) * CELL - half
      const cz = (row + 0.5) * CELL - half
      const cell = terrain.cellAt(cx, cz)
      if (!cell) continue

      const hMonde = cell.height
      const y = ground + hMonde

      const myBlocks = hMonde / terrain.block
      let abrité = false
      const neighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]]
      for (const [dc, dr] of neighbors) {
        const nc = col + dc, nr = row + dr
        const ncx = (nc + 0.5) * CELL - half
        const ncz = (nr + 0.5) * CELL - half
        const nc2 = terrain.cellAt(ncx, ncz)
        if (nc2 && nc2.height / terrain.block >= myBlocks + 1) { abrité = true; break }
      }

      vertices.push({
        position: { x: cx, y, z: cz },
        normale: { x: 0, y: 1, z: 0 },
        matériau: cell.material.id,
        expoCiel: abrité ? 0 : 1,
      })
      const key = cellKey(col, row, terrain.cols)
      if (!index.has(key)) index.set(key, [])
      index.get(key)!.push(vertices.length - 1)
    }
  }

  return { vertices }
}

/** Paramètres de la répartition spatiale (PDF sphérique 3D autour de la tête). */
export interface SpatialField {
  core: number
  sigma: number
  p: number
  floor: number
  ky: number
  upBias: number
}

const DEFAULT_FIELD: SpatialField = { core: 0, sigma: 10, p: 2, floor: 0, ky: 0, upBias: 0 }

/** Poids de tirage d'un point à la distance (paramétrée) de la tête :
      w(d) = floor + (1 − floor) · exp( −0.5 · (max(0, d−core)/σ)^p ),  d² = dx² + dz² + (ky·dy)²
    upBias décale le centre de la PDF vers le haut : le poids maximal est atteint
    à head.y + upBias, ce qui concentre les gouttes au-dessus de l'auditeur. */
export function spatialWeight(p: TerrainVertex, head: Vector3, f: SpatialField): number {
  const dx = p.position.x - head.x
  const dz = p.position.z - head.z
  const headY = head.y + (f.upBias ?? 0)
  const dy = (p.position.y - headY) * f.ky
  const d = Math.sqrt(dx * dx + dz * dz + dy * dy)
  const sigma = f.sigma > 1e-6 ? f.sigma : 1e-6
  const dOut = d > f.core ? d - f.core : 0
  const shaped = Math.exp(-0.5 * Math.pow(dOut / sigma, f.p))
  return f.floor + (1 - f.floor) * shaped
}

/** Sélection pondérée d'un point d'impact depuis le pool unique.
    Pondère par proximité à la tête (PDF paramétrée, cf. SpatialField).
    Retourne null si le pool est vide. */
export function pickImpact(
  pool: TerrainVertex[],
  prng: Prng,
  head: Vector3 | null,
  field: SpatialField = DEFAULT_FIELD,
): TerrainVertex | null {
  if (!pool.length) return null

  if (!head) {
    const total = pool.reduce((s, p) => s + (p.expoCiel || 0.01), 0)
    let threshold = prng.aléa() * total
    for (const p of pool) {
      threshold -= (p.expoCiel || 0.01)
      if (threshold <= 0) return p
    }
    return pool[pool.length - 1]
  }

  const total = pool.reduce(
    (s, p) => s + (p.expoCiel || 0.01) * spatialWeight(p, head, field), 0,
  )
  if (total <= 0) return null

  let threshold = prng.aléa() * total
  for (const p of pool) {
    threshold -= (p.expoCiel || 0.01) * spatialWeight(p, head, field)
    if (threshold <= 0) return p
  }
  return pool[pool.length - 1]
}
