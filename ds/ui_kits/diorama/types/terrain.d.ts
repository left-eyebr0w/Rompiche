/** Terrain sérialisable : grille matériaux (0.5m) + grille relief (1m) — Terrain.js. */

import type { Material, MaterialId } from './materials'

export interface CellResult {
  material: Material
  height: number
}

export declare class Terrain {
  readonly size: number
  readonly cell: number
  readonly block: number
  readonly cols: number
  readonly rows: number
  readonly bcols: number
  readonly brows: number
  /** Grille fine (matériau par cellule) — indices MATERIAL_INDEX */
  material: Uint8Array
  /** Grille blocs (hauteur en unités entières) */
  height: Uint8Array

  constructor(opts: { size: number; cell: number; block: number })

  /** Retourne le matériau et la hauteur (en mètres) à la position monde (x, z). */
  cellAt(x: number, z: number): CellResult | null

  /** Remplit toutes les cellules avec la fonction fournie. */
  fill(fn: (cx: number, cz: number) => MaterialId): void
}

export declare function makeDefaultTerrain(opts: {
  size: number
  cell: number
  block: number
}): Terrain
