import type { ClockSource } from './ClockSource.js'

export class RafClock implements ClockSource {
  private cbs: ((realDt: number) => void)[] = []
  private running = false
  private rafId = 0
  private last = 0

  onTick(cb: (realDt: number) => void): void {
    this.cbs.push(cb)
  }

  start(): Promise<void> {
    this.running = true
    this.last = performance.now()
    const tick = (now: number) => {
      if (!this.running) return
      const realDt = Math.min((now - this.last) / 1000, 0.1)
      this.last = now
      for (const cb of this.cbs) cb(realDt)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
    return Promise.resolve()
  }

  stop(): void {
    this.running = false
    if (this.rafId) cancelAnimationFrame(this.rafId)
  }
}
