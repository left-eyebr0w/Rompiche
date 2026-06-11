/* DioramaApp — full v0 screen: dark viewport (wireframe cube) + control HUD. */
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
`;
(function(){ if(typeof document==="undefined"||document.getElementById("dio-css"))return;
  const s=document.createElement("style"); s.id="dio-css"; s.textContent=APP_CSS; document.head.appendChild(s); })();

const SEGMENTS = ["aube","jour","crépuscule","nuit"];
function segmentFor(h){ if(h>=5&&h<8)return"aube"; if(h>=8&&h<18)return"jour"; if(h>=18&&h<21)return"crépuscule"; return"nuit"; }

function DioramaApp(){
  const now = new Date();
  const [state,setState] = React.useState({
    rain:true, wind:false, windDir:0.4, metal:true, earth:true, listening:false,
    x:0.18, y:0, z:-0.30, density:0.42, gain:-6,
    spin:-32, zoom:1,
    clockMode:"sync", clockSegment:"jour",
  });
  const [time,setTime] = React.useState(now);
  const set = (patch)=>setState(s=>({...s,...patch}));

  // Drag orbit — axe Y uniquement
  const drag = React.useRef({ active:false, lastX:0 });
  const viewRef = React.useRef(null);

  React.useEffect(()=>{ const t=setInterval(()=>setTime(new Date()),1000); return ()=>clearInterval(t); },[]);

  // Fin du drag même si la souris quitte le viewport
  React.useEffect(()=>{
    const onUp = ()=>{ drag.current.active = false; };
    window.addEventListener('mouseup', onUp);
    return ()=>window.removeEventListener('mouseup', onUp);
  },[]);

  // Ctrl+molette → zoom (non-passive pour pouvoir appeler preventDefault)
  React.useEffect(()=>{
    const el = viewRef.current;
    if(!el) return;
    const onWheel = (e)=>{
      if(!e.ctrlKey) return;
      e.preventDefault();
      setState(s=>({...s, zoom: Math.min(2.5, Math.max(0.4, s.zoom + (e.deltaY>0 ? -0.08 : 0.08)))}));
    };
    el.addEventListener('wheel', onWheel, {passive:false});
    return ()=>el.removeEventListener('wheel', onWheel);
  },[]);

  const handleMouseDown = (e)=>{ drag.current = { active:true, lastX:e.clientX }; };
  const handleMouseMove = (e)=>{
    if(!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    drag.current.lastX = e.clientX;
    setState(s=>({...s, spin: s.spin + dx * 0.5}));
  };
  const realClock = segmentFor(time.getHours());
  const clock = state.clockMode==="manual" ? state.clockSegment : realClock;
  const hhmm = time.toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"});

  // a faux 6-channel level meter, animates when listening / raining
  const [levels,setLevels] = React.useState([3,6,4,7,5,4]);
  React.useEffect(()=>{
    const active = state.listening;
    const t = setInterval(()=>{
      setLevels(prev=>prev.map((_,i)=>{
        const base = active ? (state.rain?18:9) : 4;
        const span = active ? (state.rain?22:12)*state.density+6 : 3;
        return Math.max(3, Math.round(base + Math.random()*span));
      }));
    }, active?140:600);
    return ()=>clearInterval(t);
  },[state.listening,state.rain,state.density]);

  const WireframeCube = window.WireframeCube;
  const ControlHUD = window.ControlHUD;

  return (
    <div className="dio">
      <div className="dio__view" ref={viewRef}
           onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}>
        <WireframeCube size={Math.min(420,380)} head={{x:state.x,y:state.y,z:state.z}}
          rain={state.rain} metal={state.metal} earth={state.earth} listening={state.listening}
          spin={state.spin} zoom={state.zoom}
          density={state.density} wind={state.wind} windDir={state.windDir}/>
        <div className="dio__scrim"/>
        <div className="dio__top">
          <div className="dio__brand">
            <span className="dio__glyph"><span className="dio__gcube">
              <span className="dio__gface" style={{transform:"translateZ(9px)"}}/>
              <span className="dio__gface" style={{transform:"rotateY(90deg) translateZ(9px)",borderColor:"var(--wire-dim)"}}/>
              <span className="dio__gface" style={{transform:"rotateX(90deg) translateZ(9px)",borderColor:"var(--wire-dim)"}}/>
            </span></span>
            <div>
              <div className="dio__name">Diorama sonore</div>
              <div className="dio__sub">v0 · prototype</div>
            </div>
          </div>
          <div className="dio__topr">
            <div className="dio__mode">horloge · {state.clockMode==="manual"?"manuel":"sync"}</div>
            <div className="dio__clock">{clock}</div>
            <div className="dio__time">{hhmm}</div>
            <div className="dio__meter">
              {levels.map((l,i)=>(
                <div key={i} className="dio__bar" style={{ height:Math.max(6,l)+"px",
                  background: state.listening?"var(--wire)":"var(--wire-dim)" }}/>
              ))}
            </div>
          </div>
        </div>
        <div className="dio__hint">
          <div><b>Glisser</b> dans le viewport pour orbiter la vue</div>
          <div><b>Ctrl+molette</b> pour zoomer · <b>Axes XYZ</b> pour déplacer l'auditeur</div>
        </div>
      </div>
      <ControlHUD state={state} set={set} segments={SEGMENTS} clock={clock} clockMode={state.clockMode}/>
    </div>
  );
}
window.DioramaApp = DioramaApp;
