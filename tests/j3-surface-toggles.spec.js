import { test, expect } from '@playwright/test'
import { gotoJ3, waitForRms, peakRms, setSurface } from './helpers-j3.js'

test('J3 — couper les surfaces metal+bache réduit l\'activité L1', async ({ page }) => {
  await gotoJ3(page)
  await waitForRms(page, 'master', 1e-4, { hits: 3 })

  await setSurface(page, 'metal', true)
  await setSurface(page, 'bache', true)
  await page.waitForTimeout(2000)
  const peakOn = await peakRms(page, 'master', { duration: 3000 })

  await setSurface(page, 'metal', false)
  await setSurface(page, 'bache', false)
  await page.waitForTimeout(2000)
  const peakOff = await peakRms(page, 'master', { duration: 3000 })

  expect(peakOn).toBeGreaterThan(1e-4)
  expect(peakOff).toBeLessThan(peakOn * 0.7)
})
