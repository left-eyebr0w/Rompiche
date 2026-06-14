import React from 'react'
import { Button } from './Button.js'
import { Eyebrow } from './Eyebrow.js'
import { Slider } from './Slider.js'
import { Switch } from './Switch.js'
import { Tag } from './Tag.js'
import type { EngineContext } from '../engine/context/EngineContext.js'
import type { EngineStore } from './store.js'

const HUD_CSS = `
.hud{ width:340px; flex:0 0 340px; height:100%; background:var(--canvas-noir);
  border-left:1px solid var(--on-ink-border); display:flex; flex-direction:column;
  font-family:var(--font-sans); color:var(--on-ink-primary); }
.hud__head{ padding:20px 22px 16px; border-bottom:1px solid var(--on-ink-border);
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.hud__title{ font-size:15px; font-weight:600; margin:6px 0 0; }
.hud__body{ flex:1; overflow-y:auto; padding:8px 22px 22px; }
.hud__sec{ padding:18px 0; border-bottom:1px solid var(--on-ink-border); }
.hud__sec:last-child{ border-bottom:none; }
.hud__sech{ display:flex; align-items:center; gap:8px; margin-bottom:14px; }
.hud__sech .ic{ color:var(--on-ink-muted); display:flex; }
.hud__sech .ic svg{ width:15px; height:15px; }
.hud__stack{ display:flex; flex-direction:column; gap:14px; }
.hud__clock{ display:grid; grid-template-columns:repeat(4,1fr); gap:1px;
  background:var(--on-ink-border); border:1px solid var(--on-ink-border); border-radius:var(--radius-sm); overflow:hidden; }
.hud__seg{ background:var(--canvas-noir); padding:8px 4px; text-align:center;
  font-family:var(--font-mono); font-size:9px; letter-spacing:.06em; text-transform:uppercase; color:var(--on-ink-faint); }
.hud__seg.active{ background:var(--blanc); color:var(--noir); font-weight:600; }
.hud__seg{ appearance:none; border:none; cursor:pointer;
  transition:background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard); }
.hud__seg:hover:not(.active){ background:rgba(255,255,255,.07); color:var(--on-ink-primary); }
.hud__clockmode{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:9px; }
.hud__synced{ font-family:var(--font-mono); font-size:9px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--on-ink-faint); display:flex; align-items:center; gap:6px; }
.hud__synced::before{ content:""; width:5px; height:5px; border-radius:50%; background:var(--on-ink-faint); }
.hud__synced.live::before{ background:var(--blanc); }
.hud__foot{ padding:18px 22px; border-top:1px solid var(--on-ink-border); display:flex; flex-direction:column; gap:10px; }
.hud__note{ font-family:var(--font-mono); font-size:10px; color:var(--on-ink-faint); letter-spacing:.04em; line-height:1.5; }
.hud__btn-full > *{ width:100%; }
`
;(function () {
  if (typeof document === 'undefined' || document.getElementById('hud-css-j5')) return
  const s = document.createElement('style'); s.id = 'hud-css-j5'; s.textContent = HUD_CSS
  document.head.appendChild(s)
})()

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  React.useEffect(() => {
    const w = window as any
    if (w.lucide && ref.current) {
      ref.current.innerHTML = ''
      const el = document.createElement('i')
      el.setAttribute('data-lucide', name)
      ref.current.appendChild(el)
      try { w.lucide.createIcons({ attrs: { width: size, height: size, 'stroke-width': 1.6 } }) } catch {}
    }
  }, [name, size])
  return <span className="ic" ref={ref} />
}

export interface ControlHUDProps {
  ctx: EngineContext
  store: EngineStore
  loadKey: number
  onSave: (name: string) => void
  onLoad: (name: string) => void
  listSaves: () => Promise<string[]>
  deleteSave: (name: string) => Promise<void>
}

function SavesSection({ Button, Eyebrow, onSave, onLoad, listSaves, deleteSave }: {
  Button: any; Eyebrow: any;
  onSave: (name: string) => void;
  onLoad: (name: string) => void;
  listSaves: () => Promise<string[]>;
  deleteSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = React.useState('')
  const [slots, setSlots] = React.useState<string[]>([])
  const refresh = React.useCallback(() => { listSaves().then(setSlots).catch(() => {}) }, [listSaves])
  React.useEffect(() => { refresh() }, [refresh])

  const doSave = async () => {
    const n = name.trim()
    if (!n) return
    onSave(n)
    setName('')
    refresh()
  }

  const inputStyle = {
    flex: 1, padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--on-ink-border)',
    background: 'transparent', color: 'var(--on-ink-primary)', fontFamily: 'var(--font-mono)', fontSize: '12px',
  }

  return (
    <section className="hud__sec">
      <div className="hud__sech"><Icon name="save" /><Eyebrow tone="inverse">Sauvegardes</Eyebrow></div>
      <div className="hud__stack">
        <div style={{ display: 'flex', gap: '8px' }}>
          <input data-testid="save-name" placeholder="Nom de la scène" value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSave() }} style={inputStyle} />
          <Button inverse onClick={doSave} data-testid="save-btn">Enregistrer</Button>
        </div>
        {slots.length === 0
          ? <div className="hud__note">Aucune sauvegarde.</div>
          : slots.map(n => (
            <div key={n} data-testid={`slot-${n}`} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--on-ink-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
              <Button inverse onClick={() => onLoad(n)} data-testid={`load-${n}`}>Charger</Button>
              <Button inverse onClick={() => deleteSave(n)} data-testid={`del-${n}`}>✕</Button>
            </div>
          ))}
      </div>
    </section>
  )
}

