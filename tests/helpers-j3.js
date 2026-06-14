const J3_PATH = '/src/index.html'

export async function gotoJ3(page) {
  await page.goto(J3_PATH)
  await page.waitForFunction(() => !!window.__rompiche)
  await page.locator('#root').click()
  await page.waitForFunction(() => {
    const r = window.__rompiche
    return r && r.rms && r.rms.master > 1e-4
  }, null, { timeout: 15000 })
}

export async function readRms(page) {
  return page.evaluate(() => ({ ...window.__rompiche.rms }))
}

export async function waitForRms(page, layer, min, { hits = 3, timeout = 15000, interval = 200 } = {}) {
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

export function setHeadPosition(page, x, y, z) {
  return page.evaluate(({ x, y, z }) => {
    const c = window.__rompiche.ctx.input.controls
    c.listener.x = x
    c.listener.y = y
    c.listener.z = z
  }, { x, y, z })
}

export function setSurface(page, id, on) {
  return page.evaluate(({ id, on }) => {
    window.__rompiche.ctx.surfaces[id] = on ? 1 : 0
  }, { id, on })
}
