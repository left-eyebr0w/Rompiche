import React from 'react'
import { useSyncExternalStore } from 'react'
import type { EngineSnapshot } from './EngineSnapshot.js'
import type { EngineStore } from './store.js'

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
.dbg__sl{ display:flex; align-items:center; gap:8px; margin-bottom:9px; }
.dbg__slk{ width:58px; flex:0 0 58px; font-size:8px; letter-spacing:.04em; color:var(--on-ink-muted); }
.dbg__slr{ flex:1; min-width:0; accent-color:#e8c96d; height:3px; }
.dbg__slv{ width:42px; text-align:right; font-size:9px; color:var(--on-ink-primary);
  font-variant-numeric:tabular-nums; }
.dbg__slin{ width:42px; flex:0 0 42px; text-align:right; font-size:9px;
  font-family:var(--font-mono); color:var(--on-ink-primary); font-variant-numeric:tabular-nums;
  background:transparent; border:1px solid transparent; border-radius:2px; padding:1px 2px;
  -moz-appearance:textfield; }
.dbg__slin::-webkit-outer-spin-button,.dbg__slin::-webkit-inner-spin-button{
  -webkit-appearance:none; margin:0; }
.dbg__slin:hover{ border-color:rgba(255,255,255,.12); }
.dbg__slin:focus{ outline:none; border-color:rgba(232,201,109,.5); color:#e8c96d; }
.dbg__slunit{ width:12px; flex:0 0 12px; font-size:8px; color:var(--on-ink-faint); }
.dbg__btn{ font-family:var(--font-mono); font-size:8px; letter-spacing:.06em;
  text-transform:uppercase; color:var(--on-ink-muted); background:rgba(255,255,255,.04);
  border:1px solid rgba(255,255,255,.1); border-radius:3px; padding:3px 7px; cursor:pointer;
  transition:background .05s, border-color .05s, color .05s; }
.dbg__btn:hover{ border-color:rgba(232,201,109,.4); color:var(--on-ink-primary); }
.dbg__btn.on{ background:rgba(232,201,109,.16); border-color:rgba(232,201,109,.5); color:#e8c96d; }
.dbg__lgctl{ display:flex; gap:4px; margin-left:auto; }
.dbg__lgbtn{ font-family:var(--font-mono); font-size:7px; letter-spacing:.04em;
  text-transform:uppercase; color:var(--on-ink-faint); background:transparent;
  border:1px solid rgba(255,255,255,.1); border-radius:2px; padding:1px 4px; cursor:pointer;
  transition:background .05s, border-color .05s, color .05s; }
.dbg__lgbtn:hover{ border-color:rgba(232,201,109,.4); color:var(--on-ink-primary); }
.dbg__lgbtn.solo{ background:rgba(232,201,109,.18); border-color:rgba(232,201,109,.55); color:#e8c96d; }
.dbg__lgbtn.mute{ background:rgba(214,90,90,.18); border-color:rgba(214,90,90,.55); color:#e08080; }
.dbg__subh{ font-size:8px; letter-spacing:.14em; text-transform:uppercase;
  color:rgba(232,201,109,.6); margin:14px 0 10px; padding-top:12px;
  border-top:1px solid rgba(255,255,255,.06); }
.dbg__sech--row{ display:flex; align-items:center; gap:8px; cursor:pointer;
  user-select:none; }
.dbg__caret{ font-size:8px; color:rgba(232,201,109,.5); transition:transform .1s; }
`
;(function () {
  if (typeof document === 'undefined' || document.getElementById('dbg-css-j5')) return
  const s = document.createElement('style'); s.id = 'dbg-css-j5'; s.textContent = DBG_CSS
  document.head.appendChild(s)
})()

const FACES = [
  { label: 'FRONT' }, { label: 'BACK' }, { label: 'DROIT' },
  { label: 'GAUCH' }, { label: 'HAUT' }, { label: 'BAS' },
] as const

function dbToWidth(db: number): number {
  if (!isFinite(db)) return 0
  return Math.max(0, Math.min(100, (db + 40) / 40 * 100))
}

function dbStr(db: number): string {
  return !isFinite(db) ? '—' : db.toFixed(1) + ' dB'
}

export interface DebugHUDProps {
  store: EngineStore
  frontierViz: boolean
  onToggleFrontierViz: () => void
}

/* Visualisation des ZONES de pluie par distance horizontale (notes/random/pluie.txt).
   Axe X = distance tête→goutte. Deux zones DISJOINTES : disque L1 (jaune, [0, rL1])
   et anneau L2 (cyan, [rL1, rMaxL2]). Sous l'axe, la bande de TIMBRE montre le mix :
   plat (clair = L1) sur le disque, puis glissement clair→sourd à travers l'anneau L2
   (mix 0→1) — exactement la dérivation de `mix` que RainPoisson applique. */
function RainZonesCurve({ rain, timbre }: { rain: any; timbre: any }) {
  if (!rain) return null
  const W = 244, H = 60, padL = 4, padR = 4, padT = 4, padB = 24
  const { rL1 = 8, rMaxL2 = 20 } = rain
  const dMax = Math.max(rMaxL2 + 4, 16)
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB
  const sx = (d: number) => x0 + (Math.min(d, dMax) / dMax) * (x1 - x0)
  const xL1 = sx(rL1)
  const xL2 = sx(rMaxL2)

  /* Bande de timbre : clair (L1) sur tout le disque, puis dégradé clair→sourd sur l'anneau. */
  const bandY = y1 + 5, bandH = 6
  const gradId = 'dbg-timbre-grad'
  const fL1 = (xL1 - x0) / (x1 - x0)
  const fL2 = (xL2 - x0) / (x1 - x0)
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', marginTop: 2 }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#e8c96d" stopOpacity="0.85" />
          <stop offset={fL1} stopColor="#e8c96d" stopOpacity="0.85" />
          <stop offset={fL2} stopColor="#5fd0e8" stopOpacity="0.7" />
          <stop offset="1" stopColor="#5fd0e8" stopOpacity="0.35" />
        </linearGradient>
      </defs>
      <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="rgba(255,255,255,.02)" />
      {/* Disque L1 (jaune) et anneau L2 (cyan), disjoints. */}
      <rect x={x0} y={y0} width={Math.max(0, xL1 - x0)} height={y1 - y0} fill="rgba(232,201,109,.14)" />
      <rect x={xL1} y={y0} width={Math.max(0, xL2 - xL1)} height={y1 - y0} fill="rgba(95,208,232,.10)" />
      <line x1={xL1} y1={y0} x2={xL1} y2={y1}
        stroke="rgba(255,255,255,.22)" strokeWidth="1" strokeDasharray="2 3" />
      <line x1={xL2} y1={y0} x2={xL2} y2={y1}
        stroke="rgba(255,255,255,.18)" strokeWidth="1" strokeDasharray="2 3" />
      <text x={(x0 + xL1) / 2} y={y0 + 12} fontSize="8" textAnchor="middle"
        fill="rgba(232,201,109,.8)" fontFamily="var(--font-mono)">L1</text>
      <text x={(xL1 + xL2) / 2} y={y0 + 12} fontSize="8" textAnchor="middle"
        fill="rgba(95,208,232,.8)" fontFamily="var(--font-mono)">L2</text>
      {/* Bande de timbre L1→L2 (présente seulement si la config timbre existe). */}
      {timbre && <rect x={x0} y={bandY} width={x1 - x0} height={bandH} fill={`url(#${gradId})`} rx="1" />}
      {timbre && (
        <text x={x0 + 1} y={bandY + bandH + 7} fontSize="6"
          fill="rgba(255,255,255,.35)" fontFamily="var(--font-mono)">timbre L1</text>
      )}
      {timbre && (
        <text x={x1 - 1} y={bandY + bandH + 7} fontSize="6" textAnchor="end"
          fill="rgba(255,255,255,.35)" fontFamily="var(--font-mono)">L2</text>
      )}
      <text x={x0 + 2} y={y1 + 8} fontSize="7"
        fill="rgba(255,255,255,.4)" fontFamily="var(--font-mono)">proche</text>
      <text x={x1 - 2} y={y1 + 8} fontSize="7" textAnchor="end"
        fill="rgba(255,255,255,.3)" fontFamily="var(--font-mono)">{dMax.toFixed(0)} m</text>
    </svg>
  )
}

/* Compte de décimales d'un pas (0.01 → 2) pour arrondir proprement molette/saisie. */
function stepDecimals(step: number): number {
  const s = String(step)
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

/* Ligne slider : range + champ NUMÉRIQUE éditable + molette au survol.
   - molette : ±1 step (Shift = ×10), bornée à [min,max] ;
   - champ : saisie libre, validée sur Entrée/blur (clamp + arrondi au step) ;
   - `unit` : suffixe affiché à droite du nombre (m, c, ms…). Le nombre édité est
     dans le DOMAINE du range — l'appelant fait la conversion d'unité comme avant. */
function SliderRow({ k, min, max, step, value, onChange, fmt, unit }: {
  k: string; min: number; max: number; step: number; value: number;
  onChange: (v: number) => void; fmt: (v: number) => string; unit?: string;
}) {
  const dec = stepDecimals(step)
  const clamp = (v: number) => Math.max(min, Math.min(max, v))
  const round = (v: number) => parseFloat(clamp(v).toFixed(dec))
  const [draft, setDraft] = React.useState<string | null>(null)

  const commit = (raw: string) => {
    const n = parseFloat(raw.replace(',', '.'))
    if (isFinite(n)) onChange(round(n))
    setDraft(null)
  }
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const mult = e.shiftKey ? 10 : 1
    const dir = e.deltaY < 0 ? 1 : -1
    onChange(round(value + dir * step * mult))
  }

  return (
    <div className="dbg__sl" onWheel={onWheel}>
      <span className="dbg__slk">{k}</span>
      <input
        className="dbg__slr" type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <input
        className="dbg__slin" type="number" min={min} max={max} step={step}
        value={draft ?? round(value)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { commit((e.target as HTMLInputElement).value); (e.target as HTMLInputElement).blur() }
          else if (e.key === 'Escape') { setDraft(null); (e.target as HTMLInputElement).blur() }
        }}
        title={fmt(value)}
      />
      {unit ? <span className="dbg__slunit">{unit}</span> : <span className="dbg__slunit" />}
    </div>
  )
}

/* Section repliable (cadrage 05 §Instrument item 10) : titre cliquable + caret. L'état
   replié est purement UI (pas de moteur). `title` peut porter du JSX (niveaux live). */
function Section(
  { id, title, open, onToggle, children }:
  { id: string; title: React.ReactNode; open: boolean; onToggle: (id: string) => void; children?: React.ReactNode },
) {
  return (
    <section className="dbg__sec">
      <div className="dbg__sech dbg__sech--row" onClick={() => onToggle(id)}>
        <span className="dbg__caret" style={{ transform: open ? 'none' : 'rotate(-90deg)' }}>▾</span>
        <span>{title}</span>
      </div>
      {open && children}
    </section>
  )
}

/* ── Persistance des réglages debug (localStorage) ──────────────────────────
   On mémorise entre deux ouvertures du panneau : sections repliées, solo/mute,
   et les valeurs réglables (rain : λ + zones, grain, timbre, budgets de voix).
   Les valeurs sont REPOUSSÉES dans ctx au montage via les setters réels, pour
   que l'affichage ET le son repartent du mix sauvegardé. */
const PREFS_KEY = 'rompiche.debug.prefs.v1'

interface DebugPrefs {
  open?: Record<string, boolean>
  solo?: 'L1' | 'L2' | 'L3' | null
  muted?: Record<string, boolean>
  rain?: Record<string, number>
  grain?: Record<string, number>
  timbre?: Record<string, number>
  voices?: { L1?: number; L2?: number }
}

function loadPrefs(): DebugPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    return raw ? (JSON.parse(raw) as DebugPrefs) : {}
  } catch { return {} }
}

function savePrefs(p: DebugPrefs): void {
  try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)) } catch { /* quota/private mode */ }
}

