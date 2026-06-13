/* ── Monde 2.5D (colonnes) · contrat unique pour L1 (slice) et L2 (far-field) ────
   Rain ne frappe que la cellule topmost sky-exposed d'une colonne. Le monde
   entier se réduit à une requête O(1) : rainSurfaceAt(x, z) → {y, material, skyExposed}.

   Cette classe enveloppe le Terrain (slice) + applique une couche de monde
   (flat uniform beyond the slice). Edit overlay (sparse column overrides) incluse
   pour forward-compat ; inerte cette passe. */

export class FlatWorld {
  constructor(terrain, coords) {
    this.terrain = terrain
    this.coords  = coords
    /* Sparse override par colonne (clé = `${Math.round(x)},${Math.round(z)}`).
       Inerte cette passe ; prêt pour break/place. */
    this._edits = new Map()
  }

  /* Requête audio unique : (x,z) → {y, material, skyExposed}.
     À l'intérieur de la slice : délègue à terrain.cellAt (bounds-checking inclus).
     Au-delà : matériau uniforme 'terre' au niveau du sol. */
  rainSurfaceAt(x, z) {
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
}

export function makeDefaultWorld({ terrain, coords }) {
  return new FlatWorld(terrain, coords)
}
