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

import { buildTerrainMesh, type TerrainVertex, type TerrainMesh } from './terrainMesh.js'
import { buildObjectVertices } from './objectMesh.js'
import { materialById, type Material, type MaterialId } from '../components/materials.js'
import type { Terrain } from './Terrain.js'
import type { WorldObject } from './objects.js'
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
}

export class FlatWorld implements WorldQuery {
  terrain: Terrain
  coords: Coords
  /** Objets posés (couche de placement, objects.ts) — exposés pour le rendu. */
  objects: WorldObject[]
  private _edits: Map<string, ColumnSurface>
  /** Pool fusionné terrain + objets, baké une fois à la construction. */
  private _mesh: TerrainVertex[]
  /** Sous-pool des seuls vertices d'objets (pour nearestSurface). */
  private _objMesh: TerrainVertex[]

  constructor(terrain: Terrain, coords: Coords, objects: WorldObject[] = []) {
    this.terrain  = terrain
    this.coords   = coords
    this.objects  = objects
    this._edits   = new Map()
    /* « Objets frappés par la pluie » = leurs faces dans le pool d'impacts. Baké
       une fois : le pivot WorldQuery absorbe les objets sans toucher RainPoisson,
       qui consomme impactPoints() à l'identique (cadrage 04 §2). */
    this._objMesh = objects.flatMap(o => buildObjectVertices(o, coords))
    this._mesh    = [...buildTerrainMesh(terrain, coords).vertices, ...this._objMesh]
  }

  /* Requête audio unique 2.5D : (x,z) → {y, material, skyExposed}.
     À l'intérieur de la slice : délègue à terrain.cellAt (bounds-checking inclus).
     Au-delà : matériau uniforme 'terre' au niveau du sol.
     Détail interne consommé par L2 (SectorField) ; nearestSurface s'appuie dessus. */
  rainSurfaceAt(x: number, z: number): ColumnSurface {
    const edit = this._edits.get(`${Math.round(x)},${Math.round(z)}`)
    if (edit) return { ...edit }

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
}

export function makeDefaultWorld(
  { terrain, coords, objects = [] }: { terrain: Terrain; coords: Coords; objects?: WorldObject[] },
): FlatWorld {
  return new FlatWorld(terrain, coords, objects)
}
