import { expect } from '@playwright/test'

/* Chemin du diorama servi par Vite (root '.', input réel du build). */
const DIORAMA_PATH = '/ds/ui_kits/diorama/index.html?debug=true'

/* Navigue vers le diorama avec l'API d'observation (?debug=true), débloque
   l'audio (clic body, ceinture-bretelles avec le flag autoplay) et attend que
   le moteur soit prêt — window.__rompiche installée + pool de voix instancié. */
export async function gotoDiorama(page) {
  await page.goto(DIORAMA_PATH)
  await page.waitForFunction(() => !!window.__rompiche)
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  await page.waitForFunction(() => {
    const s = window.__rompiche.sampler?.()
    return !!s && s.pool && s.pool.voices > 0
  }, null, { timeout: 15_000 })
}

/* Lecture instantanée des RMS des 4 couches (0..1). */
export async function readRms(page) {
  return page.evaluate(() => ({ ...window.__rompiche.rms }))
}

/* Snapshot du sampler (pool / secteurs / nappe). */
export async function readSampler(page) {
  return page.evaluate(() => window.__rompiche.sampler())
}

/* Attend que rms[layer] dépasse `min` de façon répétée (tolérant au bruit et aux
   silences brefs du processus de Poisson) : on échantillonne périodiquement et on
   considère OK dès que `hits` relevés au-dessus du seuil sont atteints. */
export async function waitForRms(page, layer, min, { hits = 3, timeout = 15_000, interval = 200 } = {}) {
  const ok = await page.waitForFunction(
    ({ layer, min, hits }) => {
      const w = window.__rompiche
      w.__rmsHits = w.__rmsHits || {}
      if (w.rms[layer] > min) w.__rmsHits[layer] = (w.__rmsHits[layer] || 0) + 1
      return (w.__rmsHits[layer] || 0) >= hits
    },
    { layer, min, hits },
    { timeout, polling: interval },
  ).catch(() => null)
  return !!ok
}

/* Échantillonne le pic de rms[layer] sur une fenêtre temporelle. */
export async function peakRms(page, layer, { duration = 2000, interval = 100 } = {}) {
  return page.evaluate(
    async ({ layer, duration, interval }) => {
      let peak = 0
      const end = performance.now() + duration
      while (performance.now() < end) {
        peak = Math.max(peak, window.__rompiche.rms[layer])
        await new Promise(r => setTimeout(r, interval))
      }
      return peak
    },
    { layer, duration, interval },
  )
}

/* Active/désactive un Switch DS repéré par son label (clique le label, ce qui
   bascule la checkbox interne et déclenche le onChange React). Idempotent :
   ne clique que si l'état diffère de la cible. */
export async function setSurface(page, label, on) {
  const sw = page.locator('label.ds-switch', { hasText: label })
  const checkbox = sw.locator('input[type=checkbox]')
  if ((await checkbox.isChecked()) !== on) {
    await sw.click()
    await expect(checkbox).toBeChecked({ checked: on })
  }
}

/* Positionne un Slider DS contrôlé (React) repéré par préfixe de label.
   Passe par le setter natif + dispatch 'input' pour déclencher le onChange React. */
export async function setHeadAxis(page, axisLabel, value) {
  const input = page
    .locator('div.ds-slider', { hasText: axisLabel })
    .locator('input[type=range]')
  await input.evaluate((el, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    ).set
    setter.call(el, String(value))
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, value)
}

export const AXIS = {
  x: 'Axe X',
  y: 'Axe Y',
  z: 'Axe Z',
}
