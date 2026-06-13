import { ResonanceAudio } from 'resonance-audio'
import { MATERIALS, materialById } from './materials.js'
import { makeCoords, headInputToWorld, worldToResonance, LISTENER_FORWARD, HEAD_FACES } from './coords.js'
import { makePrng } from './prng.js'
import { makeWorldConfig, résoudreCouches } from './worldConfig.js'
import { bakeImpactPoints, pickImpact } from './BakedSet.js'
import { DiffuseBed, resolveBedConfig } from './DiffuseBed.js'
import { SectorField } from './SectorField.js'

const COOLDOWN_MS = 80   // anti-mitraillage PAR CELLULE (0,5 m) — §13.4
const WINDOW_MS   = 400  // fenêtre glissante du réservoir (débit du DebugHUD) — §13.3
const STEAL_FADE_S = 0.005 /* vol de voix : fade-out de 5 ms — inaudible, jamais de clic. */

/* Facteur de débit Poisson par matériau — calibrable */
const MAT_FACTOR = { metal: 1, bache: 1, terre: 1 }

/* ── Réservoir de cadence par matériau ───────────────────────────────────────*/
class ImpactReservoir {
  constructor(capacity = 64) {
    this.cap = capacity
    this.t = new Float64Array(capacity)
    this.head = 0
    this.count = 0
  }
  add(t) {
    this.t[this.head] = t
    this.head = (this.head + 1) % this.cap
    if (this.count < this.cap) this.count++
  }
  rate(now, window) {
    let n = 0
    for (let k = 0; k < this.count; k++) if (now - this.t[k] <= window) n++
    return n / (window / 1000)
  }
}

/* ── Pool de voix spatialisées ───────────────────────────────────────────────*/
class Voice {
  constructor(scene, ctx, index) {
    this.index = index
    this.src = scene.createSource({ rolloff: 'logarithmic' })
    this.analyser = ctx.createAnalyser()
    this.analyser.fftSize = 256
    this.analyser.smoothingTimeConstant = 0.8
    this.analyser.connect(this.src.input)
    this.pos = { x: 0, y: 0, z: 0 }
    this.materialId = null
    this.grainSrc = null
    this.grainGain = null
    this.startedAt = 0
    this.busy = false
    this.grainId = 0
    this.impactId = 0
    this.gainDb = 0   // pour la priorité
    this.dist = 0     // distance à la tête au moment de l'acquisition
  }
}

class VoicePool {
  constructor(scene, ctx, meter, size) {
    this.ctx = ctx
    this.meter = meter
    this.voices = []
    this.free = []
    for (let i = 0; i < size; i++) {
      this.voices.push(new Voice(scene, ctx, i))
      this.free.push(i)
    }
    this.stealCount = 0
    this._buf = new Float32Array(256)
  }

  play(buf, gainDb, detune, pos, material, now, trace = {}, head, w, seuilWeakDb, r2) {
    const { rec, grainId = 0, impactId = 0 } = trace
    let v, stolen = null
    if (this.free.length) {
      v = this.voices[this.free.pop()]
    } else {
      v = this._lowestPriority(head, w)
      const remaining = +(buf.duration * 1000 - (now - v.startedAt)).toFixed(1)
      const victimPrio = this._priority(v, head, w, r2)
      stolen = {
        voice: v.index, grain: v.grainId, impact: v.impactId,
        age: +(now - v.startedAt).toFixed(1),
        remaining: Math.max(0, remaining),
        prio: +victimPrio.toFixed(4),
      }
      this._cut(v)
      this.stealCount++
    }

    const dist = Math.hypot(pos.x - head.x, pos.y - head.y, pos.z - head.z)
    v.busy = true
    v.startedAt = now
    v.materialId = material.id
    v.grainId = grainId
    v.impactId = impactId
    v.gainDb = gainDb
    v.dist = dist
    v.pos.x = pos.x; v.pos.y = pos.y; v.pos.z = pos.z
    v.src.setMinDistance(material.minDistance * this.meter)
    v.src.setMaxDistance(material.maxDistance * this.meter)
    v.src.setPosition(...worldToResonance(v.pos))

    const src = this.ctx.createBufferSource()
    src.buffer = buf
    src.detune.value = detune
    const g = this.ctx.createGain()
    g.gain.value = gainDb <= -60 ? 0 : Math.pow(10, gainDb / 20)
    src.connect(g).connect(v.analyser)
    v.grainSrc = src
    v.grainGain = g
    src.onended = () => {
      if (v.grainSrc !== src) return
      rec?.emit('release', { grain: grainId, impact: impactId, voice: v.index, reason: 'ended' })
      this._release(v)
    }
    src.start()

    const db = this.level(v)
    const weak = isFinite(db) && db < seuilWeakDb

    if (stolen) rec?.emit('steal', { grain: grainId, impact: impactId, victim: stolen, fade: STEAL_FADE_S })
    rec?.emit('acquire', {
      grain: grainId, impact: impactId, voice: v.index,
      mat: material.id, stolen: !!stolen, weak,
    })
  }

