/* ── Position monde de l'auditeur ─ helper partagé (J2) ──────────────────────
   Plusieurs systèmes ont besoin de la tête en coordonnées monde. En attendant le
   ListenerSystem (J5) qui matérialisera un Transform sur l'entité auditeur, on la
   dérive ici de l'état de contrôle (slider normalisé → monde), via l'invariant
   coords (headInputToWorld vit là et nulle part ailleurs). */

import { headInputToWorld, type Vector3 } from '../context/coords.js'
import type { EngineContext } from '../context/EngineContext.js'

export function listenerWorld(ctx: EngineContext): Vector3 {
  return headInputToWorld(ctx.input.controls.listener, ctx.coords)
}
