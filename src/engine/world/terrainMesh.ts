/* ── TerrainMesh — remplace BakedSet comme source unique des candidats ────────
   Construit un vertex par cellule de la grille fine du terrain. Chaque vertex
   porte sa position, son matériau (tel que baké depuis le Terrain), sa normale
   et son exposition au ciel. Le mesh sert à la fois :
     • pool unique de candidats pour pickImpact (simu pluie)
     • source de géométrie pour ThreeRenderer (J4)

   PAS de dépendance three.js : données pures, typées. */

import type { Terrain } from './Terrain.js'
import type { SkyOcclusion } from './skyOcclusion.js'
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

/** Construit le mesh depuis le Terrain : un vertex par cellule fine. La normale du
    terrain est toujours +Y, donc le filtre d'orientation est trivialement passé ;
    seul l'OCCLUSION verticale décide de expoCiel (cadrage 07). `occlusion` unifie
    le verdict avec les objets : une cellule est abritée par un relief plus haut OU
    par une boîte posée au-dessus. Optionnel (rétro-compat → ciel ouvert partout). */
export function buildTerrainMesh(terrain: Terrain, coords: Coords, occlusion?: SkyOcclusion): TerrainMesh {
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

      const y = ground + cell.height
      const abrité = occlusion?.isSheltered(cx, y, cz) ?? false

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

/** Tirage UNIFORME d'un point dans un pool déjà filtré. Chaque point a la même
    probabilité (les surfaces du diorama sont réparties uniformément en 2D, cf.
    notes/random/pluie.txt → tirer un point ≈ tirer une position). Retourne null
    si le pool est vide. */
export function pickImpact(pool: readonly TerrainVertex[], prng: Prng): TerrainVertex | null {
  if (!pool.length) return null
  const i = Math.min(pool.length - 1, Math.floor(prng.aléa() * pool.length))
  return pool[i]
}

/** Buckets de points pré-triés par ZONE géométrique (notes/random/pluie.txt §Placement).
    Partitionne les vertex exposés au ciel en deux pools disjoints selon la distance
    HORIZONTALE d = √(dx²+dz²) à la tête :
      • L1 : disque  d ∈ [0, rL1]
      • L2 : anneau  d ∈ [rL1, rMaxL2]
    Le re-tri n'a lieu QUE si la tête a bougé de plus de `epsMove` (m) depuis le dernier,
    ou si les rayons changent → tirage O(1) au tick, pas de raycast, coût amorti. */
export class RainBuckets {
  readonly L1: TerrainVertex[] = []
  readonly L2: TerrainVertex[] = []
  private lastX = NaN
  private lastZ = NaN
  private lastR1 = NaN
  private lastR2 = NaN

  /** Vertex source (les exposés au ciel ; les abrités sont ignorés au tri). */
  constructor(private readonly vertices: readonly TerrainVertex[], private readonly epsMove = 0.5) {}

  /** Re-trie si la tête a bougé > epsMove ou si rL1/rMaxL2 ont changé. */
  update(head: Vector3, rL1: number, rMaxL2: number): void {
    const moved = Math.hypot(head.x - this.lastX, head.z - this.lastZ)
    if (moved <= this.epsMove && rL1 === this.lastR1 && rMaxL2 === this.lastR2) return
    this.lastX = head.x; this.lastZ = head.z
    this.lastR1 = rL1; this.lastR2 = rMaxL2

    this.L1.length = 0
    this.L2.length = 0
    const r1sq = rL1 * rL1
    const r2sq = rMaxL2 * rMaxL2
    for (let i = 0; i < this.vertices.length; i++) {
      const v = this.vertices[i]
      if (v.expoCiel <= 0) continue   // abrité (sous un surplomb) → pas de goutte
      const dx = v.position.x - head.x
      const dz = v.position.z - head.z
      const dsq = dx * dx + dz * dz
      if (dsq <= r1sq) this.L1.push(v)
      else if (dsq <= r2sq) this.L2.push(v)
    }
  }
}
