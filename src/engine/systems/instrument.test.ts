/* ── Garde-fous neufs (2 flux de Poisson L1/L2, notes/random/pluie.txt) ────────
   1) Zones DISJOINTES : les impacts L1 tombent dans le disque [0,rL1], les L2 dans
      l'anneau ]rL1,rMaxL2]. La couche est fixée par le flux émetteur.
   2) Les λ règlent la part L1/L2 (levier d'équité, ex-pProche/pLoin) ; régime ×λ.
   Tous PURS (sans audio) : testés via la boucle headless. */

import { describe, it, expect } from 'vitest'
import { createWorld } from '../ecs/world.js'
import { createLoop, FIXED_DT } from '../loop/loop.js'
import { createHeadlessContext } from '../context/createContext.js'
import { ManualClock } from '../../platform/ManualClock.js'
import { createSimSystems, setupSimWorld, resizeVoicePool } from './index.js'
import type { Impact } from '../loop/frame.js'

/* Compte les couches + collecte les impacts sur un run headless (densité max). */
function runLayers(seed: number, ticks: number, tweak?: (ctx: any) => void) {
  const clock = new ManualClock()
  const ctx = createHeadlessContext({ seed, clock })
  if (tweak) tweak(ctx)
  const world = createWorld()
  setupSimWorld(world, ctx, 1)
  const loop = createLoop(ctx, createSimSystems(world, ctx))
  clock.start()
  const impacts: Impact[] = []
  let l1 = 0, l2 = 0
  for (let i = 0; i < ticks; i++) {
    clock.tick(FIXED_DT)
    for (const imp of ctx.frame.impacts) {
      if (imp.layer === 'L1') l1++
      else if (imp.layer === 'L2') l2++
      impacts.push({ ...imp })
    }
  }
  void loop
  return { l1, l2, total: l1 + l2, impacts, rain: ctx.worldConfig.rain }
}

describe('2 flux Poisson L1/L2 — zones géométriques disjointes', () => {
  it('les impacts L1 tombent dans le disque [0,rL1], les L2 dans l’anneau ]rL1,rMaxL2]', () => {
    const r = runLayers(7, 400)
    const { rL1, rMaxL2 } = r.rain
    expect(r.l1).toBeGreaterThan(0)
    expect(r.l2).toBeGreaterThan(0)
    for (const imp of r.impacts) {
      const d = imp.dist ?? Infinity
      if (imp.layer === 'L1') expect(d).toBeLessThanOrEqual(rL1 + 1e-6)
      else if (imp.layer === 'L2') {
        expect(d).toBeGreaterThan(rL1 - 1e-6)
        expect(d).toBeLessThanOrEqual(rMaxL2 + 1e-6)
      }
    }
  })

  it('le mix vaut 0 pour L1 et croît avec la distance en L2', () => {
    const r = runLayers(7, 400)
    for (const imp of r.impacts) {
      if (imp.layer === 'L1') expect(imp.mix).toBe(0)
      else if (imp.layer === 'L2') {
        expect(imp.mix).toBeGreaterThanOrEqual(0)
        expect(imp.mix).toBeLessThanOrEqual(1)
      }
    }
  })

  it('déterministe : même seed → même répartition', () => {
    const a = runLayers(7, 200)
    const b = runLayers(7, 200)
    expect({ l1: b.l1, l2: b.l2 }).toEqual({ l1: a.l1, l2: a.l2 })
  })
})

describe('λ L1/L2 — leviers d’équité (ex-pProche/pLoin)', () => {
  it('augmenter λL1 face à λL2 augmente la part L1', () => {
    const peu = runLayers(7, 400, (ctx) => { ctx.worldConfig.rain.lambdaL1 = 10; ctx.worldConfig.rain.lambdaL2 = 60 })
    const bcp = runLayers(7, 400, (ctx) => { ctx.worldConfig.rain.lambdaL1 = 60; ctx.worldConfig.rain.lambdaL2 = 10 })
    const ratioL1 = (r: { l1: number; total: number }) => (r.total > 0 ? r.l1 / r.total : 0)
    expect(bcp.total).toBeGreaterThan(0)
    expect(ratioL1(bcp)).toBeGreaterThan(ratioL1(peu))
  })

  it('λL2=0 ⇒ aucun impact L2', () => {
    const r = runLayers(7, 400, (ctx) => { ctx.worldConfig.rain.lambdaL2 = 0 })
    expect(r.l1).toBeGreaterThan(0)
    expect(r.l2).toBe(0)
  })

  it('régime ×λ : multiplier le régime augmente le débit total', () => {
    const base = runLayers(7, 300, (ctx) => { ctx.worldConfig.rain.regimeMult = 1 })
    const fort = runLayers(7, 300, (ctx) => { ctx.worldConfig.rain.regimeMult = 3 })
    expect(fort.total).toBeGreaterThan(base.total)
  })
})

/* Déterminisme du levier solo/mute : le gain de couche est lu, pas stocké dans un état
   moteur. Une simu courte tourne identiquement avec layerGain par défaut. */
describe('layerGain — neutre quand =1 (régression)', () => {
  it('une simu courte tourne identiquement avec layerGain par défaut', () => {
    const run = () => {
      const clock = new ManualClock()
      const ctx = createHeadlessContext({ seed: 3, clock })
      const world = createWorld()
      setupSimWorld(world, ctx, 0.6)
      const loop = createLoop(ctx, createSimSystems(world, ctx))
      clock.start()
      let onsets = 0
      for (let i = 0; i < 120; i++) { clock.tick(FIXED_DT); onsets += ctx.frame.grainOnsets.length }
      void loop
      return onsets
    }
    expect(run()).toBe(run())
  })
})

/* Budget de voix réglable live (sliders HUD « voix L1/L2 ») : resizeVoicePool ajuste le
   nombre d'entités voix d'UNE couche sans toucher l'autre, et les ids restent uniques sur
   tout le pool (identité des onsets/démotions côté audio). */
describe('resizeVoicePool — budgets de voix par couche en live', () => {
  const countLayer = (world: any, layer: 'L1' | 'L2') =>
    [...world.with('voice')].filter((e: any) => e.voice.layer === layer).length

  it('grandit et rétrécit le pool d’une couche sans toucher l’autre', () => {
    const clock = new ManualClock()
    const ctx = createHeadlessContext({ seed: 1, clock })
    const world = createWorld()
    setupSimWorld(world, ctx, 0.5)
    const l1Before = countLayer(world, 'L1')

    resizeVoicePool(world, 'L2', 30)
    expect(countLayer(world, 'L2')).toBe(30)
    expect(countLayer(world, 'L1')).toBe(l1Before)

    resizeVoicePool(world, 'L2', 5)
    expect(countLayer(world, 'L2')).toBe(5)
    expect(countLayer(world, 'L1')).toBe(l1Before)
  })

  it('garde des ids de voix uniques après redimensionnement', () => {
    const clock = new ManualClock()
    const ctx = createHeadlessContext({ seed: 1, clock })
    const world = createWorld()
    setupSimWorld(world, ctx, 0.5)
    resizeVoicePool(world, 'L1', 50)
    resizeVoicePool(world, 'L2', 25)
    const ids = [...world.with('voice')].map((e: any) => e.voice.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
