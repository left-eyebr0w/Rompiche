import { ResonanceAudio } from 'resonance-audio'
import type { SpatialAudioBackend, SpatialSource } from './SpatialAudioBackend.js'
import type { Vector3 } from '../engine/context/coords.js'
import type { MaterialId } from '../engine/components/materials.js'
import { LISTENER_FORWARD } from '../engine/context/coords.js'

export class ResonanceBackend implements SpatialAudioBackend {
  private scene: ResonanceAudio | null = null
  private ctx: AudioContext | null = null
  masterGain: GainNode | null = null

  init(ctx: AudioContext): void {
    this.ctx = ctx
    this.scene = new ResonanceAudio(ctx, {
      ambisonicOrder: 3,
      dimensions: { width: 50, height: 50, depth: 50 },
      materials: {
        left: 'transparent', right: 'transparent',
        front: 'transparent', back: 'transparent',
        up: 'transparent', down: 'grass',
      },
    })
    const masterGain = ctx.createGain()
    masterGain.gain.value = 3
    this.masterGain = masterGain
    this.scene.output.connect(masterGain).connect(ctx.destination)
    this.scene.setListenerOrientation(LISTENER_FORWARD.x, LISTENER_FORWARD.y, LISTENER_FORWARD.z, 0, 1, 0)
  }

  get currentTime(): number {
    return this.ctx?.currentTime ?? 0
  }

  createSource(): SpatialSource {
    const src = this.scene!.createSource({ rolloff: 'logarithmic' })
    return {
      get input(): AudioNode { return src.input },
      setPosition(p: Vector3): void { src.setPosition(p.x, p.y, p.z) },
      setMaterial(_id: MaterialId | null): void {},
      dispose(): void { src.input.disconnect() },
    }
  }

  setListener(pos: Vector3, forward: Vector3, up: Vector3): void {
    if (!this.scene) return
    this.scene.setListenerPosition(pos.x, pos.y, pos.z)
    this.scene.setListenerOrientation(forward.x, forward.y, forward.z, up.x, up.y, up.z)
  }
}
