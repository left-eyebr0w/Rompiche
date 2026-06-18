/* ── Garde-fou neuf (Phase L3) : la nappe diffuse suit l'intensité ────────────
   Le DiffuseBedSystem est un PONT pur : il lit la densité de l'émetteur de pluie
   actif et la pousse à la nappe via setIntensity, puis recopie le niveau mesuré
   dans ctx.l3Level. On le teste avec une nappe factice (stub) — pas d'AudioContext.

   Invariants :
     1) intensité poussée = densité de l'émetteur actif ;
     2) émetteur inactif → intensité 0 (silence) ;
     3) ctx.l3Level reflète le niveau renvoyé par la nappe. */

import { describe, it, expect } from 'vitest'
import { createWorld } from '../ecs/world.js'
import { createHeadlessContext } from '../context/createContext.js'
import { createDiffuseBedSystem } from './diffuseBed.js'
import type { DiffuseBed } from '../../audio/DiffuseBed.js'

/* Nappe factice : enregistre la dernière intensité, renvoie un niveau dérivé
   (croissant avec l'intensité) pour vérifier la recopie dans ctx.l3Level. */
function fakeBed() {
  const calls: number[] = []
  let last = 0
  const bed = {
    setIntensity(i: number) { calls.push(i); last = i },
    levelDb() { return last === 0 ? -Infinity : -40 + last * 28 },
  }
  return { bed: bed as unknown as DiffuseBed, calls, get last() { return last } }
}

describe('DiffuseBedSystem — pont intensité → nappe L3', () => {
  it('pousse la densité de l\'émetteur actif comme intensité', () => {
    const ctx = createHeadlessContext({ seed: 1 })
    const world = createWorld()
    world.add({ rainEmitter: { density: 0.7, active: true } })

    const { bed, calls } = fakeBed()
    const sys = createDiffuseBedSystem(world, bed)
    sys(ctx, 1 / 60)

    expect(calls[calls.length - 1]).toBeCloseTo(0.7)
    expect(ctx.l3Level).toBeCloseTo(-40 + 0.7 * 28)
    expect(ctx.l3Level).toBeGreaterThan(-Infinity)
  })

  it('émetteur inactif → intensité 0, nappe silencieuse', () => {
    const ctx = createHeadlessContext({ seed: 1 })
    const world = createWorld()
    world.add({ rainEmitter: { density: 0.9, active: false } })

    const { bed } = fakeBed()
    const sys = createDiffuseBedSystem(world, bed)
    sys(ctx, 1 / 60)

    expect(ctx.l3Level).toBe(-Infinity)
  })

  it('le niveau croît avec l\'intensité (monotone)', () => {
    const ctx = createHeadlessContext({ seed: 1 })
    const world = createWorld()
    const e = world.add({ rainEmitter: { density: 0.2, active: true } })

    const { bed } = fakeBed()
    const sys = createDiffuseBedSystem(world, bed)
    sys(ctx, 1 / 60)
    const low = ctx.l3Level

    e.rainEmitter!.density = 0.8
    sys(ctx, 1 / 60)
    const high = ctx.l3Level

    expect(high).toBeGreaterThan(low)
  })
})
