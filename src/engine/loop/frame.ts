/* ── Tampons de frame (événements mono-tick) ─ Grand Refactor J0 ──────────────
   Types-frontières SEULS (architecture.md §3.4). Un événement éphémère, haut volume,
   produit ET consommé dans le même tick → tableau ordonné dans l'EngineContext,
   vidé par la boucle en début de tick. JAMAIS une entité par impact (chemin chaud).
   L'ordre des tableaux = ordre de production (PRNG seedé) → déterminisme gratuit. */

import type { Vector3 } from '../context/coords.js'
import type { MaterialId } from '../components/materials.js'

/** Référence à un échantillon (point d'impact baké). */
export type SampleRef = number

/** Couche LOD de destination d'un impact (architecture.md §3.3). */
export type Layer = 'L1' | 'L2' | 'L3'

/** Un impact de pluie tiré au tick courant. Origine v0 : tickPoisson → trigger.
   `dist`/`layer` sont renseignés par LodRoutingSystem (layer undefined = pas encore
   routé, ou rejeté par le cooldown de cellule). */
export interface Impact {
  surface: MaterialId
  pos: Vector3
  detune: number
  sample: SampleRef
  /** Distance à l'auditeur (m), posée par LodRoutingSystem. */
  dist?: number
  /** Couche de destination, posée par LodRoutingSystem. */
  layer?: Layer
}

/** Une démotion de voix (vol/fade-out) décidée au tick courant. */
export interface Demotion {
  /** Identifiant de la voix démise. */
  voice: number
}

/** Un déclenchement de grain au tick courant : une voix VIENT d'être (ré)acquise et
   doit jouer un nouveau grain. C'est le signal d'ONSET que l'AudioSync consomme pour
   créer un BufferSource (la voix porte le reste : matériau, sample, detune, pos). */
export interface GrainOnset {
  /** Identifiant de la voix qui démarre un grain. */
  voice: number
}

/** Canaux mono-tick exposés par ctx.frame, vidés en début de tick (§3.4). */
export interface FrameEvents {
  /** RainPoissonSystem pousse → VoicePool/LodRouting drainent. */
  impacts: Impact[]
  /** VoicePoolSystem pousse (sur vol) → AudioSync applique le fade-out. */
  demotions: Demotion[]
  /** VoicePoolSystem pousse (sur acquisition) → AudioSync déclenche le grain. */
  grainOnsets: GrainOnset[]
}
