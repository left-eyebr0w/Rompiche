/* ── Couche 2 : champ de secteurs (§6, §16.2) ────────────────────────────────
   N secteurs uniformément répartis dans le plan horizontal. Chaque secteur
   porte un granulateur (AudioWorklet) encodé dans une source Resonance statique.

   Le débit de chaque secteur provient de deux sources :
     • impacts mid-field (r1..r2) absorbés via absorberImpact() (+2 grains/s)
     • baseline far-field : world.rainSurfaceAt() sampléé dans [r1,r2], modulé
       par intensité de la pluie (DENSITY_K) — rend L2 présente même sans impact.

   Valeurs résolues (§10) :
     N             = cfg.layers.L2.sectors (résolu depuis preset × plateforme)
     RAYON_SECTEUR = (r1 + r2) / 2
     CONTRIBUTION  = +2 grains/s par impact
     DECAY         = 0.85 par tick (~30 Hz)
     DEBIT_MAX     = 120 grains/s */

import { worldToResonance } from './coords.js'
import { MATERIALS } from './materials.js'

const CONTRIBUTION  = 2    // grains/s ajoutés par impact
const DECAY         = 0.85 // multiplicateur par tick
const DEBIT_MAX     = 120  // grains/s (plafond)
const DENSITY_K     = 0.5  // facteur de débit de base (intensité × exposé × K)

export class SectorField {
  constructor(ctx, scene, cfg, bands, prng, banks) {
    this._ctx    = ctx
    this._scene  = scene
    this._cfg    = cfg
    this._bands  = bands
    this._prng   = prng

    const N = cfg.layers.L2.sectors ?? 0
    this._N      = N
    this._actif  = N > 0
    this._sectors = []

    if (!this._actif) return

    const { r1, r2 } = bands
    const rayon = (r1 + r2) / 2

    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k) / N
      const dir   = { x: Math.cos(angle), y: 0, z: Math.sin(angle) }

      /* Source Resonance statique positionnée à mi-distance r1..r2 */
      const src = scene.createSource({ rolloff: 'none' })
      src.setPosition(
        ...worldToResonance({ x: dir.x * rayon, y: 0, z: dir.z * rayon })
      )

      /* Worklet granulateur — seed dérivé du PRNG maître */
      const seed = Math.floor(prng.aléa() * 0xFFFFFFFF) + 1
      const worklet = new AudioWorkletNode(ctx, 'granulator-processor', {
        processorOptions: { seed },
        outputChannelCount: [1],
      })
      worklet.connect(src.input)

      /* Envoyer les banques audio dès la création (copie structured-clone) */
      if (banks) this._sendBanks(worklet, banks, ctx.sampleRate)

