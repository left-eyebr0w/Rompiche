import { createWorld } from './engine/ecs/world.js'
import { createLoop } from './engine/loop/loop.js'
import { createHeadlessContext } from './engine/context/createContext.js'
import { createEngineSystems, setupSimWorld } from './engine/systems/index.js'
import { ResonanceBackend } from './audio/ResonanceBackend.js'
import { loadBanks } from './audio/banks.js'
import { RafClock } from './platform/RafClock.js'

const root = document.getElementById('root')!
root.innerHTML = '<p>Cliquez pour démarrer...</p>'

const clock = new RafClock()
const ctx = createHeadlessContext({ clock })
const world = createWorld()
setupSimWorld(world, ctx, 0.5)

let analyser: AnalyserNode | null = null
let masterBuf = new Float32Array(256)
let audioReady = false

function getMasterLevel(): number {
  if (!analyser) return 0
  analyser.getFloatTimeDomainData(masterBuf)
  let sq = 0
  for (let i = 0; i < masterBuf.length; i++) sq += masterBuf[i] * masterBuf[i]
  return Math.sqrt(sq / masterBuf.length)
}

/* Exposer l'état dès le début pour les tests E2E et le debug. */
const FIELD_KEYS: ReadonlyArray<string> = Object.freeze(['rate', 'core', 'sigma', 'p', 'floor', 'ky'])
;(window as any).__rompiche = {
  ctx,
  world,
  get rms(): Record<string, number> {
    const m = getMasterLevel()
    return { master: m, l1: m, l2: 0, l3: 0 }
  },
  /* Répartition spatiale L1 — lecture/écriture EN DIRECT (mute ctx.worldConfig.l1Field,
     lu à chaque tick par rainPoisson). Calqué sur ds/ui_kits/diorama/debug.js:field. */
  field: {
    get(): Record<string, number> | null {
      const f = ctx.worldConfig.l1Field
      return f ? { ...f } : null
    },
    set(partial: Record<string, number>): Record<string, number> | null {
      const f = ctx.worldConfig.l1Field
      if (!f || !partial) return null
      for (const k of FIELD_KEYS) {
        if (typeof partial[k] === 'number') (f as any)[k] = partial[k]
      }
      return { ...f }
    },
  },
}

root.onclick = async () => {
  root.onclick = null
  try {
    root.innerHTML = '<p>Chargement des samples...</p>'
    const audioCtx = new AudioContext()
    const backend = new ResonanceBackend()
    backend.init(audioCtx)
    ctx.audio = backend

    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    if (backend.masterGain) backend.masterGain.connect(analyser)

    const banks = await loadBanks(audioCtx)
    const systems = createEngineSystems(world, ctx, banks, audioCtx)
    const loop = createLoop(ctx, systems)
    await clock.start()
    audioReady = true
    root.innerHTML = '<p>✓ Rompiche J3 — audio en cours</p>'
  } catch (e: any) {
    root.innerHTML = '<p>Erreur : ' + (e?.message ?? String(e)) + '</p>'
    console.error('J3 init error:', e)
  }
}
