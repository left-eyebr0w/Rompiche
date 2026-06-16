/* ── Invariant du playhead audio (sujet 3 — deux horloges) ────────────────────
   resolvePlayhead doit borner la dérive du playhead devant l'horloge audio dans
   TOUS les cas, y compris la rafale de ticks d'un retour de background (la boucle
   logique avance vite, l'horloge audio peu). Invariant : t − now ∈ [0.005, MAX_DRIFT]. */

import { describe, it, expect } from 'vitest'
import { resolvePlayhead } from './audioSync.js'
import { FIXED_DT } from '../loop/loop.js'

const LOOKAHEAD = 0.06
const MAX_DRIFT = LOOKAHEAD + FIXED_DT

describe('resolvePlayhead', () => {
  it('amorce le playhead au 1ᵉʳ tick (playhead = -1, under-run)', () => {
    const now = 5
    const { t, next } = resolvePlayhead(-1, now)
    expect(t).toBeCloseTo(now + LOOKAHEAD, 9)
    expect(next).toBeCloseTo(t + FIXED_DT, 9)
  })

  it('avance d’un FIXED_DT en régime normal (pas de resync)', () => {
    const now = 5
    const playhead = now + LOOKAHEAD
    const { t, next } = resolvePlayhead(playhead, now)
    expect(t).toBe(playhead)          // inchangé
    expect(next).toBeCloseTo(playhead + FIXED_DT, 9)
  })

  it('resynchronise quand le playhead a pris du retard (under-run)', () => {
    const now = 10
    const { t } = resolvePlayhead(now - 1, now)  // playhead derrière l’horloge
    expect(t).toBeCloseTo(now + LOOKAHEAD, 9)
  })

  it('borne la dérive sur une rafale de ticks (retour de background)', () => {
    /* Horloge audio FIGÉE à now, la boucle logique exécute 100 ticks d’affilée
       (catch-up). Sans garde-fou haut, t − now croîtrait sans fin. */
    const now = 20
    let playhead = now + LOOKAHEAD
    let maxDrift = 0
    for (let i = 0; i < 100; i++) {
      const { t, next } = resolvePlayhead(playhead, now)
      maxDrift = Math.max(maxDrift, t - now)
      playhead = next
    }
    expect(maxDrift).toBeLessThanOrEqual(MAX_DRIFT + 1e-9)
  })

  it('maintient l’invariant t − now ∈ [0.005, MAX_DRIFT] sur un scénario mixte', () => {
    let playhead = -1
    let now = 0
    for (let i = 0; i < 500; i++) {
      // L’horloge audio avance de façon irrégulière (parfois 0 = stall, parfois plus).
      now += (i % 7 === 0) ? 0 : FIXED_DT * (0.5 + (i % 3))
      const { t, next } = resolvePlayhead(playhead, now)
      const drift = t - now
      expect(drift).toBeGreaterThanOrEqual(0.005 - 1e-9)
      expect(drift).toBeLessThanOrEqual(MAX_DRIFT + 1e-9)
      playhead = next
    }
  })
})
