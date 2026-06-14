/* ── Garde-fou : le paramètre `core` de la PDF L1 (rayon de cœur, plateau dense) ──
   La PDF spatiale pondère le tirage des gouttes héros L1 par proximité à la tête :
     w(d) = floor + (1 − floor) · exp( −0.5 · (max(0, d−core)/σ)^p )
   `core` ouvre un PLATEAU de poids maximal dans le rayon `core` autour de la tête.
   Propriétés vérifiées :
     1) core=0 (défaut) = comportement historique : forte préférence pour le plus proche ;
     2) augmenter `core` repousse vers l'extérieur la distance moyenne tirée (le cœur
        dense s'élargit → les points proches-mais-pas-les-plus-proches gagnent du poids) ;
     3) un `core` ≥ portée des points aplatit la PDF → tirage ~uniforme. */

import { describe, it, expect } from 'vitest'
import { pickImpact, type TerrainVertex, type SpatialField } from './terrainMesh.js'
import { makePrng } from '../context/prng.js'
import type { Vector3 } from '../context/coords.js'

const HEAD: Vector3 = { x: 0, y: 0, z: 0 }

/* Points alignés sur +x, du plus proche (d=0) au plus lointain (d=20), expoCiel
   uniforme → la pondération ne dépend QUE de la PDF spatiale. */
const POINTS: TerrainVertex[] = Array.from({ length: 21 }, (_, i) => ({
  position: { x: i, y: 0, z: 0 },
  normale: { x: 0, y: 1, z: 0 },
  matériau: 'terre',
  expoCiel: 1,
}))

/* Distance moyenne du point tiré sur N essais (prng seedé → déterministe). */
function meanPickDistance(field: SpatialField, n = 6000, seed = 123): number {
  const prng = makePrng(seed)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const p = pickImpact(POINTS, prng, HEAD, field)!
    sum += p.position.x
  }
  return sum / n
}

const base: Omit<SpatialField, 'core'> = { sigma: 10, p: 2, floor: 0, ky: 0 }

describe('PDF L1 — paramètre core (plateau de cœur)', () => {
  it('core=0 (défaut) favorise nettement les points proches de la tête', () => {
    const mean = meanPickDistance({ ...base, core: 0 })
    // σ=10 sur une portée de 20 m : moyenne tirée bien en deçà de la moyenne
    // géométrique des points (10 m).
    expect(mean).toBeLessThan(8)
  })

  it('augmenter core repousse vers l’extérieur la distance moyenne tirée', () => {
    const m0 = meanPickDistance({ ...base, core: 0 })
    const m8 = meanPickDistance({ ...base, core: 8 })
    expect(m8).toBeGreaterThan(m0)
  })

  it('un core ≥ portée des points aplatit la PDF (tirage ~uniforme, moyenne ~10 m)', () => {
    // core=25 ≥ 20 m : tous les points sont DANS le cœur → dOut=0 → poids égal.
    const mean = meanPickDistance({ ...base, core: 25 })
    expect(Math.abs(mean - 10)).toBeLessThan(0.6)
  })
})
