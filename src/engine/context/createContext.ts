/* ── Construction de l'EngineContext ─ Grand Refactor J1 ─────────────────────
   Assemble les Resources/singletons (architecture.md §3.1). À J1 on fournit la
   variante HEADLESS : tout le cœur réel (coords, worldConfig, WorldQuery, PRNG,
   horloge manuelle) SANS audio ni rendu (DOM/AudioContext absents en test). C'est
   la couture qui rend les garde-fous exécutables sans audio (§2.1).

   La variante « platform » (WorkletClock + backends réels, injectés au geste
   utilisateur) viendra aux jalons audio/rendu. */

import { makeCoords, headInputToWorld } from './coords.js'
import { makeWorldConfig, résoudreCouches, type WorldConfig } from './worldConfig.js'
import { makeDefaultTerrain } from '../world/Terrain.js'
import { makeDefaultWorld } from '../world/World.js'
// prng.js : JS non typé (Resource déterministe). On le relie à l'interface Prng.
import { makePrng } from './prng.js'
import { ManualClock } from '../../platform/ManualClock.js'
import type { EngineContext, Prng, InputChannels } from './EngineContext.js'
import type { ClockSource } from '../../platform/ClockSource.js'
import type { ControlState } from '../../shared/commands.js'

/** État de contrôle au repos (auditeur centré, pluie active, surfaces actives). */
export function defaultControls(): ControlState {
  return {
    listener: { x: 0, y: 0, z: 0 },
    density: 0.5,
    gain: 0,
    wind: { force: 0, rot: 0, tilt: 0 },
    rain: true,
    metal: true,
    bache: true,
    listening: true,
  }
}

function emptyInput(): InputChannels {
  return { commands: [], controls: defaultControls() }
}

export interface HeadlessOptions {
  seed?: number
  /** Évite detectPlatform() (pas de navigator en Node). */
  platform?: WorldConfig['platform']
  /** Permet d'injecter une horloge (ManualClock par défaut). */
  clock?: ClockSource
}

/** Construit un EngineContext complet mais sans audio ni rendu (test headless). */
export function createHeadlessContext(opts: HeadlessOptions = {}): EngineContext {
  const { seed = 1, platform = 'desktop', clock = new ManualClock() } = opts

  const worldConfig = makeWorldConfig({ seed, platform })
  const coords = makeCoords(worldConfig.size)
  const terrain = makeDefaultTerrain({ size: coords.size, cell: coords.CELL, block: coords.BLOCK })
  const world = makeDefaultWorld({ terrain, coords })
  const prng = makePrng(seed) as Prng
  const bands = résoudreCouches(coords.worldRadius, worldConfig)

  return {
    coords,
    worldConfig,
    world,
    clock,
    prng,
    time: { tick: 0, seconds: 0 },
    bands,
    surfaces: { metal: 1, bache: 1, terre: 1 },
    cooldown: new Map<number, number>(),
    poisson: {
      metal: { acc: 0, next: 0, rr: 0 },
      bache: { acc: 0, next: 0, rr: 0 },
      terre: { acc: 0, next: 0, rr: 0 },
    },
    frame: { impacts: [], demotions: [], grainOnsets: [] },
    faceLevels: [-Infinity, -Infinity, -Infinity, -Infinity, -Infinity, -Infinity],
    headWorldPos: headInputToWorld(defaultControls().listener, coords),
    input: emptyInput(),
    // audio / render : absents en headless (optionnels, §2.1)
  }
}
