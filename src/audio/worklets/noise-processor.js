/* ── Worklet de bruit coloré ──────────────────────────────────────────────────
   AudioWorkletProcessor sans import cross-thread : mulberry32 réimplémenté
   localement (même algo que prng.js). Génère du pink (Kellet, 7 pôles) ou du
   brown (intégrateur à fuite). La seed est passée via processorOptions au
   moment de la construction — garantit le déterminisme (I4). */

/* mulberry32 — même algo que prng.js, réimplémenté pour éviter les imports
   cross-thread interdits dans le contexte AudioWorkletProcessor. */
function makePrng(seed) {
  let state = seed >>> 0
  return function aléa() {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

class NoiseProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options)
    const opts = options?.processorOptions ?? {}
    this._couleur = opts.couleur ?? 'pink'
    this._prng = makePrng(opts.seed ?? 1)

    /* État Kellet — 7 pôles pour le bruit rose */
    this._b0 = this._b1 = this._b2 = this._b3 = 0
    this._b4 = this._b5 = this._b6 = 0
    /* État brun — intégrateur à fuite */
    this._brun = 0
  }

  process(_, outputs) {
    const canal = outputs[0][0]
    if (!canal) return true
    const r = this._prng
    if (this._couleur === 'pink') {
      let { _b0: b0, _b1: b1, _b2: b2, _b3: b3, _b4: b4, _b5: b5, _b6: b6 } = this
      for (let i = 0; i < canal.length; i++) {
        const blanc = r() * 2 - 1
        b0 = 0.99886 * b0 + blanc * 0.0555179
        b1 = 0.99332 * b1 + blanc * 0.0750759
        b2 = 0.96900 * b2 + blanc * 0.1538520
        b3 = 0.86650 * b3 + blanc * 0.3104856
        b4 = 0.55000 * b4 + blanc * 0.5329522
        b5 = -0.7616 * b5 - blanc * 0.0168980
        const pink = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + blanc * 0.5362) * 0.11
        b6 = blanc * 0.115926
        canal[i] = pink
      }
      this._b0 = b0; this._b1 = b1; this._b2 = b2; this._b3 = b3
      this._b4 = b4; this._b5 = b5; this._b6 = b6
    } else {
      /* Brown : intégrateur à fuite (leaky integrator) */
      let brun = this._brun
      for (let i = 0; i < canal.length; i++) {
        const blanc = r() * 2 - 1
        brun = (brun + 0.02 * blanc) / 1.02
        canal[i] = brun * 3.5
      }
      this._brun = brun
    }
    return true
  }
}

registerProcessor('noise-processor', NoiseProcessor)
