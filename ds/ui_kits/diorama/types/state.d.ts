/** État React centralisé du diorama (DioramaApp.jsx). */

export type Preset = 'diorama' | 'room' | 'courtyard' | 'field'
export type Platform = 'mobile' | 'desktop' | 'vr'
export type ClockMode = 'sync' | 'manual'
export type ClockSegment = 'aube' | 'jour' | 'crépuscule' | 'nuit'

export interface DioramaState {
  /** Météo */
  rain: boolean
  wind: boolean
  windTilt: number
  windRotation: number
  windForce: number

  /** Surfaces actives */
  metal: boolean
  bache: boolean

  /** Auditeur */
  listening: boolean
  /** Position normalisée [−1, +1] sur chaque axe */
  x: number
  y: number
  z: number

  /** Pluie */
  density: number
  /** Gain maître en dB [−60, 0] */
  gain: number

  /** Caméra */
  spin: number
  zoom: number

  /** Horloge */
  clockMode: ClockMode
  clockSegment: ClockSegment

  /** Debug */
  debug: boolean

  /** Configuration monde */
  preset: Preset
  seed: number
  platform: Platform
}

export type DioramaStatePatch = Partial<DioramaState>
