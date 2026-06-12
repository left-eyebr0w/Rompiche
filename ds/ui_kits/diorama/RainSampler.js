import { ResonanceAudio } from 'resonance-audio'
import { MATERIALS } from './materials.js'
import { makeCoords, headInputToWorld, worldToResonance } from './coords.js'

const COOLDOWN_MS = 80   // anti-mitraillage PAR CELLULE (0,5 m) — §13.4
const WINDOW_MS   = 400  // fenêtre glissante du réservoir — §13.3
const VOICES      = 3    // K voix Resonance par matériau — §13.2

/* ── Couche 2 · réservoir d'impacts (anneau + fenêtre glissante) — §7 ────────
   Anneau des N derniers impacts {x,y,z,t}. Encode OÙ et à quelle CADENCE un
   matériau est frappé → sa position perçue, son étendue et son niveau. */
class ImpactReservoir {
  constructor(capacity = 64) {
    this.cap = capacity
    this.x = new Float32Array(capacity)
    this.y = new Float32Array(capacity)
    this.z = new Float32Array(capacity)
    this.t = new Float64Array(capacity)
    this.head = 0
    this.count = 0
  }

  add(x, y, z, t) {
    const i = this.head
    this.x[i] = x; this.y[i] = y; this.z[i] = z; this.t[i] = t
    this.head = (i + 1) % this.cap
    if (this.count < this.cap) this.count++
  }

  /* Impacts encore dans la fenêtre, pondérés par leur fraîcheur (1 → 0).
     Écrit dans `out` (réutilisé) pour éviter d'allouer chaque frame. */
  recent(now, window, out) {
    out.length = 0
    for (let k = 0; k < this.count; k++) {
      const age = now - this.t[k]
      if (age <= window) out.push({ x: this.x[k], y: this.y[k], z: this.z[k], w: 1 - age / window })
    }
    return out
  }

  rate(now, window) {
    let n = 0
    for (let k = 0; k < this.count; k++) if (now - this.t[k] <= window) n++
    return n / (window / 1000) // impacts/s
  }
}

/* ── Couche 3 · émetteur multi-position par matériau — §9 ────────────────────
   UN émetteur (K voix Resonance) par matériau. À chaque frame, depuis le nuage
   d'impacts récents et la tête : direction (voix proche), distance (atténuation
   réelle), spread (envergure angulaire). Les grains sont routés vers la voix la
   plus proche de leur point de chute. */
class MaterialEmitter {
  constructor(scene, ctx, material, coords) {
    this.material = material
    this.coords = coords
    this.triggerCount = 0
    this._buf = new Float32Array(256)
    const { METER, ground } = coords

    this.voices = []
    this.analysers = []
    this._pos = []
    for (let i = 0; i < VOICES; i++) {
      /* Atténuation RÉELLE (logarithmique ≈ exponentielle perçue) en distances
         métriques : min 0,5 m (≈ CELL), max 4 m (≈ la pièce). Fini le minDistance
         géant qui désactivait l'atténuation. */
      const src = scene.createSource({
        rolloff: 'logarithmic',
        minDistance: material.minDistance * METER,
        maxDistance: material.maxDistance * METER,
      })
      const an = ctx.createAnalyser()
      an.fftSize = 256
      an.smoothingTimeConstant = 0.8
      an.connect(src.input)
      const p = { x: 0, y: ground, z: 0 }
      src.setPosition(...worldToResonance(p))
      this.voices.push(src)
      this.analysers.push(an)
      this._pos.push(p)
    }
  }