/* Réécrit les nombres d'un preset dans une cible muable (config ctx), clé par clé. */
function applyNums(target: any, src: Record<string, number> | undefined): void {
  if (!target || !src) return
  for (const [k, v] of Object.entries(src)) {
    if (typeof v === 'number' && isFinite(v)) target[k] = v
  }
}

export default function DebugHUD({ store, frontierViz, onToggleFrontierViz }: DebugHUDProps) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot) as EngineSnapshot

  /* Préférences chargées une seule fois (synchronement) : disponibles dès le 1er rendu
     pour initialiser open/solo/muted, et au montage pour repousser les valeurs dans ctx. */
  const prefsRef = React.useRef<DebugPrefs>(loadPrefs())

  const [ctx, setCtx] = React.useState<any>(null)
  /* Génération de pluie : 2 flux Poisson (λ L1/L2) + zones (rL1/rMaxL2) + régime. */
  const [rain, setRain] = React.useState<any>(null)

  React.useEffect(() => {
    const w = (window as any).__rompiche
    if (w?.ctx) {
      const p = prefsRef.current
      /* Repousser les valeurs sauvegardées dans ctx AVANT d'hydrater l'état React. */
      applyNums(w.ctx.worldConfig?.rain, p.rain)
      applyNums(w.ctx.worldConfig?.grain, p.grain)
      applyNums(w.ctx.worldConfig?.timbre, p.timbre)
      if (p.voices?.L1 != null) w.resizeVoices?.('L1', p.voices.L1)
      if (p.voices?.L2 != null) w.resizeVoices?.('L2', p.voices.L2)
      setCtx(w.ctx)
      if (w.ctx.worldConfig?.rain) setRain({ ...w.ctx.worldConfig.rain })
    }
  }, [])

  const setRainParam = (key: string, val: number) => {
    if (!ctx?.worldConfig?.rain) return
    ctx.worldConfig.rain[key] = val
    setRain((r: any) => ({ ...r, [key]: val }))
  }

  /* Timbre de la pluie (durée/détune/attaque/cooldown) : ex-constantes, réglables live. */
  const [grain, setGrain] = React.useState<any>(null)
  React.useEffect(() => {
    const w = (window as any).__rompiche
    if (w?.ctx?.worldConfig?.grain) setGrain({ ...w.ctx.worldConfig.grain })
  }, [])
  const setGrainParam = (key: string, val: number) => {
    if (!ctx?.worldConfig?.grain) return
    ctx.worldConfig.grain[key] = val
    setGrain((f: any) => ({ ...f, [key]: val }))
  }

  /* Timbre « flouté + pitché » des voix (interpolé L1↔L2 par mix) : réglable live. */
  const [timbre, setTimbre] = React.useState<any>(null)
  React.useEffect(() => {
    const w = (window as any).__rompiche
    if (w?.ctx?.worldConfig?.timbre) setTimbre({ ...w.ctx.worldConfig.timbre })
  }, [])
  const setTimbreParam = (key: string, val: number) => {
    if (!ctx?.worldConfig?.timbre) return
    ctx.worldConfig.timbre[key] = val
    setTimbre((f: any) => ({ ...f, [key]: val }))
  }

  /* Budgets de voix par couche (réglables live) : recréent les entités voix à la volée
     via __rompiche.resizeVoices. Permet d'équilibrer L1 (héros proches) / L2 (lointaines)
     à l'oreille selon la frontière choisie. */
  const [voicesL1, setVoicesL1] = React.useState<number>(0)
  const [voicesL2, setVoicesL2] = React.useState<number>(0)
  React.useEffect(() => {
    const w = (window as any).__rompiche
    if (w?.ctx?.worldConfig?.layers) {
      setVoicesL1(w.ctx.worldConfig.layers.L1.voices ?? 0)
      setVoicesL2(w.ctx.worldConfig.layers.L2.voicesMax ?? 0)
    }
  }, [])
  const setVoiceBudget = (layer: 'L1' | 'L2', count: number) => {
    const w = (window as any).__rompiche
    w?.resizeVoices?.(layer, count)
    if (layer === 'L1') setVoicesL1(count); else setVoicesL2(count)
  }

  /* Solo/mute par couche (cadrage 05 §Instrument) : l'UI ne fait que produire les 3 gains
     ctx.layerGain ; le moteur les applique (3 chemins audio). Règle : un seul solo à la fois
     (re-cliquer = annuler) ; mute indépendant par couche ; un solo masque les mutes des autres. */
  type Layer = 'L1' | 'L2' | 'L3'
  const [solo, setSolo] = React.useState<Layer | null>(() => prefsRef.current.solo ?? null)
  const [muted, setMuted] = React.useState<Record<Layer, boolean>>(() => ({
    L1: !!prefsRef.current.muted?.L1, L2: !!prefsRef.current.muted?.L2, L3: !!prefsRef.current.muted?.L3,
  }))

  const applyGains = (s: Layer | null, m: Record<Layer, boolean>) => {
    if (!ctx?.layerGain) return
    for (const L of ['L1', 'L2', 'L3'] as Layer[]) {
      const audible = s ? L === s : !m[L]
      ctx.layerGain[L] = audible ? 1 : 0
    }
  }
  const toggleSolo = (L: Layer) => {
    const next = solo === L ? null : L
    setSolo(next); applyGains(next, muted)
  }
  const toggleMute = (L: Layer) => {
    const next = { ...muted, [L]: !muted[L] }
    setMuted(next); applyGains(solo, next)
  }

  /* Réappliquer les gains sauvegardés (solo/mute) dès que ctx est prêt. */
  React.useEffect(() => {
    if (ctx?.layerGain) applyGains(solo, muted)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx])

  /* État replié des sections (item 10). Par défaut : l'essentiel ouvert, les sliders fins repliés.
     Fusionné avec les préférences sauvegardées (une section nouvelle garde son défaut). */
  const [open, setOpen] = React.useState<Record<string, boolean>>(() => ({
    tete: false, sortie: true, couches: true, pool: true, mat: true,
    frontiere: false, timbre: false, edition: false,
    ...prefsRef.current.open,
  }))
  const toggle = (id: string) => setOpen((o) => ({ ...o, [id]: !o[id] }))

  /* Édition du terrain (debug-grade, cadrage 07) : peint un disque du matériau choisi
     centré sur la position MONDE courante de la tête (lue dans ctx live). Le moteur
     applique + rebake le pool tout seul (EditSystem) → le son suit au tick suivant. */
  const [editRadius, setEditRadius] = React.useState(4)
  const paintUnderHead = (mat: string) => {
    const head = ctx?.headWorldPos
    if (!head) return
    store.pushCommand({
      t: 'edit',
      brush: { shape: { kind: 'disc', center: { x: head.x, y: head.y, z: head.z }, radius: editRadius }, op: { t: 'paint', mat: mat as any } },
    })
  }

  /* Persister les préférences à chaque changement (valeurs, repli, solo/mute, voix).
     GARDE-FOU : ne PAS sauvegarder tant que l'hydratation initiale n'est pas finie.
     Sinon le tout premier rendu (rain/grain/timbre = null, voices = 0) écrase
     le localStorage AVANT que les effets d'hydratation aient peuplé les états → au
     rechargement on relit des zéros (0 voix) et des champs absents. On n'arme la
     sauvegarde qu'une fois ctx prêt ET tous les états réglables hydratés. */
  const hydrated = !!ctx && rain != null && grain != null && timbre != null
  React.useEffect(() => {
    if (!hydrated) return
    savePrefs({
      open, solo, muted,
      rain: rain ?? undefined,
      grain: grain ?? undefined,
      timbre: timbre ?? undefined,
      voices: { L1: voicesL1, L2: voicesL2 },
    })
  }, [hydrated, open, solo, muted, rain, grain, timbre, voicesL1, voicesL2])

  const { master, pool, materials, faceLevels, layers } = snapshot

  return (
    <aside className="dbg">
      <div className="dbg__head">
        <span className="dbg__title">Debug</span>
        <span className="dbg__badge">Ctrl+Alt+D</span>
      </div>

      <div className="dbg__body">
        <Section id="sortie" title={`Sortie master (post-atténuation) · ${dbStr(master)}`}
          open={open.sortie} onToggle={toggle} />

        <Section id="couches" title="Couches · niveaux réels · solo / mute"
          open={open.couches} onToggle={toggle}>
          <div className="dbg__faces">
            {([
              ['L1', 'L1 héros', layers.L1.level],
              ['L2', 'L2 secteurs', layers.L2.level],
              ['L3', 'L3 nappe', layers.L3.level],
            ] as const).map(([key, label, lvl]) => {
              const audible = solo ? key === solo : !muted[key]
              return (
                <div key={key} className="dbg__face">
                  <span className="dbg__flabel" style={{ width: 56, flexBasis: 56 }}>{label}</span>
                  <div className="dbg__ftrack" style={{ opacity: audible ? 1 : 0.25 }}>
                    <div className="dbg__ffill" style={{ width: dbToWidth(lvl) + '%' }} />
                  </div>
                  <span className="dbg__fdb" style={{ width: 40, opacity: audible ? 1 : 0.4 }}>{dbStr(lvl)}</span>
                  <div className="dbg__lgctl">
                    <button
                      className={'dbg__lgbtn' + (solo === key ? ' solo' : '')}
                      onClick={() => toggleSolo(key)} title="Solo (isole cette couche)"
                    >S</button>
                    <button
                      className={'dbg__lgbtn' + (muted[key] ? ' mute' : '')}
                      onClick={() => toggleMute(key)} title="Mute (coupe cette couche)"
                    >M</button>
                  </div>
                </div>
              )
            })}
          </div>
        </Section>

        <Section
          id="pool"
          title={`Pool · ${pool.busy}/${pool.size} voix · ${pool.steals} vol${pool.steals > 1 ? 's' : ''}`}
          open={open.pool} onToggle={toggle}
        >
          <SliderRow k="voix L1" min={0} max={64} step={1} value={voicesL1}
            onChange={(v) => setVoiceBudget('L1', v)} fmt={(v) => v.toFixed(0)} />
          <SliderRow k="voix L2" min={0} max={64} step={1} value={voicesL2}
            onChange={(v) => setVoiceBudget('L2', v)} fmt={(v) => v.toFixed(0)} />
        </Section>

        <Section id="mat" title="Matériaux · pool de voix partagé" open={open.mat} onToggle={toggle}>
          <div className="dbg__zones">
            {materials.map((m) => (
              <div key={m.id} className="dbg__zone">
                <div className="dbg__zlabel">{m.label} · {m.rate.toFixed(0)}/s</div>
                <div className="dbg__zlevel">{dbStr(m.level)}</div>
                <div className="dbg__zbar">
                  <div className="dbg__zfill" style={{ width: dbToWidth(m.level) + '%' }} />
                </div>
              </div>
            ))}
          </div>
        </Section>

        {rain && (
          <Section id="frontiere" title="Pluie · 2 flux Poisson (L1 proche / L2 lointain) · zones"
            open={open.frontiere} onToggle={toggle}>
            <SliderRow k="λ L1 (gouttes/s)" min={0} max={200} step={1} value={rain.lambdaL1 ?? 40}
              onChange={(v) => setRainParam('lambdaL1', v)} fmt={(v) => v.toFixed(0)} />
            <SliderRow k="λ L2 (gouttes/s)" min={0} max={200} step={1} value={rain.lambdaL2 ?? 20}
              onChange={(v) => setRainParam('lambdaL2', v)} fmt={(v) => v.toFixed(0)} />
            <SliderRow k="rayon L1 (m)" min={0} max={30} step={0.5} value={rain.rL1 ?? 8}
              onChange={(v) => setRainParam('rL1', v)} fmt={(v) => v.toFixed(1)} />
            <SliderRow k="rayon max L2 (m)" min={0} max={40} step={0.5} value={rain.rMaxL2 ?? 20}
              onChange={(v) => setRainParam('rMaxL2', v)} fmt={(v) => v.toFixed(1)} />
            <SliderRow k="régime (×λ)" min={0} max={4} step={0.05} value={rain.regimeMult ?? 1}
              onChange={(v) => setRainParam('regimeMult', v)} fmt={(v) => '×' + v.toFixed(2)} />
            <RainZonesCurve rain={rain} timbre={timbre} />
            <div className="dbg__rec" style={{ marginTop: 8 }}>
              <button
                className={'dbg__btn' + (frontierViz ? ' on' : '')}
                onClick={onToggleFrontierViz}
                title="Cercles de zones L1→L2 dans le viewport 3D"
              >
                {frontierViz ? '◉ Zones 3D' : '○ Zones 3D'}
              </button>
            </div>

            {/* Timbre des voix = le mix rendu en son : il glisse le long du MÊME axe
                proche↔loin que la courbe ci-dessus. D'où l'imbrication sous le continuum
                plutôt qu'une section séparée. Bornes L1 (proche) / L2 (loin) interpolées. */}
            {timbre && (
              <>
                <div className="dbg__subh">Voix · flou + pitch (L1 ↔ L2)</div>
                <SliderRow k="passe-bas L1 (Hz)" min={500} max={20000} step={100} value={timbre.lowpassHzL1 ?? 18000}
                  onChange={(v) => setTimbreParam('lowpassHzL1', v)} fmt={(v) => (v / 1000).toFixed(1) + 'k'} />
                <SliderRow k="passe-bas L2 (Hz)" min={500} max={20000} step={100} value={timbre.lowpassHzL2 ?? 3500}
                  onChange={(v) => setTimbreParam('lowpassHzL2', v)} fmt={(v) => (v / 1000).toFixed(1) + 'k'} />
                <SliderRow k="diffusion L1" min={0} max={1} step={0.01} value={timbre.diffusionL1 ?? 0}
                  onChange={(v) => setTimbreParam('diffusionL1', v)} fmt={(v) => (v * 100).toFixed(0) + '%'} />
                <SliderRow k="diffusion L2" min={0} max={1} step={0.01} value={timbre.diffusionL2 ?? 0.35}
                  onChange={(v) => setTimbreParam('diffusionL2', v)} fmt={(v) => (v * 100).toFixed(0) + '%'} />
                <SliderRow k="pitch L1 (demi-tons)" min={-12} max={12} step={0.5} value={timbre.pitchL1 ?? 0}
                  onChange={(v) => setTimbreParam('pitchL1', v)} fmt={(v) => v.toFixed(1)} />
                <SliderRow k="pitch L2 (demi-tons)" min={-12} max={12} step={0.5} value={timbre.pitchL2 ?? -3}
                  onChange={(v) => setTimbreParam('pitchL2', v)} fmt={(v) => v.toFixed(1)} />
                <SliderRow k="délai diffusion (ms)" min={0} max={500} step={5} value={(timbre.delayS ?? 0.08) * 1000}
                  onChange={(v) => setTimbreParam('delayS', v / 1000)} fmt={(v) => v.toFixed(0)} />
                <SliderRow k="retour diffusion" min={0} max={0.95} step={0.01} value={timbre.feedback ?? 0.35}
                  onChange={(v) => setTimbreParam('feedback', v)} fmt={(v) => (v * 100).toFixed(0) + '%'} />
              </>
            )}
          </Section>
        )}

        {grain && (
          <Section id="timbre" title="Grain · son d'une goutte"
            open={open.timbre} onToggle={toggle}>
            <SliderRow k="durée (ms)" min={20} max={1000} step={10} value={(grain.duréeS ?? 0.3) * 1000}
              onChange={(v) => setGrainParam('duréeS', v / 1000)} fmt={(v) => v.toFixed(0)} />
            <SliderRow k="détune ±" min={0} max={200} step={2} value={grain.detuneSpan ?? 40}
              onChange={(v) => setGrainParam('detuneSpan', v)} fmt={(v) => (v / 2).toFixed(0) + ' c'} />
            <SliderRow k="attaque (ms)" min={0.5} max={50} step={0.5} value={(grain.attaqueS ?? 0.004) * 1000}
              onChange={(v) => setGrainParam('attaqueS', v / 1000)} fmt={(v) => v.toFixed(1)} />
            <SliderRow k="cooldown (ms)" min={0} max={300} step={5} value={(grain.cooldownS ?? 0.08) * 1000}
              onChange={(v) => setGrainParam('cooldownS', v / 1000)} fmt={(v) => v.toFixed(0)} />
          </Section>
        )}

        <Section id="edition" title="Édition terrain · peindre sous l'auditeur (debug)"
          open={open.edition} onToggle={toggle}>
          <SliderRow k="rayon (m)" min={0.5} max={10} step={0.5} value={editRadius}
            onChange={setEditRadius} fmt={(v) => v.toFixed(1)} />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
            {['terre', 'metal', 'bache'].map((m) => (
              <button key={m} className="dbg__btn" onClick={() => paintUnderHead(m)}
                title={`Peindre un disque de ${m} sous l'auditeur`}>{m}</button>
            ))}
          </div>
        </Section>

        <Section id="tete" title="Tête · 6 faces (inputs directionnels)" open={open.tete} onToggle={toggle}>
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
        </Section>
      </div>
      <div className="dbg__foot">mesures audio réelles · AnalyserNode par voix</div>
    </aside>
  )
}
