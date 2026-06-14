/* ── La boucle de jeu à pas fixe ─ Grand Refactor J1 ─────────────────────────
   Boucle à PAS DE SIMULATION FIXE découplée de React et du framerate
   (architecture.md §2). Le maître d'horloge (ClockSource) fournit le realDt ; la
   boucle accumule et exécute des ticks logiques ENTIERS à FIXED_DT. Conséquences :
     - un orage ne tombe pas deux fois plus vite à 120 Hz ;
     - au retour d'onglet, l'accumulator est borné (MAX_CATCHUP) → pas de rafale ;
     - simulation reproductible (PRNG seedé + pas entier) → testable en headless.

   À J1 le registre de systèmes est vide (le cœur tourne à vide) ; il se remplira
   aux jalons suivants, dans un ordre EXPLICITE codé en dur (pas de magie). */

import type { EngineContext } from '../context/EngineContext.js'

/** Un système = simple fonction (ctx, dt) → void (architecture.md §3). */
export type System = (ctx: EngineContext, dt: number) => void

/** Pas de simulation fixe : 1/60 s. */
export const FIXED_DT = 1 / 60

/** Borne anti-spirale : au-delà, on jette le temps en trop (retour d'onglet). */
export const MAX_CATCHUP = 0.25

/** Registre ORDONNÉ des systèmes. Vide à J1. L'ordre du tableau EST l'ordre
    d'exécution (producteur avant consommateur pour les tampons de frame, §3.4). */
export const SYSTEMS: System[] = []

export interface Loop {
  /** Nombre de ticks logiques exécutés depuis la création (temps logique). */
  readonly tickIndex: number
  /** Exécute exactement un tick logique (vide les tampons, joue les systèmes). */
  step(): void
}

/** Vide les canaux mono-tick du tampon de frame, en début de tick (§3.4). */
function clearFrame(ctx: EngineContext): void {
  ctx.frame.impacts.length = 0
  ctx.frame.demotions.length = 0
  ctx.frame.grainOnsets.length = 0
}

/* Crée la boucle et l'abonne à l'horloge. Chaque realDt reçu fait avancer
   l'accumulator ; tant qu'il dépasse FIXED_DT, on exécute un tick logique. */
export function createLoop(ctx: EngineContext, systems: System[] = SYSTEMS): Loop {
  let accumulator = 0
  let tickIndex = 0

  function step(): void {
    clearFrame(ctx)
    // Avance l'horloge LOGIQUE (déterministe) — jamais le temps audio (§7).
    ctx.time.tick++
    ctx.time.seconds += FIXED_DT
    // (à venir : ctx.input.drain → InputSystem en tête de SYSTEMS)
    for (const sys of systems) sys(ctx, FIXED_DT)
    tickIndex++
  }

  ctx.clock.onTick((realDt: number) => {
    accumulator += Math.min(realDt, MAX_CATCHUP)
    while (accumulator >= FIXED_DT) {
      step()
      accumulator -= FIXED_DT
    }
  })

  return {
    get tickIndex() { return tickIndex },
    step,
  }
}
