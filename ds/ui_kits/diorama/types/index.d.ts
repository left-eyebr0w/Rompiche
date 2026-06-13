/** Point d'entrée unique pour les types du modèle de données Rompiche. */

export type { Coords, Vector3, HeadInput, HeadFace } from './coords'
export type { MaterialId, Material } from './materials'
export type { CellResult, Terrain } from './terrain'
export type { WorldObject } from './objects'
export type {
  Preset, Platform, ClockMode, ClockSegment,
  DioramaState, DioramaStatePatch,
} from './state'
export type {
  L1Priority, L1Config, L2Config, L3Config, L3FilterConfig,
  LayersConfig, WeatherConfig, WorldConfig,
  LayerBoundaries, PlatformPreset,
} from './worldConfig'
