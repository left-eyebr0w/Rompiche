import { test, expect } from '@playwright/test'
import { gotoJ5, setSlider, setSwitch } from './helpers-j5.js'

test('J5 — save → reload → load via UI restaure l\'état de la scène', async ({ page }) => {
  await gotoJ5(page)

  /* Changer des valeurs (distinctes des défauts). */
  await setSlider(page, 'Densité', '0.73')
  await setSwitch(page, 'Surface bâche', false)
  await page.waitForTimeout(200)

  /* Enregistrer. */
  await page.getByTestId('save-name').fill('j5-scene-test')
  await page.getByTestId('save-btn').click()
  await expect(page.getByText('j5-scene-test')).toBeVisible({ timeout: 5000 })

  /* Recharger : l'état revient aux défauts. */
  await gotoJ5(page)
  const densityAfterReload = await page.locator('div.ds-slider', { hasText: 'Densité' })
    .locator('input[type=range]').inputValue()
  expect(densityAfterReload).toBe('0.5')

  /* Charger le slot. */
  await expect(page.getByTestId('slot-j5-scene-test')).toBeVisible({ timeout: 5000 })
  await page.getByTestId('load-j5-scene-test').click()
  await page.waitForTimeout(500)

  /* Vérifier que les valeurs restaurées. */
  const densityAfterLoad = await page.locator('div.ds-slider', { hasText: 'Densité' })
    .locator('input[type=range]').inputValue()
  expect(densityAfterLoad).toBe('0.73')

  /* Nettoyage. */
  await page.getByTestId('del-j5-scene-test').click()
})
