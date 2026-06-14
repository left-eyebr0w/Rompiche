import React from 'react'
import { makeCoords, headInputToWorld, HEAD_FACES } from './coords.js'

const DBG_CSS = `
.dbg{ width:280px; flex:0 0 280px; height:100%; background:var(--canvas-noir);
  border-right:1px solid rgba(232,201,109,.18); display:flex; flex-direction:column;
  font-family:var(--font-mono); color:var(--on-ink-primary); }
.dbg__head{ padding:16px 18px 12px; border-bottom:1px solid rgba(232,201,109,.18);
  display:flex; align-items:center; justify-content:space-between; gap:8px; }
.dbg__title{ font-size:11px; font-weight:700; letter-spacing:.14em; text-transform:uppercase;
  color:#e8c96d; }
.dbg__badge{ font-size:8px; letter-spacing:.08em; text-transform:uppercase;
  color:rgba(232,201,109,.45); border:1px solid rgba(232,201,109,.25); padding:2px 6px; border-radius:3px; }
.dbg__body{ flex:1; overflow-y:auto; padding:4px 0 12px; }
.dbg__sec{ padding:12px 18px; border-bottom:1px solid rgba(255,255,255,.05); }
.dbg__sec:last-child{ border-bottom:none; }
.dbg__sech{ font-size:8px; letter-spacing:.14em; text-transform:uppercase;
  color:rgba(232,201,109,.6); margin-bottom:10px; }
.dbg__faces{ display:flex; flex-direction:column; gap:7px; }
.dbg__face{ display:flex; align-items:center; gap:7px; }
.dbg__flabel{ width:34px; font-size:8px; letter-spacing:.06em; color:var(--on-ink-muted);
  flex:0 0 34px; }
.dbg__ftrack{ flex:1; height:3px; background:rgba(255,255,255,.06); border-radius:2px; overflow:hidden; }
.dbg__ffill{ height:100%; border-radius:2px; background:#e8c96d;
  transition:width .08s linear; }
.dbg__fdb{ width:44px; text-align:right; font-size:8px; color:var(--on-ink-faint); }
.dbg__zones{ display:grid; grid-template-columns:repeat(3,1fr); gap:4px; }
.dbg__zone{ border:1px solid rgba(255,255,255,.07); border-radius:3px; padding:4px 3px;
  text-align:center; transition:background .05s, border-color .05s; }
.dbg__zone.hit{ background:rgba(232,201,109,.12); border-color:rgba(232,201,109,.35); }
.dbg__zlabel{ font-size:7px; letter-spacing:.06em; color:var(--on-ink-faint); }
.dbg__zlevel{ font-size:10px; color:var(--on-ink-primary); margin-top:3px;
  font-variant-numeric:tabular-nums; }
.dbg__zbar{ height:2px; background:rgba(255,255,255,.06); border-radius:1px; margin-top:5px; overflow:hidden; }
.dbg__zfill{ height:100%; background:#e8c96d; border-radius:1px; transition:width .08s linear; }
.dbg__stats{ display:flex; flex-direction:column; gap:5px; }
.dbg__stat{ display:flex; justify-content:space-between; align-items:baseline; }
.dbg__skey{ font-size:8px; color:var(--on-ink-faint); letter-spacing:.04em; }
.dbg__sval{ font-size:9px; color:var(--on-ink-primary); font-variant-numeric:tabular-nums; }
.dbg__foot{ padding:10px 18px; border-top:1px solid rgba(232,201,109,.12);
  font-size:8px; color:rgba(232,201,109,.3); letter-spacing:.08em; }
.dbg__rec{ display:flex; gap:6px; align-items:stretch; }
.dbg__btn{ flex:1; font-family:var(--font-mono); font-size:9px; letter-spacing:.08em;
  text-transform:uppercase; padding:7px 8px; border-radius:4px; cursor:pointer;
  border:1px solid rgba(232,201,109,.3); background:transparent; color:#e8c96d;
  transition:background .12s, border-color .12s, color .12s; }
.dbg__btn:hover{ background:rgba(232,201,109,.1); }
.dbg__btn:disabled{ opacity:.35; cursor:not-allowed; }
.dbg__btn.on{ background:#e8c96d; border-color:#e8c96d; color:var(--canvas-noir); font-weight:700; }
.dbg__recmeta{ display:flex; align-items:center; gap:6px; margin-bottom:9px;
  font-size:8px; letter-spacing:.06em; color:var(--on-ink-faint); }
.dbg__dot{ width:7px; height:7px; border-radius:50%; background:rgba(255,255,255,.18); flex:0 0 7px; }
.dbg__dot.live{ background:#e8553b; animation:dbgpulse 1s ease-in-out infinite; }
@keyframes dbgpulse{ 0%,100%{ opacity:1 } 50%{ opacity:.3 } }
.dbg__sl{ display:flex; align-items:center; gap:8px; margin-bottom:9px; }
.dbg__slk{ width:58px; flex:0 0 58px; font-size:8px; letter-spacing:.04em; color:var(--on-ink-muted); }
.dbg__slr{ flex:1; min-width:0; accent-color:#e8c96d; height:3px; }
.dbg__slv{ width:42px; text-align:right; font-size:9px; color:var(--on-ink-primary);
  font-variant-numeric:tabular-nums; }
`
;(function () {
  if (typeof document === 'undefined' || document.getElementById('dbg-css')) return
  const s = document.createElement('style'); s.id = 'dbg-css'; s.textContent = DBG_CSS
  document.head.appendChild(s)
})()

