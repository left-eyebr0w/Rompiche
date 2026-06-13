import React from 'react'
import WireframeCube from './WireframeCube.jsx'
import ControlHUD from './ControlHUD.jsx'
import DebugHUD from './DebugHUD.jsx'
import { RainSampler } from './RainSampler.js'
import { TraceRecorder } from './TraceRecorder.js'
import { makeCoords } from './coords.js'
import { makeDefaultTerrain } from './Terrain.js'

const SIZE = Math.min(420, 380)

const SEGMENTS = ['aube', 'jour', 'crépuscule', 'nuit']
function segmentFor(h) {
  if (h >= 5 && h < 8)  return 'aube'
  if (h >= 8 && h < 18) return 'jour'
  if (h >= 18 && h < 21) return 'crépuscule'
  return 'nuit'
}

const APP_CSS = `
.dio{ position:fixed; inset:0; display:flex; background:var(--canvas-noir); font-family:var(--font-sans); }
.dio__view{ position:relative; flex:1; min-width:0; overflow:hidden; }
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
  if (typeof document === 'undefined' || document.getElementById('dio-css')) return
  const s = document.createElement('style'); s.id = 'dio-css'; s.textContent = APP_CSS
  document.head.appendChild(s)
})()

export default function DioramaApp() {
  const now = new Date()
  const [state, setState] = React.useState({
    rain: true, wind: false, windTilt: 0.5, windRotation: 0, windForce: 0.5, metal: true, bache: true, listening: false,
    x: 0.18, y: 0, z: -0.30, density: 0.42, gain: -6,
    spin: -32, zoom: 1,
    clockMode: 'sync', clockSegment: 'jour',
    debug: false,
  })
  const [time, setTime] = React.useState(now)
  const set = (patch) => setState(s => ({ ...s, ...patch }))

  /* Terrain (couche 1) — donnée éditable, reproduit la scène figée actuelle.
     Lu par WireframeCube pour le matériau de chaque goutte (fini le `ix < 0 ?`). */
  const terrain = React.useMemo(() => {
    const c = makeCoords(SIZE)
    return makeDefaultTerrain({ size: c.size, cell: c.CELL, block: c.BLOCK })
  }, [])

  /* ── Audio sampler ──────────────────────────────────────── */
  const samplerRef = React.useRef(null)
  const gainRef    = React.useRef(state.gain)
  gainRef.current  = state.gain
  const headRef    = React.useRef({ x: state.x, y: state.y, z: state.z })
  headRef.current  = { x: state.x, y: state.y, z: state.z }
  const stateRef   = React.useRef(state)
  stateRef.current = state

  /* ── Boîte noire (traçage causal) ─────────────────────────
     Recorder persistant, branché au sampler dès l'init. Inerte tant qu'on
     n'enregistre pas (Ctrl+Alt+R ou bouton du DebugHUD). */
  const recRef = React.useRef(null)
  if (!recRef.current) recRef.current = new TraceRecorder()
  const [recording, setRecording] = React.useState(false)
  const [traceCount, setTraceCount] = React.useState(0)

  const initSampler = React.useCallback(async () => {
    if (samplerRef.current) { samplerRef.current.resume(); return }
    const s = new RainSampler(SIZE)
    await s.init()
    s.setRecorder(recRef.current)
    samplerRef.current = s
    /* Positionne l'auditeur dès l'init — le useEffect ci-dessous tourne trop tôt (avant async).
       L'orientation est fixe (posée dans RainSampler.init) : elle ne suit pas l'orbite caméra. */
    const h = headRef.current
    s.setListenerPosition(h.x, h.y, h.z)
  }, [])

  React.useEffect(() => {
    if (state.listening) initSampler()
  }, [state.listening, initSampler])

  const handleImpact = React.useCallback((surface, pos) => {
    const s = samplerRef.current
    if (!s?.ready) return
    /* Maillon racine de la chaîne causale : on frappe l'id ICI (au plus près de
       la cause physique) et on le propage au trigger, qui le porte jusqu'à la
       voix et l'enveloppe. `impact` = 0 quand on n'enregistre pas (coût nul). */
    const rec = recRef.current
    const impactId = rec.recording ? rec.nextImpactId() : 0
    if (impactId) {
      rec.emit('impact', {
        impact: impactId, surface,
        x: Math.round(pos?.x ?? 0), z: Math.round(pos?.z ?? 0),
      })
    }
    s.trigger(surface, {
      x: pos?.x ?? 0,
      z: pos?.z ?? 0,
      gainDb: gainRef.current,
      detune: (Math.random() - 0.5) * 40,
      impactId,
    })
  }, [])

  /* Synchronise la position de l'auditeur avec la tête */
  React.useEffect(() => {
    samplerRef.current?.setListenerPosition(state.x, state.y, state.z)
  }, [state.x, state.y, state.z])

  /* L'orientation de l'auditeur est FIXE (posée à l'init) : orbiter la vue
     (spin) déplace le point de vue, pas l'écoute. La tête est l'input de
     référence et reste fixe → le champ sonore reste ancré au monde. */

  /* ── Pilotage de la boîte noire ───────────────────────────
     Champs d'état suivis en delta (journalisés au changement, jamais dupliqués
     sur chaque goutte). Le snapshot initial à l'ouverture pose la version 1. */
  const TRACKED = ['rain', 'wind', 'windTilt', 'windRotation', 'windForce',
    'metal', 'bache', 'x', 'y', 'z', 'density', 'gain']
  const snapshot = (st) => Object.fromEntries(TRACKED.map(k => [k, st[k]]))
  const trackedRef = React.useRef(null)

  const toggleRecording = React.useCallback(() => {
    const rec = recRef.current
    const s = samplerRef.current
    if (rec.recording) {
      rec.stop()
      setRecording(false)
      setTraceCount(rec.count)
      trackedRef.current = null
      return
    }
    if (!s?.ready) return // pas d'écoute active → rien à tracer
    rec.start(s.ctx, { size: SIZE })
    const snap = snapshot(stateRef.current)
    rec.state(snap)              // version 1 = état complet du monde
    trackedRef.current = snap    // amorce le diff des deltas
    setTraceCount(rec.count)
    setRecording(true)
  }, [])

  const exportTrace = React.useCallback(() => recRef.current.download(), [])

  /* Deltas d'état : n'émet QUE les champs qui ont changé depuis le dernier
     point de référence, avec un nouveau numéro de version. */
  React.useEffect(() => {
    const rec = recRef.current
    if (!rec.recording || !trackedRef.current) return
    const cur = snapshot(stateRef.current)
    const prev = trackedRef.current
    const patch = {}
    for (const k of TRACKED) if (cur[k] !== prev[k]) patch[k] = cur[k]
    if (Object.keys(patch).length) {
      rec.state(patch)
      trackedRef.current = cur
    }
  }, [state.rain, state.wind, state.windTilt, state.windRotation, state.windForce,
      state.metal, state.bache, state.x, state.y, state.z, state.density, state.gain, recording])

  /* Boucle d'échantillonnage des 6 pistes (~30 Hz, 1 frame sur 2). Autonome :
     tourne tant qu'on enregistre, que le DebugHUD soit ouvert ou non. */
  React.useEffect(() => {
    if (!recording) return
    let frame = 0, rafId
    const loop = () => {
      rafId = requestAnimationFrame(loop)
      if (++frame % 2 !== 0) return
      const s = samplerRef.current
      const rec = recRef.current
      if (!s?.ready || !rec.recording) return
      s.traceSample(rec)
      setTraceCount(rec.count)
    }
    rafId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafId)
  }, [recording])

  /* drag orbit — Y axis only */
  const drag = React.useRef({ active: false, lastX: 0 })
  const viewRef = React.useRef(null)

  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  React.useEffect(() => {
    const onUp = () => { drag.current.active = false }
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [])

  React.useEffect(() => {
    const onKey = (e) => {
      if (e.ctrlKey && e.altKey && e.code === 'KeyD') {
        e.preventDefault()
        setState(s => ({ ...s, debug: !s.debug }))
      }
      if (e.ctrlKey && e.altKey && e.code === 'KeyR') {
        e.preventDefault()
        toggleRecording()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleRecording])

  React.useEffect(() => {
    const el = viewRef.current
    if (!el) return
    const onWheel = (e) => {
      if (!e.ctrlKey) return
      e.preventDefault()
      setState(s => ({ ...s, zoom: Math.min(2.5, Math.max(0.4, s.zoom + (e.deltaY > 0 ? -0.08 : 0.08))) }))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const handleMouseDown = (e) => { drag.current = { active: true, lastX: e.clientX } }
  const handleMouseMove = (e) => {
    if (!drag.current.active) return
    const dx = e.clientX - drag.current.lastX
    drag.current.lastX = e.clientX
    setState(s => ({ ...s, spin: s.spin + dx * 0.5 }))
  }

  const realClock = segmentFor(time.getHours())
  const clock = state.clockMode === 'manual' ? state.clockSegment : realClock
  const hhmm = time.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const [levels, setLevels] = React.useState([3, 6, 4, 7, 5, 4])
  React.useEffect(() => {
    const active = state.listening
    const t = setInterval(() => {
      setLevels(prev => prev.map(() => {
        const base = active ? (state.rain ? 18 : 9) : 4
        const span = active ? (state.rain ? 22 : 12) * state.density + 6 : 3
        return Math.max(3, Math.round(base + Math.random() * span))
      }))
    }, active ? 140 : 600)
    return () => clearInterval(t)
  }, [state.listening, state.rain, state.density])

  return (
    <div className="dio">
      {state.debug && (
        <DebugHUD
          samplerRef={samplerRef}
          head={{ x: state.x, y: state.y, z: state.z }}
          size={SIZE}
          recording={recording}
          traceCount={traceCount}
          onToggleRecord={toggleRecording}
          onExport={exportTrace}
        />
      )}
      <div className="dio__view" ref={viewRef}
           onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
        <WireframeCube
          size={SIZE}
          terrain={terrain}
          head={{ x: state.x, y: state.y, z: state.z }}
          rain={state.rain} metal={state.metal} bache={state.bache}
          listening={state.listening}
          spin={state.spin} zoom={state.zoom}
          density={state.density} wind={state.wind}
          windTilt={state.windTilt} windRotation={state.windRotation} windForce={state.windForce}
          onImpact={state.listening && state.rain ? handleImpact : null}
          samplerRef={samplerRef} debug={state.debug}
        />
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
              <div className="dio__sub">v0 · prototype</div>
            </div>
          </div>
          <div className="dio__topr">
            <div className="dio__mode">horloge · {state.clockMode === 'manual' ? 'manuel' : 'sync'}</div>
            <div className="dio__clock">{clock}</div>
            <div className="dio__time">{hhmm}</div>
            <div className="dio__meter">
              {levels.map((l, i) => (
                <div key={i} className="dio__bar" style={{
                  height: Math.max(6, l) + 'px',
                  background: state.listening ? 'var(--wire)' : 'var(--wire-dim)',
                }} />
              ))}
            </div>
          </div>
        </div>
        <div className="dio__hint">
          <div><b>Glisser</b> dans le viewport pour orbiter la vue</div>
          <div><b>Ctrl+molette</b> pour zoomer · <b>Axes XYZ</b> pour déplacer l'auditeur</div>
          <div><b>Ctrl+Alt+D</b> panneau debug · <b>Ctrl+Alt+R</b> enregistrer la trace</div>
        </div>
      </div>
      <ControlHUD state={state} set={set} segments={SEGMENTS} clock={clock} clockMode={state.clockMode} />
    </div>
  )
}
