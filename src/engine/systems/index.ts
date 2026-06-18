/* ── Assemblage des systèmes de simulation (J2) ──────────────────────────────
   Ordre EXPLICITE codé en dur (architecture.md §3.1) : génération → allocation de
   voix. La couche d'un impact est désormais fixée À L'ÉMISSION par RainPoisson
   (deux flux de Poisson L1/L2, cf. notes/random/pluie.txt) — plus d'étape de routage
   zonal a posteriori. */

import { headInputToWorld } from '../context/coords.js'
import { createInputSystem, type InputSystemDeps } from './input.js'
import { createRainPoissonSystem } from './rainPoisson.js'
import { createVoicePoolSystem } from './voicePool.js'
import { createAudioSyncSystem } from './audioSync.js'
import { createDiffuseBedSystem } from './diffuseBed.js'
import { createFaceProjectionSystem } from './faceProjection.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { Entity } from '../ecs/Entity.js'
import type { Banks } from '../../audio/banks.js'
import type { DiffuseBed } from '../../audio/DiffuseBed.js'

/** Construit les systèmes de simulation pure (pas d'audio ni rendu), liés au World. */
export function createSimSystems(world: GameWorld, ctx: EngineContext, inputDeps?: InputSystemDeps): System[] {
  return [
    createInputSystem(ctx, inputDeps ?? { world }),
    createRainPoissonSystem(world, ctx),
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
  bed?: DiffuseBed,
): System[] {
  return [
    ...createSimSystems(world, ctx, { world, audioCtx, ...inputDeps }),
    createAudioSyncSystem(world, ctx, banks, audioCtx),
    /* Nappe diffuse L3 : ajoutée seulement si le bed audio est présent (jamais en
       headless). Indépendante des voix/du frame — pilotée par l'intensité de pluie. */
    ...(bed ? [createDiffuseBedSystem(world, bed)] : []),
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

  /* Pool L1 (héros, proche) puis pool L2 (prolongement lointain, budget séparé).
     Les id restent uniques sur tout le pool (identité des démotions/onsets). */
  resizeVoicePool(world, 'L1', ctx.worldConfig.layers.L1.voices)
  resizeVoicePool(world, 'L2', ctx.worldConfig.layers.L2.voicesMax)
}

let _nextVoiceId = 0

function mkVoice(id: number, layer: 'L1' | 'L2'): { voice: NonNullable<Entity['voice']> } {
  return {
    voice: {
      id,
      layer,
      materialId: null,
      sample: 0,
      grain: 0,
      mix: 0,
      gainDb: 0,
      levelDb: -Infinity,
      busy: false,
      dist: 0,
      pos: { x: 0, y: 0, z: 0 },
      startedAt: 0,
      duration: 0,
    },
  }
}

/* Redimensionne le pool de voix d'UNE couche à `count` entités, à la volée. Les
   entités voix sont créées paresseusement côté audio (audioSync crée la SpatialSource
   au 1ᵉʳ tick où l'id apparaît), donc ajouter/retirer fonctionne en live sans recâbler
   l'audio. Les ids restent globalement uniques (compteur monotone) pour ne pas
   collisionner avec les démotions/onsets d'une voix retirée. Retirer les voix LIBRES
   d'abord (jamais couper une voix qui sonne ; on retire les occupées en dernier). */
export function resizeVoicePool(world: GameWorld, layer: 'L1' | 'L2', count: number): void {
  const target = Math.max(0, Math.floor(count))
  const current = [...world.with('voice')].filter(e => e.voice!.layer === layer)
  if (current.length < target) {
    for (let i = current.length; i < target; i++) world.add(mkVoice(_nextVoiceId++, layer))
  } else if (current.length > target) {
    /* Retirer les libres avant les occupées pour minimiser les coupures audibles. */
    const removable = current.sort((a, b) => Number(a.voice!.busy) - Number(b.voice!.busy))
    for (let i = 0; i < current.length - target; i++) world.remove(removable[i])
  }
}
