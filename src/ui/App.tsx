import React, { useSyncExternalStore } from 'react'
import ControlHUD from './ControlHUD.js'
import DebugHUD from './DebugHUD.js'
import { createEngineStore, type EngineStore } from './store.js'
import { serializeWorld, deserializeWorld, putSave, getSave, listSaves, deleteSave } from '../persistence/save.js'
import { MATERIALS } from '../engine/components/materials.js'
import type { EngineContext } from '../engine/context/EngineContext.js'
import type { GameWorld } from '../engine/ecs/world.js'
import type { ThreeRenderer } from '../render/ThreeRenderer.js'
import type { DioramaStatePatch } from '../shared/state.js'

const APP_CSS = `
.dio{ position:fixed; inset:0; display:flex; background:var(--canvas-noir); font-family:var(--font-sans); }
.dio__view{ position:relative; flex:1; min-width:0; overflow:hidden; }
.dio__view canvas{ display:block; width:100%; height:100%; }
.dio__scrim{ position:absolute; inset:0; background:
  radial-gradient(120% 90% at 50% 40%, rgba(255,255,255,.03), transparent 60%); pointer-events:none; }
.dio__top{ position:absolute; top:0; left:0; right:0; padding:20px 26px; display:flex;
  align-items:flex-start; justify-content:space-between; z-index:6; }
.dio__brand{ display:flex; align-items:center; gap:12px; }
.dio__glyph{ width:26px;height:26px;perspective:180px;flex:0 0 26px; }
.dio__gcube{ width:18px;height:18px;position:relative;margin:4px;transform-style:preserve-3d;transform:rotateX(-24deg) rotateY(-32deg);}
.dio__gface{ position:absolute;width:18px;height:18px;border:1.4px solid var(--wire); }
.dio__name{ color:var(--on-ink-primary); font-size:16px; font-weight:600; letter-spacing:-.01em; line-height:1; }
.dio__sub{ font-family:var(--font-mono); font-size:9px; letter-spacing:.18em; text-transform:uppercase;
  color:var(--on-ink-faint); margin-top:4px; }
.dio__topr{ text-align:right; }
.dio__clock{ font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--on-ink-muted); }
.dio__mode{ font-family:var(--font-mono); font-size:9px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--on-ink-faint); margin-bottom:3px; }
.dio__time{ font-family:var(--font-mono); font-size:22px; color:var(--on-ink-primary); font-variant-numeric:tabular-nums; line-height:1.2; }
.dio__meter{ display:flex; gap:4px; justify-content:flex-end; margin-top:10px; }
.dio__bar{ width:5px; background:var(--wire-faint); border-radius:1px; transition:height .12s linear, background .2s; }
.dio__hint{ position:absolute; left:26px; bottom:22px; z-index:6; font-family:var(--font-mono);
  font-size:10px; letter-spacing:.06em; color:var(--on-ink-faint); line-height:1.7; }
.dio__hint b{ color:var(--on-ink-muted); font-weight:500; }
`
;(function () {
  if (typeof document === 'undefined' || document.getElementById('app-css-j5')) return
  const s = document.createElement('style'); s.id = 'app-css-j5'; s.textContent = APP_CSS
  document.head.appendChild(s)
})()

const SEGMENTS = ['aube', 'jour', 'crépuscule', 'nuit'] as const

export interface AppProps {
  ctx: EngineContext
  world: GameWorld
  renderer: ThreeRenderer
}

