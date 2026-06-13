/* ── Moteur de replay déterministe (§14) ──────────────────────────────────────
   Mode A — Re-trigger : rejoue les ordres horodatés depuis la trace (trigger/
   sector/bed). Fidèle sans la graine. Utile pour rejouer une session passée.

   Mode B — Re-simulation : recrée le PRNG depuis header.seed, injecte la
   timeline d'état (state/scale/weather), et laisse le moteur re-tirer Poisson/
   sélection/LOD à l'identique. Tout écart vs. live = régression à investiguer.

   Utilisation :
     const engine = new ReplayEngine()
     engine.loadNDJSON(text)
     engine.replayA(sampler)   // ou .replayB(sampler) */

import { makePrng } from './prng.js'
import { makeWorldConfig } from './worldConfig.js'

export class ReplayEngine {
  constructor() {
    this._header = null
    this._events = []
  }

  /** Charge une trace NDJSON (string). */
  loadNDJSON(text) {
    const lines = text.trim().split('\n').filter(Boolean)
    this._events = []
    this._header = null
    for (const line of lines) {
      try {
        const e = JSON.parse(line)
        if (e.type === 'header') { this._header = e; continue }
        this._events.push(e)
      } catch { /* ligne malformée, ignorée */ }
    }
    return this
  }

  get header() { return this._header }
  get eventCount() { return this._events.length }

  /* ── Mode A : re-trigger ── */

  /**
   * Rejoue la trace via le moteur audio. Planifie les triggers à leur timestamp `at`.
   * @param {object} sampler — instance RainSampler prête (init() fait, banques chargées)
   */
  replayA(sampler) {
    if (!sampler?.ready) throw new Error('[ReplayEngine] sampler non prêt')
    const ctx = sampler.ctx
    const t0  = ctx.currentTime

    for (const e of this._events) {
      if (e.type === 'trigger') {
        const delay = e.at ?? 0
        /* Planifie le trigger via setTimeout sur le game thread */
        setTimeout(() => {
          sampler.trigger(e.surface, {
            x:        e.x,
            y:        e.y,
            z:        e.z,
            gainDb:   e.gainDb,
            detune:   e.detune,
            impactId: 0, // re-trigger : pas de causalité reconstruite
          })
        }, delay * 1000)
      } else if (e.type === 'bed') {
        const delay = e.at ?? 0
        setTimeout(() => {
          sampler.setWeather({ intensité: Math.pow(10, (e.niveau + 80) / 80), vent: 0, dir: 0 })
        }, delay * 1000)
      } else if (e.type === 'state') {
        const delay = e.at ?? 0
        setTimeout(() => {
          if (e.patch?.density !== undefined) {
            sampler.setWeather({ intensité: e.patch.density, vent: 0, dir: 0 })
          }
        }, delay * 1000)
      }
    }
  }

  /* ── Mode B : re-simulation ── */

  /**
   * Re-simule depuis header.seed + timeline state/scale/weather.
   * Injecte les entrées dans le moteur, qui re-tire Poisson/sélection/LOD.
   * @param {object} sampler — instance RainSampler configurée (même banques)
   * @returns {Promise<void>}
   */
  async replayB(sampler) {
    if (!this._header?.seed) throw new Error('[ReplayEngine] seed manquant dans le header')
    if (!sampler?.ready)     throw new Error('[ReplayEngine] sampler non prêt')

    /* Reconstruit le WorldConfig depuis le header */
    const cfg = makeWorldConfig({
      preset: this._header.meta?.preset ?? 'diorama',
      seed:   this._header.seed,
    })
    sampler.setScale(cfg)

    /* Rejoue la timeline d'état : les événements `state` pilotent la météo */
    const stateEvents = this._events.filter(e => e.type === 'state' || e.type === 'weather')
    for (const e of stateEvents) {
      const delay = e.at ?? 0
      setTimeout(() => {
        if (e.patch) {
          const { density, rain } = e.patch
          if (density !== undefined || rain !== undefined) {
            const intensité = (rain ?? true) ? (density ?? 0.5) : 0
            sampler.setWeather({ intensité, vent: 0, dir: 0 })
          }
          if (e.patch.x !== undefined || e.patch.z !== undefined) {
            sampler.setListenerPosition(
              e.patch.x ?? 0, e.patch.y ?? 0, e.patch.z ?? 0
            )
          }
        }
      }, delay * 1000)
    }

    /* Le moteur re-tire Poisson/sélection/LOD depuis le même seed — le reste est géré
       par les boucles RAF existantes (tickPoisson, évaluerLod, etc.). */
    console.log(`[ReplayEngine] mode B démarré — seed=${this._header.seed}, ${stateEvents.length} états à rejouer`)
  }
}
