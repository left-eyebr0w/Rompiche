import { test, expect } from '@playwright/test'
import { gotoJ5, setSlider } from './helpers-j5.js'

test('J5 — déplacer l\'auditeur via le slider UI modifie le champ sonore', async ({ page }) => {
  await gotoJ5(page)

  /* Se déplacer complètement à droite, puis à gauche. */
  await setSlider(page, 'Axe X', '0.9')
  await page.waitForTimeout(800)
  const rightRms = await page.evaluate(() => window.__rompiche.rms.master)

  await setSlider(page, 'Axe X', '-0.9')
  await page.waitForTimeout(800)
  const leftRms = await page.evaluate(() => window.__rompiche.rms.master)

  expect(Math.abs(rightRms - leftRms)).toBeGreaterThan(1e-5)
})
