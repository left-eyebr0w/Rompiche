/* ── SpatialAudioBackend — couture audio ↔ spatialisation ─ Grand Refactor J0 ──
   Types-frontières SEULS (architecture.md §4.2). Abstrait la techno de spatialisation
   pour permettre le swap Resonance → Web Audio sans toucher aux systèmes audio.
     Impl transitoire : ResonanceBackend (temps 1 du swap)
     Impl cible       : WebAudioBackend (PannerNode HRTF, temps 2) */

import type { Vector3 } from '../engine/context/coords.js'
import type { MaterialId } from '../engine/components/materials.js'

export interface SpatialAudioBackend {
  init(ctx: AudioContext): void
  /** Temps audio courant (currentTime de l'AudioContext). */
  readonly currentTime: number
  /** Une source spatialisée par Voice. */
  createSource(): SpatialSource
  setListener(pos: Vector3, forward: Vector3, up: Vector3): void
  // occlusion (monde vivant) : filtre passe-bas sur le send
  // réverb   (monde vivant) : ConvolverNode partagé, IR ← enclosedVolume()
}

export interface SpatialSource {
  /** Point de connexion du grain. */
  readonly input: AudioNode
  setPosition(p: Vector3): void
  /** Configure les paramètres d'atténuation (refDistance/maxDistance) selon le matériau. */
  setMaterial(id: MaterialId | null): void
  dispose(): void
}