      this._sectors.push({
        index: k,
        centreDir: dir,
        worklet,
        src,
        débit: 0,
        matMix: this._uniformMatMix(),
        occlusion: 0,
      })
    }
  }

  get actif() { return this._actif }
  get N()     { return this._N }

  /* Envoie les banques (Float32Array[]) au worklet. */
  _sendBanks(worklet, banks, sr) {
    const serialized = {}
    for (const m of MATERIALS) {
      const buffers = banks[m.id] ?? []
      serialized[m.id] = buffers.map(buf => {
        /* buf est un AudioBuffer — extraire les données mono du canal 0 */
        const channelData = buf.getChannelData(0)
        const arr = new Float32Array(channelData.length)
        arr.set(channelData)
        return arr
      })
      if (buffers.length > 0) {
        console.debug(`[SectorField] ${m.id}: ${buffers.length} samples envoyés au worklet`)
      }
    }
    worklet.port.postMessage({ type: 'banks', banks: serialized, sampleRate: sr })
  }

  /* Distribue les banques après init (appelé par RainSampler). */
  setBanks(banks) {
    for (const s of this._sectors) {
      this._sendBanks(s.worklet, banks, this._ctx.sampleRate)
    }
  }

  _uniformMatMix() {
    const mix = {}
    for (const m of MATERIALS) mix[m.id] = 1 / MATERIALS.length
    return mix
  }

  /* Identifie le secteur correspondant à l'angle horizontal d'un impact. */
  _sectorFor(pos, head) {
    const dx = pos.x - head.x
    const dz = pos.z - head.z
    const angle = Math.atan2(dz, dx)                    // -π .. π
    const norm  = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
    return Math.floor(norm / (2 * Math.PI) * this._N) % this._N
  }

  /* Un impact lointain alimente le débit du secteur correspondant. */
  absorberImpact(pos, material, head) {
    if (!this._actif) return
    const k = this._sectorFor(pos, head)
    const s = this._sectors[k]
    s.débit = Math.min(DEBIT_MAX, s.débit + CONTRIBUTION)

    /* Met à jour le matMix du secteur avec ce matériau */
    const alpha = 0.15 // lissage EMA
    for (const id of Object.keys(s.matMix)) {
      s.matMix[id] = s.matMix[id] * (1 - alpha) + (id === material ? alpha : 0)
    }
  }

  /* ~30 Hz — débit de base du monde far-field, géométrie, pousse params aux worklets, émet `sector`. */
  update(world, head, intensity, rec) {
    if (!this._actif) return
    for (const s of this._sectors) {
      /* Decay du débit d'impacts (retombe sans alimentation) */
      s.débit *= DECAY
      if (s.débit < 0.5) s.débit = 0

      /* T-2.6 — Modulation géométrique (minimum viable) + débit de base far-field */
      s.occlusion = this._occlusionLocale(world, head, s.centreDir)
      const matMix = this._couvertureMatériau(world, head, s.centreDir) ?? s.matMix

      /* Débit de base : monde far-field raining (indépendant des impacts proches) */
      const baseline = intensity * this._farFieldExposure(world, head, s.centreDir) * DENSITY_K
      s.débit = Math.min(DEBIT_MAX, s.débit + baseline)

      /* Pousse les paramètres au worklet (pas d'allocation ici) */
      s.worklet.port.postMessage({
        débit:     s.débit,
        matMix:    matMix,
        occlusion: s.occlusion,
      })

      rec?.emit('sector', {
        sector:    s.index,
        débit:     +s.débit.toFixed(2),
        occlusion: +s.occlusion.toFixed(3),
        matMix,
      })
    }
  }

  /* Occlusion locale : raycast court le long de la direction du secteur.
     Retourne 0..1. Une cellule plus haute que la tête d'au moins 1 m → occlusion. */
  _occlusionLocale(world, head, dir) {
    if (!world) return 0
    const steps  = 6
    const reach  = this._bands.r1 * 0.8
    const headY  = head.y ?? 0
    for (let i = 1; i <= steps; i++) {
      const t  = (i / steps) * reach
      const cx = head.x + dir.x * t
      const cz = head.z + dir.z * t
      const surf = world.rainSurfaceAt(cx, cz)
      if (surf.y > headY + 1) return Math.min(1, i / steps)
    }
    return 0
  }

  /* Couverture matériau : échantillonne le monde le long de la direction,
     incluant le far-field. */
  _couvertureMatériau(world, head, dir) {
    if (!world) return null
    const steps  = 8
    const reach  = (this._bands.r1 + this._bands.r2) / 2
    const counts = {}
    for (const m of MATERIALS) counts[m.id] = 0
    let total = 0
    for (let i = 1; i <= steps; i++) {
      const t  = (i / steps) * reach
      const cx = head.x + dir.x * t
      const cz = head.z + dir.z * t
      const surf = world.rainSurfaceAt(cx, cz)
      if (!surf?.material) continue
      counts[surf.material] = (counts[surf.material] ?? 0) + 1
      total++
    }
    if (!total) return null
    const mix = {}
    for (const m of MATERIALS) mix[m.id] = (counts[m.id] ?? 0) / total
    return mix
  }

  /* Exposition lointaine : fraction du monde [r1,r2] qui est exposed (pas occludée).
     Sampling statistique le long de la direction. */
  _farFieldExposure(world, head, dir) {
    if (!world) return 0
    const steps = 6
    const r1 = this._bands.r1
    const r2 = this._bands.r2
    let exposed = 0
    for (let i = 1; i <= steps; i++) {
      const t  = r1 + ((i / steps) * (r2 - r1))
      const cx = head.x + dir.x * t
      const cz = head.z + dir.z * t
      const surf = world.rainSurfaceAt(cx, cz)
      if (surf?.skyExposed) exposed++
    }
    return exposed / steps
  }
}
