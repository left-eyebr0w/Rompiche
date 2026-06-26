/* ── Outil d'édition du terrain (brush abstrait) ─ cadrage rework/07 ──────────
   Donnée PURE, importable par l'UI ET le moteur (jamais de React/three ici). Le
   brush décrit un GESTE d'édition indépendant de l'implémentation du monde :
     • shape = la ZONE affectée (disque en (x,z) aujourd'hui ; sphère/box au SDF) ;
     • op    = l'OPÉRATION (peindre un matériau ; lever le relief plus tard).

   Volontairement MINIMAL (cadrage 07 §4.1, §4bis pt 2) : on n'anticipe pas le
   vocabulaire CSG du World Shaper (add/sub/smooth/flatten/strength). Le SDF
   ÉLARGIRA l'union `op` — re-typage indolore : le canal de commandes, l'UI et la
   couture EditableWorld ne bougent pas, seul applyEdit gagne des cas. */

import type { MaterialId } from '../engine/components/materials.js'
import type { Vector3 } from '../engine/context/coords.js'

/** Zone d'influence du brush. `disc` = disque horizontal (rayon en mètres, y ignoré).
    Extensible (box, path, sphere…) — la forme reste commune plat ↔ SDF. */
export type BrushShape =
  | { kind: 'disc'; center: Vector3; radius: number }

/** Opération appliquée dans la zone. Minimal en v1 (cf. en-tête). */
export type BrushOp =
  | { t: 'paint'; mat: MaterialId }
  | { t: 'raise'; delta: number }   // relief (2ᵉ temps, cadrage 07 §3) — pas encore implémenté

export interface EditBrush {
  shape: BrushShape
  op: BrushOp
}
