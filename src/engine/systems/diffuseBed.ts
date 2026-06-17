/* ── DiffuseBedSystem ─ couche L3 (nappe diffuse) ─────────────────────────────
   Pilote la nappe diffuse depuis l'intensité de pluie courante. Fidèle au v0
   (DiffuseBed.setWeather) : la nappe est pilotée par l'INTENSITÉ, pas par les
   impacts individuels — un fond continu de pluie lointaine, non localisé.

   L'intensité courante = densité de l'émetteur de pluie actif (le levier temps-réel
   « Densité » de l'UI), bornée [0,1]. Émetteur inactif → intensité 0 → silence.

   PUR côté orchestration : toute la techno audio (worklet, filtre, gain) vit dans
   la classe DiffuseBed (DOM/AudioContext). Le système n'est qu'un pont : il lit
   l'état du World et appelle bed.setIntensity. ABSENT en headless (pas de bed) →
   le pont n'est tout simplement pas ajouté au pipeline (cf. index.ts). */

import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { DiffuseBed } from '../../audio/DiffuseBed.js'

export function createDiffuseBedSystem(world: GameWorld, bed: DiffuseBed): System {
  const emitters = world.with('rainEmitter')

  return (ctx: EngineContext) => {
    let intensity = 0
    for (const e of emitters) {
      if (e.rainEmitter!.active) { intensity = e.rainEmitter!.density; break }
    }
    bed.setIntensity(intensity)
    ctx.l3Level = bed.levelDb()
  }
}
