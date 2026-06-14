/* ── Garde-fou neuf (J1) : la simulation est déterministe & à pas fixe ────────
   Le déterminisme (architecture.md §7) est testable ICI, sans audio : même seed
   PRNG → même suite de tirages, sur N ticks logiques entiers. Exerce d'un coup le
   World Miniplex, la boucle à pas fixe, ManualClock, le PRNG Resource et le tampon
   de frame (vidé chaque tick). */

import { describe, it, expect } from 'vitest'
import { createWorld } from '../ecs/world.js'
import { createLoop, FIXED_DT, type System } from './loop.js'
import { createHeadlessContext } from '../context/createContext.js'
import { ManualClock } from '../../platform/ManualClock.js'

interface SessionResult {
  draws: number[]
  tickIndex: number
  impactsAtEnd: number
}

/* Joue `ticks` ticks logiques avec un système-enregistreur : par émetteur de pluie,
   il tire le PRNG et pousse un impact dans le tampon de frame. */
function runSession(seed: number, ticks: number): SessionResult {
  const clock = new ManualClock()
  const ctx = createHeadlessContext({ seed, clock })

  const world = createWorld()
  world.add({ rainEmitter: { density: 0.5, active: true } })
  world.add({ rainEmitter: { density: 0.3, active: true } })
  const emitters = world.with('rainEmitter')

  const draws: number[] = []
  const recorder: System = (c) => {
    for (const _e of emitters) {
      const v = c.prng.aléa()
      draws.push(v)
      c.frame.impacts.push({ surface: 'terre', pos: { x: v, y: 0, z: 0 }, detune: v, sample: 0 })
    }
  }

  const loop = createLoop(ctx, [recorder])
  clock.start()
  for (let i = 0; i < ticks; i++) clock.tick(FIXED_DT)

  return { draws, tickIndex: loop.tickIndex, impactsAtEnd: ctx.frame.impacts.length }
}

describe('boucle à pas fixe + déterminisme', () => {
  it("avance d'exactement N ticks logiques pour N pas d'horloge à FIXED_DT", () => {
    const r = runSession(1, 20)
    expect(r.tickIndex).toBe(20)
    expect(r.draws.length).toBe(20 * 2) // 2 émetteurs
  })

  it('ne tic pas tant que l’horloge n’a pas démarré (contexte audio suspendu)', () => {
    const clock = new ManualClock()
    const ctx = createHeadlessContext({ clock })
    const loop = createLoop(ctx, [() => { /* no-op */ }])
    clock.tick(FIXED_DT) // start() pas appelé → aucun tick
    expect(loop.tickIndex).toBe(0)
  })

  it('même seed → suite de tirages identique (reproductible)', () => {
    const a = runSession(42, 30)
    const b = runSession(42, 30)
    expect(b.draws).toEqual(a.draws)
  })

  it('seed différent → suite de tirages différente', () => {
    const a = runSession(1, 30)
    const b = runSession(2, 30)
    expect(b.draws).not.toEqual(a.draws)
  })

  it('vide le tampon de frame à chaque tick (zéro accumulation)', () => {
    // 2 émetteurs → chaque tick pousse 2 impacts ; vidé en début de tick suivant.
    const r = runSession(7, 15)
    expect(r.impactsAtEnd).toBe(2)
  })
})
