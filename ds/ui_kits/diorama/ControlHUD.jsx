import React from 'react'

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
  if (typeof document === 'undefined' || document.getElementById('hud-css')) return
  const s = document.createElement('style'); s.id = 'hud-css'; s.textContent = HUD_CSS
  document.head.appendChild(s)
})()

function Icon({ name, size = 16 }) {
  const ref = React.useRef(null)
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = ''
      const el = document.createElement('i')
      el.setAttribute('data-lucide', name)
      ref.current.appendChild(el)
      try { window.lucide.createIcons({ attrs: { width: size, height: size, 'stroke-width': 1.6 } }) } catch (e) {}
    }
  }, [name, size])
  return <span className="ic" ref={ref} />
}

export default function ControlHUD(props) {
  const DS = window.DioramaSonoreDesignSystem_6d9bc4
  const { Switch, Slider, Button, Tag, Eyebrow } = DS
  const { state, set, segments, clock, clockMode } = props

  return (
    <aside className="hud">
      <div className="hud__head">
        <div>
          <Eyebrow tone="inverse">Contrôles moteur</Eyebrow>
          <h2 className="hud__title">Scène vitrine</h2>
        </div>
        <Tag variant="spec" inverse dot>v0</Tag>
      </div>

      <div className="hud__body">
        <section className="hud__sec">
          <div className="hud__sech"><Icon name="cloud-rain" /><Eyebrow tone="inverse">État du monde</Eyebrow></div>
          <div className="hud__stack">
            <Switch inverse label="Pluie" showState checked={state.rain}
              onChange={e => set({ rain: e.target.checked })} />
            <Switch inverse label="Vent" showState checked={state.wind}
              onChange={e => set({ wind: e.target.checked })} />
            <div>
              <div className="hud__note" style={{ marginBottom: 8 }}>
                Horloge interne · {clockMode === 'manual' ? 'réglage manuel' : 'synchronisée'}
              </div>
              <div className="hud__clock">
                {segments.map(s => (
                  <button key={s} type="button"
                    className={'hud__seg' + (s === clock ? ' active' : '')}
                    onClick={() => set({ clockMode: 'manual', clockSegment: s })}>{s}</button>
                ))}
              </div>
              <div className="hud__clockmode">
                <span className={'hud__synced' + (clockMode === 'sync' ? ' live' : '')}>
                  {clockMode === 'sync' ? 'synchronisée à l\'heure locale' : 'découplée de l\'heure réelle'}
                </span>
                <Button variant="inverse-ghost" size="sm" mono
                  iconLeft={<Icon name="refresh-cw" size={12} />}
                  disabled={clockMode === 'sync'}
                  onClick={() => set({ clockMode: 'sync' })}>Resync</Button>
              </div>
            </div>
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="box" /><Eyebrow tone="inverse">Éléments · surfaces</Eyebrow></div>
          <div className="hud__stack">
            <Switch inverse label="Surface métal" showState checked={state.metal}
              onChange={e => set({ metal: e.target.checked })} />
            <Switch inverse label="Surface bâche" showState checked={state.bache}
              onChange={e => set({ bache: e.target.checked })} />
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="move-3d" /><Eyebrow tone="inverse">Tête de l'auditeur</Eyebrow></div>
          <div className="hud__stack">
            <Slider inverse label="Axe X — gauche / droite" min={-1} max={1} step={0.01}
              value={state.x} formatValue={v => v.toFixed(2)} onChange={e => set({ x: parseFloat(e.target.value) })} />
            <Slider inverse label="Axe Y — bas / haut" min={-1} max={1} step={0.01}
              value={state.y} formatValue={v => v.toFixed(2)} onChange={e => set({ y: parseFloat(e.target.value) })} />
            <Slider inverse label="Axe Z — avant / arrière" min={-1} max={1} step={0.01}
              value={state.z} formatValue={v => v.toFixed(2)} onChange={e => set({ z: parseFloat(e.target.value) })} />
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="wind" /><Eyebrow tone="inverse">Paramètres de vent</Eyebrow></div>
          <div className="hud__stack">
            <Slider inverse label="Inclinaison" min={0} max={1} step={0.05}
              value={state.windTilt} disabled={!state.wind}
              formatValue={v => v.toFixed(2)}
              onChange={e => set({ windTilt: parseFloat(e.target.value) })} />
            <Slider inverse label="Rotation" min={0} max={360} step={5}
              value={state.windRotation} disabled={!state.wind}
              formatValue={v => Math.round(v) + '°'}
              onChange={e => set({ windRotation: parseFloat(e.target.value) })} />
            <Slider inverse label="Force" min={0} max={1} step={0.05}
              value={state.windForce} disabled={!state.wind}
              formatValue={v => v.toFixed(2)}
              onChange={e => set({ windForce: parseFloat(e.target.value) })} />
          </div>
        </section>

        <section className="hud__sec">
          <div className="hud__sech"><Icon name="sliders-horizontal" /><Eyebrow tone="inverse">Paramètres de pluie</Eyebrow></div>
          <div className="hud__stack">
            <Slider inverse label="Densité" min={0} max={1} step={0.01}
              value={state.density} disabled={!state.rain} formatValue={v => v.toFixed(2)} onChange={e => set({ density: parseFloat(e.target.value) })} />
            <Slider inverse label="Gain" min={-24} max={0} step={0.5}
              value={state.gain} disabled={!state.rain} formatValue={v => v.toFixed(1) + ' dB'} onChange={e => set({ gain: parseFloat(e.target.value) })} />
          </div>
        </section>
      </div>

      <div className="hud__foot">
        <div className="hud__btn-full">
          <Button variant={state.listening ? 'inverse-ghost' : 'inverse'}
            iconLeft={<Icon name={state.listening ? 'pause' : 'play'} size={15} />}
            onClick={() => set({ listening: !state.listening })}>
            {state.listening ? 'Écoute en cours' : 'Lancer l\'écoute'}
          </Button>
        </div>
        <div className="hud__note">Bus 6 canaux · HRTF natif · réverb. paramétrique interpolée</div>
      </div>
    </aside>
  )
}