const FACES = HEAD_FACES // 6 points d'écoute directionnels — source unique (coords.js)

function dot3(a, b) { return a[0]*b[0] + a[1]*b[1] + a[2]*b[2] }
function norm3(v) {
  const l = Math.sqrt(dot3(v, v)) || 1e-9
  return [v[0]/l, v[1]/l, v[2]/l]
}

function dbToWidth(db) {
  if (!isFinite(db)) return 0
  return Math.max(0, Math.min(100, (db + 40) / 40 * 100))
}
function dbStr(db) {
  return !isFinite(db) ? '—' : db.toFixed(1) + ' dB'
}

/* Courbe radiale du poids de la PDF L1 :
     w(d) = floor + (1−floor)·exp(−0.5·(max(0,d−core)/σ)^p).
   Lit le PROFIL exact (cœur, σ, p, plancher) que les coquilles 3D ne montrent qu'en volume.
   Repères : ligne verticale à d=core+σ, ligne horizontale au plancher. SVG, sans dépendance. */
function FieldCurve({ field }) {
  const W = 244, H = 64, padL = 4, padR = 4, padT = 4, padB = 12
  const { core, sigma, p, floor } = field
  const s = Math.max(0.1, sigma)
  const c = Math.max(0, core || 0)
  const dMax = Math.max(c + s * 3, 12)
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB
  const sx = (d) => x0 + (d / dMax) * (x1 - x0)
  const sy = (w) => y1 - w * (y1 - y0) // w∈[0,1] : 1 en haut, 0 en bas
  const w = (d) => floor + (1 - floor) * Math.exp(-0.5 * Math.pow(Math.max(0, d - c) / s, p))
  const N = 56
  let path = ''
  for (let i = 0; i <= N; i++) {
    const d = (i / N) * dMax
    path += (i === 0 ? 'M' : 'L') + sx(d).toFixed(1) + ',' + sy(w(d)).toFixed(1) + ' '
  }
  const xSigma = sx(Math.min(c + s, dMax))
  const yFloor = sy(floor)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: 2 }}>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="rgba(255,255,255,.02)" />
      {/* plancher (asymptote des gouttes lointaines) */}
      {floor > 0.001 && (
        <line x1={x0} y1={yFloor} x2={x1} y2={yFloor}
          stroke="rgba(232,201,109,.35)" strokeWidth="1" strokeDasharray="2 3" />
      )}
      {/* repère σ */}
      <line x1={xSigma} y1={y0} x2={xSigma} y2={y1}
        stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="2 3" />
      <path d={path} fill="none" stroke="#e8c96d" strokeWidth="1.5" />
      <text x={Math.min(xSigma + 3, x1 - 14)} y={H - 2} fontSize="7"
        fill="rgba(255,255,255,.4)" fontFamily="var(--font-mono)">σ</text>
      <text x={x1 - 2} y={H - 2} fontSize="7" textAnchor="end"
        fill="rgba(255,255,255,.3)" fontFamily="var(--font-mono)">{dMax.toFixed(0)} m</text>
    </svg>
  )
}

