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

import { bakeImpactPoints, type ImpactPoint } from './BakedSet.js'
import { materialById, type Material, type MaterialId } from './materials.js'
import type { Terrain } from './Terrain.js'
import type { Coords, Vector3 } from './coords.js'

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

  /** Points d'impact pluie disponibles (remplace l'accès direct au BakedSet). */
  impactPoints(): ReadonlyArray<ImpactPoint>
}

export class FlatWorld implements WorldQuery {
  terrain: Terrain
  coords: Coords
  private _edits: Map<string, ColumnSurface>
  private _baked: ImpactPoint[]

  constructor(terrain: Terrain, coords: Coords) {
    this.terrain = terrain
    this.coords  = coords
    /* Sparse override par colonne (clé = `${Math.round(x)},${Math.round(z)}`).
       Inerte cette passe ; prêt pour break/place. */
    this._edits = new Map()
    /* Les points d'impact sont bakés une fois, à la construction du monde.
       L'audio les récupère via impactPoints() — jamais via le terrain. */
    this._baked = bakeImpactPoints(terrain, coords).points
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
    /* En 2.5D, la surface est le toit de la colonne ; la distance est la hauteur
       du point au-dessus de ce toit (jamais négative côté ciel). */
    return { distance: Math.max(0, p.y - surf.y), material }
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

  impactPoints(): ReadonlyArray<ImpactPoint> {
    return this._baked
  }
}

export function makeDefaultWorld({ terrain, coords }: { terrain: Terrain; coords: Coords }): FlatWorld {
  return new FlatWorld(terrain, coords)
}
