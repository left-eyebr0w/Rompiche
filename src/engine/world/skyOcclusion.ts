/* ── SkyOcclusion — « ce point est-il à ciel ouvert ? » (cadrage 07) ──────────
   Réponse unique partagée par terrainMesh et objectMesh au bake du pool d'impacts.
   Un point reçoit la pluie verticale ssi RIEN de solide ne le surplombe sur sa
   colonne (x, z) au-dessus de y. Deux sources de surplomb :
     • le TERRAIN : une cellule plus haute que le point (relief, ancien expoCiel),
     • un OBJET   : une boîte (AABB) qui recouvre (x, z) avec son DESSOUS au-dessus de y.

   C'est l'extension aux objets de la notion expoCiel déjà portée par le terrain :
   un objet posé abrite le sol sous lui, et un objet en abrite un autre.

   Le test de NORMALE (face tournée vers le haut) est un filtre orthogonal appliqué
   à l'émission des faces (objectMesh) ; il ne vit PAS ici — ce module ne répond
   qu'à la question d'occlusion verticale.

   PAS de dépendance three.js : données pures. */

import type { Terrain } from './Terrain.js'
import type { WorldObject } from './objects.js'
import type { Coords } from '../context/coords.js'

/* Marge anti-auto-occlusion : un point sur le DESSUS d'une boîte ne doit pas être
   abrité par sa propre boîte. On ignore tout surplomb dont le dessous est à moins
   d'EPS au-dessus du point (le point EST sur cette surface). */
const EPS = 1e-3

export interface SkyOcclusion {
  /** true si quelque chose de solide surplombe (x, z) strictement au-dessus de y. */
  isSheltered(x: number, y: number, z: number): boolean
}

/** Construit le testeur depuis le terrain + les objets (toute la géométrie de
    collision verticale connue à la construction du monde). */
export function makeSkyOcclusion(terrain: Terrain, coords: Coords, objects: readonly WorldObject[]): SkyOcclusion {
  /* Bornes verticales [bas, haut] de chaque boîte, pré-calculées une fois. */
  const boxes = objects.map(o => {
    const [w, h, d] = o.size
    const [cx, cy, cz] = o.position
    return {
      minX: cx - w / 2, maxX: cx + w / 2,
      minZ: cz - d / 2, maxZ: cz + d / 2,
      bottom: cy - h / 2, top: cy + h / 2,
    }
  })

  return {
    isSheltered(x: number, y: number, z: number): boolean {
      /* Terrain : le toit de la colonne (sol + relief) est-il au-dessus du point ? */
      const cell = terrain.cellAt(x, z)
      if (cell) {
        const roof = coords.ground + cell.height
        if (roof > y + EPS) return true
      }

      /* Objets : une boîte recouvre-t-elle (x, z) avec son dessous au-dessus de y ?
         (Le dessous de la boîte abrite tout ce qui est sous elle.) */
      for (const b of boxes) {
        if (x < b.minX || x > b.maxX || z < b.minZ || z > b.maxZ) continue
        if (b.bottom > y + EPS) return true
        /* Point à l'intérieur du volume (ex. flanc/dessus d'une boîte plus basse) :
           abrité si le DESSUS de la boîte surplombe le point. */
        if (b.top > y + EPS && b.bottom < y - EPS) return true
      }

      return false
    },
  }
}
