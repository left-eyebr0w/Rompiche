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

/** Niveau réel d'une couche audio (L1/L2/L3), mesuré côté moteur. dB ; -Infinity
   si la couche est muette ou pas encore branchée (L2 tant que Phase L2 non livrée). */
export interface LayerMeter {
  level: number
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
  /** Niveau réel par couche (L1 héros, L2 secteurs, L3 nappe). Projeté côté moteur.
     L2 reste -Infinity tant que la Phase L2 (secteurs) n'est pas livrée. */
  layers: { L1: LayerMeter; L2: LayerMeter; L3: LayerMeter }
}
