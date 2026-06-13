/* ── Moteur d'échelle — WorldConfig & LayerConfig (§2.3, §4, §15.4) ──────────
   Source unique des presets et de la résolution des frontières de couches.
   Un seul endroit pour changer l'échelle du monde (I3, I5). */

/* ── Profils plateforme (§12.2, T-4.2) ── */
export const PLATFORM_PRESETS = {
  mobile:  { voicesL1: 14, sectorsL2: 4,  ambisonicOrder: 1, sampleRate: 48000 },
  desktop: { voicesL1: 40, sectorsL2: 8,  ambisonicOrder: 2, sampleRate: 48000 },
  vr:      { voicesL1: 64, sectorsL2: 12, ambisonicOrder: 3, sampleRate: 48000 },
}

/** Détecte la plateforme courante (UA + XRSystem). */
export function detectPlatform() {
  if (typeof navigator === 'undefined') return 'desktop'
  if ('xr' in navigator) return 'vr'
  const ua = navigator.userAgent ?? ''
  if (/Mobi|Android|iPhone|iPad/i.test(ua)) return 'mobile'
  return 'desktop'
}

const COMMON = {
  L1: {
    priorité: { w_gain: 0.40, w_dist: 0.40, w_att: 0.15, w_age: 0.10 },
    seuilWeakDb: -45,
  },
  L2: { débitMax: 120 },
  L3: { ordre: 1, filtre: { centreHz: 1600, largeurHz: 4000 } },
}

export const PRESETS = {
  diorama:   { size: 4,  L1rMax: 2.5, L2rMax: 10,   sectors: 8,  crossfade: 0.30 },
  room:      { size: 12, L1rMax: 4,   L2rMax: 10,   sectors: 4,  crossfade: 0.25 },
  courtyard: { size: 30, L1rMax: 5,   L2rMax: 22,   sectors: 8,  crossfade: 0.20 },
  field:     { size: 80, L1rMax: 6,   L2rMax: 35,   sectors: 12, crossfade: 0.15 },
}

/**
 * Crée un WorldConfig complet.
 * @param {object} opts
 * @param {string} [opts.preset='diorama']
 * @param {number} [opts.seed=1]
 * @param {string} [opts.platform] — 'mobile'|'desktop'|'vr' (auto-détecté si absent)
 */
export function makeWorldConfig({ preset = 'diorama', seed = 1, platform } = {}) {
  const p  = PRESETS[preset] ?? PRESETS.diorama
  const pl = PLATFORM_PRESETS[platform ?? detectPlatform()]

  /* Le secteur count est le min de ce que le preset monde autorise et de la plateforme */
  const sectors = Math.min(p.sectors, pl.sectorsL2)

  return {
    size: p.size,
    preset,
    seed,
    platform: platform ?? detectPlatform(),
    ambisonicOrder: pl.ambisonicOrder,
    layers: {
      /* Quand L2 est absent (sectors=0), l'hémisphère arrière n'a aucun autre support :
         on neutralise le biais d'attention du vol de voix (w_att) pour ne pas raboter
         en continu les voix derrière l'auditeur et détruire le surround. */
      L1: {
        ...COMMON.L1,
        voices: pl.voicesL1,
        rMax: p.L1rMax,
        priorité: { ...COMMON.L1.priorité, w_att: sectors > 0 ? COMMON.L1.priorité.w_att : 0 },
      },
      L2: { ...COMMON.L2, rMax: p.L2rMax, sectors },
      L3: { ...COMMON.L3 },
      crossfade: p.crossfade,
      hystérésis: 1,
    },
    weather: { intensité: 0.5, vent: 0, dir: 0 },
  }
}

/** Résolution des frontières r1/r2 et détection du mode collapse (§4.1-4.2).
    r1 (L1) est borné par la slice (worldRadius) ; r2 (L2) peut s'étendre au-delà
    du monde visible (far-field world). */
export function résoudreCouches(worldRadius, cfg) {
  const r1 = Math.min(cfg.layers.L1.rMax, worldRadius)
  const r2 = cfg.layers.L2.rMax == null
    ? r1
    : cfg.layers.L2.rMax
  /* overlap = zone de transition L1→L2. Borné à r1 pour éviter que la zone
     de crossfade n'engloutisse L1 quand r2 >> r1 (ex: diorama r1=2, r2=10). */
  const overlap = cfg.layers.crossfade * Math.min(r2 - r1, r1)
  const collapse =
    worldRadius <= r1 ? 'diorama' :
    worldRadius <= r2 ? 'small'   : 'full'
  return { r1, r2, overlap, collapse }
}
