/* ── Monde 2.5D (colonnes) · le PIVOT Monde↔Audio (cadrage-v1 §3) ─────────────
   Le moteur audio ne lit JAMAIS terrain.material en direct. Il interroge le monde
   uniquement à travers l'interface WorldQuery ci-dessous. C'est la frontière stable
   derrière laquelle l'implémentation du terrain pourra changer (plat → SDF en P3)
   sans que l'audio ne s'en aperçoive.

   Rain ne frappe que la cellule topmost sky-exposed d'une colonne. Le monde
   entier se réduit à une requête O(1) : rainSurfaceAt(x, z) → {y, material, skyExposed}.

   Cette classe enveloppe le Terrain (slice) + applique une couche de monde
   (flat uniform beyond the slice). Edit overlay (sparse column overrides) incluse
   pour forward-compat ; inerte cette passe. */

import { buildTerrainMesh, buildCellVertex, type TerrainVertex } from './terrainMesh.js'
import { buildObjectVertices } from './objectMesh.js'
import { makeSkyOcclusion } from './skyOcclusion.js'
import { materialById, MATERIAL_INDEX, type Material, type MaterialId } from '../components/materials.js'
import type { Terrain } from './Terrain.js'
import type { WorldObject } from './objects.js'
import type { EditBrush } from '../../shared/edit.js'
import type { Coords, Vector3 } from '../context/coords.js'

/** Résultat d'une requête de colonne 2.5D (détail interne de l'implémentation plate). */
export interface ColumnSurface {
  y: number
  material: MaterialId
  skyExposed: boolean
}

/** Résultat de raycast acoustique. */
export interface RaycastHit {
  distance: number
  point: Vector3
  normal: Vector3
  material: Material
}

/* ── L'interface figée Monde ↔ Audio (cadrage-v1 §3) ──────────────────────────
   Une fois figée, l'implémentation derrière (terrain plat aujourd'hui, SDF demain)
   est interchangeable. Invariant : si audio et monde divergent un jour, on ne
   corrige QUE l'implémentation de WorldQuery, jamais le sampler. */
export interface WorldQuery {
  /** Matériau + distance (mètres) à la surface la plus proche d'un point monde. */
  nearestSurface(p: Vector3): { distance: number; material: Material } | null

  /** Lancer de rayon : occlusion, premières réflexions. */
  raycast(origin: Vector3, dir: Vector3): RaycastHit | null

  /** Occlusion source→auditeur, [0,1]. */
  isOccluded(source: Vector3, listener: Vector3): number

  /** Volume estimé de la cavité (m³) → réverbération (RT60, Sabine). */
  enclosedVolume(p: Vector3): number

  /** Points d'impact pluie disponibles (le pool unique de TerrainMesh). */
  impactPoints(): ReadonlyArray<TerrainVertex>

  /** Version du pool d'impacts, incrémentée à chaque rebake. Permet aux consommateurs
      (RainBuckets) de détecter qu'il faut re-trier même si la tête n'a pas bougé. */
  readonly meshVersion: number
}

/** Zone monde salie par une édition (AABB horizontal en mètres). `flushRemesh` est
    libre de l'élargir en interne (apron des chunks voisins, au SDF). */
export interface DirtyRegion {
  minX: number; maxX: number
  minZ: number; maxZ: number
}

/* ── Couture d'édition (cadrage rework/07) ────────────────────────────────────
   Séparée en DEUX temps pour anticiper le remaillage asynchrone du World Shaper :
     • applyEdit  : SYNCHRONE, léger — mute le monde, empile la zone salie. Ne remaille PAS.
     • flushRemesh: consommé par la BOUCLE (budget borné) — reconstruit le pool des zones
                    salies. FlatWorld le fait tout de suite ; SdfWorld déléguera au Worker
                    derrière la MÊME signature (canal/InputSystem/UI inchangés au passage SDF). */
export interface EditableWorld {
  /** Applique un brush : mute le monde, empile la DirtyRegion, retourne-la. */
  applyEdit(brush: EditBrush): DirtyRegion | null
  /** Draine jusqu'à `budget` zones salies en attente et rebake le pool. Retourne le
      nombre de zones traitées (0 = rien en attente). */
  flushRemesh(budget: number): number
}

/** Garde de type : ce monde sait-il s'éditer ? (FlatWorld oui ; un monde headless minimal non.) */
export function isEditable(w: WorldQuery): w is WorldQuery & EditableWorld {
  return typeof (w as Partial<EditableWorld>).applyEdit === 'function'
}