  /* Replace les K voix depuis le nuage d'impacts récents + la tête (monde).
     - Direction d'ensemble = CENTROÏDE ANGULAIRE (résultante des azimuts) : le
       « plus proche » donnerait le bord intérieur d'une grande zone, près du
       centre, et tuerait le gauche/droite. Le plus proche ne sert qu'à la distance.
     - On raisonne en rayon HORIZONTAL (plan XZ) en gardant la hauteur réelle des
       impacts, pour ne pas compter deux fois la chute verticale jusqu'au sol. */
  update(pts, head) {
    if (!pts.length) return

    let nd = Infinity
    let sumY = 0, sumRH = 0, sumW = 0
    let mx = 0, mz = 0 // résultante des azimuts → direction + concentration
    for (const p of pts) {
      const dx = p.x - head.x, dy = p.y - head.y, dz = p.z - head.z
      const d2 = dx * dx + dy * dy + dz * dz
      if (d2 < nd) nd = d2
      const az = Math.atan2(dz, dx)
      mx += Math.cos(az); mz += Math.sin(az)
      sumY += p.y * p.w
      sumRH += Math.hypot(dx, dz) * p.w
      sumW += p.w
    }
    const R = Math.hypot(mx, mz) / pts.length // concentration angulaire [0,1]
    const meanAz = Math.atan2(mz, mx)         // direction d'ensemble
    const spread = Math.PI * (1 - R)          // envergure : étroit si concentré, large si on est dessus
    const meanY = sumW > 0 ? sumY / sumW : head.y
    const meanRH = Math.max(
      sumW > 0 ? sumRH / sumW : Math.sqrt(nd),
      this.coords.CELL, // évite un rayon nul quand on est pile sur la zone
    )

    // K voix réparties sur l'arc [meanAz − spread/2, meanAz + spread/2]
    for (let i = 0; i < VOICES; i++) {
      const frac = VOICES > 1 ? (i / (VOICES - 1)) - 0.5 : 0 // [-0.5, 0.5]
      const az = meanAz + frac * spread
      this._set(i, head.x + Math.cos(az) * meanRH, meanY, head.z + Math.sin(az) * meanRH)
    }
  }

  _set(i, x, y, z) {
    const p = this._pos[i]
    p.x = x; p.y = y; p.z = z
    this.voices[i].setPosition(...worldToResonance(p))
  }

  /* Joue un grain via la voix dont la position courante est la plus proche du
     point de chute → le grain part de la bonne direction. */
  triggerGrain(ctx, buf, gainDb, detune, pos) {
    let vi = 0, best = Infinity
    for (let i = 0; i < VOICES; i++) {
      const p = this._pos[i]
      const dx = p.x - pos.x, dz = p.z - pos.z
      const d = dx * dx + dz * dz
      if (d < best) { best = d; vi = i }
    }
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.detune.value = detune
    const g = ctx.createGain()
    g.gain.value = gainDb <= -60 ? 0 : Math.pow(10, gainDb / 20)
    src.connect(g).connect(this.analysers[vi])
    src.start()
    this.triggerCount++
  }

  levels() {
    return this.analysers.map((a) => {
      a.getFloatTimeDomainData(this._buf)
      let sq = 0
      for (let i = 0; i < this._buf.length; i++) sq += this._buf[i] * this._buf[i]
      const rms = Math.sqrt(sq / this._buf.length)
      return rms < 1e-8 ? -Infinity : 20 * Math.log10(rms)
    })
  }
}

export class RainSampler {
  constructor(size = 380) {
    this.ctx   = null
    this.scene = null
    this.banks = Object.fromEntries(MATERIALS.map(m => [m.id, []]))
    this.ready = false
    this.coords = makeCoords(size)
    this.half  = this.coords.half
    this.limit = this.coords.limit
    this.emitters   = new Map()
    this.reservoirs = new Map()
    this._headWorld = { x: 0, y: 0, z: 0 }
    this._cellCooldown = new Map() // clé cellule (0,5 m) → dernier déclenchement
    this._cols = Math.ceil(size / this.coords.CELL)
    this._scratch = []             // réutilisé par recent() chaque frame
    this._raf = 0
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()

    const h = this.half
    this.scene = new ResonanceAudio(this.ctx, {
      ambisonicOrder: 3,
      dimensions: { width: h * 2, height: h * 2, depth: h * 2 },
      materials: {
        left: 'transparent', right: 'transparent',
        front: 'transparent', back: 'transparent',
        up: 'transparent',   down: 'grass',
      },
    })
    /* Gain de compensation : Resonance Audio atténue le signal via son pipeline ambisonique */
    const masterGain = this.ctx.createGain()
    masterGain.gain.value = 3
    this.scene.output.connect(masterGain).connect(this.ctx.destination)

    /* Tap de mesure sur la sortie master — niveau RÉEL post-atténuation (le seul
       qui reflète ce qu'on entend, contrairement aux analysers par voix qui sont
       en amont du pipeline Resonance). */
    this._masterAnalyser = this.ctx.createAnalyser()
    this._masterAnalyser.fftSize = 256
    this._masterAnalyser.smoothingTimeConstant = 0.8
    this._masterBuf = new Float32Array(256)
    masterGain.connect(this._masterAnalyser)

    /* Un émetteur + un réservoir PAR MATÉRIAU (≈ nombre de matériaux, jamais le
       nombre de cellules). Plus de zones fixes ni de hack gauche/droite. */
    for (const m of MATERIALS) {
      this.emitters.set(m.id, new MaterialEmitter(this.scene, this.ctx, m, this.coords))
      this.reservoirs.set(m.id, new ImpactReservoir(64))
    }

    await Promise.all(MATERIALS.map(m => this._loadBank(m.id, m.urls)))
    this.ready = true
    this._startLoop()
  }

