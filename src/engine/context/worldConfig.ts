/* ── Moteur d'échelle — WorldConfig & LayerConfig (§2.3, §4, §15.4) ──────────
   Source unique des presets et de la résolution des frontières de couches.
   Un seul endroit pour changer l'échelle du monde (I3, I5). */

import type { Platform } from '../../shared/state.js'

export interface L1Priority {
  w_gain: number
  w_dist: number
  w_att: number
  w_age: number
}

export interface L1Config {
  voices: number
  rMax: number
  priorité: L1Priority
  seuilWeakDb: number
}

export interface L2Config {
  rMax: number
  sectors: number
  débitMax: number
}

export interface L3FilterConfig {
  centreHz: number
  largeurHz: number
}

export interface L3Config {
  ordre: number
  filtre: L3FilterConfig
}

export interface LayersConfig {
  L1: L1Config
  L2: L2Config
  L3: L3Config
  crossfade: number
  hystérésis: number
}

export interface WeatherConfig {
  intensité: number
  vent: number
  dir: number
}

/** Champ de répartition spatiale des gouttes HÉROS L1 (couche L1 découplée).
   La probabilité de tirage d'une goutte candidate à distance d de la tête suit
     w(d) = floor + (1 − floor) · exp( −0.5 · (max(0, d−core)/σ)^p ),  d² = dx² + dz² + (ky·dy)²
   - rate  : débit de gouttes héros L1 (grains/s à density=1), INDÉPENDANT de L2/L3
   - core  : rayon (m) d'un plateau de poids maximal autour de la tête (cœur dense uniforme) ;
             découplé de σ — au-delà du cœur, la diffusion reprend en σ. 0 = pas de plateau.
   - sigma : rayon de diffusion (m) au-delà du cœur ; petit = serré autour de la tête
   - p     : forme (1 = pointu/exponentiel, 2 = gaussien, >2 = plateau central puis chute)
   - floor : poids résiduel des gouttes lointaines [0..1] (0 = disparaissent)
   - ky    : poids de l'axe vertical (0 = répartition 2D plate, 1 = vraie sphère 3D) */
export interface L1FieldConfig {
  rate: number
  core: number
  sigma: number
  p: number
  floor: number
  ky: number
}

export interface WorldConfig {
  size: number
  seed: number
  platform: Platform
  ambisonicOrder: number
  layers: LayersConfig
  weather: WeatherConfig
  /** Répartition spatiale des gouttes héros L1 (couche L1 découplée). Réglable live. */
  l1Field: L1FieldConfig
  /** Débit-cible de gouttes L1 (grains/s) pour density=1, INDÉPENDANT de la
     résolution de grille. Le débit effectif = density · dropletRate, réparti
     entre matériaux au prorata de leur surface exposée. Réglable (UI/preset) :
     c'est le levier d'intensité de la pluie. À tenir sous le débit soutenable du
     pool (≈ voices/duréeGrain) pour éviter la saturation/vol de voix permanent. */
  dropletRate: number
}

export interface LayerBoundaries {
  r1: number
  r2: number
  overlap: number
  collapse: 'diorama' | 'small' | 'full'
}

export interface PlatformPreset {
  voicesL1: number
  sectorsL2: number
  ambisonicOrder: number
  sampleRate: number
}

/* ── Profils plateforme (§12.2, T-4.2) ── */
export const PLATFORM_PRESETS: Record<Platform, PlatformPreset> = {
  mobile:  { voicesL1: 14, sectorsL2: 4,  ambisonicOrder: 1, sampleRate: 48000 },
  desktop: { voicesL1: 40, sectorsL2: 8,  ambisonicOrder: 2, sampleRate: 48000 },
  vr:      { voicesL1: 64, sectorsL2: 12, ambisonicOrder: 3, sampleRate: 48000 },
}

/** Détecte la plateforme courante (UA + XRSystem). */
export function detectPlatform(): Platform {
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

/* Échelle unique du monde (ex-preset « diorama »). La notion de preset a été
   retirée : Rompiche est un diorama unique. Ces constantes sont la seule source
   de l'échelle ; si un jour d'autres tailles reviennent, elles repasseront par
   l'interface WorldQuery, pas par une table de presets recâblée partout. */
const WORLD = { size: 25, L1rMax: 12, L2rMax: 20, sectors: 8, crossfade: 0.30 }

/** Crée un WorldConfig complet. */
export function makeWorldConfig(
  { seed = 1, platform }: { seed?: number; platform?: Platform } = {},
): WorldConfig {
  const p  = WORLD
  const plat = platform ?? detectPlatform()
  const pl = PLATFORM_PRESETS[plat]

  /* Le secteur count est le min de ce que le monde autorise et de la plateforme */
  const sectors = Math.min(p.sectors, pl.sectorsL2)

  return {
    size: p.size,
    seed,
    platform: plat,
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
    /* Couche L1 héros découplée : son propre débit + répartition spatiale réglable.
       ky=1 → vraie sphère 3D (le défaut demandé) ; σ=10 m, p=2 (gaussien), petit plancher ;
       core=0 → pas de plateau central par défaut (à régler à l'oreille). */
    l1Field: { rate: 60, core: 0, sigma: 10, p: 2, floor: 0.02, ky: 1 },
    /* Débit du flux BULK (alimente L2 secteurs / L3 nappe), INDÉPENDANT du grid.
       density=0,5 (défaut) = pluie posée. Découplé du débit héros L1 (l1Field.rate). */
    dropletRate: 120,
  }
}

/** Résolution des frontières r1/r2 et détection du mode collapse (§4.1-4.2).
    r1 (L1) est borné par la slice (worldRadius) ; r2 (L2) peut s'étendre au-delà
    du monde visible (far-field world). */
export function résoudreCouches(worldRadius: number, cfg: WorldConfig): LayerBoundaries {
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
