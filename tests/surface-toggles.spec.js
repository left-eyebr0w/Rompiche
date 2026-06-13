import { test, expect } from '@playwright/test'
import { gotoDiorama, waitForRms, peakRms, setSurface } from './helpers.js'

/* DoD §4 — « les toggles de surface agissent ».
   Couper metal ET bache doit réduire l'activité L1 issue de ces surfaces.
   On mesure le pic RMS L1 avec les deux surfaces actives, puis avec les deux
   coupées : le pic doit nettement baisser. (Le sol terre, lui, reste actif —
   garanti par la correction du bug sol-herbe — donc on n'exige pas un zéro
   absolu, seulement une baisse marquée.) */
test('couper les surfaces metal+bache réduit l\'activité L1', async ({ page }) => {
  await gotoDiorama(page)
  await waitForRms(page, 'master', 1e-4, { hits: 3 })

  await setSurface(page, 'Surface métal', true)
  await setSurface(page, 'Surface bâche', true)
  const peakOn = await peakRms(page, 'l1', { duration: 2500 })

  await setSurface(page, 'Surface métal', false)
  await setSurface(page, 'Surface bâche', false)
  const peakOff = await peakRms(page, 'l1', { duration: 2500 })

  expect(peakOn).toBeGreaterThan(1e-4)
  expect(peakOff).toBeLessThan(peakOn * 0.6)
})
