import { ResonanceAudio } from 'resonance-audio'
import { MATERIALS, materialById } from './materials.js'
import { makeCoords, headInputToWorld, worldToResonance, LISTENER_FORWARD, HEAD_FACES } from './coords.js'
import { makePrng } from './prng.js'
import { makeWorldConfig, résoudreCouches } from './worldConfig.js'
import { pickImpact } from './BakedSet.js'
import { makeDefaultWorld } from './World.js'
import { DiffuseBed, resolveBedConfig } from './DiffuseBed.js'
import { SectorField } from './SectorField.js'
import { LodController, FONDU_S } from './LodController.js'
import { resolveLodParams } from './lod.js'
import { makeRing, ORD } from './ringBuffer.js'

const COOLDOWN_MS = 80   // anti-mitraillage PAR CELLULE (0,5 m) — §13.4
const WINDOW_MS   = 400  // fenêtre glissante du réservoir (débit du DebugHUD) — §13.3
const STEAL_FADE_S = 0.005 /* vol de voix : fade-out de 5 ms — inaudible, jamais de clic. */

/* Facteur de débit Poisson par matériau — calibrable */
const MAT_FACTOR = { metal: 1, bache: 1, terre: 1 }

/* Plafond de grains générés PAR MATÉRIAU et PAR TICK, CALIBRÉ SUR LE POOL DE VOIX.
   λ ∝ nombre de points exposés : sur un grand monde (size 25 → 2500 points, et
   worldRadius ≈ r1 donc TOUT tombe en Couche 1), λ produit des dizaines de
   milliers de grains/s qui se battent pour ~N voix L1 → vol de voix permanent.
   Chaque grain coûte un pickImpact O(N) + (en cas de vol) un _cut Web Audio +
   un nouveau BufferSource : c'est CE churn qui fige l'onglet, pas le rendu.
   Le pool ne peut sonoriser que ~`voices` grains/frame ; au-delà tout est volé
   donc inaudible. On borne à voices/nbMatériaux par matériau (réparti équitablement)
   et on purge l'accumulateur pour éviter un backlog qui s'emballe. */
function maxGrainsPerTick(voices) {
  return Math.max(4, Math.ceil(voices / MATERIALS.length))
}

