/* ── EditSystem ─ boucle d'édition du terrain (cadrage rework/07) ─────────────
   Consomme les commandes `edit` (canal A) et exécute la couture EditableWorld en
   DEUX temps :
     • TEMPS 1 — applyEdit(brush) : mute le monde, empile la zone salie (synchrone).
     • TEMPS 2 — flushRemesh(budget) : rebake le pool des zones salies (budget borné).
   Les deux temps vivent ici, dans un système ordonné APRÈS InputSystem (qui ne fait
   plus que drainer les commandes save/load/reset). Au SDF, flushRemesh déléguera au
   Worker derrière la même signature — ce système ne change pas.

   PUR côté logique : ne touche ni l'audio ni le rendu. Absent si le monde n'est pas
   éditable (headless minimal) — comme diffuseBed est absent sans bed. */

import { isEditable } from '../world/World.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'

/** Budget de zones rebakées par tick. Le terrain plat est petit → généreux suffit ;
    le budget existe pour le contrat (le SDF le bornera vraiment, remaillage Worker). */
const REMESH_BUDGET = 8

export function createEditSystem(_ctx: EngineContext): System {
  return (c) => {
    const world = c.world
    if (!isEditable(world)) {
      /* Monde non éditable : on draine quand même les commandes edit pour ne pas
         les laisser s'accumuler indéfiniment. */
      c.input.commands = c.input.commands.filter(cmd => cmd.t !== 'edit')
      return
    }

    /* TEMPS 1 — applique les coups de brosse de ce tick (ordre = ordre d'arrivée),
       et retire ces commandes de la file (InputSystem les a laissées pour nous). */
    const remaining: typeof c.input.commands = []
    for (const cmd of c.input.commands) {
      if (cmd.t === 'edit') world.applyEdit(cmd.brush)
      else remaining.push(cmd)
    }
    c.input.commands = remaining

    /* TEMPS 2 — rebake les zones salies en attente (budget borné). */
    world.flushRemesh(REMESH_BUDGET)
  }
}