export class FlatWorld implements WorldQuery, EditableWorld {
  terrain: Terrain
  coords: Coords
  /** Objets posés (couche de placement, objects.ts) — exposés pour le rendu. */
  objects: WorldObject[]
  /** Pool fusionné terrain + objets. Les vertices de terrain occupent [0, _objStart[,
      les objets [_objStart, fin[. Patché en place par flushRemesh (cadrage 07 §5). */
  private _mesh: TerrainVertex[]
  /** Index de début des vertices d'objets dans _mesh (= nb de vertices terrain). */
  private _objStart: number
  /** Sous-pool des seuls vertices d'objets (pour nearestSurface). */
  private _objMesh: TerrainVertex[]
  /** Index cellule terrain (row*cols+col) → position dans _mesh. Une cellule hors
      terrain n'a pas d'entrée. Permet le rebake INCRÉMENTAL d'une cellule. */
  private _cellSlot: Map<number, number>
  /** Occlusion verticale partagée (terrain + objets), conservée pour le rebake. */
  private _occlusion: ReturnType<typeof makeSkyOcclusion>
  /** Zones salies en attente de rebake (cadrage 07 §4.3, temps 1 → temps 2). */
  private _dirty: DirtyRegion[] = []
  /** Version du pool, incrémentée à chaque rebake effectif. */
  private _meshVersion = 0

  constructor(terrain: Terrain, coords: Coords, objects: WorldObject[] = []) {
    this.terrain  = terrain
    this.coords   = coords
    this.objects  = objects
    /* Faces cachées (cadrage 07) : un testeur d'occlusion verticale partagé, qui
       connaît terrain + objets AVANT le bake, pour qu'un objet puisse abriter le
       sol sous lui (et un autre objet). Construit d'abord, consommé par les deux
       bakers ci-dessous → expoCiel cohérent entre terrain et objets. */
    const occlusion = makeSkyOcclusion(terrain, coords, objects)
    this._occlusion = occlusion
    /* « Objets frappés par la pluie » = leurs faces dans le pool d'impacts. Baké
       une fois : le pivot WorldQuery absorbe les objets sans toucher RainPoisson,
       qui consomme impactPoints() à l'identique (cadrage 04 §2). Le bake écarte
       déjà les flancs/dessous (filtre de normale) et marque les points abrités. */
    this._objMesh = objects.flatMap(o => buildObjectVertices(o, coords, occlusion))
    const built = buildTerrainMesh(terrain, coords, occlusion)
    this._objStart = built.vertices.length
    this._mesh = [...built.vertices, ...this._objMesh]
    this._cellSlot = built.cellSlot
  }

  get meshVersion(): number { return this._meshVersion }

  /* Requête audio unique 2.5D : (x,z) → {y, material, skyExposed}.
     À l'intérieur de la slice : délègue à terrain.cellAt (bounds-checking inclus).
     Au-delà : matériau uniforme 'terre' au niveau du sol.
     nearestSurface s'appuie dessus. */
  rainSurfaceAt(x: number, z: number): ColumnSurface {
    const cell = this.terrain.cellAt(x, z)
    if (cell) {
      return {
        y:          this.coords.ground + cell.height,
        material:   cell.material.id,
        skyExposed: true,
      }
    }

    return { y: this.coords.ground, material: 'terre', skyExposed: true }
  }

  /* ── WorldQuery ─────────────────────────────────────────────────────────── */

  nearestSurface(p: Vector3): { distance: number; material: Material } | null {
    const surf = this.rainSurfaceAt(p.x, p.z)
    const material = materialById(surf.material)
    if (!material) return null
    /* En 2.5D, la surface terrain est le toit de la colonne ; la distance est la
       hauteur du point au-dessus de ce toit (jamais négative côté ciel). */
    let best = Math.max(0, p.y - surf.y)
    let bestMat = material

    /* Les objets sont des points 3D au-dessus de la colonne : on prend le plus
       proche s'il bat le toit du terrain. Chemin SECONDAIRE — le matériau d'un
       impact de pluie vient déjà du vertex piqué (rainPoisson) ; nearestSurface
       sert l'audio de proximité, pas le routage des grains (cadrage 04 §2). */
    for (const v of this._objMesh) {
      const dx = v.position.x - p.x
      const dy = v.position.y - p.y
      const dz = v.position.z - p.z
      const dObj = Math.sqrt(dx * dx + dy * dy + dz * dz)
      if (dObj < best) {
        const m = materialById(v.matériau)
        if (m) { best = dObj; bestMat = m }
      }
    }
    return { distance: best, material: bestMat }
  }

