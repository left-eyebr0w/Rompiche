/* ── EngineContext — les Resources/singletons passés à chaque système ─ J0 ─────
   Type-frontière SEUL (architecture.md §3.1, §3.4). Miniplex n'a pas de notion de
   Resource : on la fournit nous-mêmes. Cet objet est passé en 1ᵉʳ argument à chaque
   système. HORS ECS (ce ne sont pas des entités). Agrège les coutures stables.
   Aucun comportement ici : que la signature. */

import type { Coords } from './coords.js'
import type { WorldConfig, LayerBoundaries } from './worldConfig.js'
import type { MaterialId } from '../components/materials.js'
import type { WorldQuery } from '../world/World.js'
import type { SpatialAudioBackend } from '../../audio/SpatialAudioBackend.js'
import type { RenderTarget } from '../../render/RenderTarget.js'
import type { ClockSource } from '../../platform/ClockSource.js'
import type { FrameEvents } from '../loop/frame.js'
import type { Command, ControlState } from '../../shared/commands.js'

/** PRNG seedé unique (Resource). Implémenté par makePrng (mulberry32, prng.js).
   Forme alignée sur l'existant v0 : un seul PRNG partagé moteur ↔ reste du code. */
export interface Prng {
  /** Flottant déterministe [0, 1). Math.random est INTERDIT dans les systèmes. */
  aléa(): number
  /** Dérive un sous-PRNG indépendant (déterministe). */
  fork(): Prng
  readonly seed: number
}

/** Horloge LOGIQUE (déterministe), avancée par la boucle à chaque tick. Distincte
   du temps audio `currentTime` qu'aucun système de simu ne lit (§7). */
export interface LogicalClock {
  /** Numéro du tick logique courant. */
  tick: number
  /** Temps logique écoulé (s) = tick × FIXED_DT. */
  seconds: number
}

/** État d'intégration Poisson par matériau (Resource ; miroir v0 _poissonAcc/Next/_rr). */
export interface PoissonState {
  /** Temps accumulé (ms) en attente de prochain impact. */
  acc: number
  /** Intervalle (ms) avant le prochain impact (tiré ∼ exp(λ)). */
  next: number
  /** Round-robin de sélection d'échantillon. */
  rr: number
}

/** Canaux d'entrée UI → moteur (§5.2). */
export interface InputChannels {
  /** Canal A : file de commandes (drainée + vidée chaque tick). */
  commands: Command[]
  /** Canal B : état de contrôle (dernière valeur, polled chaque tick). */
  controls: ControlState
}

/** Resources/singletons partagés, hors ECS, passés à chaque système. */
export interface EngineContext {
  coords: Coords
  worldConfig: WorldConfig
  world: WorldQuery
  clock: ClockSource
  prng: Prng
  /** Horloge logique (déterministe), avancée par la boucle. */
  time: LogicalClock
  /** Frontières de couches r1/r2/overlap (dérivées de worldConfig+coords). */
  bands: LayerBoundaries
  /** Densité d'activité par matériau [0..1] (0 = surface coupée). Miroir v0 surfaceDensities. */
  surfaces: Record<MaterialId, number>
  /** Cooldown par cellule (clé = index de cellule → dernier temps logique d'impact, s). */
  cooldown: Map<number, number>
  /** État d'intégration Poisson par matériau. */
  poisson: Record<MaterialId, PoissonState>
  /** Tampons de frame mono-tick, vidés en début de tick. */
  frame: FrameEvents
  /** Niveaux directionnels des 6 faces de la tête (projetés par FaceProjectionSystem). */
  faceLevels: [number, number, number, number, number, number]
  input: InputChannels
  /* Adaptateurs liés au DOM / AudioContext : injectés par la platform au démarrage,
     LÉGITIMEMENT ABSENTS en test headless (le cœur tourne sans audio ni rendu, §2.1). */
  audio?: SpatialAudioBackend
  render?: RenderTarget
}