  /* Priorité d'une voix (§5.3). Plus la priorité est haute, moins on vole cette voix. */
  _priority(v, head, w, r2) {
    const gainNorm = Math.min(1, Math.max(0, (v.gainDb + 60) / 60))
    const distNorm = Math.min(1, v.dist / (r2 || 1))
    const âgeNorm  = Math.min(1, (performance.now() - v.startedAt) / 1000)
    return w.w_gain * gainNorm + w.w_dist * (1 - distNorm) + w.w_att * 1 - w.w_age * âgeNorm
  }

  /* Vol par priorité minimale (remplace _oldest). */
  _lowestPriority(head, w) {
    const r2 = 1 // normalisé dans _priority ; passé implicitement via dist
    let best = null, bestP = Infinity
    for (const v of this.voices) {
      if (!v.busy) continue
      const p = this._priority(v, head, w, r2)
      if (p < bestP) { bestP = p; best = v }
    }
    return best ?? this.voices[0]
  }

  _cut(v) {
    const t = this.ctx.currentTime
    if (v.grainGain) {
      v.grainGain.gain.cancelScheduledValues(t)
      v.grainGain.gain.setValueAtTime(v.grainGain.gain.value, t)
      v.grainGain.gain.linearRampToValueAtTime(0, t + STEAL_FADE_S)
    }
    if (v.grainSrc) {
      v.grainSrc.onended = null
      try { v.grainSrc.stop(t + STEAL_FADE_S) } catch { /* déjà stoppé */ }
    }
  }

  _release(v) {
    v.busy = false
    v.grainSrc = null
    v.grainGain = null
    v.materialId = null
    this.free.push(v.index)
  }

  level(v) {
    v.analyser.getFloatTimeDomainData(this._buf)
    let sq = 0
    for (let i = 0; i < this._buf.length; i++) sq += this._buf[i] * this._buf[i]
    const rms = Math.sqrt(sq / this._buf.length)
    return rms < 1e-8 ? -Infinity : 20 * Math.log10(rms)
  }
}

export class RainSampler {
  constructor(worldCfgOrSize = 380) {
    /* Rétrocompatibilité : accepte un nombre (ancienne API) ou un WorldConfig */
    const worldCfg = (typeof worldCfgOrSize === 'number')
      ? makeWorldConfig({ preset: 'diorama', seed: 1, _size: worldCfgOrSize })
      : worldCfgOrSize

    this.cfg    = worldCfg
    this.ctx    = null
    this.scene  = null
    this.banks  = Object.fromEntries(MATERIALS.map(m => [m.id, []]))
    this.ready  = false
    this.coords = makeCoords(worldCfg.size)
    this.half   = this.coords.half
    this.limit  = this.coords.limit
    this.pool   = null
    this.prng   = makePrng(worldCfg.seed)
    this.bands  = résoudreCouches(this.coords.worldRadius, worldCfg)
    this.baked  = null // posé par setTerrain() avant init()
    this.reservoirs    = new Map()
    this.triggerCounts = new Map()
    this._headWorld    = { x: 0, y: 0, z: 0 }
    this._cellCooldown = new Map()
    this._cols = Math.ceil(worldCfg.size / this.coords.CELL)
    this.recorder = null
    /* Round-robin seedé par matériau (évite Math.random dans le chemin audio) */
    this._rr = Object.fromEntries(MATERIALS.map(m => [m.id, 0]))
    /* Accumulateurs Poisson par matériau (intervalle restant avant prochain impact) */
    this._poissonAcc = Object.fromEntries(MATERIALS.map(m => [m.id, 0]))
    this._poissonNext = Object.fromEntries(MATERIALS.map(m => [m.id, 0]))
  }

  setTerrain(terrain) {
    this.baked = bakeImpactPoints(terrain, this.coords)
  }

  setRecorder(rec) { this.recorder = rec }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()

