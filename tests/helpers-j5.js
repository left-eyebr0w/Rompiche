const J5_PATH = '/src/index.html'

export async function gotoJ5(page) {
  await page.goto(J5_PATH)
  await page.waitForFunction(() => !!window.__rompiche)
  await page.waitForSelector('#overlay')
  await page.locator('#overlay').click()
  await page.waitForFunction(() => {
    const r = window.__rompiche
    return r && r.rms && r.rms.master > 1e-4
  }, null, { timeout: 15000 })
}

/* Positionne un Slider DS contrôlé (React) repéré par préfixe de label. */
export async function setSlider(page, label, value) {
  const input = page
    .locator('div.ds-slider', { hasText: label })
    .locator('input[type=range]')
  await input.evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    ).set
    setter.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

/* Active/désactive un Switch DS repéré par son label. */
export async function setSwitch(page, label, on) {
  const sw = page.locator('label.ds-switch', { hasText: label })
  const checkbox = sw.locator('input[type=checkbox]')
  if ((await checkbox.isChecked()) !== on) {
    await sw.click()
  }
}

/* Retourne la valeur courante d'un slider repéré par label. */
export async function readSlider(page, label) {
  return page.locator('div.ds-slider', { hasText: label })
    .locator('input[type=range]')
    .inputValue()
}

export const AXIS = {
  x: 'Axe X',
  y: 'Axe Y',
  z: 'Axe Z',
}
