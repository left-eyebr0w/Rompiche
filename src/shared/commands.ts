/* ── Canaux UI → moteur (intents) ─ Grand Refactor J0 ────────────────────────
   Types-frontières SEULS (architecture.md §5.2). DEUX canaux selon la nature de
   l'entrée. Module DONNÉE PURE, importable par l'UI ET le moteur (le moteur n'importe
   jamais React). Le moteur reste l'autorité : l'UI envoie l'intent brut, le moteur clampe.
     Canal A — Command : actions discrètes ; chaque occurrence compte (file drainée/vidée).
     Canal B — ControlState : continus + bascules ; seule la dernière valeur compte. */

import type { MaterialId } from '../engine/components/materials.js'
import type { WorldConfig } from '../engine/context/worldConfig.js'

/** Canal A — file de commandes (actions discrètes). Ordre = ordre d'arrivée → déterministe. */
export type Command =
  | { t: 'paint'; cell: number; mat: MaterialId }
  | { t: 'save'; name: string }
  | { t: 'load'; name: string }
  | { t: 'setScale'; cfg: WorldConfig }
  | { t: 'reset' }

/** Canal B — état de contrôle double-bufferé (continus + bascules). L'UI ÉCRASE, l'InputSystem POLL. */
export interface ControlState {
  /** Position auditeur normalisée [−1, +1]. */
  listener: { x: number; y: number; z: number }
  density: number
  gain: number
  wind: { force: number; rot: number; tilt: number }
  rain: boolean
  metal: boolean
  bache: boolean
  listening: boolean
}
