/* ── Assemblage des systèmes de simulation (J2) ──────────────────────────────
   Ordre EXPLICITE codé en dur (architecture.md §3.1) : génération → routage →
   allocation de voix. On ROUTE avant d'allouer car la couche d'un impact décide
   s'il mérite une voix héros (L1) ou part aux secteurs (L2/L3) — fidèle au v0 dont
   `trigger` route les impacts lointains et RETOURNE avant `pool.play`. (Diffère de
   l'ordre purement illustratif de §3.4.) */

import { createInputSystem, type InputSystemDeps } from './input.js'
import { createRainPoissonSystem } from './rainPoisson.js'
import { createLodRoutingSystem } from './lodRouting.js'
import { createVoicePoolSystem } from './voicePool.js'
import { createAudioSyncSystem } from './audioSync.js'
import { createRenderSyncSystem } from './renderSync.js'
import { createFaceProjectionSystem } from './faceProjection.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { Banks } from '../../audio/banks.js'
import type { ThreeRenderer } from '../../render/ThreeRenderer.js'

/** Construit les systèmes de simulation pure (pas d'audio ni rendu), liés au World. */
export function createSimSystems(world: GameWorld, ctx: EngineContext, inputDeps?: InputSystemDeps): System[] {
  return [
    createInputSystem(ctx, inputDeps ?? { world }),
    createRainPoissonSystem(world, ctx),
    createLodRoutingSystem(),
    createVoicePoolSystem(world, ctx),
  ]
}

/** Construit les systèmes de simulation + audio + rendu, liés au World.
    AudioSyncSystem tourne APRÈS VoicePoolSystem (qui pousse onsets/demotions).
    RenderSyncSystem tourne en dernier (n'affecte ni la simu ni l'audio). */
export function createEngineSystems(
  world: GameWorld,
  ctx: EngineContext,
  banks: Banks,
  audioCtx: AudioContext,
  renderer?: ThreeRenderer,
  inputDeps?: InputSystemDeps,
): System[] {
  const systems: System[] = [
    ...createSimSystems(world, ctx, { world, audioCtx, ...inputDeps }),
    createAudioSyncSystem(world, ctx, banks, audioCtx),
  ]
  if (renderer) systems.push(createRenderSyncSystem(renderer, world))
  systems.push(createFaceProjectionSystem(world))
  return systems
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
        levelDb: -Infinity,
        busy: false,
        dist: 0,
        pos: { x: 0, y: 0, z: 0 },
        startedAt: 0,
        duration: 0,
      },
    })
  }
}
