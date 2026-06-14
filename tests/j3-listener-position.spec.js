import { test, expect } from '@playwright/test'
import { gotoJ3, waitForRms, setHeadPosition } from './helpers-j3.js'

test('J3 — déplacer l\'auditeur modifie le champ sonore', async ({ page }) => {
  await gotoJ3(page)
  await waitForRms(page, 'master', 1e-4, { hits: 3 })

  /* Se déplacer complètement à gauche, puis à droite. La RMS du master change
     car Resonance spatialise les sources autour de l'auditeur. */
  await setHeadPosition(page, -0.9, 0, 0)
  await page.waitForTimeout(1000)
  const leftRms = await page.evaluate(() => window.__rompiche.rms.master)

  await setHeadPosition(page, 0.9, 0, 0)
  await page.waitForTimeout(1000)
  const rightRms = await page.evaluate(() => window.__rompiche.rms.master)

  /* Le champ sonore change : la RMS diffère entre les deux positions. */
  expect(Math.abs(rightRms - leftRms)).toBeGreaterThan(1e-5)
})
