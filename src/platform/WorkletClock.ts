/* ── WorkletClock — maître d'horloge piloté par le thread audio ─ architecture.md §2
   Implémentation primaire de la couture ClockSource. Le worklet `clock-processor`
   poste `currentTime` (temps audio absolu) depuis le thread audio, jamais gelé hors
   focus / écran éteint. On en dérive le `realDt` qui fait avancer la boucle à pas
   fixe (loop.ts) — c'est ce qui rend le mode background possible.

   Repli rAF intégré : si l'AudioWorklet est indisponible (vieux navigateur, échec
   d'addModule), on retombe sur requestAnimationFrame pour ne pas casser le desktop.
   Le repli N'OFFRE PAS la garantie background (rAF gèle hors focus) — c'est un
   filet, pas la cible. */

import type { ClockSource } from './ClockSource.js'

const DEFAULT_INTERVAL_MS = 16

export class WorkletClock implements ClockSource {
  private cbs: ((realDt: number) => void)[] = []
  private node: AudioWorkletNode | null = null
  private sink: GainNode | null = null
  private lastAudioTime = -1
  /* Repli rAF (filet) : actif uniquement si le worklet a échoué. */
  private rafId = 0
  private rafLast = 0
  private usingFallback = false

  constructor(private ctx: AudioContext, private intervalMs = DEFAULT_INTERVAL_MS) {}

  onTick(cb: (realDt: number) => void): void {
    this.cbs.push(cb)
  }

  async start(): Promise<void> {
    try {
      await this.ctx.audioWorklet.addModule(
        new URL('./worklets/clock-processor.js', import.meta.url),
      )
      const node = new AudioWorkletNode(this.ctx, 'clock-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { intervalMs: this.intervalMs },
      })
      /* Muet mais branché : le moteur audio ne « pull »e que les nœuds reliés à
         destination ; sans ça, process() ne tournerait pas et l'horloge n'avancerait
         jamais. Le gain à 0 garantit que la sortie n'atteint pas les haut-parleurs. */
      const sink = this.ctx.createGain()
      sink.gain.value = 0
      node.connect(sink).connect(this.ctx.destination)
      node.port.onmessage = (e: MessageEvent<number>) => this._onAudioTime(e.data)
      this.node = node
      this.sink = sink
    } catch (err) {
      console.warn('[WorkletClock] AudioWorklet indisponible, repli rAF :', err)
      this._startRafFallback()
    }
  }

  /* Convertit l'horloge audio absolue en delta. Le 1ᵉʳ message ne fait qu'amorcer
     lastAudioTime (pas de dt géant au démarrage). La boucle borne déjà ce dt
     (MAX_CATCHUP), mais on jette les deltas non positifs par sécurité. */
  private _onAudioTime(audioTime: number): void {
    if (this.lastAudioTime < 0) { this.lastAudioTime = audioTime; return }
    const realDt = audioTime - this.lastAudioTime
    this.lastAudioTime = audioTime
    if (realDt <= 0) return
    for (const cb of this.cbs) cb(realDt)
  }

  private _startRafFallback(): void {
    this.usingFallback = true
    this.rafLast = performance.now()
    const tick = (now: number) => {
      const realDt = Math.min((now - this.rafLast) / 1000, 0.1)
      this.rafLast = now
      for (const cb of this.cbs) cb(realDt)
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.usingFallback && this.rafId) cancelAnimationFrame(this.rafId)
    if (this.node) { this.node.port.onmessage = null; this.node.disconnect() }
    if (this.sink) this.sink.disconnect()
  }
}
