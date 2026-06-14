/* ── Assemblage des systèmes de simulation (J2) ──────────────────────────────
   Ordre EXPLICITE codé en dur (architecture.md §3.1) : génération → routage →
   allocation de voix. On ROUTE avant d'allouer car la couche d'un impact décide
   s'il mérite une voix héros (L1) ou part aux secteurs (L2/L3) — fidèle au v0 dont
   `trigger` route les impacts lointains et RETOURNE avant `pool.play`. (Diffère de
   l'ordre purement illustratif de §3.4.) */

import { createRainPoissonSystem } from './rainPoisson.js'
import { createLodRoutingSystem } from './lodRouting.js'
import { createVoicePoolSystem } from './voicePool.js'
import { createAudioSyncSystem } from './audioSync.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { Banks } from '../../audio/banks.js'

/** Construit les systèmes de simulation pure (pas d'audio ni rendu), liés au World. */
export function createSimSystems(world: GameWorld, ctx: EngineContext): System[] {
  return [
    createRainPoissonSystem(world, ctx),
    createLodRoutingSystem(),
    createVoicePoolSystem(world, ctx),
  ]
}

/** Construit les systèmes de simulation + audio, liés au World.
    AudioSyncSystem tourne APRÈS VoicePoolSystem (qui pousse onsets/demotions). */
export function createEngineSystems(
  world: GameWorld,
  ctx: EngineContext,
  banks: Banks,
  audioCtx: AudioContext,
): System[] {
  return [
    ...createSimSystems(world, ctx),
    createAudioSyncSystem(world, ctx, banks, audioCtx),
  ]
}

/** Peuple le World : un émetteur de pluie global + le pool de voix (taille = cfg L1). */
export function setupSimWorld(world: GameWorld, ctx: EngineContext, density = 0.5): void {
  world.add({ rainEmitter: { density, active: true } })
  const n = ctx.worldConfig.layers.L1.voices
  for (let i = 0; i < n; i++) {
    world.add({
      voice: {
        id: i,
        materialId: null,
        sample: 0,
        grain: 0,
        gainDb: 0,
        busy: false,
        dist: 0,
        pos: { x: 0, y: 0, z: 0 },
        startedAt: 0,
        duration: 0,
      },
    })
  }
}