    /* T-1.3 / T-2.1 — Charger les worklets avant la scène (fallback silencieux) */
    try {
      await this.ctx.audioWorklet.addModule(
        new URL('./worklets/noise-processor.js', import.meta.url)
      )
      await this.ctx.audioWorklet.addModule(
        new URL('./worklets/granulator-processor.js', import.meta.url)
      )
      this._workletReady = true
    } catch (e) {
      console.warn('[RainSampler] worklet non chargé — couches 2/3 désactivées', e)
      this._workletReady = false
      this.recorder?.emit('reject', { reason: 'no-worklet' })
    }

    const h = this.half
    this.scene = new ResonanceAudio(this.ctx, {
      ambisonicOrder: this.cfg.ambisonicOrder ?? 3,
      dimensions: { width: h * 2, height: h * 2, depth: h * 2 },
      materials: {
        left: 'transparent', right: 'transparent',
        front: 'transparent', back: 'transparent',
        up: 'transparent',   down: 'grass',
      },
    })
    const masterGain = this.ctx.createGain()
    masterGain.gain.value = 3
    this._masterGain = masterGain
    this.scene.output.connect(masterGain).connect(this.ctx.destination)
    this.scene.setListenerOrientation(...worldToResonance(LISTENER_FORWARD), 0, 1, 0)

    this._masterAnalyser = this.ctx.createAnalyser()
    this._masterAnalyser.fftSize = 256
    this._masterAnalyser.smoothingTimeConstant = 0.8
    this._masterBuf = new Float32Array(256)
    masterGain.connect(this._masterAnalyser)

    const voices = this.cfg.layers.L1.voices
    this.pool = new VoicePool(this.scene, this.ctx, this.coords.METER, voices)
    for (const m of MATERIALS) {
      this.reservoirs.set(m.id, new ImpactReservoir(64))
      this.triggerCounts.set(m.id, 0)
    }

    await Promise.all(MATERIALS.map(m => this._loadBank(m.id, m.urls)))

    /* T-1.4 — Instancier la nappe diffuse */
    if (this._workletReady) {
      const bedCfg = resolveBedConfig(this.cfg, this.bands)
      this.bed = new DiffuseBed(this.ctx, masterGain, bedCfg, this.prng)
      this.bed.attachWorklet(bedCfg.noise)
    }

    /* T-2.3 — Instancier le champ de secteurs */
    if (this._workletReady) {
      this.sectors = new SectorField(
        this.ctx, this.scene, this.cfg, this.bands,
        this.prng.fork ? this.prng.fork() : this.prng,
        this.banks,
      )
    }

    this.ready = true