const EMPTY = Object.freeze([])

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

  /* T-4.7 — Attention : 1 si la voix est dans le champ avant de la tête, 0.4 sinon.
     Concentre le budget sur les sources audibles en face de l'oreille. */
  static _attention(vPos, head) {
    const dx = vPos.x - head.x, dz = vPos.z - head.z
    const l  = Math.hypot(dx, dz)
    if (l < 1e-6) return 1
    /* LISTENER_FORWARD = {0,0,-1} : le demi-espace avant est z < 0 côté auditeur */
    const dot = (dx * 0 + dz * (-1)) / l  // dot avec forward (0,0,-1) dans plan XZ
    return dot > 0 ? 1 : 0.4              // devant → 1, derrière → 0.4 (calibrable)
  }

  /* Priorité d'une voix (§5.3). Plus la priorité est haute, moins on vole cette voix. */
  _priority(v, head, w, r2) {
    const gainNorm = Math.min(1, Math.max(0, (v.gainDb + 60) / 60))
    const distNorm = Math.min(1, v.dist / (r2 || 1))
    const âgeNorm  = Math.min(1, (performance.now() - v.startedAt) / 1000)
    const attention = VoicePool._attention(v.pos, head)
    return w.w_gain * gainNorm + w.w_dist * (1 - distNorm) + w.w_att * attention - w.w_age * âgeNorm
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
      ? makeWorldConfig({ seed: 1 })
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
    this.world  = null // posé par setTerrain() — seule porte vers le terrain (WorldQuery)
    this._terrain = null // référence au terrain pour reconstruire le monde
    this._intensity = 0 // mis à jour par setWeather()
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
    /* Cadence L1 pilotée par le worklet-horloge (clock-processor) : la pluie ne
       gèle plus quand l'onglet perd le focus. Paramètres météo poussés par l'UI
       (setRainParams) et lus à chaque tick. clockDriven=false → fallback rAF. */
    this._rainParams = { rain: false, metal: true, bache: true, density: 1 }
    this.clockDriven = false
    this._lastTick = null
    /* T-4.1 — Ring buffer SPSC (transitoire : game thread = audio thread) */
    this._ring = makeRing(1024)
    /* T-4.5 — Compteurs audio→game publiés à 30 Hz */
    this._counters = { busy: 0, steals: 0, niveauMaster: -Infinity, sectorsActive: 0 }
  }

  setTerrain(terrain) {
    this._terrain = terrain
    /* Le monde (FlatWorld) bake ses points d'impact en interne. Le sampler ne
       touche jamais au terrain en direct : il interroge this.world (WorldQuery). */
    this.world = makeDefaultWorld({ terrain, coords: this.coords })
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
      await this.ctx.audioWorklet.addModule(
        new URL('./worklets/clock-processor.js', import.meta.url)
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

    /* T-2.3 — Instancier le champ de secteurs (toujours pour diorama now) */
    if (this._workletReady && this.cfg.layers.L2.sectors > 0) {
      this.sectors = new SectorField(
        this.ctx, this.scene, this.cfg, this.bands,
        this.prng.fork ? this.prng.fork() : this.prng,
        this.banks,
      )
      /* T-2.3b — Garantir que les banques sont reçues par les worklets (mesure défensive) */
      this.sectors.setBanks(this.banks)
    }

    /* T-3.2 — Instancier le contrôleur LOD */
    this._lodParams = resolveLodParams(this.bands, this.cfg)
    this._lod = new LodController(this._lodParams, {
      onDémote: (voice, de, vers) => this._onDémote(voice, de, vers),
      onPromote: (voice, de, vers) => this._onPromote(voice, de, vers),
    })

    /* Worklet-horloge : pilote tickPoisson (L1) depuis le thread audio, jamais
       gelé quand l'onglet perd le focus. Sortie muette routée via un gain à 0
       pour que le nœud reste « pull »é par le moteur. Si le worklet manque, on
       reste en fallback rAF (clockDriven=false) — pluie dégradée mais jamais nulle. */
    if (this._workletReady) {
      this._clock = new AudioWorkletNode(this.ctx, 'clock-processor', {
        numberOfInputs: 0,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: { intervalMs: 16 },
      })
      const silent = this.ctx.createGain()
      silent.gain.value = 0
      this._clock.connect(silent).connect(this.ctx.destination)
      this._clock.port.onmessage = (e) => this._onClockTick(e.data)
      this.clockDriven = true
    }

    this.ready = true

    /* Émet l'événement scale initial */
    this._emitScale()
  }

  /* Tick du worklet-horloge : exécute le Poisson L1 avec le dt audio réel.
     Les paramètres météo (pluie/surfaces/densité) sont poussés par l'UI via
     setRainParams — le tick n'a pas besoin de l'état React. */
  _onClockTick(audioTime) {
    if (!this.ready || this.ctx?.state === 'suspended') { this._lastTick = null; return }
    /* dt mesuré sur l'horloge AUDIO (secondes) reçue du worklet : robuste aux
       rafales de messages quand le thread principal stalle. Borné à 100 ms pour
       éviter un pic de grains au retour d'un onglet longtemps masqué. */
    if (this._lastTick == null) { this._lastTick = audioTime; return }
    const dtMs = Math.min(100, (audioTime - this._lastTick) * 1000)
    this._lastTick = audioTime
    const rp = this._rainParams
    if (!rp.rain) return
    this.tickPoisson(dtMs, {
      metal: rp.metal ? 1 : 0,
      bache: rp.bache ? 1 : 0,
      terre: 1,
    }, rp.density)
  }

  /* Pousse les paramètres météo lus par le worklet-horloge à chaque tick. */
  setRainParams(params) {
    Object.assign(this._rainParams, params)
  }

  /* T-3.3 — Hook de démotion : coupe la voix héros + alimente le secteur. */
  _onDémote(voice, de, vers) {
    if (de === 'L1') {
      /* Fade-out de la voix HRTF (20 ms — inaudible) */
      if (voice.grainGain && voice.grainSrc) {
        const t = this.ctx.currentTime
        voice.grainGain.gain.cancelScheduledValues(t)
        voice.grainGain.gain.setValueAtTime(voice.grainGain.gain.value, t)
        voice.grainGain.gain.linearRampToValueAtTime(0, t + FONDU_S)
        voice.grainSrc.onended = null
        try { voice.grainSrc.stop(t + FONDU_S) } catch { /* déjà stoppé */ }
      }
      /* Verse l'énergie dans le secteur correspondant */
      if (this.sectors?.actif) {
        this.sectors.absorberImpact(voice.pos, voice.materialId, this._headWorld)
      }
    }
    /* L2→L3 : rien à faire structurellement (la nappe porte le fond) */
  }

  /* T-3.3 — Hook de promotion : tente de réacquérir une voix héros. */
  _onPromote(voice, de, vers) {
    if (vers !== 'L1') return true // L3→L2 toujours acceptée
    if (!this.pool || !this.pool.free.length) return false // budget saturé
    /* La voix est déjà libérée — aucun re-play immédiat (promotion "prête" pour le prochain impact) */
    return true
  }

  /* T-3.5 / T-4.9 — Levier de budget : ajuste r1 sous pression. Consomme les compteurs audio→game. */
  ajusterBudget(rec) {
    if (!this.pool || !this._lodParams) return
    const stats = this._counters       // T-4.5 — compteurs publiés à 30 Hz
    if (!stats.busy && stats.busy !== 0) return // pas encore initialisés
    const p = this._lodParams
    let r1Adj   = p.r1

    const poolSize = this.cfg.layers.L1.voices
    if (stats.busy >= p.busyHi * poolSize) {
      r1Adj = Math.max(p.r1Min, p.r1 - p.pas)
    } else if (stats.busy < p.busyLo * poolSize) {
      r1Adj = Math.min(p.r1Max, p.r1 + p.pas)
    }

    if (r1Adj !== p.r1) {
      p.r1 = r1Adj
      this._lod?.setParams(p)
    }

    rec?.emit('budget', {
      busyL1:        stats.busy,
      sizeL1:        poolSize,
      steals:        stats.steals,
      sectorsActive: stats.sectorsActive,
      r1Adj:         +r1Adj.toFixed(2),
    })
  }

  /* T-1.5 — Pilote la nappe selon la météo courante. */
  setWeather(weather) {
    this._intensity = Math.max(0, Math.min(1, weather.intensité ?? 0))
    if (!this.bed) return
    this.bed.setWeather(weather, this.recorder?.stateVersion, this.recorder)
  }

  /* Mise à jour ~30 Hz des secteurs L2 (débit de base + géométrie). */
  updateSectors(rec) {
    this.sectors?.update(this.world, this._headWorld, this._intensity, rec)
  }

  /* Reconfigure l'échelle sans recréer le contexte audio. */
  setScale(worldCfg) {
    this.cfg   = worldCfg
    this.coords = makeCoords(worldCfg.size)
    this.half  = this.coords.half
    this.limit = this.coords.limit
    this.prng  = makePrng(worldCfg.seed)
    this.bands = résoudreCouches(this.coords.worldRadius, worldCfg)
    /* Reconstruire le monde avec les nouvelles coordonnées */
    if (this._terrain) {
      this.world = makeDefaultWorld({ terrain: this._terrain, coords: this.coords })
    }
    /* T-1.6 — Collapse diorama : bascule le mode mince de la nappe */
    this.bed?.setMince(this.bands.collapse === 'diorama')
    this._emitScale()
  }

  _emitScale() {
    const { size } = this.cfg
    const { r1, r2, overlap } = this.bands
    this.recorder?.emit('scale', { size, r1, r2, overlap })
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
    const world = headInputToWorld({ x: nx, y: ny, z: nz }, this.coords)
    this._headWorld = world
    this.scene.setListenerPosition(...worldToResonance(world))
  }

  /* Boucle Poisson (game thread). Appelée chaque frame avec dtMs.
     surfaceDensities = { metal, bache, terre } : activité de chaque surface (0 ou 1).
     density = multiplicateur global (0..1) depuis l'UI. */
  /* Partitionne les points d'impact par matériau, une seule fois par monde.
     _byMat[mat]       : tous les points de ce matériau (candidats pickImpact)
     _exposedCount[mat]: nombre de points exposés au ciel (débit Poisson λ) */
  _rebuildImpactCache(pts) {
    this._impactCachePts = pts
    const byMat = {}
    const exposedCount = {}
    for (const m of MATERIALS) { byMat[m.id] = []; exposedCount[m.id] = 0 }
    for (const p of pts) {
      ;(byMat[p.matériau] ||= []).push(p)
      if (p.expoCiel > 0) exposedCount[p.matériau] = (exposedCount[p.matériau] || 0) + 1
    }
    this._byMat = byMat
    this._exposedCount = exposedCount
  }

  tickPoisson(dtMs, surfaceDensities, density = 1) {
    if (!this.ready || !this.world || this.ctx?.state === 'suspended') return
    const rec = this.recorder

    /* Seule lecture du monde, via l'interface WorldQuery (jamais terrain.material). */
    const pts = this.world.impactPoints()

    /* Partition par matériau bakée UNE fois par monde (réf. stable de _baked) :
       compte des points exposés + listes de candidats pour pickImpact. Évite de
       re-filtrer 2500 points × matériaux à CHAQUE frame (l'ancien code le faisait). */
    if (pts !== this._impactCachePts) this._rebuildImpactCache(pts)

    const maxGrains = maxGrainsPerTick(this.cfg.layers.L1.voices)

    for (const m of MATERIALS) {
      const sid = m.id
      /* surfaceDensities[sid] : multiplicateur 0..1 (0 = surface coupée depuis l'UI). */
      const surfFactor = surfaceDensities[sid] ?? 1
      if (surfFactor <= 0) { this._poissonNext[sid] = 0; continue }

      /* Surface exposée = nombre de points baked exposés pour ce matériau (cache).
         Pour 'terre' : inclut aussi les points dont le matériau overlay est désactivé
         (le sol sous un objet retiré de la scène redevient terre). */
      let exposed = this._exposedCount[sid] || 0
      let candidates = this._byMat[sid] || EMPTY
      if (sid === 'terre') {
        for (const om of MATERIALS) {
          if (om.id === 'terre') continue
          if ((surfaceDensities[om.id] ?? 1) <= 0) {
            exposed += this._exposedCount[om.id] || 0
            // concat ne mute pas le tableau caché : sûr de réaffecter.
            candidates = candidates.concat(this._byMat[om.id] || EMPTY)
          }
        }
      }
      if (!exposed) continue

      const λ = density * surfFactor * exposed * (MAT_FACTOR[sid] ?? 1) * 0.05 // grains/ms
      if (λ <= 0) continue

      this._poissonAcc[sid] = (this._poissonAcc[sid] || 0) + dtMs

      /* Tire autant d'impacts que l'intervalle de Poisson le permet, dans la limite
         du plafond audible (voir MAX_GRAINS_PER_TICK). */
      let grains = 0
      while (this._poissonAcc[sid] >= this._poissonNext[sid]) {
        if (grains >= maxGrains) { this._poissonAcc[sid] = 0; break }
        grains++
        this._poissonAcc[sid] -= this._poissonNext[sid]
        /* Prochain intervalle : distribution exponentielle (−ln(u)/λ) */
        const u = Math.max(1e-9, this.prng.aléa())
        this._poissonNext[sid] = -Math.log(u) / λ

        const point = pickImpact(candidates, sid, this.prng, this._headWorld, surfaceDensities, true)
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
    this.pool.play(buf, gainDb, detune, pos, material, now, { rec, grainId, impactId }, head, w, seuilWeakDb, this.bands.r2)

    /* T-3.3 — Enregistre la voix auprès du LodController pour suivi de distance */
    if (this._lod) {
      /* Retrouve la voix qui vient d'être acquise (celle portant grainId) */
      const voice = this.pool.voices.find(v => v.grainId === grainId && v.busy)
      if (voice) this._lod.track(voice)
    }
  }

  /* T-3.4 — Évaluation LOD appelée à ~30 Hz depuis DioramaApp. */
  évaluerLod(rec) {
    this._lod?.évaluerTout(this._headWorld, rec)
  }

  traceSample(rec) {
    if (!this.pool) return
    this._publishCounters() // T-4.5 — toujours mis à jour, pas seulement en enregistrement
    if (!rec?.recording) return
    const head = this._headWorld
    const faceSum = new Array(HEAD_FACES.length).fill(0)
    const seuilWeakDb = this.cfg.layers.L1.seuilWeakDb
    for (const v of this.pool.voices) {
      if (!v.busy) continue
      const db = this.pool.level(v)
      if (!isFinite(db)) continue
      const weak = db < seuilWeakDb

      /* T-4.6 — Coupe les grains négligeables : rend la voix au budget. */
      if (weak) {
        rec.emit('env', {
          grain: v.grainId, impact: v.impactId, voice: v.index, mat: v.materialId,
          db: +db.toFixed(2),
          x: Math.round(v.pos.x), y: Math.round(v.pos.y), z: Math.round(v.pos.z),
          weak: true,
        })
        this._lod?.untrack(v.grainId)
        this.pool._cut(v)
        this.pool._release(v)
        continue
      }

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

  /* T-4.5 — Publie les compteurs audio→game à 30 Hz (appelé depuis traceSample). */
  _publishCounters() {
    if (!this.pool) return
    let busy = 0
    for (const v of this.pool.voices) if (v.busy) busy++
    this._counters.busy          = busy
    this._counters.steals        = this.pool.stealCount
    this._counters.niveauMaster  = this.getMasterLevel()
    this._counters.sectorsActive = this.sectors?.N ?? 0
  }

  /** Lecture des compteurs courants (pour LodController / ajusterBudget). */
  getCounters() { return this._counters }

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

  suspend() { return this.ctx?.suspend() }
}
