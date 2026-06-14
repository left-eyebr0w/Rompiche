/* ── Composants ECS (Miniplex) & type Entity ─ Grand Refactor J0 ──────────────
   Types-frontières SEULS (architecture.md §3.2). Aucun comportement : un composant
   est une propriété optionnelle d'entité, DONNÉE PURE (sérialisation triviale = saves).
   L'inventaire suit le mapping de l'existant v0 ; les composants du monde vivant
   (Animable, Fauna) sont listés mais pas implémentés au refactor. */

import type { Vector3 } from '../context/coords.js'
import type { MaterialId } from '../components/materials.js'

/** Position (m) + orientation. Dispersé en v0 (head, voices, objects). */
export interface Transform {
  position: Vector3
  /** Vecteur avant unitaire (orientation). */
  forward: Vector3
}

/** L'auditeur : offset slider normalisé + hauteur d'oreille. Origine v0 : coords + state. */
export interface Listener {
  /** Offset normalisé [−1, +1] par axe (avant résolution monde). */
  offset: Vector3
  /** Hauteur d'oreille en mètres (EAR = 1.6). */
  earHeight: number
}

/** Émetteur de pluie : paramètres du tirage Poisson. Origine v0 : tickPoisson. */
export interface RainEmitter {
  /** Densité d'impacts. */
  density: number
  active: boolean
}

/** Une voix du pool sonore. Origine v0 : RainSampler.Voice. */
export interface Voice {
  /** Index stable dans le pool (= identité pour les démotions). */
  id: number
  materialId: MaterialId | null
  /** Référence d'échantillon (indice de banque) du grain en cours. */
  sample: number
  /** Désaccord du grain (cents/ratio). */
  grain: number
  gainDb: number
  busy: boolean
  /** Distance à l'auditeur (m), au moment de l'acquisition (pour priorité). */
  dist: number
  /** Position monde de l'impact porté par la voix. */
  pos: Vector3
  /** Temps logique (s) du début du grain (âge = now − startedAt). */
  startedAt: number
  /** Durée nominale du grain (s) ; la voix se libère à startedAt + duration. */
  duration: number
}

/** Matériau de surface référencé (table materials). */
export interface SurfaceMaterial {
  materialId: MaterialId
}

/** Vent : direction, force, inclinaison. Origine v0 : state wind*. */
export interface Wind {
  /** Rotation horizontale (rad). */
  direction: number
  force: number
  /** Inclinaison de la pluie (rad). */
  tilt: number
}

/* ── Monde vivant : listés (justifient l'ECS), non peuplés au refactor (§3.2) ─── */

/** Objet animable : timeline 0-1 pilotée par conditions. Non implémenté au refactor. */
export interface Animable {
  /** Progression de la timeline [0, 1]. */
  timeline: number
}

/** Faune : comportement + biome. Non implémenté au refactor. */
export interface Fauna {
  behavior: string
  biome: string
}

/** Une entité Miniplex = objet JS plat ; ses propriétés SONT les composants. */
export type Entity = {
  transform?: Transform
  listener?: Listener
  voice?: Voice
  rainEmitter?: RainEmitter
  surface?: SurfaceMaterial
  wind?: Wind
  // … monde vivant (non peuplé au refactor) :
  animable?: Animable
  fauna?: Fauna
}
