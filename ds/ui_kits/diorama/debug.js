/* ── Instrumentation de développement (opt-in) ───────────────────────────────
   Expose une API d'observation sur `window.__rompiche` UNIQUEMENT lorsque
   `?debug=true` est présent dans l'URL. Purement additif : aucune modification
   du son, du processus de Poisson, des voix, du mixing ni du rendu.

   • RMS — taps AnalyserNode (lecture seule) branchés en fan-out sur des nœuds
     déjà existants du sampler. Un tap ne route rien vers la sortie : il observe
     sans altérer le signal audible.
   • Voix — lecture du pool de voix actif.
   • Trace — sérialisation NDJSON en mémoire du TraceRecorder (sans download).
   • Seed — réassigne le PRNG maître (source unique de l'aléatoire Poisson),
     avant le démarrage du moteur ou à runtime.

   Tout est confiné ici et derrière `isDebugEnabled()` : en prod, ce module
   n'installe rien et `window.__rompiche` reste `undefined`. */

import { makePrng } from './prng.js'

let _enabled = null
/** Vrai si le flag de debug (`?debug=true`) est actif. Mémoïsé. */
export function isDebugEnabled() {
  if (_enabled !== null) return _enabled
  try {
    const p = new URLSearchParams(window.location.search)
    _enabled = p.get('debug') === 'true'
  } catch {
    _enabled = false
  }
  return _enabled
}

/* État interne du module (jamais exposé en prod). */
let _sampler = null
let _terrain = null         // grille terrain brute (pour scene())
let _objects = null         // props placés dans le monde (pour scene())
let _getRecorder = () => null
let _taps = null            // { l1, l2, l3 } AnalyserNodes
let _bufs = new WeakMap()   // analyser → Float32Array réutilisé
let _seedValue = null       // dernier seed demandé via seed.set()
let _pendingApply = false   // seed posé avant l'existence du sampler

/* RMS linéaire (0..1) d'un AnalyserNode, depuis le domaine temporel. */
function rmsOf(analyser) {
  if (!analyser) return 0
  let buf = _bufs.get(analyser)
  if (!buf || buf.length !== analyser.fftSize) {
    buf = new Float32Array(analyser.fftSize)
    _bufs.set(analyser, buf)
  }
  analyser.getFloatTimeDomainData(buf)
  let sq = 0
  for (let i = 0; i < buf.length; i++) sq += buf[i] * buf[i]
  return Math.min(1, Math.sqrt(sq / buf.length))
}

/* Crée les taps L1/L2/L3 en fan-out sur les nœuds existants du sampler.
   Aucun de ces analysers n'est reconnecté vers la destination → pas de son. */
function buildTaps(sampler) {
  const ctx = sampler.ctx
  if (!ctx) return null
  const mk = () => { const a = ctx.createAnalyser(); a.fftSize = 256; a.smoothingTimeConstant = 0.8; return a }

  const l1 = mk()
  for (const v of sampler.pool?.voices ?? []) v.analyser.connect(l1)

  const l2 = mk()
  const sectors = sampler.sectors?._sectors
  if (!sectors || sectors.length === 0) {
    console.warn(
      '[debug] L2 sans secteurs : sampler.sectors._sectors est ' +
      (sectors ? 'vide' : 'undefined') +
      ` (N=${sampler.sectors?.N ?? 0}). ` +
      'rms.l2 restera à 0 — le monde devrait avoir des secteurs désormais.'
    )
  }
  for (const s of sectors ?? []) s.worklet.connect(l2)

  const l3 = mk()
  if (sampler.bed?._gain) sampler.bed._gain.connect(l3)

  return { l1, l2, l3 }
}