  _startLoop() {
    const tick = () => {
      this._raf = requestAnimationFrame(tick)
      const now = performance.now()
      for (const m of MATERIALS) {
        const pts = this.reservoirs.get(m.id).recent(now, WINDOW_MS, this._scratch)
        this.emitters.get(m.id).update(pts, this._headWorld)
      }
    }
    this._raf = requestAnimationFrame(tick)
  }

  async _loadBank(name, urls) {
    const buffers = await Promise.all(urls.map(u => this._decode(u)))
    this.banks[name] = buffers.filter(Boolean)
    console.log(`[RainSampler] ${name} : ${this.banks[name].length}/${urls.length} samples chargés`)
  }

  async _decode(url) {
    try {
      const res = await fetch(url)
      const arr = await res.arrayBuffer()
      return await this.ctx.decodeAudioData(arr)
    } catch (e) {
      console.warn(`[RainSampler] échec : ${url}`, e)
      return null
    }
  }

  _cellKey(x, z) {
    const c = Math.floor((x + this.half) / this.coords.CELL)
    const r = Math.floor((z + this.half) / this.coords.CELL)
    return r * this._cols + c
  }

  /* nx, ny, nz : coordonnées normalisées [-1, 1] provenant de DioramaApp.
     Input auditeur → monde Three.js → Resonance, via les conversions uniques
     de coords.js (le « piège du Z » vit là, pas ici). */
  setListenerPosition(nx, ny, nz) {
    if (!this.scene) return
    const world = headInputToWorld({ x: nx, y: ny, z: nz }, this.limit)
    this._headWorld = world
    this.scene.setListenerPosition(...worldToResonance(world))
  }

  trigger(surface, { x = 0, z = 0, gainDb = 0, detune = 0 } = {}) {
    if (!this.ready || this.ctx.state === 'suspended') return
    const bank = this.banks[surface]
    if (!bank?.length) return
    const emitter = this.emitters.get(surface)
    if (!emitter) return

    /* Cooldown PAR CELLULE (0,5 m) — remplace le cooldown par zone (§13.4) */
    const key = this._cellKey(x, z)
    const now = performance.now()
    if (now - (this._cellCooldown.get(key) || 0) < COOLDOWN_MS) return
    this._cellCooldown.set(key, now)

    /* Alimente le réservoir (position monde, au sol) puis joue le grain */
    const pos = { x, y: this.coords.ground, z }
    this.reservoirs.get(surface).add(pos.x, pos.y, pos.z, now)
    const buf = bank[Math.floor(Math.random() * bank.length)]
    emitter.triggerGrain(this.ctx, buf, gainDb, detune, pos)
  }

  /* État par matériau pour le DebugHUD (niveaux mesurés + positions des voix). */
  materialMeters() {
    const now = performance.now()
    return MATERIALS.map((m) => {
      const e = this.emitters.get(m.id)
      const levels = e.levels()
      let lin = 0
      for (const db of levels) if (isFinite(db)) lin += Math.pow(10, db / 20)
      return {
        id: m.id,
        label: m.label,
        level: lin < 1e-8 ? -Infinity : 20 * Math.log10(lin),
        triggerCount: e.triggerCount,
        rate: this.reservoirs.get(m.id).rate(now, WINDOW_MS),
        voices: e._pos.map((p, i) => ({ x: p.x, y: p.y, z: p.z, level: levels[i] })),
      }
    })
  }

  /* Niveau RÉEL de la sortie master (post-atténuation) — ce qu'on entend. */
  getMasterLevel() {
    const a = this._masterAnalyser
    if (!a) return -Infinity
    a.getFloatTimeDomainData(this._masterBuf)
    let sq = 0
    for (let i = 0; i < this._masterBuf.length; i++) sq += this._masterBuf[i] * this._masterBuf[i]
    const rms = Math.sqrt(sq / this._masterBuf.length)
    return rms < 1e-8 ? -Infinity : 20 * Math.log10(rms)
  }

  resume() { return this.ctx?.resume() }
}