export default function App({ ctx, world, renderer }: AppProps) {
  const [debug, setDebug] = React.useState(false)
  const [frontierViz, setFrontierViz] = React.useState(false)
  const [listening, setListening] = React.useState(() => ctx.input.controls.listening)
  const [loadKey, setLoadKey] = React.useState(0)
  const viewportRef = React.useRef<HTMLDivElement>(null)
  const lastXRef = React.useRef(0)
  const spinningRef = React.useRef(false)

  const ctrl = ctx.input.controls

  /* Monter le canvas ThreeRenderer dans le viewport. */
  React.useEffect(() => {
    if (!viewportRef.current) return
    const canvas = renderer.canvas
    if (canvas.parentElement !== viewportRef.current) {
      viewportRef.current.appendChild(canvas)
    }
  }, [renderer])

  /* Store pour les snapshots. */
  const [store] = React.useState<EngineStore>(() => {
    const w = window as any
    const getMaster = () => (w.__rompiche?.rms?.master as number) ?? 0
    return createEngineStore(ctx, world, getMaster)
  })
  React.useEffect(() => () => store.stop(), [store])

  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot)
  const BAR_MULTS = [1.0, 0.65, 0.85, 0.55, 0.75, 0.9]
  const meterLevels = React.useMemo(() => {
    const db = snapshot.master
    const norm = isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 55)) : 0
    return BAR_MULTS.map(m => Math.round(Math.max(4, norm * m * 28)))
  }, [snapshot.master])

  /* Spin/zoom handlers sur le viewport. */
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    spinningRef.current = true
    lastXRef.current = e.clientX
  }, [])

  const handleMouseMove = React.useCallback((e: React.MouseEvent) => {
    if (!spinningRef.current) return
    const dx = e.clientX - lastXRef.current
    renderer.spin += dx * 0.5
    lastXRef.current = e.clientX
  }, [renderer])

  React.useEffect(() => {
    const onUp = () => { spinningRef.current = false }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  /* Molette (Ctrl+wheel pour zoom). */
  React.useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      renderer.zoom = Math.min(2.5, Math.max(0.4, renderer.zoom + (e.deltaY > 0 ? -0.08 : 0.08)))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [renderer])

  /* Keyboard: Ctrl+Alt+D toggle debug. */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
        e.preventDefault()
        setDebug(d => {
          const next = !d
          const w = window as any
          if (w.__rompiche) w.__rompiche.debug.debugOn = next
          return next
        })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  /* Horloge. */
  const [time, setTime] = React.useState(new Date())
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const segmentFor = (h: number) => {
    if (h >= 5 && h < 8) return 'aube'
    if (h >= 8 && h < 18) return 'jour'
    if (h >= 18 && h < 21) return 'crépuscule'
    return 'nuit'
  }
  const clock = segmentFor(time.getHours())
  const hhmm = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  /* Save/Load. */
  const handleSave = React.useCallback(async (name: string) => {
    const terrain = (ctx.world as any).terrain
    const objects: any[] = []
    const statePatch: DioramaStatePatch = {
      rain: ctrl.rain,
      x: ctrl.listener.x, y: ctrl.listener.y, z: ctrl.listener.z,
      density: ctrl.density, gain: ctrl.gain,
      rainGainDb: ctrl.rainGainDb, masterGainDb: ctrl.masterGainDb,
    }
    const save = serializeWorld(name, statePatch, terrain, objects, MATERIALS.map(m => m.id))
    await putSave(name, save)
  }, [ctx, ctrl])

  const handleLoad = React.useCallback(async (name: string) => {
    const raw = await getSave(name)
    if (!raw) return
    const { statePatch } = deserializeWorld(raw)
    if (statePatch.x !== undefined) ctrl.listener.x = statePatch.x
    if (statePatch.y !== undefined) ctrl.listener.y = statePatch.y
    if (statePatch.z !== undefined) ctrl.listener.z = statePatch.z
    if (statePatch.density !== undefined) ctrl.density = statePatch.density
    if (statePatch.rain !== undefined) ctrl.rain = statePatch.rain
    if (statePatch.gain !== undefined) ctrl.gain = statePatch.gain
    if (statePatch.rainGainDb !== undefined) ctrl.rainGainDb = statePatch.rainGainDb
    if (statePatch.masterGainDb !== undefined) ctrl.masterGainDb = statePatch.masterGainDb
    store.pushCommand({ t: 'reset' })
    setLoadKey(k => k + 1)
  }, [ctx, ctrl, store])

  const handleListSaves = React.useCallback(() => listSaves(), [])
  const handleDeleteSave = React.useCallback((name: string) => deleteSave(name), [])

  return (
    <div className="dio">
      {debug && (
        <DebugHUD
          store={store}
          frontierViz={frontierViz}
          onToggleFrontierViz={() => {
            const next = !frontierViz
            setFrontierViz(next)
            const w = window as any
            if (w.__rompiche) w.__rompiche.debug.frontierViz = next
          }}
        />
      )}
      <div className="dio__view" ref={viewportRef}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
        {/* Canvas monté par React.useEffect */}
        <div className="dio__scrim" />
        <div className="dio__top">
          <div className="dio__brand">
            <span className="dio__glyph"><span className="dio__gcube">
              <span className="dio__gface" style={{ transform: 'translateZ(9px)' }} />
              <span className="dio__gface" style={{ transform: 'rotateY(90deg) translateZ(9px)', borderColor: 'var(--wire-dim)' }} />
              <span className="dio__gface" style={{ transform: 'rotateX(90deg) translateZ(9px)', borderColor: 'var(--wire-dim)' }} />
            </span></span>
            <div>
              <div className="dio__name">Diorama sonore</div>
              <div className="dio__sub">v0 · J5</div>
            </div>
          </div>
          <div className="dio__topr">
            <div className="dio__mode">horloge · sync</div>
            <div className="dio__clock">{clock}</div>
            <div className="dio__time">{hhmm}</div>
            <div className="dio__meter" style={{ cursor: 'pointer' }} onClick={() => {
                const next = !listening
                ctrl.listening = next
                setListening(next)
              }}
              title={listening ? "Arrêter l'écoute" : "Lancer l'écoute"}>
              {meterLevels.map((h, i) => (
                <div key={i} className="dio__bar" style={{
                  height: h + 'px',
                  background: listening ? 'var(--wire)' : 'var(--wire-dim)',
                }} />
              ))}
            </div>
          </div>
        </div>
        <div className="dio__hint">
          <div><b>Glisser</b> dans le viewport pour orbiter la vue</div>
          <div><b>Ctrl+molette</b> pour zoomer · <b>Axes XYZ</b> pour déplacer l'auditeur</div>
          <div><b>Ctrl+Alt+D</b> panneau debug</div>
        </div>
      </div>
      <ControlHUD
        ctx={ctx}
        store={store}
        loadKey={loadKey}
        onSave={handleSave}
        onLoad={handleLoad}
        listSaves={handleListSaves}
        deleteSave={handleDeleteSave}
      />
    </div>
  )
}
