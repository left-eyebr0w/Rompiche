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

/** Un impact de pluie tiré au tick courant. Posé entièrement par RainPoissonSystem
   (deux flux de Poisson L1/L2, cf. notes/random/pluie.txt) : la couche est fixée à
   l'émission — plus d'étape de routage a posteriori. */
export interface Impact {
  surface: MaterialId
  pos: Vector3
  detune: number
  sample: SampleRef
  /** Distance horizontale à l'auditeur (m), posée par RainPoissonSystem. */
  dist?: number
  /** Couche de destination (fixée par le flux Poisson émetteur). */
  layer?: Layer
  /** Position de timbre ∈ [0,1] dérivée de la distance (0 = L1 proche / timbre clair,
     1 = bord externe de l'anneau L2 / timbre sourd). Pilote l'interpolation de timbre
     (flou/pitch) côté audio. */
  mix?: number
  /** Décalage sous-tick (s) de l'impact dans la fenêtre du tick, calculé par le
     processus de Poisson. Permet d'étaler les onsets dans le temps audio au lieu
     de les empiler à l'instant du tick (sinon : pulsation à la fréquence de tick). */
  offset?: number
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
  /** Décalage sous-tick (s) hérité de l'impact : quand jouer le grain dans la
     fenêtre du tick, relatif au temps audio courant. */
  offset?: number
}

/** Canaux mono-tick exposés par ctx.frame, vidés en début de tick (§3.4). */
export interface FrameEvents {
  /** RainPoissonSystem pousse (couche déjà fixée) → VoicePool draine. */
  impacts: Impact[]
  /** VoicePoolSystem pousse (sur vol) → AudioSync applique le fade-out. */
  demotions: Demotion[]
  /** VoicePoolSystem pousse (sur acquisition) → AudioSync déclenche le grain. */
  grainOnsets: GrainOnset[]
}
