import React from 'react'
import ReactDOM from 'react-dom/client'
window.React = React

/* Charger le bundle DS (IIFE → window.DioramaSonoreDesignSystem_6d9bc4). */
import '../ds/_ds_bundle.js'

import { createWorld } from './engine/ecs/world.js'
import { createLoop } from './engine/loop/loop.js'
import { createHeadlessContext } from './engine/context/createContext.js'
import { createEngineSystems, setupSimWorld } from './engine/systems/index.js'
import { ResonanceBackend } from './audio/ResonanceBackend.js'
import { loadBanks } from './audio/banks.js'
import { RafClock } from './platform/RafClock.js'
import { ThreeRenderer } from './render/ThreeRenderer.js'
import { FlatWorld } from './engine/world/World.js'
import App from './ui/App.js'

const root = document.getElementById('root')!
const uiContainer = document.getElementById('ui')!

const clock = new RafClock()
const ctx = createHeadlessContext({ clock })
const world = createWorld()
setupSimWorld(world, ctx, 0.5)

const flatWorld = ctx.world as FlatWorld
const renderer = new ThreeRenderer(ctx.coords, flatWorld.terrain)
ctx.render = renderer

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

const FIELD_KEYS: ReadonlyArray<string> = Object.freeze(['rate', 'core', 'sigma', 'p', 'floor', 'ky'])
;(window as any).__rompiche = {
  ctx,
  world,
  debug: {},
  get rms(): Record<string, number> {
    const m = getMasterLevel()
    return { master: m, l1: m, l2: 0, l3: 0 }
  },
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

/* Monter l'UI React. */
const reactRoot = ReactDOM.createRoot(uiContainer)
reactRoot.render(React.createElement(App, { ctx, world, renderer }))

/* ── Boot automatique : barre de chargement sobre, puis démarrage sans clic ──
   Le contexte audio est créé en état `suspended` (autorisé sans geste) ; le
   décodage des samples, le rendu et la sim démarrent immédiatement. Seule la
   REPRISE du son exige un geste utilisateur (politique d'autoplay) → on la
   déclenche au premier clic/touche, via un indice discret. */
const bootCss = document.createElement('style')
bootCss.textContent = `
#boot{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;gap:16px;z-index:20;background:#000;transition:opacity .4s ease}
#boot.boot--done{opacity:0;pointer-events:none}
.boot__bar{width:160px;height:2px;background:rgba(255,255,255,.1);border-radius:2px;overflow:hidden}
.boot__fill{width:40%;height:100%;background:rgba(255,255,255,.55);border-radius:2px;
  animation:boot-slide 1.1s ease-in-out infinite}
.boot__txt{font-family:monospace;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgba(255,255,255,.38)}
@keyframes boot-slide{0%{transform:translateX(-110%)}100%{transform:translateX(360%)}}
#sound-hint{position:absolute;left:50%;bottom:46px;transform:translateX(-50%);z-index:15;
  font-family:monospace;font-size:11px;letter-spacing:.08em;color:rgba(255,255,255,.45);
  cursor:pointer;user-select:none;transition:opacity .3s ease}
`
document.head.appendChild(bootCss)

const boot = document.createElement('div')
boot.id = 'boot'
boot.innerHTML = '<div class="boot__bar"><div class="boot__fill"></div></div><div class="boot__txt">Chargement…</div>'
root.appendChild(boot)

async function startEngine(): Promise<void> {
  try {
    const audioCtx = new AudioContext()
    const backend = new ResonanceBackend()
    backend.init(audioCtx)
    ctx.audio = backend

    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    if (backend.masterGain) backend.masterGain.connect(analyser)

    const banks = await loadBanks(audioCtx)
    const systems = createEngineSystems(world, ctx, banks, audioCtx, renderer)
    createLoop(ctx, systems)
    await clock.start()
    audioReady = true

    boot.classList.add('boot--done')
    setTimeout(() => boot.remove(), 450)

    if (audioCtx.state === 'suspended') unlockAudioOnGesture(audioCtx)
  } catch (e: any) {
    const txt = boot.querySelector('.boot__txt')
    if (txt) txt.textContent = 'Erreur : ' + (e?.message ?? String(e))
    console.error('J5 boot error:', e)
  }
}

function unlockAudioOnGesture(audioCtx: AudioContext): void {
  const hint = document.createElement('div')
  hint.id = 'sound-hint'
  hint.textContent = '♪ Cliquez pour activer le son'
  root.appendChild(hint)
  const unlock = () => {
    audioCtx.resume()
    hint.style.opacity = '0'
    setTimeout(() => hint.remove(), 300)
    window.removeEventListener('pointerdown', unlock)
    window.removeEventListener('keydown', unlock)
  }
  window.addEventListener('pointerdown', unlock)
  window.addEventListener('keydown', unlock)
}

startEngine()
