import { test, expect } from '@playwright/test'
import { gotoDiorama, waitForRms } from './helpers.js'

/* DoD §4 — « le son sort ».
   État par défaut : listening + rain + metal + bache actifs. Le master doit
   produire du signal (RMS > seuil) de façon répétée. */
test('le son sort : le master produit du signal', async ({ page }) => {
  await gotoDiorama(page)
  const heard = await waitForRms(page, 'master', 1e-4, { hits: 3 })
  expect(heard).toBe(true)
})
