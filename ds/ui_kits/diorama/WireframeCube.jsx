/* WireframeCube
   - wc-head-wrap has explicit HC×HC dimensions → top:50%;left:50%; children
     correctly resolve to the geometric centre.
   - Head-cube is fully solidary with the world-cube: no counter-rotation.
     It orbits naturally as the view spins, like any other element in the scene.
   - Rain: système de particules CSS 3D. Chaque goutte est un point (x,z) aléatoire
     dans l'espace du cube, animé le long de l'axe Y monde (plafond→sol).
     Chaîne preserve-3d : wc-cube → conteneur pluie → wrapper par goutte → span. */
const WC_CSS = `
.wc-stage{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  perspective:1200px; overflow:hidden; }
.wc-cube{ position:relative; transform-style:preserve-3d;
  transform: rotateX(-22deg) rotateY(var(--wc-spin,-32deg));
}
/* world-cube faces */
.wc-face{ position:absolute; border:1.5px solid; background:rgba(255,255,255,.01);
  top:50%; left:50%; }
.wc-face.wc-front{ border-color:var(--wire); }
.wc-face.wc-back,
.wc-face.wc-side,
.wc-face.wc-top,
.wc-face.wc-bottom{ border-color:var(--wire-dim); }
/* ground zones on bottom face */
.wc-zone{ position:absolute; top:0; height:100%; transition:opacity .2s var(--ease-standard); }
.wc-zone.off{ opacity:.15; }
.wc-zlabel{ position:absolute; font-family:var(--font-mono); font-size:10px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--on-ink-faint); }
/* head-wrap: explicit size so % children resolve to the geometric centre */
.wc-head-wrap{ position:absolute; top:50%; left:50%; transform-style:preserve-3d;
  transition: transform .08s linear; }
/* head-cube (6-point binaural bus, solidary with the head).
   Counter-rotation is applied via inline style — see JSX. */
.wc-hcube{ position:absolute; top:0; left:0; transform-style:preserve-3d; }
.wc-hface{ position:absolute; border:1px dashed var(--wire); background:rgba(255,255,255,.02);
  top:50%; left:50%; }
.wc-hface.wc-hfront{ border-color:var(--blanc); }
/* speaker-point dot at centre of each head-cube face */
.wc-pt{ position:absolute; top:50%; left:50%; width:6px;height:6px;margin:-3px;border-radius:50%;
  background:var(--wire); box-shadow:0 0 0 3px rgba(255,255,255,.08); }
.wc-pt.wc-pt-main{ background:var(--blanc); width:7px;height:7px;margin:-3.5px;
  box-shadow:0 0 0 4px rgba(255,255,255,.12); }
/* head: white dot at the geometric centre of the head-cube — positioned via inline px (% fails in preserve-3d) */
.wc-head{ position:absolute; width:13px;height:13px;
  border-radius:50%; background:var(--blanc);
  box-shadow:0 0 0 4px rgba(255,255,255,.10),0 0 20px rgba(255,255,255,.2); z-index:5; }
.wc-head.listening{ animation: wc-pulse 1.8s ease-in-out infinite; }
@keyframes wc-pulse{ 0%,100%{ box-shadow:0 0 0 4px rgba(255,255,255,.10),0 0 16px rgba(255,255,255,.18);}
  50%{ box-shadow:0 0 0 9px rgba(255,255,255,.05),0 0 32px rgba(255,255,255,.38);} }
/* 3D rain — gouttes en espace-monde, tombent le long de l'axe Y du cube.
   Le wrapper donne la position statique (x,y0,z) ; le span anime la chute
   de -2H à +2H autour de y0. Sans animation (prefers-reduced-motion),
   chaque span est à translateY(0) et la position y0 suffit à remplir le volume. */
@keyframes wc-fall3d { from{ transform:translateY(-400px); } to{ transform:translateY(400px); } }
.wc-drop3d{ position:absolute; top:0; left:-.5px; width:1px; height:12px;
  background:linear-gradient(to bottom, var(--wire), transparent); pointer-events:none;
  animation: wc-fall3d linear infinite; }
@media (prefers-reduced-motion:reduce){ .wc-drop3d{ animation:none; } }
`;
(function(){ if(typeof document==="undefined")return;
  let s=document.getElementById("wc-css");
  if(!s){ s=document.createElement("style"); s.id="wc-css"; document.head.appendChild(s); }
  s.textContent=WC_CSS; })();