export default function ControlHUD(props: ControlHUDProps) {
  const { ctx, onSave, onLoad, listSaves, deleteSave } = props

  const ctrl = ctx.input.controls

  const setCtrl = (patch: Partial<typeof ctrl>) => {
    Object.assign(ctrl, patch)
  }

  return (
    <aside className="hud">
      <div className="hud__head">
        <div>
          <Eyebrow tone="inverse">Contrôles moteur</Eyebrow>
          <h2 className="hud__title">Scène vitrine</h2>
        </div>
        <Tag variant="spec" inverse dot>J5</Tag>
      </div>

      <div className="hud__body">
        <section className="hud__sec">
          <div className="hud__sech"><Icon name="cloud-rain" /><Eyebrow tone="inverse">État du monde</Eyebrow></div>
          <div className="hud__stack">
            <Switch inverse label="Pluie" showState checked={ctrl.rain}
              onChange={(e: any) => setCtrl({ rain: e.target.checked })} />
            <Switch inverse label="Vent" showState checked={ctrl.wind?.force ? ctrl.wind.force > 0 : false}
              onChange={(e: any) => setCtrl({ wind: { ...ctrl.wind, force: e.target.checked ? 0.5 : 0 } })} />
          </div>
        </section>

<section className="hud__sec">
          <div className="hud__sech"><Icon name="box" /><Eyebrow tone="inverse">Éléments · surfaces</Eyebrow></div>
          <div className="hud__stack">
            <Switch inverse label="Surface métal" showState checked={ctrl.metal}
              onChange={(e: any) => setCtrl({ metal: e.target.checked })} />
            <Switch inverse label="Surface bâche" showState checked={ctrl.bache}
              onChange={(e: any) => setCtrl({ bache: e.target.checked })} />
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="move-3d" /><Eyebrow tone="inverse">Tête de l'auditeur</Eyebrow></div>
          <div className="hud__stack">
            <Slider inverse label="Axe X — gauche / droite" min={-1} max={1} step={0.01}
              value={ctrl.listener.x} formatValue={(v: number) => v.toFixed(2)}
              onChange={(e: any) => { ctrl.listener.x = parseFloat(e.target.value); setCtrl({ listener: ctrl.listener }) }} />
            <Slider inverse label="Axe Y — bas / haut" min={-1} max={1} step={0.01}
              value={ctrl.listener.y} formatValue={(v: number) => v.toFixed(2)}
              onChange={(e: any) => { ctrl.listener.y = parseFloat(e.target.value); setCtrl({ listener: ctrl.listener }) }} />
            <Slider inverse label="Axe Z — avant / arrière" min={-1} max={1} step={0.01}
              value={ctrl.listener.z} formatValue={(v: number) => v.toFixed(2)}
              onChange={(e: any) => { ctrl.listener.z = parseFloat(e.target.value); setCtrl({ listener: ctrl.listener }) }} />
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="wind" /><Eyebrow tone="inverse">Paramètres de vent</Eyebrow></div>
          <div className="hud__stack">
            <Slider inverse label="Rotation" min={0} max={360} step={5}
              value={ctrl.wind?.rot ?? 0} disabled={(ctrl.wind?.force ?? 0) <= 0}
              formatValue={(v: number) => Math.round(v) + '°'}
              onChange={(e: any) => setCtrl({ wind: { ...ctrl.wind, rot: parseFloat(e.target.value) } })} />
            <Slider inverse label="Force" min={0} max={1} step={0.05}
              value={ctrl.wind?.force ?? 0} disabled={(ctrl.wind?.force ?? 0) <= 0}
              formatValue={(v: number) => v.toFixed(2)}
              onChange={(e: any) => setCtrl({ wind: { ...ctrl.wind, force: parseFloat(e.target.value) } })} />
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="sliders-horizontal" /><Eyebrow tone="inverse">Paramètres de pluie</Eyebrow></div>
          <div className="hud__stack">
            <Slider inverse label="Densité" min={0} max={1} step={0.01}
              value={ctrl.density} disabled={!ctrl.rain}
              formatValue={(v: number) => v.toFixed(2)}
              onChange={(e: any) => setCtrl({ density: parseFloat(e.target.value) })} />
          </div>
        </section>

        <SavesSection Button={Button} Eyebrow={Eyebrow}
          onSave={onSave} onLoad={onLoad} listSaves={listSaves} deleteSave={deleteSave} />
      </div>
    </aside>
  )
}
