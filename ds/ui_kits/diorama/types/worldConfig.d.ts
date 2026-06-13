/** Configuration monde : presets, plateformes, résolution des couches (worldConfig.js). */

import type { Preset, Platform } from './state'

export interface L1Priority {
  w_gain: number
  w_dist: number
  w_att: number
  w_age: number
}

export interface L1Config {
  voices: number
  rMax: number
  priorité: L1Priority
  seuilWeakDb: number
}

export interface L2Config {
  rMax: number
  sectors: number
  débitMax: number
}

export interface L3FilterConfig {
  centreHz: number
  largeurHz: number
}

export interface L3Config {
  ordre: number
  filtre: L3FilterConfig
}

export interface LayersConfig {
  L1: L1Config
  L2: L2Config
  L3: L3Config
  crossfade: number
  hystérésis: number
}

export interface WeatherConfig {
  intensité: number
  vent: number
  dir: number
}

export interface WorldConfig {
  size: number
  preset: Preset
  seed: number
  platform: Platform
  ambisonicOrder: number
  layers: LayersConfig
  weather: WeatherConfig
}

export interface LayerBoundaries {
  r1: number
  r2: number
  overlap: number
  collapse: 'diorama' | 'small' | 'full'
}

export interface PlatformPreset {
  voicesL1: number
  sectorsL2: number
  ambisonicOrder: number
  sampleRate: number
}

export declare const PRESETS: Record<Preset, {
  size: number
  L1rMax: number
  L2rMax: number
  sectors: number
  crossfade: number
}>

export declare const PLATFORM_PRESETS: Record<Platform, PlatformPreset>

export declare function detectPlatform(): Platform

export declare function makeWorldConfig(opts?: {
  preset?: Preset
  seed?: number
  platform?: Platform
}): WorldConfig

export declare function résoudreCouches(
  worldRadius: number,
  cfg: WorldConfig
): LayerBoundaries
