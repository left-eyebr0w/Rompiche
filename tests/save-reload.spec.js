import { test, expect } from '@playwright/test'
import { gotoDiorama, setSurface } from './helpers.js'

/* DoD v1 — « save → reload → état identique » (cadrage-v1 §5).
   Le format WorldSave est versionné et persiste en IndexedDB (slots nommés).
   On modifie quelques paramètres, on enregistre un slot, on RECHARGE la page
   (l'état React repart aux défauts, IndexedDB survit), puis on charge le slot :
   les contrôles doivent retrouver les valeurs sauvegardées. */

const densitySlider = (page) =>
  page.locator('div.ds-slider', { hasText: 'Densité' }).locator('input[type=range]')

async function setDensity(page, value) {
  await densitySlider(page).evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set
    setter.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

test('save → reload → load restaure l\'état de la scène', async ({ page }) => {
  await gotoDiorama(page)

  /* Valeurs distinctes des défauts (density 0.42, bâche ON). */
  await setDensity(page, 0.73)
  await setSurface(page, 'Surface bâche', false)
  await expect(densitySlider(page)).toHaveValue('0.73')

  /* Enregistre un slot nommé. */
  await page.getByTestId('save-name').fill('scene-test')
  await page.getByRole('button', { name: 'Enregistrer' }).click()
  await expect(page.getByText('scene-test')).toBeVisible()

  /* Recharge : l'état React revient aux défauts, IndexedDB persiste. */
  await gotoDiorama(page)
  await expect(densitySlider(page)).toHaveValue('0.42')
  const bache = page.locator('label.ds-switch', { hasText: 'Surface bâche' }).locator('input[type=checkbox]')
  await expect(bache).toBeChecked()

  /* Charge le slot : les valeurs sauvegardées reviennent. */
  await expect(page.getByText('scene-test')).toBeVisible()
  await page.getByRole('button', { name: 'Charger' }).click()
  await expect(densitySlider(page)).toHaveValue('0.73')
  await expect(bache).not.toBeChecked()

  /* Nettoyage du slot pour ne pas polluer les runs suivants. */
  await page.getByRole('button', { name: '✕' }).click()
})
