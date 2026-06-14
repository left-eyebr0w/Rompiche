/* ── ClockSource — couture maître d'horloge ─ Grand Refactor J0 ───────────────
   Type-frontière SEUL (architecture.md §2.1). Le cœur ne connaît QUE cette interface ;
   la platform (propriétaire de l'AudioContext) injecte l'implémentation au runtime.
   Un seul maître d'horloge actif à la fois (pas deux horloges concurrentes).
     Impl primaire : WorkletClock (clock-processor → realDt)
     Impl repli    : RafClock (worklet absent)
     Impl test     : ManualClock (tick(dt) piloté à la main, headless sans AudioContext) */

export interface ClockSource {
  /** S'abonne au tic d'horloge ; realDt en secondes (temps réel écoulé). */
  onTick(cb: (realDt: number) => void): void
  /** Démarre l'horloge (resume() du contexte audio). */
  start(): Promise<void>
  /** Arrête l'horloge. */
  stop(): void
}
