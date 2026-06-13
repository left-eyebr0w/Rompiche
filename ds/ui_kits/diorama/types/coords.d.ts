/** Repère partagé audio / visuel — source de vérité unique (coords.js). */

export interface Coords {
  size: number
  half: number
  HC: number
  limit: number
  ground: number
  METER: number
  BLOCK: number
  CELL: number
  worldRadius: number
}

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface HeadInput {
  x: number
  y: number
  z: number
}

export interface HeadFace {
  label: 'FRONT' | 'BACK' | 'DROIT' | 'GAUCH' | 'HAUT' | 'BAS'
  n: [number, number, number]
}

export declare function makeCoords(size: number): Coords
export declare function headInputToWorld(input: HeadInput, limit: number): Vector3
export declare function worldToResonance(v: Vector3): [number, number, number]
export declare const LISTENER_FORWARD: Vector3
export declare const HEAD_FACES: HeadFace[]
