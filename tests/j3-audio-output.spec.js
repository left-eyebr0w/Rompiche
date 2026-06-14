import { test, expect } from '@playwright/test'
import { gotoJ3, waitForRms } from './helpers-j3.js'

test('J3 — le son sort : le master produit du signal', async ({ page }) => {
  await gotoJ3(page)
  const heard = await waitForRms(page, 'master', 1e-4, { hits: 3 })
  expect(heard).toBe(true)
})
