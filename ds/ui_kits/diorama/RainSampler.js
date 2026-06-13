import { ResonanceAudio } from 'resonance-audio'
import { MATERIALS, materialById } from './materials.js'
import { makeCoords, headInputToWorld, worldToResonance, LISTENER_FORWARD, HEAD_FACES } from './coords.js'

const COOLDOWN_MS = 80   // anti-mitraillage PAR CELLULE (0,5 m) — §13.4
const WINDOW_MS   = 400  // fenêtre glissante du réservoir (débit du DebugHUD) — §13.3
const POOL_SIZE   = 48   /* voix Resonance pré-créées à l'init, PARTAGÉES entre
  matériaux. Dimensionnement : concurrence ≈ débit × durée de grain — avec des
  queues de samples longues (300-500 ms et plus), ~50 imp/s × 0,4 s ≈ 20 voix
  en moyenne, pics ~2× → 48. Surveiller le compteur de VOLS du DebugHUD : s'il
  grimpe, augmenter ; s'il reste à 0 avec une occupation < 50 %, réduire. Les
  durées réelles des banques sont loguées au chargement. Mobile : 12-16. */
const AMBISONIC_ORDER = 3 /* ordre 3 = 16 canaux d'encodage par voix + décodeur
  binaural partagé (coût fixe). Passer à 1 ou 2 sur mobile pour alléger. */
const STEAL_FADE_S = 0.005 /* vol de voix : fade-out de 5 ms du grain le plus
  ancien avant réaffectation — inaudible, jamais de clic (standard sampler). */
const Y_FLATTEN   = 0.25 /* écrasement de la composante verticale tête→grain :
  les impacts sont au sol et l'auditeur au-dessus, et un angle d'élévation trop
  piqué écrase les indices gauche/droite HRTF (correction 3). Appliqué au
  DÉCLENCHEMENT (la position d'un grain ne bouge plus ensuite). Provisoire :
  le relief (phase 5) apportera de vraies hauteurs d'impact. */

/* ── Réservoir de cadence par matériau ───────────────────────────────────────
   Anneau des timestamps des derniers impacts : expose le débit (impacts/s)
   pour le DebugHUD. Les positions n'y vivent plus : chaque grain porte la
   sienne (cf. VoicePool), il n'y a plus de placement différé à la frame. */
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
    return n / (window / 1000) // impacts/s
  }
}

/* ── Pool de voix spatialisées — le grain POSSÈDE sa position ────────────────
   POOL_SIZE sources Resonance créées UNE fois à l'init, jamais détruites
   ensuite (zéro churn de nœuds, zéro pression GC côté audio). Cycle de vie :

     acquire → setPosition sur l'impact (UNE seule fois) → grain joue
             → onended → release.

   La position d'une voix ne bouge JAMAIS pendant qu'un grain y joue : fini
   les voix-secteurs partagées que update() téléportait sous les grains en
   cours (télescopage spatial, cf. révision 2 du DIAGNOSTIC). Direction,
   distance et enveloppement émergent de la géométrie réelle, goutte par
   goutte — chaque grain sonne d'où il est tombé, jusqu'au bout. */
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
    this.grainSrc = null   // BufferSource en cours (pour le vol de voix)
    this.grainGain = null  // gain du grain en cours (pour le fade de vol)
    this.startedAt = 0
    this.busy = false
    this.grainId = 0       // id du grain en cours (traçage causal)
    this.impactId = 0      // id de l'impact qui a déclenché ce grain (traçage)
  }
}

class VoicePool {
  constructor(scene, ctx, meter) {
    this.ctx = ctx
    this.meter = meter // unités-monde par mètre, pour min/maxDistance
    this.voices = []
    this.free = []     // indices des voix libres (LIFO)
    for (let i = 0; i < POOL_SIZE; i++) {
      this.voices.push(new Voice(scene, ctx, i))
      this.free.push(i)
    }
    this.stealCount = 0
    this._buf = new Float32Array(256)
  }

  /* Joue un grain depuis la position MONDE de son impact. Acquiert une voix
     libre — ou vole la plus ancienne (fade 5 ms) si le pool est épuisé. Les
     distances d'atténuation du matériau sont posées à l'acquisition : le pool
     reste partagé, le matériau garde ses paramètres (§12). */
  play(buf, gainDb, detune, pos, material, now, trace = {}) {
    const { rec, grainId = 0, impactId = 0 } = trace
    let v, stolen = null
    if (this.free.length) {
      v = this.voices[this.free.pop()]
    } else {
      v = this._oldest()
      /* Le grain volé est coupé ICI : on capture son identité AVANT réaffectation
         (son onended est désarmé par _cut, il n'émettra pas de `release`). */
      stolen = { voice: v.index, grain: v.grainId, impact: v.impactId, age: +(now - v.startedAt).toFixed(1) }
      this._cut(v)
      this.stealCount++
    }

    v.busy = true
    v.startedAt = now
    v.materialId = material.id
    v.grainId = grainId
    v.impactId = impactId
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
    /* Le garde `grainSrc === src` évite qu'un onended périmé (voix volée puis
       réaffectée) ne libère la voix sous le grain suivant. */
    src.onended = () => {
      if (v.grainSrc !== src) return
      rec?.emit('release', { grain: grainId, impact: impactId, voice: v.index, reason: 'ended' })
      this._release(v)
    }
    src.start()

    if (stolen) rec?.emit('steal', { grain: grainId, impact: impactId, victim: stolen, fade: STEAL_FADE_S })
    rec?.emit('acquire', { grain: grainId, impact: impactId, voice: v.index, mat: material.id, stolen: !!stolen })
  }

