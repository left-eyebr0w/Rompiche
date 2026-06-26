/* ── Boucle d'édition du terrain (cadrage rework/07 §8) ───────────────────────
   Garde-fous de la boucle commande → applyEdit → flushRemesh → pool → son :
     1) applyEdit({paint}) change le matériau des cellules SOUS le disque, pas au-delà.
     2) après applyEdit + flushRemesh, impactPoints() porte le nouveau matériau dans la
        zone, et seulement là (rebake INCRÉMENTAL : le reste du pool est intact).
     3) bout-en-bout headless : un impact tiré dans la zone repeinte porte le neuf.
   Tous PURS (sans audio), via la boucle headless / le monde directement. */

import { describe, it, expect } from 'vitest'
import { makeDefaultTerrain } from './Terrain.js'
import { FlatWorld, isEditable } from './World.js'
import { makeCoords } from '../context/coords.js'
import { createWorld } from '../ecs/world.js'
import { createLoop, FIXED_DT } from '../loop/loop.js'
import { createHeadlessContext } from '../context/createContext.js'
import { ManualClock } from '../../platform/ManualClock.js'
import { createSimSystems, setupSimWorld } from '../systems/index.js'
import type { EditBrush } from '../../shared/edit.js'

const SIZE = 25

function makeFlatWorld(): FlatWorld {
  const coords = makeCoords(SIZE)
  const terrain = makeDefaultTerrain({ size: coords.size, cell: coords.CELL, block: coords.BLOCK })
  return new FlatWorld(terrain, coords)
}
const CELL = makeCoords(SIZE).CELL

const paintAt = (x: number, z: number, radius: number, mat: string): EditBrush => ({
  shape: { kind: 'disc', center: { x, y: 0, z }, radius },
  op: { t: 'paint', mat: mat as never },
})

describe('FlatWorld — couture EditableWorld', () => {
  it('est éditable (garde de type)', () => {
    expect(isEditable(makeFlatWorld())).toBe(true)
  })

  it('applyEdit({paint}) mute le matériau sous le disque et pas au-delà', () => {
    const w = makeFlatWorld()
    const region = w.applyEdit(paintAt(0, 0, 2, 'metal'))
    expect(region).not.toBeNull()
    // Centre repeint…
    expect(w.terrain.cellAt(0, 0)!.material.id).toBe('metal')
    // …bord du disque repeint…
    expect(w.terrain.cellAt(1.5, 0)!.material.id).toBe('metal')
    // …mais une cellule loin hors du disque reste 'terre'.
    expect(w.terrain.cellAt(8, 8)!.material.id).toBe('terre')
  })

  it('applyEdit hors-terrain ou rayon nul ne mute rien (retourne null)', () => {
    const w = makeFlatWorld()
    expect(w.applyEdit(paintAt(0, 0, 0, 'metal'))).toBeNull()
    expect(w.applyEdit(paintAt(999, 999, 2, 'metal'))).toBeNull()
  })

  it('flushRemesh patche le pool : la zone porte le neuf, le reste est intact', () => {
    const w = makeFlatWorld()
    const before = w.impactPoints().filter(v => v.matériau === 'metal').length
    expect(before).toBe(0)

    w.applyEdit(paintAt(0, 0, 2, 'metal'))
    // Avant flush, le pool n'a PAS encore changé (deux temps).
    expect(w.impactPoints().filter(v => v.matériau === 'metal').length).toBe(0)
    const v0 = w.meshVersion

    const done = w.flushRemesh(8)
    expect(done).toBe(1)
    expect(w.meshVersion).toBe(v0 + 1)

    const metal = w.impactPoints().filter(v => v.matériau === 'metal')
    expect(metal.length).toBeGreaterThan(0)
    // Tous les vertices 'metal' sont dans la zone du disque (rebake incrémental ciblé).
    for (const v of metal) {
      expect(Math.hypot(v.position.x, v.position.z)).toBeLessThanOrEqual(2 + CELL)
    }
    // Le pool garde sa taille (patch en place, pas d'ajout/suppression).
    expect(w.impactPoints().length).toBe(makeFlatWorld().impactPoints().length)
  })

  it('flushRemesh respecte le budget et draine en plusieurs passes', () => {
    const w = makeFlatWorld()
    w.applyEdit(paintAt(-5, -5, 1, 'metal'))
    w.applyEdit(paintAt(5, 5, 1, 'bache'))
    expect(w.flushRemesh(1)).toBe(1)   // une zone seulement
    expect(w.flushRemesh(1)).toBe(1)   // la seconde
    expect(w.flushRemesh(1)).toBe(0)   // plus rien
  })
})

describe('Boucle d’édition headless — le son suit l’édition', () => {
  it('un impact tiré dans la zone repeinte porte le nouveau matériau', () => {
    const clock = new ManualClock()
    const ctx = createHeadlessContext({ seed: 5, clock })
    if (!isEditable(ctx.world)) throw new Error('monde de test non éditable')
    const world = createWorld()
    setupSimWorld(world, ctx, 1)
    const loop = createLoop(ctx, createSimSystems(world, ctx))
    clock.start()

    // Repeindre un large disque autour de la tête en 'metal' via le canal de commandes.
    ctx.input.commands.push(paintAt(ctx.headWorldPos.x, ctx.headWorldPos.z, 6, 'metal') as never)

    let sawMetalImpact = false
    let sawAnyImpact = false
    for (let i = 0; i < 300; i++) {
      clock.tick(FIXED_DT)
      for (const imp of ctx.frame.impacts) {
        sawAnyImpact = true
        if (imp.surface === 'metal') sawMetalImpact = true
      }
    }
    void loop
    expect(sawAnyImpact).toBe(true)
    expect(sawMetalImpact).toBe(true)
  })
})
