import { headInputToWorld } from '../context/coords.js'
import type { System } from '../loop/loop.js'
import type { EngineContext } from '../context/EngineContext.js'
import type { GameWorld } from '../ecs/world.js'
import type { SpatialSource } from '../../audio/SpatialAudioBackend.js'
import type { Banks } from '../../audio/banks.js'

interface ActiveGrain {
  source: AudioBufferSourceNode
  gain: GainNode
}

export function createAudioSyncSystem(
  world: GameWorld,
  ctx: EngineContext,
  banks: Banks,
  audioCtx: AudioContext,
): System {
  const pool = world.with('voice')
  const sources = new Map<number, SpatialSource>()
  const grains = new Map<number, ActiveGrain>()

  return () => {
    const backend = ctx.audio
    if (!backend) return

    /* 1) Créer une SpatialSource par voix (paresseux, 1 seul appel). */
    for (const e of pool) {
      const id = e.voice!.id
      if (!sources.has(id)) {
        sources.set(id, backend.createSource())
      }
    }

    /* 2) Démotions : fade-out puis stop (AVANT les onsets, cf. voicePool.ts). */
    const t = backend.currentTime
    for (const d of ctx.frame.demotions) {
      const g = grains.get(d.voice)
      if (!g) continue
      g.gain.gain.cancelScheduledValues(t)
      g.gain.gain.setValueAtTime(g.gain.gain.value, t)
      g.gain.gain.linearRampToValueAtTime(0, t + 0.005)
      g.source.onended = null
      try { g.source.stop(t + 0.005) } catch { /* déjà stoppé */ }
      grains.delete(d.voice)
    }

    /* 3) Onsets : jouer un nouveau grain sur la voix. */
    for (const o of ctx.frame.grainOnsets) {
      let voice = null
      for (const e of pool) {
        if (e.voice!.id === o.voice) { voice = e.voice; break }
      }
      if (!voice || !voice.busy) continue

      const src = sources.get(o.voice)
      if (!src) continue

      const buf = banks[voice.materialId!]?.[voice.sample]
      if (!buf) continue

      /* Couper le grain précédent s'il existe encore. */
      const prev = grains.get(o.voice)
      if (prev) {
        try { prev.source.stop() } catch { /* déjà stoppé */ }
        grains.delete(o.voice)
      }

      const grainSrc = audioCtx.createBufferSource()
      grainSrc.buffer = buf
      grainSrc.detune.value = voice.grain

      const grainGain = audioCtx.createGain()
      grainGain.gain.value = 1

      grainSrc.connect(grainGain).connect(src.input)
      grainSrc.start()

      const vid = o.voice
      grainSrc.onended = () => {
        if (grains.get(vid)?.source === grainSrc) {
          grains.delete(vid)
        }
      }

      grains.set(vid, { source: grainSrc, gain: grainGain })
    }

    /* 4) Positionner les sources spatiales des voix actives. */
    for (const e of pool) {
      const v = e.voice!
      if (!v.busy) continue
      const src = sources.get(v.id)
      if (src) src.setPosition(v.pos)
    }

    /* 5) Positionner l'auditeur (depuis les contrôles). */
    const worldPos = headInputToWorld(ctx.input.controls.listener, ctx.coords)
    backend.setListener(worldPos, { x: 0, y: 0, z: -1 }, { x: 0, y: 1, z: 0 })
  }
}