function WireframeCube({ size=360, head={x:0,y:0,z:0}, rain=true, metal=true, earth=true, listening=false, spin=-32, zoom=1, density=0.5, wind=false, windDir=0 }){
  const W = size, H = W/2;
  const faceStyle = { width:W, height:W, marginLeft:-H, marginTop:-H };

  /* Head-cube: ~26% of world side */
  const HC  = Math.round(W * 0.26);
  const HCH = HC / 2;
  const hcFaceStyle = { width:HC, height:HC, marginLeft:-HCH, marginTop:-HCH };

  /* Head position within the world (clamped so head-cube stays inside) */
  const limit = H - HCH - 10;
  const hx =  head.x * limit;
  const hy = -head.y * limit;
  const hz =  head.z * limit;

  /* Particules pluie — pool stable de gouttes réparties dans tout le VOLUME du
     cube : (x,z) aléatoires + phase de chute décalée (delay négatif) pour que
     toute la hauteur soit peuplée dès t=0 (et non une seule tranche). On n'affiche
     qu'une fraction du pool, pilotée par la densité ; le vent incline l'axe de chute. */
  const RAIN_POOL = 80;
  const drops = React.useMemo(()=>Array.from({length:RAIN_POOL},()=>{
    const dur = 0.55 + Math.random()*0.7;
    return {
      x:   ((Math.random()*2-1)*(H-14)).toFixed(1),
      y0:  ((Math.random()*2-1)*(H-14)).toFixed(1),   // position statique Y : remplit le volume même sans animation
      z:   ((Math.random()*2-1)*(H-14)).toFixed(1),
      delay:(-Math.random()*dur).toFixed(2),           // négatif → phase aléatoire dans la chute
      dur:  dur.toFixed(2),
      op:   (0.45 + Math.random()*0.55).toFixed(2),
    };
  }),[size]);
  const dropCount = rain ? Math.round(12 + density*(RAIN_POOL-12)) : 0;
  const windAngle = wind ? windDir*30 : 0;   // inclinaison de la pluie (°)
  const streakH = 12 + (wind ? Math.abs(windDir)*12 : 0);   // traînées allongées par le vent

  const worldFaces = [
    { cn:"wc-front",  t:`translateZ(${H}px)`,              ground:false },
    { cn:"wc-back",   t:`rotateY(180deg) translateZ(${H}px)`, ground:false },
    { cn:"wc-side",   t:`rotateY(90deg) translateZ(${H}px)`,  ground:false },
    { cn:"wc-side",   t:`rotateY(-90deg) translateZ(${H}px)`, ground:false },
    { cn:"wc-top",    t:`rotateX(90deg) translateZ(${H}px)`,  ground:false },
    { cn:"wc-bottom", t:`rotateX(-90deg) translateZ(${H}px)`, ground:true  },
  ];
  const headFaces = [
    { cn:"wc-hfront", t:`translateZ(${HCH}px)` },
    { cn:"",          t:`rotateY(180deg) translateZ(${HCH}px)` },
    { cn:"",          t:`rotateY(90deg) translateZ(${HCH}px)` },
    { cn:"",          t:`rotateY(-90deg) translateZ(${HCH}px)` },
    { cn:"",          t:`rotateX(90deg) translateZ(${HCH}px)` },
    { cn:"",          t:`rotateX(-90deg) translateZ(${HCH}px)` },
  ];



  return (
    <div className="wc-stage" style={{ transform:`scale(${zoom})` }}>
      <div className="wc-cube" style={{ width:W, height:W, "--wc-spin": spin+"deg" }}>

        {/* ── World cube (the room) — plain faces, no dots ── */}
        {worldFaces.map((f,i)=>(
          <div key={"w"+i} className={"wc-face "+f.cn} style={{...faceStyle, transform:f.t}}>
            {f.ground && (
              <>
                <div className={"wc-zone"+(metal?"":" off")} style={{ left:0, width:"50%",
                  backgroundImage:"repeating-linear-gradient(45deg,var(--wire-dim) 0 1px,transparent 1px 12px)" }}>
                  <span className="wc-zlabel" style={{top:7,left:7}}>métal</span>
                </div>
                <div className={"wc-zone"+(earth?"":" off")} style={{ left:"50%", width:"50%",
                  backgroundImage:"radial-gradient(var(--wire-dim) .7px,transparent 1px)",
                  backgroundSize:"11px 11px" }}>
                  <span className="wc-zlabel" style={{top:7,right:7}}>terre</span>
                </div>
                <div style={{position:"absolute",left:"50%",top:0,bottom:0,width:1,background:"var(--wire-faint)"}}/>
              </>
            )}
          </div>
        ))}

        {/* ── Head-wrap: HC×HC, centred on head position ── */}
        <div className="wc-head-wrap"
             style={{ width:HC, height:HC, marginLeft:-HCH, marginTop:-HCH,
                      transform:`translate3d(${hx}px,${hy}px,${hz}px)` }}>

          {/* Head-cube — solidary with the world-cube, orbits naturally */}
          <div className="wc-hcube"
               style={{ width:HC, height:HC }}>
            {headFaces.map((f,i)=>(
              <div key={"h"+i} className={"wc-hface "+(f.cn||"")} style={{...hcFaceStyle, transform:f.t}}>
                <span className={"wc-pt"+(i===0?" wc-pt-main":"")}/>
              </div>
            ))}
          </div>

          {/* Listener head — explicit px position (% top/left fails in preserve-3d context) */}
          <div className={"wc-head"+(listening?" listening":"")}
               style={{ top: HCH-6.5, left: HCH-6.5 }}/>        </div>

        {/* 3D rain — conteneur preserve-3d centré ; chaque goutte est placée à (x,z)
             puis inclinée par le vent (rotateZ) ; le span tombe le long de l'axe local Y */}
        <div style={{
          position:'absolute', top:'50%', left:'50%',
          width:0, height:0,
          transformStyle:'preserve-3d',
          opacity: rain ? 0.85 : 0,
          transition:'opacity .35s',
          pointerEvents:'none',
        }}>
          {drops.slice(0,dropCount).map((d,i)=>(
            <div key={"r"+i} style={{
              position:'absolute', top:0, left:0, width:0, height:0,
              transform:`translate3d(${d.x}px,${d.y0}px,${d.z}px) rotateZ(${windAngle}deg)`,
              transformStyle:'preserve-3d',
              transition:'transform .4s var(--ease-standard)',
            }}>
              <span className="wc-drop3d" style={{
                animationDelay:d.delay+'s',
                animationDuration:d.dur+'s',
                opacity:d.op,
                height:streakH+'px',
              }}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
window.WireframeCube = WireframeCube;