  /* Pool plein ⇒ toutes les voix sont occupées : la plus ancienne est la
     meilleure candidate (son grain est le plus proche de sa fin naturelle). */
  _oldest() {
    let best = this.voices[0]
    for (const v of this.voices) if (v.startedAt < best.startedAt) best = v
    return best
  }

  /* Vol de voix : fondu de 5 ms puis stop — l'ancien grain s'éteint proprement
     (pas de clic), son onended est désarmé pour ne pas libérer la voix
     fraîchement réaffectée. */
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

  /* Niveau RMS (dB) d'une voix — mesuré AVANT le pipeline Resonance. */
  level(v) {
    v.analyser.getFloatTimeDomainData(this._buf)
    let sq = 0
    for (let i = 0; i < this._buf.length; i++) sq += this._buf[i] * this._buf[i]
    const rms = Math.sqrt(sq / this._buf.length)
    return rms < 1e-8 ? -Infinity : 20 * Math.log10(rms)
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
    this.pool  = null
    this.reservoirs    = new Map()
    this.triggerCounts = new Map()
    this._headWorld = { x: 0, y: 0, z: 0 }
    this._cellCooldown = new Map() // clé cellule (0,5 m) → dernier déclenchement
    this._cols = Math.ceil(size / this.coords.CELL)
    this.recorder = null // boîte noire optionnelle (TraceRecorder) — cf. traceSample
  }

