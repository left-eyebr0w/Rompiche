/* ── Contrôleur LOD — machine à états avec hystérésis & anti-rebond (§8.2) ────
   Suit les sources L1 (voix de pool) et déclenche démotion/promotion quand leur
   distance à l'auditeur franchit les seuils ± h.

   Transitions surveillées (§4 de PHASE-3.md) :
     L1 → L2  si dist > r1 + h
     L2 → L1  si dist < r1 − h  ET  budget disponible
     L2 → L3  si dist > r2 + h  (absorption nappe)
     L3 → L2  si dist < r2 − h  (reprise secteur)

   Seules les sources proches d'une frontière sont réévaluées (coût minimal). */

import { fondu } from './lod.js'

const FONDU_S = 0.02 // 20 ms — fondu de démotion (inaudible)

export class LodController {
  /**
   * @param {object} params — résultat de resolveLodParams()
   * @param {object} hooks  — { onDémote(voice, de, vers), onPromote(voice, de, vers) }
   */
  constructor(params, hooks) {
    this._p     = params
    this._hooks = hooks
    /* Map grainId → { couche, tBascule, voice } */
    this._sources = new Map()
  }

  /** Met à jour les paramètres (ex. après ajustement r1 par le levier de budget). */
  setParams(params) {
    this._p = params
  }

  /** Enregistre une voix L1 active dès son acquisition. */
  track(voice) {
    this._sources.set(voice.grainId, {
      couche:    'L1',
      tBascule:  0,
      voice,
    })
  }

  /** Retire une source du suivi (grain terminé ou volé). */
  untrack(grainId) {
    this._sources.delete(grainId)
  }

  /**
   * Évaluation à ~30 Hz. Pour chaque source suivie, calcule la distance actuelle,
   * applique hystérésis + anti-rebond, et déclenche les hooks si migration nécessaire.
   * @param {object} head — position monde de l'auditeur {x,y,z}
   * @param {object} rec  — TraceRecorder (optionnel)
   */
  évaluerTout(head, rec) {
    const now = performance.now()
    const { r1, r2, h, debounce } = this._p

    for (const [grainId, s] of this._sources) {
      const v = s.voice
      if (!v.busy) { this._sources.delete(grainId); continue }

      const dist = Math.hypot(v.pos.x - head.x, v.pos.y - head.y, v.pos.z - head.z)

      /* Anti-rebond */
      if (now - s.tBascule < debounce) continue

      /* Zone de crossfade active : appliquer fondu au gain de la voix */
      this._appliquerFondu(v, dist, rec, grainId)

      /* Transitions d'état */
      if (s.couche === 'L1' && dist > r1 + h) {
        this._démouvoir(s, 'L1', 'L2', dist, now, rec)
      } else if (s.couche === 'L2' && dist < r1 - h) {
        this._promouvoir(s, 'L2', 'L1', dist, now, rec)
      } else if (s.couche === 'L2' && dist > r2 + h) {
        this._démouvoir(s, 'L2', 'L3', dist, now, rec)
      } else if (s.couche === 'L3' && dist < r2 - h) {
        this._promouvoir(s, 'L3', 'L2', dist, now, rec)
      }
    }
  }

  /* Applique le fondu de puissance constante à une voix dans la zone de recouvrement. */
  _appliquerFondu(voice, dist, rec, grainId) {
    const { r1, overlap } = this._p
    const zoneMin = r1 - overlap
    const zoneMax = r1 + overlap
    if (dist < zoneMin || dist > zoneMax || !voice.grainGain) return

    const t = (dist - zoneMin) / (2 * overlap)
    const [gBas] = fondu(t)
    /* Ajuste le gain en temps réel (pas de ramp → la zone change lentement) */
    voice.grainGain.gain.value = gBas <= 0.001 ? 0 : Math.pow(10, voice.gainDb / 20) * gBas
    rec?.emit('crossfade', { grain: grainId, from: 'L1', to: 'L2', gBas: +gBas.toFixed(3), gHaut: +(1-gBas).toFixed(3) })
  }

  _démouvoir(s, de, vers, dist, now, rec) {
    s.couche   = vers
    s.tBascule = now
    this._hooks?.onDémote?.(s.voice, de, vers)
    rec?.emit('lod', {
      grain: s.voice.grainId, from: de, to: vers,
      dist: +dist.toFixed(2), reason: 'dist',
    })
  }

  _promouvoir(s, de, vers, dist, now, rec) {
    const promoted = this._hooks?.onPromote?.(s.voice, de, vers)
    if (!promoted) {
      /* Budget saturé — reste en densité */
      rec?.emit('lod', {
        grain: s.voice.grainId, from: de, to: de,
        dist: +dist.toFixed(2), reason: 'no-budget',
      })
      return
    }
    s.couche   = vers
    s.tBascule = now
    rec?.emit('lod', {
      grain: s.voice.grainId, from: de, to: vers,
      dist: +dist.toFixed(2), reason: 'dist',
    })
  }

  get size() { return this._sources.size }
}

export { FONDU_S }
