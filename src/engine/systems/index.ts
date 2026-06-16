/* ── Assemblage des systèmes de simulation (J2) ──────────────────────────────
   Ordre EXPLICITE codé en dur (architecture.md §3.1) : génération → routage →
   allocation de voix. On ROUTE avant d'allouer car la couche d'un impact décide
   s'il mérite une voix héros (L1) ou part aux secteurs (L2/L3) — fidèle au v0 dont
   `trigger` route les impacts lointains et RETOURNE avant `pool.play`. (Diffère de
   l'ordre purement illustratif de §3.4.) */

import { headInputToWorld } from '../context/coords.js'
import { createInputSystem, type InputSystemDeps } from './input.js'
import { createRainPoissonSystem } from './rainPoisson.js'
import { createLodRoutingSystem } from './lodRouting.js'
import { createVoicePoolSystem } from './voicePool.js'
import { createAudioSyncSystem } from './audioSync.js'
import { createFaceProjectionSystem } from './faceProjection.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { Banks } from '../../audio/banks.js'

/** Construit les systèmes de simulation pure (pas d'audio ni rendu), liés au World. */
export function createSimSystems(world: GameWorld, ctx: EngineContext, inputDeps?: InputSystemDeps): System[] {
  return [
    createInputSystem(ctx, inputDeps ?? { world }),
    createRainPoissonSystem(world, ctx),
    createLodRoutingSystem(),
    createVoicePoolSystem(world, ctx),
  ]
}

/** Construit les systèmes de simulation + audio, liés au World.
    AudioSyncSystem tourne APRÈS VoicePoolSystem (qui pousse onsets/demotions).
    Le RENDU n'est PLUS un système : il est découplé du pas fixe et piloté par rAF
    (main.ts), conformément à architecture.md §2 (rAF a le droit de geler hors focus).
    FaceProjectionSystem reste dans la boucle (pur, suit la mesure audio, alimente le HUD). */
export function createEngineSystems(
  world: GameWorld,
  ctx: EngineContext,
  banks: Banks,
  audioCtx: AudioContext,
  inputDeps?: InputSystemDeps,
): System[] {
  return [
    ...createSimSystems(world, ctx, { world, audioCtx, ...inputDeps }),
    createAudioSyncSystem(world, ctx, banks, audioCtx),
    createFaceProjectionSystem(world),
  ]
}

/** Peuple le World : tête auditeur + émetteur de pluie global + pool de voix (taille = cfg L1). */
export function setupSimWorld(world: GameWorld, ctx: EngineContext, density = 0.5): void {
  // Entité tête : seule source de vérité pour la position de l'auditeur en monde.
  // InputSystem la met à jour chaque tick depuis controls.listener.
  const headPos = headInputToWorld(ctx.input.controls.listener, ctx.coords)
  world.add({
    transform: { position: headPos, forward: { x: 0, y: 0, z: -1 } },
    listener: { offset: { ...ctx.input.controls.listener }, earHeight: ctx.coords.EAR },
  })

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
