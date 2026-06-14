/* ── EngineSnapshot — pont lecture moteur → UI ─ Grand Refactor J0 ────────────
   Type-frontière SEUL (architecture.md §5.1). Inventaire YAGNI : seulement ce que
   l'UI lit RÉELLEMENT. La projection des 6 faces se fait côté moteur (pas dans React) ;
   le snapshot ne porte que faceLevels[6]. Petit et borné → mécanisme de pont libre
   (à trancher au chantier UI). Lecture seule. */

/** Ligne de méter par matériau (DebugHUD). */
export interface MaterialMeter {
  id: string
  label: string
  /** Niveau en dB. */
  level: number
  /** Impacts par seconde. */
  rate: number
  triggerCount: number
}

export interface EngineSnapshot {
  /** Moteur démarré (sera un enum de lifecycle au-delà de J0). */
  ready: boolean
  /** Gain maître post-atténuation, dB. */
  master: number
  pool: { busy: number; size: number; steals: number }
  materials: MaterialMeter[]
  /** Niveaux directionnels des 6 faces de la tête (projetés côté moteur). */
  faceLevels: [number, number, number, number, number, number]
}
