/* ── WebAudioBackend — SpatialAudioBackend natif (J6, swap temps 2) ──────────
   Remplace ResonanceBackend (temps 1, bibliothèque Google morte). Branche derrière
   la même couture SpatialAudioBackend : audioSync ne change pas.

   Graphe par voix :
     src.input (BiquadFilter lowpass)  → PannerNode (HRTF, inverse) → masterGain
                                       ↘ reverbSend (gain=0)  ─────┘

   Réverb (ConvolverNode) et occlusion (BiquadFilter) sont câblés CORRECTS mais
   DORMANTS en monde plat (enclosedVolume=0, isOccluded=0).
   Ils s'activeront aux chantiers terrain / monde vivant sans toucher à ce module. */

import type { SpatialAudioBackend, SpatialSource } from './SpatialAudioBackend.js'
import type { Vector3 } from '../engine/context/coords.js'
import type { MaterialId } from '../engine/components/materials.js'
import { materialById } from '../engine/components/materials.js'

export class WebAudioBackend implements SpatialAudioBackend {
  private _ctx: AudioContext | null = null
  masterGain: GainNode | null = null
  private _reverbSend: GainNode | null = null

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
        panner.positionX.value = p.x
        panner.positionY.value = p.y
        panner.positionZ.value = p.z
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
