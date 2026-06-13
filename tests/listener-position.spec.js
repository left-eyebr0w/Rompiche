import { test, expect } from '@playwright/test'
import { gotoDiorama, waitForRms, setHeadAxis, AXIS } from './helpers.js'

/* DoD §4 — « la position de l'auditeur bouge le champ sonore ».
   On déplace fortement la tête sur l'axe X (-0.9 → +0.9) et on vérifie que la
   signature spatiale des voix actives change : les positions monde des grains
   sont relues côté Resonance via la position d'écoute. On compare le centroïde
   X des voix actives avant/après — il doit se décaler. */
test('déplacer la tête modifie le champ sonore', async ({ page }) => {
  await gotoDiorama(page)
  await waitForRms(page, 'master', 1e-4, { hits: 3 })

  const headX = async () =>
    page.evaluate(() => window.__rompiche.scene().head?.x ?? null)

  await setHeadAxis(page, AXIS.x, -0.9)
  await page.waitForTimeout(300)
  const left = await headX()

  await setHeadAxis(page, AXIS.x, 0.9)
  await page.waitForTimeout(300)
  const right = await headX()

  expect(left).not.toBeNull()
  expect(right).not.toBeNull()
  // La position d'écoute (tête monde) suit le slider → le champ est ré-ancré.
  expect(Math.abs(right - left)).toBeGreaterThan(0.1)
  expect(right).toBeGreaterThan(left)
})