  /* Pas de murs en wireframe (v1) : aucun obstacle à intersecter. Stub neutre,
     point d'extension pour P3 (descente de colonne SDF). */
  raycast(_origin: Vector3, _dir: Vector3): RaycastHit | null {
    return null
  }

  /* Ciel ouvert en v1 : rien n'occulte la source de l'auditeur. */
  isOccluded(_source: Vector3, _listener: Vector3): number {
    return 0
  }

  /* Espace ouvert en v1 : pas de cavité → pas de réverbération calculée. */
  enclosedVolume(_p: Vector3): number {
    return 0
  }

  impactPoints(): ReadonlyArray<TerrainVertex> {
    return this._mesh
  }

  /* ── EditableWorld (cadrage 07) ───────────────────────────────────────────── */

  /* TEMPS 1 — synchrone, léger. Mute la donnée terrain sous la zone du brush et
     empile la DirtyRegion. NE rebake PAS (c'est flushRemesh, consommé par la boucle).
     Le moteur est l'autorité : un brush hors-terrain ne mute rien (retourne null). */
  applyEdit(brush: EditBrush): DirtyRegion | null {
    const { shape, op } = brush
    if (shape.kind !== 'disc') return null
    const { center, radius } = shape
    if (radius <= 0) return null

    /* Relief (op 'raise') reporté au 2ᵉ temps (cadrage 07 §3) : pas encore implémenté. */
    if (op.t !== 'paint') return null
    const matIdx = MATERIAL_INDEX[op.mat]
    if (matIdx === undefined) return null

    const t = this.terrain
    const r2 = radius * radius
    let touched = false
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity

    /* Parcourt les cellules de la grille fine sous le disque (AABB → test radius). */
    const cellMin = (v: number) => Math.floor((v + t.size / 2) / t.cell)
    const c0 = Math.max(0, cellMin(center.x - radius))
    const c1 = Math.min(t.cols - 1, cellMin(center.x + radius))
    const r0 = Math.max(0, cellMin(center.z - radius))
    const r1 = Math.min(t.rows - 1, cellMin(center.z + radius))
    const half = t.size / 2
    for (let row = r0; row <= r1; row++) {
      for (let col = c0; col <= c1; col++) {
        const cx = (col + 0.5) * t.cell - half
        const cz = (row + 0.5) * t.cell - half
        const dx = cx - center.x, dz = cz - center.z
        if (dx * dx + dz * dz > r2) continue
        t.material[row * t.cols + col] = matIdx
        touched = true
        if (cx < minX) minX = cx; if (cx > maxX) maxX = cx
        if (cz < minZ) minZ = cz; if (cz > maxZ) maxZ = cz
      }
    }

    if (!touched) return null
    const region: DirtyRegion = { minX, maxX, minZ, maxZ }
    this._dirty.push(region)
    return region
  }

  /* TEMPS 2 — consommé par la boucle. Draine jusqu'à `budget` zones et patche le
     pool d'impacts EN PLACE (rebake par région, cadrage 07 §5 option B) : seules les
     cellules salies sont reconstruites, les vertices hors zone sont intacts. Au SDF,
     ce corps déléguera au Worker derrière la même signature. */
  flushRemesh(budget: number): number {
    if (this._dirty.length === 0) return 0
    const n = Math.min(budget, this._dirty.length)
    const t = this.terrain
    const half = t.size / 2
    for (let k = 0; k < n; k++) {
      const region = this._dirty.shift()!
      const c0 = Math.max(0, Math.floor((region.minX + half) / t.cell))
      const c1 = Math.min(t.cols - 1, Math.floor((region.maxX + half) / t.cell))
      const r0 = Math.max(0, Math.floor((region.minZ + half) / t.cell))
      const r1 = Math.min(t.rows - 1, Math.floor((region.maxZ + half) / t.cell))
      for (let row = r0; row <= r1; row++) {
        for (let col = c0; col <= c1; col++) {
          const slot = this._cellSlot.get(row * t.cols + col)
          if (slot === undefined) continue
          /* Recalcule le vertex de la cellule (matériau à jour + occlusion). */
          this._mesh[slot] = buildCellVertex(t, this.coords, col, row, this._occlusion)
        }
      }
    }
    this._meshVersion++
    return n
  }
}

export function makeDefaultWorld(
  { terrain, coords, objects = [] }: { terrain: Terrain; coords: Coords; objects?: WorldObject[] },
): FlatWorld {
  return new FlatWorld(terrain, coords, objects)
}
