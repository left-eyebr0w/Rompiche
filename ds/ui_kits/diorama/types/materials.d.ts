/** Registre central des matériaux de surface (materials.js). */

export type MaterialId = 'metal' | 'bache' | 'terre'

export interface Material {
  id: MaterialId
  label: string
  urls: string[]
  gain: number
  minDistance: number
  maxDistance: number
  debugColor: number
}

export declare const MATERIALS: Material[]
export declare const MATERIAL_INDEX: Record<MaterialId, number>
export declare function materialById(id: string): Material | null
export declare function requireMaterial(id: string): Material
