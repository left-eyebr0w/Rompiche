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
  voicesMax: number   // quota de voix L2 (budget séparé de L1)
}

/** Génération de pluie par DEUX flux de Poisson indépendants (cadrage notes/random/pluie.txt).
   Chaque couche d'événements a son propre débit λ (gouttes/s) et tire ses points dans
   sa ZONE géométrique disjointe (distance horizontale d = √(dx²+dz²) à la tête) :
     • L1 (héros, proche) : disque  d ∈ [0, rL1]
     • L2 (lointaine)     : anneau  d ∈ [rL1, rMaxL2]
   La couche d'une goutte est décidée PAR LE FLUX qui l'émet (plus de routage zonal
   probabiliste a posteriori). Le débit effectif d'un flux = λ × regimeMult × density.
   La voix porte un `mix` ∈ [0,1] DÉRIVÉ de la distance réelle (continu sur l'anneau L2)
   qui pilote l'interpolation de timbre (flou/pitch) côté audio — mix=0 pour L1.
   - lambdaL1   : débit du flux héros L1 (gouttes/s à regimeMult=density=1)
   - lambdaL2   : débit du flux lointain L2 (gouttes/s à regimeMult=density=1)
   - rL1        : rayon (m) du disque proche L1 (= bord interne de l'anneau L2)
   - rMaxL2     : rayon (m) externe de l'anneau L2 (au-delà → fondu perceptif dans L3)
   - regimeMult : multiplicateur global sur les λ (levier de régime bruine→averse) */
export interface RainConfig {
  lambdaL1: number
  lambdaL2: number
  rL1: number
  rMaxL2: number
  regimeMult: number
}

/** Paramètres de TIMBRE de la pluie, réglables à l'oreille (ex-constantes en dur). */
export interface GrainConfig {
  duréeS: number       // durée nominale d'un grain (s) — ex-GRAIN_DURATION_S
  detuneSpan: number   // amplitude crête-à-crête du détune aléatoire (cents)
  attaqueS: number     // fondu d'entrée anti-clic (s) — ex-0.004
  cooldownS: number    // anti-mitraillage par cellule (s) — ex-COOLDOWN_S
}

/** Timbre des voix « flouté + pitché » (cadrage rework/06), interpolé par voix selon
   son `mix` ∈ [0,1] (0 = réglages L1, 1 = réglages L2). Réglable live.
   - lowpassHzL1/L2 : fréquence de coupure du passe-bas (Hz). Plus bas = plus sourd/lointain.
   - diffusionL1/L2 : quantité de halo (réseau de délais), wet [0..1].
   - pitchL1/L2     : décalage de hauteur en DEMI-TONS (×100 → cents en interne), s'ajoute
                      au détune aléatoire du grain.
   - delayS / feedback : réglages globaux du réseau de délais partagé (temps, retour). */
export interface TimbreConfig {
  lowpassHzL1: number
  lowpassHzL2: number
  diffusionL1: number
  diffusionL2: number
  pitchL1: number
  pitchL2: number
  delayS: number
  feedback: number
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

export interface WorldConfig {
  size: number
  seed: number
  platform: Platform
  ambisonicOrder: number
  layers: LayersConfig
  weather: WeatherConfig
  /** Génération de pluie : 2 flux de Poisson (L1/L2) + zones géométriques. Réglable live. */
  rain: RainConfig
  /** Timbre de la pluie (durée/détune/attaque/cooldown). Réglable live. */
  grain: GrainConfig
  /** Timbre « flouté + pitché » des voix, interpolé L1↔L2 par mix. Réglable live. */
  timbre: TimbreConfig
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
  L2: {
    voicesMax: 10,   // budget du pool de voix L2 (séparé de L1)
  },
  L3: { ordre: 1, filtre: { centreHz: 1600, largeurHz: 4000 } },
}

/* Échelle unique du monde (ex-preset « diorama »). La notion de preset a été
   retirée : Rompiche est un diorama unique. Ces constantes sont la seule source
   de l'échelle ; si un jour d'autres tailles reviennent, elles repasseront par
   l'interface WorldQuery, pas par une table de presets recâblée partout. */
const WORLD = { size: 25, L1rMax: 12, L2rMax: 20, crossfade: 0.30 }

/** Crée un WorldConfig complet. */
export function makeWorldConfig(
  { seed = 1, platform }: { seed?: number; platform?: Platform } = {},
): WorldConfig {
  const p  = WORLD
  const plat = platform ?? detectPlatform()
  const pl = PLATFORM_PRESETS[plat]

  return {
    size: p.size,
    seed,
    platform: plat,
    ambisonicOrder: pl.ambisonicOrder,
    layers: {
      L1: {
        ...COMMON.L1,
        voices: pl.voicesL1,
        rMax: p.L1rMax,
      },
      L2: { ...COMMON.L2, rMax: p.L2rMax },
      L3: { ...COMMON.L3 },
      crossfade: p.crossfade,
      hystérésis: 1,
    },
    weather: { intensité: 0.5, vent: 0, dir: 0 },
    /* Deux flux de Poisson (notes/random/pluie.txt) : L1 héros dans le disque proche
       (rL1=8 m), L2 lointain dans l'anneau 8→20 m. λ = gouttes/s à regime=density=1 ;
       L1 plus dense que L2 (héros proches). À caler à l'oreille. */
    rain: { lambdaL1: 40, lambdaL2: 20, rL1: 8, rMaxL2: p.L2rMax, regimeMult: 1 },
    /* Timbre de la pluie (ex-constantes en dur, désormais réglables à l'oreille). */
    grain: { duréeS: 0.3, detuneSpan: 40, attaqueS: 0.004, cooldownS: 0.08 },
    /* Timbre flouté/pitché interpolé L1↔L2 (cadrage rework/06). L1 = clair/proche
       (coupe haute, pas de halo, pas de pitch) ; L2 = sourd/lointain (coupe basse,
       un peu de halo, légèrement plus grave). Délai partagé pour la diffusion. */
    timbre: {
      lowpassHzL1: 18000, lowpassHzL2: 3500,
      diffusionL1: 0, diffusionL2: 0.35,
      pitchL1: 0, pitchL2: -3,
      delayS: 0.08, feedback: 0.35,
    },
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
