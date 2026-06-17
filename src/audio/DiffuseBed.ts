/* ── Couche 3 : nappe diffuse lointaine (port v0 DiffuseBed.js) ───────────────
   Graphe : noise-processor (bruit pink) → BiquadFilter passe-bande → GainNode
   → masterGain. Routée dans le master (même sortie binaurale que les voix HRTF) :
   son de fond NON localisé — un diffus pur n'a pas de cues de direction.

   Port fidèle du v0 (commit 4c3d0f9, qui sonnait juste). Seule adaptation : la
   nappe se branche sur le `masterGain` du WebAudioBackend (au lieu du master
   Resonance) — la techno de spatialisation a changé au J6, pas la nappe.

   Pilotage : `setIntensity(i)` avec i ∈ [0,1] (l'intensité de pluie courante).
     centre  = 800  + 1700·i   (Hz)
     largeur = 1500 + 3500·i   (Hz) → Q = centre / largeur
     niveau  = lerp(SILENCE, niveauMax, i) dB ; i=0 → silence
   Réglages live possibles via les AudioParam (debug). Un AnalyserNode interne
   mesure le niveau RÉEL de sortie (jamais décoratif). */

const NIVEAU_MAX_DB = -12
const SILENCE_DB = -80
const RAMP_S = 0.08

function dbToLin(db: number): number {
  return db <= SILENCE_DB ? 0 : Math.pow(10, db / 20)
}

function lerpDb(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export class DiffuseBed {
  private _ctx: AudioContext
  private _filter: BiquadFilterNode
  private _gain: GainNode
  private _analyser: AnalyserNode
  private _buf: Float32Array<ArrayBuffer>
  private _noise: AudioWorkletNode | null = null
  private _seed: number
  private _i = -1   // dernière intensité poussée (évite les ramps redondantes)

  constructor(ctx: AudioContext, masterGain: GainNode, seed: number) {
    this._ctx = ctx
    this._seed = (seed >>> 0) || 1

    this._filter = ctx.createBiquadFilter()
    this._filter.type = 'bandpass'

    this._gain = ctx.createGain()
    this._gain.gain.value = 0   // silencieux jusqu'au premier setIntensity

    /* Mesure du niveau réel de la nappe (post-gain, pré-master). */
    this._analyser = ctx.createAnalyser()
    this._analyser.fftSize = 256
    this._analyser.smoothingTimeConstant = 0.8
    this._buf = new Float32Array(this._analyser.fftSize) as Float32Array<ArrayBuffer>

    this._filter.connect(this._gain)
    this._gain.connect(this._analyser)
    this._gain.connect(masterGain)
  }

  /* Crée et branche le nœud worklet de bruit. À appeler APRÈS addModule. */
  attachWorklet(couleur: 'pink' | 'brown' = 'pink'): void {
    if (this._noise) return
    this._noise = new AudioWorkletNode(this._ctx, 'noise-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      processorOptions: { seed: this._seed, couleur },
    })
    this._noise.connect(this._filter)
  }

  /* Pilote la nappe selon l'intensité de pluie courante (0..1). */
  setIntensity(intensity: number): void {
    const i = Math.max(0, Math.min(1, intensity))
    if (i === this._i) return
    this._i = i

    const niveau = i === 0 ? SILENCE_DB : lerpDb(SILENCE_DB, NIVEAU_MAX_DB, i)
    const centre = 800 + 1700 * i
    const largeur = 1500 + 3500 * i

    const now = this._ctx.currentTime
    this._gain.gain.cancelScheduledValues(now)
    this._gain.gain.setValueAtTime(this._gain.gain.value, now)
    this._gain.gain.linearRampToValueAtTime(dbToLin(niveau), now + RAMP_S)

    this._filter.frequency.value = centre
    this._filter.Q.value = centre / Math.max(1, largeur)
  }

  /* Niveau de sortie réel (RMS) en dB. -Infinity si silencieux. */
  levelDb(): number {
    this._analyser.getFloatTimeDomainData(this._buf)
    let sq = 0
    for (let k = 0; k < this._buf.length; k++) sq += this._buf[k] * this._buf[k]
    const rms = Math.sqrt(sq / this._buf.length)
    return rms < 1e-7 ? -Infinity : 20 * Math.log10(rms)
  }

  dispose(): void {
    this._noise?.disconnect()
    this._filter.disconnect()
    this._gain.disconnect()
    this._analyser.disconnect()
  }
}
