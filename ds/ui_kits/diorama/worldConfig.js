/* ── Moteur d'échelle — WorldConfig & LayerConfig (§2.3, §4, §15.4) ──────────
   Source unique des presets et de la résolution des frontières de couches.
   Un seul endroit pour changer l'échelle du monde (I3, I5). */

const COMMON = {
  L1: {
    voices: 48,
    priorité: { w_gain: 0.40, w_dist: 0.40, w_att: 0.15, w_age: 0.10 },
    seuilWeakDb: -45,
  },
  L2: { débitMax: 120 },
  L3: { ordre: 1, filtre: { centreHz: 1600, largeurHz: 4000 } },
}

export const PRESETS = {
  diorama:   { size: 4,  L1rMax: 2.5, L2rMax: null, sectors: 0,  crossfade: 0.30 },
  room:      { size: 12, L1rMax: 4,   L2rMax: 10,   sectors: 4,  crossfade: 0.25 },
  courtyard: { size: 30, L1rMax: 5,   L2rMax: 22,   sectors: 8,  crossfade: 0.20 },
  field:     { size: 80, L1rMax: 6,   L2rMax: 35,   sectors: 12, crossfade: 0.15 },
}

export function makeWorldConfig({ preset = 'diorama', seed = 1 } = {}) {
  const p = PRESETS[preset] ?? PRESETS.diorama
  return {
    size: p.size,
    preset,
    seed,
    layers: {
      L1: { ...COMMON.L1, rMax: p.L1rMax },
      L2: { ...COMMON.L2, rMax: p.L2rMax, sectors: p.sectors },
      L3: { ...COMMON.L3 },
      crossfade: p.crossfade,
      hystérésis: 1, // réservé Phase 3
    },
    weather: { intensité: 0.5, vent: 0, dir: 0 },
  }
}

/* Résolution des frontières r1/r2 et détection du mode collapse (§4.1-4.2). */
export function résoudreCouches(worldRadius, cfg) {
  const r1 = Math.min(cfg.layers.L1.rMax, worldRadius)
  const r2 = cfg.layers.L2.rMax == null
    ? r1
    : Math.min(cfg.layers.L2.rMax, worldRadius)
  const overlap = cfg.layers.crossfade * Math.max(0, r2 - r1)
  const collapse =
    worldRadius <= r1 ? 'diorama' :
    worldRadius <= r2 ? 'small'   : 'full'
  return { r1, r2, overlap, collapse }
}