/* Une ligne de slider de debug (label · range · valeur). */
function SliderRow({ k, min, max, step, value, onChange, fmt }) {
  return (
    <div className="dbg__sl">
      <span className="dbg__slk">{k}</span>
      <input
        className="dbg__slr" type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <span className="dbg__slv">{fmt(value)}</span>
    </div>
  )
}

export default function DebugHUD({ samplerRef, head, size,
  recording = false, traceCount = 0, onToggleRecord, onExport,
  fieldViz = false, onToggleFieldViz }) {
  const coords = React.useMemo(() => makeCoords(size), [size])

  const [meters, setMeters] = React.useState([])
  const [master, setMaster] = React.useState(-Infinity)
  const [pool, setPool] = React.useState({ busy: 0, size: 0, steals: 0 })
  const [hitIds, setHitIds] = React.useState({})
  const prevCounts = React.useRef({})

  /* Répartition spatiale L1 héros — réglée EN DIRECT (mute cfg.l1Field, lu au tick).
     On amorce l'état des sliders depuis le sampler dès qu'il est prêt. */
  const [field, setField] = React.useState(null)
  React.useEffect(() => {
    let id
    const seed = () => {
      const s = samplerRef.current
      if (s?.cfg?.l1Field) { setField({ ...s.cfg.l1Field }); return }
      id = requestAnimationFrame(seed)
    }
    seed()
    return () => cancelAnimationFrame(id)
  }, [samplerRef])

  const setParam = (key, val) => {
    const s = samplerRef.current
    if (s?.cfg?.l1Field) s.cfg.l1Field[key] = val // mutation live, lue au prochain tick Poisson
    setField((f) => ({ ...f, [key]: val }))
  }

  React.useEffect(() => {
    let frame = 0
    let rafId
    function tick() {
      rafId = requestAnimationFrame(tick)
      if (++frame % 2 !== 0) return
      const s = samplerRef.current
      if (!s?.ready) return
      const m = s.materialMeters()
      setMeters(m)
      setMaster(s.getMasterLevel())
      setPool(s.poolStats())
      const hits = {}
      let any = false
      for (const e of m) {
        if (e.triggerCount !== (prevCounts.current[e.id] ?? 0)) { hits[e.id] = true; any = true }
        prevCounts.current[e.id] = e.triggerCount
      }
      if (any) setHitIds(hits)
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [samplerRef])

  React.useEffect(() => {
    if (!Object.keys(hitIds).length) return
    const t = setTimeout(() => setHitIds({}), 90)
    return () => clearTimeout(t)
  }, [hitIds])

  /* Face level computation — projection directionnelle des voix de chaque
     matériau (positions réelles, recalculées chaque frame) sur les 6 faces. */
  const lw = headInputToWorld(head, coords)
  const listenerPos = [lw.x, lw.y, lw.z]

  const faceLevels = FACES.map(({ n }) => {
    let sum = 0
    for (const m of meters) {
      for (const v of m.voices) {
        const lin = isFinite(v.level) ? Math.pow(10, v.level / 20) : 0
        if (lin < 1e-9) continue
        const dir = norm3([v.x - listenerPos[0], v.y - listenerPos[1], v.z - listenerPos[2]])
        sum += lin * Math.max(0, dot3(n, dir))
      }
    }
    return sum < 1e-8 ? -Infinity : 20 * Math.log10(sum)
  })

  return (
    <aside className="dbg">
      <div className="dbg__head">
        <span className="dbg__title">Debug</span>
        <span className="dbg__badge">Ctrl+Alt+D</span>
      </div>

      <div className="dbg__body">

        <section className="dbg__sec">
          <div className="dbg__sech">Boîte noire · traçage causal</div>
          <div className="dbg__recmeta">
            <span className={'dbg__dot' + (recording ? ' live' : '')} />
            <span>{recording ? 'enregistrement' : 'à l\'arrêt'} · {traceCount} évén.</span>
          </div>
          <div className="dbg__rec">
            <button
              className={'dbg__btn' + (recording ? ' on' : '')}
              onClick={onToggleRecord}
              title="Ctrl+Alt+R"
            >
              {recording ? '■ Stop' : '● Rec'}
            </button>
            <button
              className="dbg__btn"
              onClick={onExport}
              disabled={recording || traceCount === 0}
              title="Télécharger le NDJSON"
            >
              ⤓ Export
            </button>
          </div>
        </section>

        <section className="dbg__sec">
          <div className="dbg__sech">Inputs · 6 faces de la tête</div>
          <div className="dbg__faces">
            {FACES.map(({ label }, i) => (
              <div key={label} className="dbg__face">
                <span className="dbg__flabel">{label}</span>
                <div className="dbg__ftrack">
                  <div className="dbg__ffill" style={{ width: dbToWidth(faceLevels[i]) + '%' }} />
                </div>
                <span className="dbg__fdb">{dbStr(faceLevels[i])}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="dbg__sec">
          <div className="dbg__sech">Sortie master (post-atténuation) · {dbStr(master)}</div>
        </section>

        <section className="dbg__sec">
          <div className="dbg__sech">
            Pool · {pool.busy}/{pool.size} voix · {pool.steals} vol{pool.steals > 1 ? 's' : ''}
          </div>
        </section>

        <section className="dbg__sec">
          <div className="dbg__sech">Matériaux · pool de voix partagé</div>
          <div className="dbg__zones">
            {meters.map((m) => (
              <div key={m.id} className={'dbg__zone' + (hitIds[m.id] ? ' hit' : '')}>
                <div className="dbg__zlabel">{m.label} · {m.rate.toFixed(0)}/s</div>
                <div className="dbg__zlevel">{dbStr(m.level)}</div>
                <div className="dbg__zbar">
                  <div className="dbg__zfill" style={{ width: dbToWidth(m.level) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </section>

        {field && (
          <section className="dbg__sec">
            <div className="dbg__sech">Répartition L1 héros · sphère 3D</div>
            <SliderRow k="débit /s" min={0} max={200} step={1} value={field.rate}
              onChange={(v) => setParam('rate', v)} fmt={(v) => v.toFixed(0)} />
            <SliderRow k="cœur" min={0} max={15} step={0.5} value={field.core}
              onChange={(v) => setParam('core', v)} fmt={(v) => v.toFixed(1) + ' m'} />
            <SliderRow k="σ rayon" min={0.5} max={30} step={0.5} value={field.sigma}
              onChange={(v) => setParam('sigma', v)} fmt={(v) => v.toFixed(1) + ' m'} />
            <SliderRow k="p forme" min={0.5} max={6} step={0.1} value={field.p}
              onChange={(v) => setParam('p', v)} fmt={(v) => v.toFixed(1)} />
            <SliderRow k="plancher" min={0} max={1} step={0.01} value={field.floor}
              onChange={(v) => setParam('floor', v)} fmt={(v) => v.toFixed(2)} />
            <SliderRow k="vertical ky" min={0} max={1} step={0.01} value={field.ky}
              onChange={(v) => setParam('ky', v)} fmt={(v) => v.toFixed(2)} />
            <FieldCurve field={field} />
            <div className="dbg__rec" style={{ marginTop: 8 }}>
              <button
                className={'dbg__btn' + (fieldViz ? ' on' : '')}
                onClick={onToggleFieldViz}
                title="Coquilles iso-poids dans le viewport 3D"
              >
                {fieldViz ? '◉ Sphère 3D' : '○ Sphère 3D'}
              </button>
            </div>
          </section>
        )}

      </div>
      <div className="dbg__foot">mesures audio réelles · AnalyserNode par voix</div>
    </aside>
  )
}
