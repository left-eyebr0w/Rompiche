/** Couche props : objets discrets placés dans le monde (objects.js). */

import type { MaterialId } from './materials'

export interface WorldObject {
  id: string
  materialId: MaterialId
  /** Dimensions [largeur, hauteur, profondeur] en mètres */
  size: [number, number, number]
  /** Position monde [x, y, z] en mètres */
  position: [number, number, number]
}

export declare function makeObject(opts: {
  id: string
  materialId: MaterialId
  size: [number, number, number]
  position: [number, number, number]
}): WorldObject

export declare function makeDefaultObjects(): WorldObject[]
