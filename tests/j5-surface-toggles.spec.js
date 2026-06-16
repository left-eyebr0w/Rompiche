import { test, expect } from '@playwright/test'
import { gotoJ5, setSwitch } from './helpers-j5.js'
import { waitForRms, peakRms } from './helpers-j3.js'

test('J5 — couper les surfaces metal+bache via l\'UI réduit l\'activité L1', async ({ page }) => {
  await gotoJ5(page)
  await waitForRms(page, 'master', 1e-4, { hits: 3 })

  await setSwitch(page, 'Surface métal', true)
  await setSwitch(page, 'Surface bâche', true)
  await page.waitForTimeout(2000)
  const peakOn = await peakRms(page, 'master', { duration: 3000 })

  await setSwitch(page, 'Surface métal', false)
  await setSwitch(page, 'Surface bâche', false)
  await page.waitForTimeout(2000)
  const peakOff = await peakRms(page, 'master', { duration: 3000 })

  expect(peakOn).toBeGreaterThan(1e-4)
  expect(peakOff).toBeLessThan(peakOn * 0.8)
})
