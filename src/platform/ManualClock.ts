/* ── ManualClock — ClockSource pilotée à la main ─ Grand Refactor J1 ──────────
   Implémentation de test de ClockSource (architecture.md §2.1). Pas d'AudioContext,
   pas de worklet : on appelle tick(dt) à la main pour faire avancer la boucle de
   façon déterministe → c'est ce qui rend le cœur testable en headless (les garde-fous
   tournent sans audio réel). Un seul maître d'horloge actif : ici, c'est nous. */

import type { ClockSource } from './ClockSource.js'

export class ManualClock implements ClockSource {
  private cbs: ((realDt: number) => void)[] = []
  private running = false

  onTick(cb: (realDt: number) => void): void {
    this.cbs.push(cb)
  }

  start(): Promise<void> {
    this.running = true
    return Promise.resolve()
  }

  stop(): void {
    this.running = false
  }

  /** Avance le temps réel de `realDt` secondes (no-op tant que start() n'a pas été
      appelé, comme un contexte audio suspendu qui ne tic pas — §2.1). */
  tick(realDt: number): void {
    if (!this.running) return
    for (const cb of this.cbs) cb(realDt)
  }
}
