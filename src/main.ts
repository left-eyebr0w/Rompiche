import React from 'react'
import ReactDOM from 'react-dom/client'
window.React = React


import { createWorld } from './engine/ecs/world.js'
import { createLoop } from './engine/loop/loop.js'
import { createHeadlessContext } from './engine/context/createContext.js'
import { createEngineSystems, setupSimWorld } from './engine/systems/index.js'
import { createRenderSyncSystem } from './engine/systems/renderSync.js'
import { WebAudioBackend } from './audio/WebAudioBackend.js'
import { loadBanks } from './audio/banks.js'
import { WorkletClock } from './platform/WorkletClock.js'
import { ThreeRenderer } from './render/ThreeRenderer.js'
import { FlatWorld } from './engine/world/World.js'
import App from './ui/App.js'

const root = document.getElementById('root')!
const uiContainer = document.getElementById('ui')!

/* AudioContext créé tôt, en état `suspended` (autorisé sans geste utilisateur) :
   le WorkletClock — maître d'horloge — en a besoin dès la construction. Le worklet
   ne tourne (et la simulation n'avance) qu'une fois le contexte `running`, c.-à-d.
   après le 1ᵉʳ geste qui le `resume()`. C'est voulu : pas d'audio = pas de tick. */
const audioCtx = new AudioContext()
const clock = new WorkletClock(audioCtx)
const ctx = createHeadlessContext({ clock })
const world = createWorld()
setupSimWorld(world, ctx, 0.5)

const flatWorld = ctx.world as FlatWorld
const renderer = new ThreeRenderer(ctx.coords, flatWorld.terrain, flatWorld.objects)
ctx.render = renderer

/* ── Boucle de RENDU, pilotée par rAF, découplée du pas fixe (architecture.md §2)
   Le rendu n'est plus un système de la boucle de simulation : il tourne sur sa
   propre horloge rAF, qui a le DROIT de geler hors focus / écran éteint (c'est
   voulu : en background, on ne dessine pas, mais la simu+audio continuent via le
   worklet). Lancée tout de suite → la scène est vivante AVANT le 1ᵉʳ geste audio
   (plus de scène figée tant que l'AudioContext est suspended). */
const renderTick = createRenderSyncSystem(renderer, world)
let renderRaf = 0
function renderLoop(): void {
  renderTick(ctx, 0)  // draw() lit l'état courant ; dt ignoré (rAF a sa propre horloge)
  renderRaf = requestAnimationFrame(renderLoop)
}
renderRaf = requestAnimationFrame(renderLoop)
void renderRaf  // conservé pour un éventuel cancelAnimationFrame (dispose)

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
    const backend = new WebAudioBackend()
    backend.init(audioCtx)
    ctx.audio = backend

    analyser = audioCtx.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8
    if (backend.masterGain) backend.masterGain.connect(analyser)

    const banks = await loadBanks(audioCtx)
    const systems = createEngineSystems(world, ctx, banks, audioCtx)
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