/* Installe `window.__rompiche`. Idempotent. À appeler une fois au montage. */
export function installDebugApi({ getRecorder } = {}) {
  if (!isDebugEnabled() || typeof window === 'undefined' || window.__rompiche) return
  if (getRecorder) _getRecorder = getRecorder

  const rms = {}
  Object.defineProperties(rms, {
    master: { enumerable: true, get: () => rmsOf(_sampler?._masterAnalyser) },
    l1:     { enumerable: true, get: () => rmsOf(_taps?.l1) },
    l2:     { enumerable: true, get: () => rmsOf(_taps?.l2) },
    l3:     { enumerable: true, get: () => rmsOf(_taps?.l3) },
  })

  const voices = {}
  Object.defineProperties(voices, {
    active: {
      enumerable: true,
      get: () => {
        const vs = _sampler?.pool?.voices
        if (!vs) return 0
        let n = 0
        for (const v of vs) if (v.busy) n++
        return n
      },
    },
    list: {
      enumerable: true,
      get: () => {
        const vs = _sampler?.pool?.voices
        if (!vs) return []
        const now = performance.now()
        const out = []
        for (const v of vs) {
          if (!v.busy) continue
          out.push({
            material: v.materialId,
            position: { x: v.pos.x, y: v.pos.y, z: v.pos.z },
            age: +(now - v.startedAt).toFixed(1),
          })
        }
        return out
      },
    },
  })

  const trace = {
    getBuffer() {
      const rec = _getRecorder?.()
      if (!rec || rec.count === 0) return ''
      return rec.toNDJSON()
    },
  }

  /* Snapshot JSON-sérialisable de la scène : surfaces, terrain, tête. */
  function scene() {
    /* Les « surfaces actives » ne sont PAS la couche props (vide par défaut) :
       ce sont les matériaux réellement présents dans le terrain baké du moteur
       via l'interface WorldQuery. On regroupe par matériau et on dérive les bounds
       monde (AABB) des points d'impact de ce matériau. */
    const points = _sampler?.world?.impactPoints() ?? []
    const byMat = new Map()
    for (const p of points) {
      const id = p.matériau
      let s = byMat.get(id)
      if (!s) {
        s = {
          material: id,
          cells: 0,
          exposed: 0,
          bounds: {
            min: { x: Infinity, y: Infinity, z: Infinity },
            max: { x: -Infinity, y: -Infinity, z: -Infinity },
          },
        }
        byMat.set(id, s)
      }
      s.cells++
      if (p.expoCiel > 0) s.exposed++
      const { x, y, z } = p.position
      const b = s.bounds
      if (x < b.min.x) b.min.x = x; if (x > b.max.x) b.max.x = x
      if (y < b.min.y) b.min.y = y; if (y > b.max.y) b.max.y = y
      if (z < b.min.z) b.min.z = z; if (z > b.max.z) b.max.z = z
    }
    const surfaces = [...byMat.values()]

    const t = _terrain
    const terrain = t ? {
      size: t.size, cell: t.cell, block: t.block,
      cols: t.cols, rows: t.rows, bcols: t.bcols, brows: t.brows,
      material: Array.from(t.material), // grille fine → indices MATERIALS[]
      height: Array.from(t.height),     // grille blocs → hauteur (en blocs)
    } : null

    const hw = _sampler?._headWorld
    const head = hw ? { x: hw.x, y: hw.y, z: hw.z } : null

    return { surfaces, terrain, head }
  }

  /* Snapshot de l'état des trois couches du sampler. */
  function sampler() {
    const s = _sampler
    if (!s) return null

    /* L1 — pool de voix */
    const vs = s.pool?.voices ?? []
    let busy = 0
    for (const v of vs) if (v.busy) busy++
    const pool = { voices: vs.length, busy }

    /* L2 — champ de secteurs (SectorField, instancié dans RainSampler.init()).
       count   = nombre de secteurs réellement instanciés (s.sectors._sectors)
       configured = ce que le monde/plateforme prévoit (cfg.layers.L2.sectors) */
    const field = s.sectors
    const secList = field?._sectors ?? []
    const sectors = {
      count: secList.length,
      configured: s.cfg?.layers?.L2?.sectors ?? 0,
      actif: field?.actif ?? false,
      /* un worklet connecté par secteur ? (présence du nœud AudioWorkletNode) */
      connected: secList.map((sec) => !!sec.worklet),
    }

    /* L3 — nappe diffuse */
    const bed = s.bed
      ? { exists: true, gain: s.bed._gain?.gain?.value ?? null }
      : { exists: false, gain: null }

    return {
      pool,
      sectors,
      bed,
      masterAnalyser: !!s._masterAnalyser,
    }
  }

  const seed = {
    set(n) {
      _seedValue = n >>> 0
      if (_sampler) _sampler.prng = makePrng(_seedValue)
      else _pendingApply = true
      return _seedValue
    },
    get() {
      return _sampler ? _sampler.prng.seed : _seedValue
    },
  }

  /* Répartition spatiale L1 héros (cfg.l1Field) — lecture/écriture EN DIRECT.
     get() → copie ; set(partial) → mute les champs fournis (lus au prochain tick). */
  const field = {
    get() { return _sampler?.cfg?.l1Field ? { ..._sampler.cfg.l1Field } : null },
    set(partial) {
      const f = _sampler?.cfg?.l1Field
      if (!f || !partial) return null
      for (const k of ['rate', 'core', 'sigma', 'p', 'floor', 'ky']) {
        if (typeof partial[k] === 'number') f[k] = partial[k]
      }
      return { ...f }
    },
  }

  window.__rompiche = { rms, voices, trace, seed, scene, sampler, field }
}

/* Enregistre le sampler actif : construit les taps RMS et applique un seed
   éventuellement posé avant le démarrage du moteur. */
export function registerDebugSampler(sampler, { terrain = null, objects = null } = {}) {
  if (!isDebugEnabled() || !sampler) return
  _sampler = sampler
  _terrain = terrain
  _objects = objects
  _taps = buildTaps(sampler)
  if (_pendingApply && _seedValue !== null) {
    sampler.prng = makePrng(_seedValue)
    _pendingApply = false
  }
}
