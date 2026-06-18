/* ── Tirage des gouttes : UNIFORME + buckets par zone (notes/random/pluie.txt) ─
   pickImpact tire uniformément dans un pool déjà filtré (les surfaces sont réparties
   uniformément en 2D → tirer un point ≈ tirer une position). RainBuckets partitionne
   les vertex exposés au ciel en deux zones géométriques DISJOINTES : disque L1 [0,rL1]
   et anneau L2 [rL1, rMaxL2], re-triées seulement quand la tête bouge. */

import { describe, it, expect } from 'vitest'
import { pickImpact, RainBuckets, type TerrainVertex } from './terrainMesh.js'
import { makePrng } from '../context/prng.js'
import type { Vector3 } from '../context/coords.js'

const HEAD: Vector3 = { x: 0, y: 0, z: 0 }

/* Points alignés sur +x, du plus proche (d=0) au plus lointain (d=20). */
const POINTS: TerrainVertex[] = Array.from({ length: 21 }, (_, i) => ({
  position: { x: i, y: 0, z: 0 },
  normale: { x: 0, y: 1, z: 0 },
  matériau: 'terre',
  expoCiel: 1,
}))

/* Distance moyenne du point tiré sur N essais (prng seedé → déterministe). */
function meanPickDistance(n = 6000, seed = 123): number {
  const prng = makePrng(seed)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const p = pickImpact(POINTS, prng)!
    sum += p.position.x
  }
  return sum / n
}

describe('pickImpact — tirage uniforme', () => {
  it('la distance moyenne tirée ≈ moyenne géométrique des points (10 m), sans biais de proximité', () => {
    const mean = meanPickDistance()
    expect(Math.abs(mean - 10)).toBeLessThan(0.6)
  })

  it('retourne null sur un pool vide', () => {
    expect(pickImpact([], makePrng(1))).toBeNull()
  })
})

describe('RainBuckets — partition par zone géométrique', () => {
  it('disque L1 [0,rL1] et anneau L2 [rL1,rMaxL2] disjoints, abrités exclus', () => {
    const b = new RainBuckets(POINTS)
    b.update(HEAD, 5, 12)
    // L1 = d ∈ [0,5] → x 0..5 (6 points) ; L2 = d ∈ ]5,12] → x 6..12 (7 points)
    expect(b.L1.every(v => v.position.x <= 5)).toBe(true)
    expect(b.L2.every(v => v.position.x > 5 && v.position.x <= 12)).toBe(true)
    expect(b.L1.length).toBe(6)
    expect(b.L2.length).toBe(7)
    // Au-delà de rMaxL2 : ni L1 ni L2 (fondu dans L3, hors événements).
    expect(b.L1.length + b.L2.length).toBeLessThan(POINTS.length)
  })

  it('exclut les vertex abrités (expoCiel ≤ 0)', () => {
    const pts: TerrainVertex[] = POINTS.map((v, i) => ({ ...v, expoCiel: i % 2 === 0 ? 1 : 0 }))
    const b = new RainBuckets(pts)
    b.update(HEAD, 20, 20)
    expect([...b.L1, ...b.L2].every(v => v.expoCiel > 0)).toBe(true)
  })

  it('ne re-trie pas sous le seuil de déplacement, re-trie au-delà', () => {
    const b = new RainBuckets(POINTS, 0.5)
    b.update(HEAD, 5, 12)
    const n1 = b.L1.length
    // Petit déplacement (< epsMove) : buckets inchangés malgré rayons identiques.
    b.update({ x: 0.2, y: 0, z: 0 }, 5, 12)
    expect(b.L1.length).toBe(n1)
    // Gros déplacement : re-tri (la zone proche se recentre → contenu change).
    b.update({ x: 10, y: 0, z: 0 }, 5, 12)
    expect(b.L1.every(v => Math.abs(v.position.x - 10) <= 5)).toBe(true)
  })

  it('re-trie si les rayons changent même sans déplacement', () => {
    const b = new RainBuckets(POINTS)
    b.update(HEAD, 5, 12)
    expect(b.L1.length).toBe(6)
    b.update(HEAD, 3, 12)   // rL1 réduit → disque plus petit
    expect(b.L1.length).toBe(4) // x 0..3
  })
})