  /* Branche/débranche la boîte noire. Quand un recorder est posé ET en cours
     d'enregistrement, toute la chaîne (décisions, rejets, voix, vols) émet ses
     événements. Sinon le coût est nul (gardes `rec?.` + `recording`). */
  setRecorder(rec) { this.recorder = rec }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)()

    const h = this.half
    this.scene = new ResonanceAudio(this.ctx, {
      ambisonicOrder: AMBISONIC_ORDER,
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

    /* Orientation de l'auditeur posée UNE fois et FIXE : la tête est l'input de
       référence, elle ne tourne pas avec l'orbite caméra (spin). Le champ sonore
       reste ancré au monde — orbiter la vue change le point de vue, pas l'écoute. */
    this.scene.setListenerOrientation(...worldToResonance(LISTENER_FORWARD), 0, 1, 0)

    /* Tap de mesure sur la sortie master — niveau RÉEL post-atténuation (le seul
       qui reflète ce qu'on entend, contrairement aux analysers par voix qui sont
       en amont du pipeline Resonance). */
    this._masterAnalyser = this.ctx.createAnalyser()
    this._masterAnalyser.fftSize = 256
    this._masterAnalyser.smoothingTimeConstant = 0.8
    this._masterBuf = new Float32Array(256)
    masterGain.connect(this._masterAnalyser)

    /* UN pool de voix partagé (budget fixe, indépendant du terrain et de la
       pluie) + un réservoir de cadence PAR MATÉRIAU pour le DebugHUD. */
    this.pool = new VoicePool(this.scene, this.ctx, this.coords.METER)
    for (const m of MATERIALS) {
      this.reservoirs.set(m.id, new ImpactReservoir(64))
      this.triggerCounts.set(m.id, 0)
    }

    await Promise.all(MATERIALS.map(m => this._loadBank(m.id, m.urls)))
    this.ready = true
  }

  async _loadBank(name, urls) {
    const buffers = await Promise.all(urls.map(u => this._decode(u)))
    this.banks[name] = buffers.filter(Boolean)
    /* Durées loguées pour dimensionner POOL_SIZE : concurrence ≈ débit × durée. */
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

  /* nx, ny, nz : coordonnées normalisées [-1, 1] provenant de DioramaApp.
     Input auditeur → monde Three.js → Resonance, via les conversions uniques
     de coords.js (le « piège du Z » vit là, pas ici). */
  setListenerPosition(nx, ny, nz) {
    if (!this.scene) return
    const world = headInputToWorld({ x: nx, y: ny, z: nz }, this.limit)
    this._headWorld = world
    this.scene.setListenerPosition(...worldToResonance(world))
  }

  trigger(surface, { x = 0, z = 0, gainDb = 0, detune = 0, impactId = 0 } = {}) {
    const rec = this.recorder
    /* Chaque sortie anticipée est un NON-SON : journalisé avec sa raison, car
       « pourquoi cet impact n'a pas sonné » est l'essentiel du débogage. */
    if (!this.ready || this.ctx.state === 'suspended') {
      rec?.emit('reject', { impact: impactId, surface, reason: this.ready ? 'suspended' : 'not-ready' })
      return
    }
    const bank = this.banks[surface]
    if (!bank?.length) { rec?.emit('reject', { impact: impactId, surface, reason: 'no-bank' }); return }
    const material = materialById(surface)
    if (!material) { rec?.emit('reject', { impact: impactId, surface, reason: 'no-material' }); return }

    /* Cooldown PAR CELLULE (0,5 m) — remplace le cooldown par zone (§13.4) */
    const key = this._cellKey(x, z)
    const now = performance.now()
    if (now - (this._cellCooldown.get(key) || 0) < COOLDOWN_MS) {
      rec?.emit('reject', { impact: impactId, surface, reason: 'cooldown', cell: key })
      return
    }
    this._cellCooldown.set(key, now)

    /* Position MONDE du grain : impact au sol, composante verticale écrasée
       vers la tête (Y_FLATTEN, correction 3) — figée ICI, au déclenchement,
       puisque la position d'un grain ne bouge plus jamais ensuite. */
    const head = this._headWorld
    const pos = { x, y: head.y + (this.coords.ground - head.y) * Y_FLATTEN, z }
    this.reservoirs.get(surface).add(now)
    this.triggerCounts.set(surface, this.triggerCounts.get(surface) + 1)
    const idx = Math.floor(Math.random() * bank.length)
    const buf = bank[idx]
    /* Grain accepté : on lui donne un id et on journalise TOUTES ses
       caractéristiques de déclenchement. `sample`+`detune` rendent le grain
       reproductible (relecture déterministe : même son sans audio enregistré). */
    const grainId = rec ? rec.nextGrainId() : 0
    rec?.emit('trigger', {
      impact: impactId, grain: grainId, surface,
      x: Math.round(x), y: Math.round(pos.y), z: Math.round(z),
      gainDb, detune: +detune.toFixed(1),
      sample: idx, dur: +buf.duration.toFixed(3),
      minDist: material.minDistance, maxDist: material.maxDistance,
    })
    this.pool.play(buf, gainDb, detune, pos, material, now, { rec, grainId, impactId })
  }

  /* ── Échantillon de trace — les 6 pistes ────────────────────────────────────
     Appelé à cadence fixe par la boucle d'enregistrement. Pour chaque voix
     ACTIVE : enveloppe RMS (avec grain, impact, position) — on suit l'amplitude
     d'un son tout au long de sa vie. Puis projection de toutes les voix sur les
     6 faces de la tête : un événement `faces` par tick = un point sur chacune
     des 6 timelines. Les niveaux par face sont aussi reconstituables hors-ligne
     depuis les `env` (position) + l'état auditeur (deltas) ; `faces` est le
     résumé prêt à tracer. */
  traceSample(rec) {
    if (!rec?.recording || !this.pool) return
    const head = this._headWorld
    const faceSum = new Array(HEAD_FACES.length).fill(0)
    for (const v of this.pool.voices) {
      if (!v.busy) continue
      const db = this.pool.level(v)
      if (!isFinite(db)) continue
      rec.emit('env', {
        grain: v.grainId, impact: v.impactId, voice: v.index, mat: v.materialId,
        db: +db.toFixed(2),
        x: Math.round(v.pos.x), y: Math.round(v.pos.y), z: Math.round(v.pos.z),
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
      head: { x: Math.round(head.x), y: Math.round(head.y), z: Math.round(head.z) },
      busy: this.pool.voices.reduce((n, v) => n + (v.busy ? 1 : 0), 0),
    })
  }

  /* État par matériau pour le DebugHUD : débit, niveau cumulé et voix ACTIVES
     du matériau (positions réelles des grains en cours de lecture). */
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

  /* Snapshot des voix pour l'overlay 3D de debug : position MONDE réelle de
     chaque voix (celle entendue, Y_FLATTEN compris), matériau et niveau RMS.
     N'allouer qu'en mode debug — appelé depuis la boucle de rendu. */
  debugVoices() {
    if (!this.pool) return []
    return this.pool.voices.map(v => ({
      busy: v.busy,
      materialId: v.materialId,
      x: v.pos.x, y: v.pos.y, z: v.pos.z,
      level: v.busy ? this.pool.level(v) : -Infinity,
    }))
  }

  /* Occupation du pool (DebugHUD) : voix actives / budget, vols cumulés.
     Un compteur de vols qui grimpe = pool sous-dimensionné pour le débit. */
  poolStats() {
    if (!this.pool) return { busy: 0, size: POOL_SIZE, steals: 0 }
    let busy = 0
    for (const v of this.pool.voices) if (v.busy) busy++
    return { busy, size: POOL_SIZE, steals: this.pool.stealCount }
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
