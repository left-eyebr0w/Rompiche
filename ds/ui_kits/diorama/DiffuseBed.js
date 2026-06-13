/* ── Couche 3 : nappe diffuse lointaine (§7, §16.1) ──────────────────────────
   Graphe : bruit pink/brown → BiquadFilter passe-bande → GainNode → masterGain.
   La nappe est routée dans le gain master (même sortie que les voix HRTF) pour
   partager l'unique décodage binaural (§16.1). Son de fond non localisé — un
   diffus pur n'a pas de cues de direction (I1).

   Valeurs résolues :
     niveauMax      = -12 dBFS  (full)
     niveauMaxMince = -18 dBFS  (mode diorama)
     rampe niveau   = 80 ms
     centreHz  = 800 + 1700·i   (i = intensité pluie)
     largeurHz = 1500 + 3500·i */

const NIVEAU_MAX_DB   = -12
const NIVEAU_MAX_MINCE_DB = -18
const SILENCE_DB      = -80
const RAMP_MS         = 0.080 // secondes

function dbToLin(db) {
  return db <= SILENCE_DB ? 0 : Math.pow(10, db / 20)
}

function lerpDb(a, b, t) {
  return a + (b - a) * t
}

export class DiffuseBed {
  constructor(ctx, masterGain, cfg, prng) {
    this._ctx  = ctx
    this._cfg  = { ...cfg }
    this._mince = cfg.mince ?? false

    /* Graphe audio : worklet → passe-bande → gain → master */
    this._filter = ctx.createBiquadFilter()
    this._filter.type = 'bandpass'

    this._gain = ctx.createGain()
    this._gain.gain.value = 0 // silencieux jusqu'au premier setWeather

    this._filter.connect(this._gain)
    this._gain.connect(masterGain)

    /* Le worklet est créé séparément via attachWorklet() pour permettre l'await */
    this._noise = null

    /* Graine pour le worklet (fork du PRNG maître) */
    this._seed = Math.floor(prng.aléa() * 0xFFFFFFFF) + 1
  }

  /* Appelé après addModule — crée et branche le nœud worklet. */
  attachWorklet(couleur = 'pink') {
    if (this._noise) return
    this._noise = new AudioWorkletNode(this._ctx, 'noise-processor', {
      processorOptions: { seed: this._seed, couleur },
    })
    this._noise.connect(this._filter)
  }

  /* Pilote la nappe selon l'état météo. Émet un event `bed` si un recorder est passé. */
  setWeather(weather, weatherSv, rec) {
    const i = Math.max(0, Math.min(1, weather.intensité ?? 0))
    const niveauMax = this._mince ? NIVEAU_MAX_MINCE_DB : NIVEAU_MAX_DB
    const niveau = i === 0 ? SILENCE_DB : lerpDb(SILENCE_DB, niveauMax, i)
    const centre  = 800  + 1700  * i
    const largeur = 1500 + 3500  * i

    const now = this._ctx.currentTime
    this._gain.gain.cancelScheduledValues(now)
    this._gain.gain.setValueAtTime(this._gain.gain.value, now)
    this._gain.gain.linearRampToValueAtTime(dbToLin(niveau), now + RAMP_MS)

    this._filter.frequency.value = centre
    this._filter.Q.value = centre / Math.max(1, largeur)

    rec?.emit('bed', {
      niveau: +niveau.toFixed(2),
      filtre: { centre: Math.round(centre), largeur: Math.round(largeur) },
      ordre: this._cfg.ordre ?? 1,
      weatherSv: weatherSv ?? 0,
    })
  }

  /* Bascule entre mode plein et mode mince (diorama collapse §4.2). */
  setMince(on) {
    this._mince = on
  }
}

/* Résout la BedConfig depuis le WorldConfig et les frontières de bandes. */
export function resolveBedConfig(worldCfg, bands) {
  return {
    noise:     'pink',
    ordre:     worldCfg.layers.L3.ordre,
    filtre:    worldCfg.layers.L3.filtre,
    niveauMax: NIVEAU_MAX_DB,
    mince:     bands.collapse === 'diorama',
  }
}
