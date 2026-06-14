/* ── Points d'impact bakés (§5.2, §15.2) ─────────────────────────────────────
   Précalcule une fois les positions/matériaux/normales/exposition de toutes les
   cellules du terrain. Évite de faire un cellAt() à chaque goutte de Poisson.
   Structure : { points:[ImpactPoint], index:Map<clé→indices> } */

import type { Terrain } from './Terrain.js'
import type { Coords, Vector3 } from '../context/coords.js'
import type { MaterialId } from '../components/materials.js'

export interface ImpactPoint {
  position: Vector3
  normale: Vector3
  matériau: MaterialId
  expoCiel: number
}

export interface BakedSet {
  points: ImpactPoint[]
  index: Map<number, number[]>
}

interface Prng { aléa(): number }

function cellKey(col: number, row: number, cols: number): number {
  return row * cols + col
}

/* Bake toutes les cellules fines en ImpactPoint. Pour chaque cellule :
   - position = centre (cx, ground + hauteur_monde, cz)
   - normale  = (0,1,0) — toit plat (la hauteur est déjà incluse dans y)
   - expoCiel = 0 si une cellule-bloc voisine (4-connexe) est plus haute d'au
     moins 1 bloc (cellule sous abri), sinon 1. */
export function bakeImpactPoints(terrain: Terrain, coords: Coords): BakedSet {
  const { size, CELL, ground } = coords
  const half = size / 2
  const points: ImpactPoint[] = []
  const index = new Map<number, number[]>() // clé → [indices dans points]

  for (let row = 0; row < terrain.rows; row++) {
    for (let col = 0; col < terrain.cols; col++) {
      const cx = (col + 0.5) * CELL - half
      const cz = (row + 0.5) * CELL - half
      const cell = terrain.cellAt(cx, cz)
      if (!cell) continue

      const hMonde = cell.height           // hauteur en unités-monde
      const y = ground + hMonde

      /* Exposition ciel : cherche si un bloc voisin est plus haut d'au moins 1 m */
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

      const pt: ImpactPoint = {
        position: { x: cx, y, z: cz },
        normale:  { x: 0, y: 1, z: 0 },
        matériau: cell.material.id,
        expoCiel: abrité ? 0 : 1,
      }
      const key = cellKey(col, row, terrain.cols)
      const idx = points.length
      points.push(pt)
      if (!index.has(key)) index.set(key, [])
      index.get(key)!.push(idx)
    }
  }

  return { points, index }
}

/* Sélection pondérée d'un point d'impact par matériau (§5.2).
   Filtre par surface, pondère par proximité à la tête (gaussienne). Retourne null si aucun point.
   surfaceDensities : quand fourni, 'terre' peut aussi piocher dans les points dont le matériau
   est désactivé (sol sous un objet retiré de la scène). */
/** Paramètres de la répartition spatiale (PDF sphérique 3D autour de la tête).
   Sous-ensemble de L1FieldConfig (sans `rate`). */
export interface SpatialField {
  core: number
  sigma: number
  p: number
  floor: number
  ky: number
}

/* Répartition par défaut = comportement 2D historique EXACT : gaussienne σ=10 m
   dans le plan XZ (ky=0), sans plancher (floor=0), sans cœur (core=0), p=2. */
const DEFAULT_FIELD: SpatialField = { core: 0, sigma: 10, p: 2, floor: 0, ky: 0 }

/* Poids de tirage d'un point à la distance (paramétrée) de la tête :
     w(d) = floor + (1 − floor) · exp( −0.5 · (max(0, d−core)/σ)^p ),  d² = dx² + dz² + (ky·dy)²
   core = rayon d'un plateau de poids maximal autour de la tête (cœur dense uniforme) ;
   au-delà, la décroissance reprend en σ. p=2 ⇒ gaussienne (w(core+σ) ≈ 0,61). */
function spatialWeight(p: ImpactPoint, head: Vector3, f: SpatialField): number {
  const dx = p.position.x - head.x
  const dz = p.position.z - head.z
  const dy = (p.position.y - head.y) * f.ky
  const d = Math.sqrt(dx * dx + dz * dz + dy * dy)
  const sigma = f.sigma > 1e-6 ? f.sigma : 1e-6
  /* Plateau central : dans le cœur (d ≤ core) le poids reste maximal ; la diffusion
     gaussienne ne mesure que la distance AU-DELÀ du cœur. */
  const dOut = d > f.core ? d - f.core : 0
  const shaped = Math.exp(-0.5 * Math.pow(dOut / sigma, f.p))
  return f.floor + (1 - f.floor) * shaped
}

export function pickImpact(
  points: ReadonlyArray<ImpactPoint>,
  surface: MaterialId,
  prng: Prng,
  head: Vector3 | null,
  surfaceDensities: Partial<Record<MaterialId, number>> = {},
  preFiltered = false,
  field: SpatialField = DEFAULT_FIELD,
): ImpactPoint | null {
  /* preFiltered : `points` est DÉJÀ la liste des candidats pour `surface`
     (partition mémorisée par l'appelant). On saute le filter — sinon il ré-alloue
     un tableau de toute la grille à chaque grain, point chaud O(N) par grain. */
  let candidates: ReadonlyArray<ImpactPoint>
  if (preFiltered) {
    candidates = points
  } else if (surface === 'terre') {
    candidates = points.filter(p => {
      if (p.matériau === 'terre') return true
      return (surfaceDensities[p.matériau] ?? 1) <= 0
    })
  } else {
    candidates = points.filter(p => p.matériau === surface)
  }
  if (!candidates.length) return null

  if (!head) {
    /* Fallback : sélection classique sans proximité */
    const total = candidates.reduce((s, p) => s + (p.expoCiel || 0.01), 0)
    let threshold = prng.aléa() * total
    for (const p of candidates) {
      threshold -= (p.expoCiel || 0.01)
      if (threshold <= 0) return p
    }
    return candidates[candidates.length - 1]
  }

  /* Pondération spatiale paramétrée (PDF sphérique 3D, cf. spatialWeight/field) :
     favorise les impacts proches du joueur selon σ/p/plancher/ky. */
  const total = candidates.reduce(
    (s, p) => s + (p.expoCiel || 0.01) * spatialWeight(p, head, field), 0,
  )

  let threshold = prng.aléa() * total
  for (const p of candidates) {
    threshold -= (p.expoCiel || 0.01) * spatialWeight(p, head, field)
    if (threshold <= 0) return p
  }
  return candidates[candidates.length - 1]
}
