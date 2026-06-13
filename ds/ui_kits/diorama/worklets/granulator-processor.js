/* ── Granulateur sectoriel (AudioWorkletProcessor) ────────────────────────────
   Un par secteur. Flux de grains courts déclenchés par Poisson seedé,
   enveloppe 30 ms (att 3 / chute 27), round-robin matériau pondéré,
   passe-bas 1 pôle piloté par l'occlusion. Zéro allocation dans process (I2). */

/* mulberry32 — réimplémenté (pas d'import cross-thread) */
function makePrng(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const POOL = 64        // grains pré-alloués
const MAT_IDS = ['metal', 'bache', 'terre']

class GranulatorProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super(options)
    const seed = options?.processorOptions?.seed ?? 1
    this._prng = makePrng(seed)
    this._ready = false   // en attente des banques

    /* Params (mis à jour par postMessage) */
    this._débit    = 0    // grains/s
    this._matMix   = { metal: 0.33, bache: 0.33, terre: 0.34 }
    this._occlusion = 0

    /* Banques — reçues via port (Float32Array[]) par matériau */
    this._banks = { metal: [], bache: [], terre: [] }
    /* Round-robin par matériau */
    this._rr = { metal: 0, bache: 0, terre: 0 }

    /* Poisson : position courante en échantillons + prochain déclenchement */
    this._sampPos   = 0
    this._nextFire  = 0

    /* Pool de grains — typed arrays, zéro new dans process */
    this._gActive   = new Uint8Array(POOL)
    this._gBufData  = new Array(POOL).fill(null)   // référence Float32Array
    this._gPos      = new Float64Array(POOL)
    this._gEnvPos   = new Int32Array(POOL)
    this._gEnvLen   = new Int32Array(POOL)
    this._gAttLen   = new Int32Array(POOL)
    this._gGain     = new Float32Array(POOL)
    this._gPitch    = new Float32Array(POOL)

    /* Passe-bas 1 pôle (occlusion) */
    this._lpState = 0

    this.port.onmessage = (e) => {
      const msg = e.data
      if (msg.type === 'banks') {
        this._banks = msg.banks
        this._sampleRate = msg.sampleRate
        this._ready = true
        this._scheduleNext()
        return
      }
      /* Mise à jour params météo/densité */
      if (msg.débit   !== undefined) this._débit    = msg.débit
      if (msg.matMix  !== undefined) this._matMix   = msg.matMix
      if (msg.occlusion !== undefined) this._occlusion = msg.occlusion
    }
  }

  _scheduleNext() {
    if (this._débit <= 0) { this._nextFire = Infinity; return }
    const u = Math.max(1e-9, this._prng())
    const sr = this._sampleRate || sampleRate
    this._nextFire = this._sampPos + Math.ceil(-Math.log(u) / this._débit * sr)
  }

  _pickMat() {
    const r = this._prng()
    let total = 0
    for (const id of MAT_IDS) total += (this._matMix[id] ?? 0)
    if (total <= 0) return 'metal'
    let thresh = r * total
    for (const id of MAT_IDS) {
      thresh -= (this._matMix[id] ?? 0)
      if (thresh <= 0) return id
    }
    return 'metal'
  }

  _fireGrain() {
    /* Cherche un slot libre */
    let slot = -1
    for (let g = 0; g < POOL; g++) if (!this._gActive[g]) { slot = g; break }
    if (slot < 0) return // pool plein — grain sacrifié

    const mat = this._pickMat()
    const bank = this._banks[mat]
    if (!bank?.length) return

    this._rr[mat] = (this._rr[mat] + 1) % bank.length
    const buf = bank[this._rr[mat]]
    if (!buf?.length) return

    const sr = this._sampleRate || sampleRate
    const envLen   = Math.round(0.030 * sr) // 30 ms
    const attLen   = Math.round(0.003 * sr) // 3 ms

    const pitch  = 0.9 + this._prng() * 0.2  // jitter ±10 %
    const gain   = (0.6 + this._prng() * 0.4) * (1 - this._occlusion * 0.8)

    this._gActive[slot]  = 1
    this._gBufData[slot] = buf
    this._gPos[slot]     = 0
    this._gEnvPos[slot]  = 0
    this._gEnvLen[slot]  = Math.min(envLen, buf.length)
    this._gAttLen[slot]  = attLen
    this._gGain[slot]    = gain
    this._gPitch[slot]   = pitch
  }

  process(_, outputs) {
    const out = outputs[0]?.[0]
    if (!out) return true
    if (!this._ready || this._débit <= 0) {
      out.fill(0)
      return true
    }

    const len = out.length
    for (let i = 0; i < len; i++) {
      this._sampPos++
      /* Poisson : déclencher un grain si on a dépassé l'échéance */
      while (this._sampPos >= this._nextFire) {
        this._fireGrain()
        this._scheduleNext()
      }

      /* Mixer tous les grains actifs */
      let sample = 0
      for (let g = 0; g < POOL; g++) {
        if (!this._gActive[g]) continue
        const buf      = this._gBufData[g]
        const envPos   = this._gEnvPos[g]
        const envLen   = this._gEnvLen[g]
        const attLen   = this._gAttLen[g]

        /* Enveloppe linéaire : montée / descente */
        let env
        if (envPos < attLen) {
          env = envPos / (attLen || 1)
        } else {
          const decLen = envLen - attLen
          env = decLen > 0 ? 1 - (envPos - attLen) / decLen : 0
        }
        env = Math.max(0, Math.min(1, env))

        /* Lecture avec interpolation linéaire (pitch) */
        const pos  = this._gPos[g]
        const idx  = pos | 0
        const frac = pos - idx
        const s0   = idx     < buf.length ? buf[idx]     : 0
        const s1   = idx + 1 < buf.length ? buf[idx + 1] : 0
        sample += (s0 + (s1 - s0) * frac) * env * this._gGain[g]

        this._gPos[g]    += this._gPitch[g]
        this._gEnvPos[g] += 1
        if (this._gEnvPos[g] >= envLen || this._gPos[g] >= buf.length) {
          this._gActive[g] = 0
        }
      }
      out[i] = sample
    }

    /* Passe-bas 1 pôle — coupure = 18000 − 16500·occlusion Hz */
    const fc   = 18000 - 16500 * Math.min(1, this._occlusion)
    const sr   = this._sampleRate || sampleRate
    const rc   = 1 / (2 * Math.PI * fc)
    const dt   = 1 / sr
    const alfa = dt / (rc + dt)
    let lp = this._lpState
    for (let i = 0; i < len; i++) {
      lp += alfa * (out[i] - lp)
      out[i] = lp
    }
    this._lpState = lp

    return true
  }
}

registerProcessor('granulator-processor', GranulatorProcessor)
