/* ── Garde-fous neufs (J2) : la simulation pure, headless ─────────────────────
   1) impacts produits DÉTERMINISTES (même seed → même flux ; seed ≠ → flux ≠) ;
   2) portage headless du garde-fou SURFACES : couper metal+bache réduit l'activité
      L1 issue de ces surfaces (le sol terre prend le relais → pas un zéro absolu,
      d'où le seuil < 0,6 comme en E2E v0) ;
   3) routage sur les 3 couches ; 4) le pool vole des voix sous charge (démotions). */

import { describe, it, expect } from 'vitest'
import { createWorld } from '../ecs/world.js'
import { createLoop, FIXED_DT } from '../loop/loop.js'
import { createHeadlessContext } from '../context/createContext.js'
import { ManualClock } from '../../platform/ManualClock.js'
import { createSimSystems, setupSimWorld } from './index.js'
import type { MaterialId } from '../components/materials.js'
import type { Impact, Layer } from '../loop/frame.js'

interface SimResult {
  impacts: Impact[] // copies de tous les impacts produits, tous ticks confondus
  demotions: number
  onsets: number // total des onsets de grain poussés (acquisitions de voix L1)
}

function runSim(
  seed: number,
  surfaces: Partial<Record<MaterialId, number>>,
  ticks: number,
  density = 0.5,
  dropletRate?: number,
): SimResult {
  const clock = new ManualClock()
  const ctx = createHeadlessContext({ seed, clock })
  /* Via InputSystem : les surfaces sont pilotées par ctx.input.controls. */
  if (surfaces.metal !== undefined) ctx.input.controls.metal = surfaces.metal > 0
  if (surfaces.bache !== undefined) ctx.input.controls.bache = surfaces.bache > 0
  if (dropletRate !== undefined) ctx.worldConfig.dropletRate = dropletRate

  const world = createWorld()
  setupSimWorld(world, ctx, density)
  const loop = createLoop(ctx, createSimSystems(world, ctx))
  clock.start()

  const impacts: Impact[] = []
  let demotions = 0
  let onsets = 0
  for (let i = 0; i < ticks; i++) {
    clock.tick(FIXED_DT)
    for (const imp of ctx.frame.impacts) impacts.push({ ...imp, pos: { ...imp.pos } })
    demotions += ctx.frame.demotions.length
    onsets += ctx.frame.grainOnsets.length
  }
  void loop
  return { impacts, demotions, onsets }
}

const countLayer = (r: SimResult, l: Layer) => r.impacts.filter(i => i.layer === l).length
const l1BySurface = (r: SimResult, surfs: MaterialId[]) =>
  r.impacts.filter(i => i.layer === 'L1' && surfs.includes(i.surface)).length

describe('simulation pure (RainPoisson → LodRouting → VoicePool)', () => {
  it('produit des impacts', () => {
    const r = runSim(1, {}, 120)
    expect(r.impacts.length).toBeGreaterThan(0)
  })

  it('même seed → flux d’impacts identique (déterministe)', () => {
    const a = runSim(42, {}, 120)
    const b = runSim(42, {}, 120)
    expect(b.impacts).toEqual(a.impacts)
  })

  it('seed différent → flux d’impacts différent', () => {
    const a = runSim(1, {}, 120)
    const b = runSim(2, {}, 120)
    expect(b.impacts).not.toEqual(a.impacts)
  })

  it('route les impacts sur les 3 couches (L1 héros, L2/L3 lointains)', () => {
    const r = runSim(3, {}, 400)
    expect(countLayer(r, 'L1')).toBeGreaterThan(0)
    expect(countLayer(r, 'L2') + countLayer(r, 'L3')).toBeGreaterThan(0)
  })

  it('GARDE-FOU surfaces : couper metal+bache réduit l’activité L1 de ces surfaces', () => {
    const on = runSim(7, { metal: 1, bache: 1 }, 200)
    const off = runSim(7, { metal: 0, bache: 0 }, 200)
    const peakOn = l1BySurface(on, ['metal', 'bache'])
    const peakOff = l1BySurface(off, ['metal', 'bache'])
    expect(peakOn).toBeGreaterThan(0)
    expect(peakOff).toBeLessThan(peakOn * 0.6)
  })

  it('pousse un onset de grain par acquisition de voix L1 (canal AudioSync)', () => {
    const r = runSim(3, {}, 400)
    // Au moins autant d'onsets que de voix L1 routées (chaque L1 acquise = 1 onset),
    // et jamais plus que le total des impacts. Déterministe (même seed → même nombre).
    expect(r.onsets).toBeGreaterThan(0)
    expect(r.onsets).toBeLessThanOrEqual(r.impacts.length)
    expect(runSim(3, {}, 400).onsets).toBe(r.onsets)
  })

  it('vole des voix sous charge (démotions poussées dans le tampon de frame)', () => {
    // Débit-cible volontairement énorme → pool saturé → vol de voix garanti.
    const r = runSim(5, {}, 300, 1, 8000)
    expect(r.demotions).toBeGreaterThan(0)
  })

  it('au débit par défaut, le pool n’est PAS saturé (anti-mitraillette/anti-freeze)', () => {
    // Régression du bug de sur-saturation : à density=1 (défaut dropletRate=120),
    // le nombre de voix simultanément busy reste bien sous la capacité du pool.
    const clock = new ManualClock()
    const ctx = createHeadlessContext({ seed: 9, clock })
    const world = createWorld()
    setupSimWorld(world, ctx, 1)
    const loop = createLoop(ctx, createSimSystems(world, ctx))
    clock.start()
    const capacity = ctx.worldConfig.layers.L1.voices
    let peakBusy = 0
    for (let i = 0; i < 400; i++) {
      clock.tick(FIXED_DT)
      let busy = 0
      for (const e of world.with('voice')) if (e.voice!.busy) busy++
      peakBusy = Math.max(peakBusy, busy)
    }
    void loop
    expect(peakBusy).toBeLessThan(capacity) // jamais 40/40
  })
})