    /* Émet l'événement scale initial */
    this._emitScale()
  }

  /* T-1.5 — Pilote la nappe selon la météo courante. */
  setWeather(weather) {
    if (!this.bed) return
    this.bed.setWeather(weather, this.recorder?.stateVersion, this.recorder)
  }

  /* Reconfigure l'échelle sans recréer le contexte audio. */
  setScale(worldCfg) {
    this.cfg   = worldCfg
    this.coords = makeCoords(worldCfg.size)
    this.half  = this.coords.half
    this.limit = this.coords.limit
    this.prng  = makePrng(worldCfg.seed)
    this.bands = résoudreCouches(this.coords.worldRadius, worldCfg)
    /* T-1.6 — Collapse diorama : bascule le mode mince de la nappe */
    this.bed?.setMince(this.bands.collapse === 'diorama')
    this._emitScale()
  }

  _emitScale() {
    const { preset, size } = this.cfg
    const { r1, r2, overlap } = this.bands
    this.recorder?.emit('scale', { preset, size, r1, r2, overlap })
  }

  async _loadBank(name, urls) {
    const buffers = await Promise.all(urls.map(u => this._decode(u)))
    this.banks[name] = buffers.filter(Boolean)
    const durs = this.banks[name].map(b => b.duration)
    const mean = durs.length ? durs.reduce((a, b) => a + b, 0) / durs.length : 0
    const max  = durs.length ? Math.max(...durs) : 0
    console.log(`[RainSampler] ${name} : ${this.banks[name].length}/${urls.length} samples chargés` +
      ` · durée moy ${Math.round(mean * 1000)} ms · max ${Math.round(max * 1000)} ms`)
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

  setListenerPosition(nx, ny, nz) {
    if (!this.scene) return
    const world = headInputToWorld({ x: nx, y: ny, z: nz }, this.limit)
    this._headWorld = world
    this.scene.setListenerPosition(...worldToResonance(world))
  }

  /* Boucle Poisson (game thread). Appelée chaque frame avec dtMs.
     surfaceDensities = { metal, bache, terre } : activité de chaque surface (0 ou 1).
     density = multiplicateur global (0..1) depuis l'UI. */
  tickPoisson(dtMs, surfaceDensities, density = 1) {
    if (!this.ready || !this.baked || this.ctx?.state === 'suspended') return
    const rec = this.recorder

    for (const m of MATERIALS) {
      const sid = m.id
      const active = surfaceDensities[sid] !== false
      if (!active) { this._poissonNext[sid] = 0; continue }

      /* Surface exposée = nombre de points baked exposés pour ce matériau */
      const exposed = this.baked.points.filter(p => p.matériau === sid && p.expoCiel > 0).length
      if (!exposed) continue

      const λ = density * exposed * (MAT_FACTOR[sid] ?? 1) * 0.05 // grains/ms
      if (λ <= 0) continue

      this._poissonAcc[sid] = (this._poissonAcc[sid] || 0) + dtMs

      /* Tire autant d'impacts que l'intervalle de Poisson le permet */
      while (this._poissonAcc[sid] >= this._poissonNext[sid]) {
        this._poissonAcc[sid] -= this._poissonNext[sid]
        /* Prochain intervalle : distribution exponentielle (−ln(u)/λ) */
        const u = Math.max(1e-9, this.prng.aléa())
        this._poissonNext[sid] = -Math.log(u) / λ

        const point = pickImpact(this.baked, sid, this.prng)
        if (!point) continue

        const impactId = rec?.recording ? rec.nextImpactId() : 0
        if (impactId) {
          rec.emit('impact', {
            impact: impactId, surface: sid,
            x: Math.round(point.position.x),
            z: Math.round(point.position.z),
          })
        }

        /* Sélection sample seedée (round-robin + décalage PRNG) */
        const bank = this.banks[sid]
        if (!bank?.length) continue
        this._rr[sid] = (this._rr[sid] + 1 + Math.floor(this.prng.aléa() * bank.length)) % bank.length
        const idx = this._rr[sid]
        const buf = bank[idx]

        /* Detune depuis le PRNG (plus de Math.random) */
        const detune = (this.prng.aléa() - 0.5) * 40

        this.trigger(sid, {
          x: point.position.x,
          y: point.position.y,
          z: point.position.z,
          gainDb: 0,
          detune,
          impactId,
          _buf: buf,
          _idx: idx,
        })
      }
    }
  }

  trigger(surface, { x = 0, y = null, z = 0, gainDb = 0, detune = 0, impactId = 0, _buf, _idx } = {}) {
    const rec = this.recorder
    if (!this.ready || this.ctx.state === 'suspended') {
      rec?.emit('reject', { impact: impactId, surface, reason: this.ready ? 'suspended' : 'not-ready' })
      return
    }
    const bank = this.banks[surface]
    if (!bank?.length) { rec?.emit('reject', { impact: impactId, surface, reason: 'no-bank' }); return }
    const material = materialById(surface)
    if (!material) { rec?.emit('reject', { impact: impactId, surface, reason: 'no-material' }); return }

    const key = this._cellKey(x, z)
    const now = performance.now()
    if (now - (this._cellCooldown.get(key) || 0) < COOLDOWN_MS) {
      rec?.emit('reject', { impact: impactId, surface, reason: 'cooldown', cell: key })
      return
    }
    this._cellCooldown.set(key, now)

    /* Position réelle depuis le relief (y fourni par tickPoisson via pickImpact) */
    const head = this._headWorld
    const posY = (y !== null) ? y : this.coords.ground
    const pos = { x, y: posY, z }

    this.reservoirs.get(surface).add(now)
    this.triggerCounts.set(surface, this.triggerCounts.get(surface) + 1)

    /* T-2.4 — Routage par distance : Couche 1 < r1−overlap, Couche 2 r1..r2 */
    const dist = Math.hypot(pos.x - head.x, pos.y - head.y, pos.z - head.z)
    const { r1, r2, overlap } = this.bands

    if (this.sectors?.actif && dist >= r1 - overlap) {
      /* Impact lointain → alimente le débit du secteur (pas de voix héros) */
      if (dist < r2) {
        this.sectors.absorberImpact(pos, surface, head)
      }
      /* Au-delà de r2 : la nappe (Couche 3) porte la masse — rien à router */
      return
    }

    /* Sample : soit pré-sélectionné par tickPoisson, soit fallback seedé */
    let buf = _buf, idx = _idx
    if (!buf) {
      this._rr[surface] = (this._rr[surface] + 1 + Math.floor(this.prng.aléa() * bank.length)) % bank.length
      idx = this._rr[surface]
      buf = bank[idx]
    }

    const grainId = rec ? rec.nextGrainId() : 0
    rec?.emit('trigger', {
      impact: impactId, grain: grainId, surface,
      x: Math.round(x), y: Math.round(posY), z: Math.round(z),
      gainDb, detune: +detune.toFixed(1),
      sample: idx, dur: +buf.duration.toFixed(3),
      minDist: material.minDistance, maxDist: material.maxDistance,
    })

    const w = this.cfg.layers.L1.priorité
    const seuilWeakDb = this.cfg.layers.L1.seuilWeakDb
    this.pool.play(buf, gainDb, detune, pos, material, now, { rec, grainId, impactId }, head, w, seuilWeakDb, r2)
  }

  traceSample(rec) {
    if (!rec?.recording || !this.pool) return
    const head = this._headWorld
    const faceSum = new Array(HEAD_FACES.length).fill(0)
    const seuilWeakDb = this.cfg.layers.L1.seuilWeakDb
    for (const v of this.pool.voices) {
      if (!v.busy) continue
      const db = this.pool.level(v)
      if (!isFinite(db)) continue
      const weak = db < seuilWeakDb
      rec.emit('env', {
        grain: v.grainId, impact: v.impactId, voice: v.index, mat: v.materialId,
        db: +db.toFixed(2),
        x: Math.round(v.pos.x), y: Math.round(v.pos.y), z: Math.round(v.pos.z),
        weak,
      })
      const lin = Math.pow(10, db / 20)
      const dx = v.pos.x - head.x, dy = v.pos.y - head.y, dz = v.pos.z - head.z
      const l = Math.hypot(dx, dy, dz) || 1e-9
      for (let f = 0; f < HEAD_FACES.length; f++) {
        const n = HEAD_FACES[f].n
        const d = (n[0]*dx + n[1]*dy + n[2]*dz) / l
        if (d > 0) faceSum[f] += lin * d
      }
    }
    rec.emit('faces', {
      labels: HEAD_FACES.map(f => f.label),
      db: faceSum.map(s => s < 1e-8 ? null : +(20 * Math.log10(s)).toFixed(2)),
      head: {
        x: Math.round(head.x), y: Math.round(head.y), z: Math.round(head.z),
        fwd: [LISTENER_FORWARD.x, LISTENER_FORWARD.y, LISTENER_FORWARD.z],
        up:  [0, 1, 0],
      },
      busy: this.pool.voices.reduce((n, v) => n + (v.busy ? 1 : 0), 0),
      size: this.cfg.layers.L1.voices,
      steals: this.pool.stealCount,
    })
  }

  materialMeters() {
    const now = performance.now()
    return MATERIALS.map((m) => {
      const voices = []
      let lin = 0
      if (this.pool) {
        for (const v of this.pool.voices) {
          if (!v.busy || v.materialId !== m.id) continue
          const db = this.pool.level(v)
          if (isFinite(db)) lin += Math.pow(10, db / 20)
          voices.push({ x: v.pos.x, y: v.pos.y, z: v.pos.z, level: db })
        }
      }
      return {
        id: m.id,
        label: m.label,
        level: lin < 1e-8 ? -Infinity : 20 * Math.log10(lin),
        triggerCount: this.triggerCounts.get(m.id) ?? 0,
        rate: this.reservoirs.get(m.id)?.rate(now, WINDOW_MS) ?? 0,
        voices,
      }
    })
  }

  debugVoices() {
    if (!this.pool) return []
    return this.pool.voices.map(v => ({
      busy: v.busy,
      materialId: v.materialId,
      x: v.pos.x, y: v.pos.y, z: v.pos.z,
      level: v.busy ? this.pool.level(v) : -Infinity,
    }))
  }

  poolStats() {
    if (!this.pool) return { busy: 0, size: this.cfg.layers.L1.voices, steals: 0 }
    let busy = 0
    for (const v of this.pool.voices) if (v.busy) busy++
    return { busy, size: this.cfg.layers.L1.voices, steals: this.pool.stealCount }
  }

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
