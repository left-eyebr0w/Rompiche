import { test, expect } from '@playwright/test'
import { gotoDiorama, waitForRms, readSampler } from './helpers.js'

/* DoD §4 — « les 3 couches produisent du signal ».
   En v0 il n'existe qu'une scène : le diorama (une « tranche » d'un monde plat
   de terre). Les trois couches doivent toutes produire du signal :
   - L1 : impacts héros (voix HRTF),
   - L2 : texture moyenne (secteurs granulaires),
   - L3 : nappe diffuse.
   Seuils tolérants + polling. La nappe L3 est faible par nature → seuil plus bas. */
test('les 3 couches produisent du signal (L1, L2, L3)', async ({ page }) => {
  await gotoDiorama(page)

  const l1 = await waitForRms(page, 'l1', 1e-4, { hits: 3 })
  const l2 = await waitForRms(page, 'l2', 1e-5, { hits: 3 })
  const l3 = await waitForRms(page, 'l3', 1e-5, { hits: 3 })

  expect(l1, 'L1 (impacts héros) doit produire du signal').toBe(true)
  expect(l2, 'L2 (secteurs) doit produire du signal').toBe(true)
  expect(l3, 'L3 (nappe diffuse) doit produire du signal').toBe(true)

  // Les trois couches sont instanciées dans le moteur.
  const s = await readSampler(page)
  expect(s.pool.voices, 'pool de voix L1 instancié').toBeGreaterThan(0)
  expect(s.sectors.count, 'secteurs L2 instanciés').toBeGreaterThan(0)
  expect(s.bed.exists, 'nappe L3 instanciée').toBe(true)
})
