import { MATERIALS, MATERIAL_INDEX, requireMaterial, type Material, type MaterialId } from '../components/materials.js'

/* ── Couche 1 · le terrain (donnée, éditable) — §6 de SYSTEME-SURFACES.md ────
   Deux résolutions : le MATÉRIAU vit sur la grille fine (cellule 0,5 m), le
   RELIEF sur la grille blocs (1 m). Les grilles sont des Uint8Array plats :
   compacts, rapides, sérialisables tels quels.

   La seule question posée au terrain est « à (x,z), quel matériau et quelle
   hauteur ? », résolue en O(1) par quantification. */

export interface CellResult {
  material: Material
  height: number
}

export class Terrain {
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

  constructor({ size, cell, block }: { size: number; cell: number; block: number }) {
    this.size = size
    this.cell = cell
    this.block = block
    this.cols = this.rows = Math.ceil(size / cell)
    this.bcols = this.brows = Math.ceil(size / block)
    this.material = new Uint8Array(this.cols * this.rows) // grille fine → MATERIALS[]
    this.height = new Uint8Array(this.bcols * this.brows)  // grille blocs → hauteur (en blocs)
  }

  /* monde → indice grille fine ; -1 hors-terrain */
  index(x: number, z: number): number {
    const c = Math.floor((x + this.size / 2) / this.cell)
    const r = Math.floor((z + this.size / 2) / this.cell)
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1
    return r * this.cols + c
  }

  /* monde → indice grille blocs ; -1 hors-terrain */
  bindex(x: number, z: number): number {
    const c = Math.floor((x + this.size / 2) / this.block)
    const r = Math.floor((z + this.size / 2) / this.block)
    if (c < 0 || r < 0 || c >= this.bcols || r >= this.brows) return -1
    return r * this.bcols + c
  }

  cellAt(x: number, z: number): CellResult | null {
    const i = this.index(x, z)
    if (i < 0) return null
    const b = this.bindex(x, z)
    return {
      material: MATERIALS[this.material[i]],
      height: (b < 0 ? 0 : this.height[b]) * this.block, // relief monde, pas de bloc
    }
  }

  /* Remplit chaque cellule via un prédicat (cx, cz) → id matériau, en passant le
     CENTRE monde de la cellule. Boucle locale O(cellules), indépendante du runtime.
     Chaque cellule DOIT recevoir un matériau valide : requireMaterial lève si le
     prédicat renvoie un id inconnu (plus de défaut silencieux sur l'indice 0). */
  fill(materialAt: (cx: number, cz: number) => MaterialId): void {
    const half = this.size / 2
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const cx = (c + 0.5) * this.cell - half
        const cz = (r + 0.5) * this.cell - half
        const id = materialAt(cx, cz)
        requireMaterial(id) // invariant : matériau obligatoire (lève si inconnu)
        this.material[r * this.cols + c] = MATERIAL_INDEX[id]
      }
    }
  }
}

/* Terrain initial : sol PLAT uniforme en terre. Le relief de test (bloc surélevé)
   et la frontière métal/bâche désactivable ont été retirés (cadrage 04 §3.3) :
   on repart sur une base saine. Les matières variées et l'élévation sont désormais
   portées par les OBJETS posés (objects.ts → makeTestScene), pas par le terrain. */
export function makeDefaultTerrain({ size, cell, block }: { size: number; cell: number; block: number }): Terrain {
  const terrain = new Terrain({ size, cell, block })
  terrain.fill(() => 'terre')
  return terrain
}
