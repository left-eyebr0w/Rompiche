/* ── WebAudioBackend — SpatialAudioBackend natif (J6) ─────────────────────────
   Implementation unique et finale derrière la couture SpatialAudioBackend.
   audioSync ne change pas (branche sur la même interface).

   Graphe par voix :
     src.input (BiquadFilter lowpass)  → PannerNode (HRTF, inverse) → masterGain
                                       ↘ reverbSend (gain=0)  ─────┘

   Réverb (ConvolverNode) et occlusion (BiquadFilter) sont câblés CORRECTS mais
   DORMANTS en monde plat (enclosedVolume=0, isOccluded=0).
   Ils s'activeront aux chantiers terrain / monde vivant sans toucher à ce module.

   Bus de DIFFUSION partagé (« flou » des voix, cadrage rework/06) :
     diffusionInput → delay → masterGain
                        ↑___ feedback (gain) ___|
   Réseau de délais à retour. Les grains y envoient un wet ∝ mix (audioSync). */

import type { SpatialAudioBackend, SpatialSource } from './SpatialAudioBackend.js'
import type { Vector3 } from '../engine/context/coords.js'
import type { MaterialId } from '../engine/components/materials.js'
import { materialById } from '../engine/components/materials.js'

export class WebAudioBackend implements SpatialAudioBackend {
  private _ctx: AudioContext | null = null
  masterGain: GainNode | null = null
  private _reverbSend: GainNode | null = null
  private _diffusionIn: GainNode | null = null
  private _diffusionDelay: DelayNode | null = null
  private _diffusionFb: GainNode | null = null

  init(ctx: AudioContext): void {
    this._ctx = ctx

    const masterGain = ctx.createGain()
    masterGain.gain.value = 3
    masterGain.connect(ctx.destination)
    this.masterGain = masterGain

    // Bus de réverb partagé (dormant : gain=0 tant qu'enclosedVolume=0).
    const reverbSend = ctx.createGain()
    reverbSend.gain.value = 0
    const reverb = ctx.createConvolver()
    reverbSend.connect(reverb).connect(masterGain)
    this._reverbSend = reverbSend

    /* Bus de diffusion partagé (réseau de délais à retour) : diffusionIn → delay →
       master, avec une boucle de retour delay → fb → delay. Réglé par setDiffusion. */
    const diffusionIn = ctx.createGain()
    diffusionIn.gain.value = 1
    const delay = ctx.createDelay(1.0)
    delay.delayTime.value = 0.08
    const fb = ctx.createGain()
    fb.gain.value = 0.35
    diffusionIn.connect(delay)
    delay.connect(fb).connect(delay)   // boucle de retour
    delay.connect(masterGain)
    this._diffusionIn = diffusionIn
    this._diffusionDelay = delay
    this._diffusionFb = fb
  }

  get diffusionInput(): AudioNode | null { return this._diffusionIn }

  setDiffusion(delayS: number, feedback: number): void {
    const ctx = this._ctx
    if (!ctx || !this._diffusionDelay || !this._diffusionFb) return
    const now = ctx.currentTime
    this._diffusionDelay.delayTime.setTargetAtTime(Math.max(0, delayS), now, 0.02)
    /* feedback borné < 1 pour éviter l'emballement (auto-oscillation). */
    this._diffusionFb.gain.setTargetAtTime(Math.min(0.95, Math.max(0, feedback)), now, 0.02)
  }

  get currentTime(): number {
    return this._ctx?.currentTime ?? 0
  }

  createSource(): SpatialSource {
    const ctx = this._ctx!
    const reverbSend = this._reverbSend!
    const masterGain = this.masterGain!

    // Filtre d'occlusion par source (transparent à freq=Nyquist tant qu'isOccluded=0).
    const occFilter = ctx.createBiquadFilter()
    occFilter.type = 'lowpass'
    occFilter.frequency.value = ctx.sampleRate / 2

    const panner = ctx.createPanner()
    panner.panningModel = 'HRTF'
    panner.distanceModel = 'inverse'
    panner.refDistance = 0.5
    panner.maxDistance = 14
    panner.rolloffFactor = 1

    occFilter.connect(panner).connect(masterGain)
    occFilter.connect(reverbSend)

    return {
      get input(): AudioNode { return occFilter },
      setPosition(p: Vector3): void {
        /* Rampe courte (≈10 ms) au lieu d'un saut instantané : en HRTF, un
           changement brutal de position téléporte la voix L↔R et claque.
           setTargetAtTime lisse le déplacement sans traîner. */
        const now = ctx.currentTime
        const tau = 0.01
        panner.positionX.setTargetAtTime(p.x, now, tau)
        panner.positionY.setTargetAtTime(p.y, now, tau)
        panner.positionZ.setTargetAtTime(p.z, now, tau)
      },
      setMaterial(id: MaterialId | null): void {
        const mat = id ? materialById(id) : null
        panner.refDistance = mat?.minDistance ?? 0.5
        panner.maxDistance = mat?.maxDistance ?? 14
      },
      dispose(): void {
        occFilter.disconnect()
        panner.disconnect()
      },
    }
  }

  private _masterBaseGain = 3

  setMasterGainDb(db: number): void {
    const ctx = this._ctx
    if (!ctx || !this.masterGain) return
    const now = ctx.currentTime
    const target = this._masterBaseGain * Math.pow(10, db / 20)
    this.masterGain.gain.cancelScheduledValues(now)
    this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
    this.masterGain.gain.linearRampToValueAtTime(target, now + 0.05)
  }

  setListener(pos: Vector3, forward: Vector3, up: Vector3): void {
    const listener = this._ctx?.listener
    if (!listener) return
    listener.positionX.value = pos.x
    listener.positionY.value = pos.y
    listener.positionZ.value = pos.z
    listener.forwardX.value = forward.x
    listener.forwardY.value = forward.y
    listener.forwardZ.value = forward.z
    listener.upX.value = up.x
    listener.upY.value = up.y
    listener.upZ.value = up.z
  }
}
