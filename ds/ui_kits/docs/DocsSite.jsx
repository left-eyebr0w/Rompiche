/* DocsSite — faithful recreation of docs/ (black sidebar + document column).
   Rebuilt on DS tokens + primitives; visual parity with docs/assets/style.css. */
const DOCS_CSS = `
.dx{ display:flex; min-height:100vh; background:var(--bg); font-family:var(--font-sans);
  color:var(--text-primary); line-height:var(--leading-normal); }
.dx__side{ width:var(--sidebar-w); flex:0 0 var(--sidebar-w); background:var(--noir);
  color:var(--gris-200); padding:28px 20px; position:sticky; top:0; height:100vh; overflow-y:auto;
  border-right:1px solid var(--gris-700); }
.dx__brand{ display:flex; align-items:center; gap:11px; color:var(--blanc); text-decoration:none; }
.dx__glyph{ width:24px;height:24px;perspective:160px;flex:0 0 24px; }
.dx__gcube{ width:16px;height:16px;position:relative;margin:4px;transform-style:preserve-3d;transform:rotateX(-24deg) rotateY(-32deg);}
.dx__gface{ position:absolute;width:16px;height:16px;border:1.3px solid var(--blanc); }
.dx__bname{ font-weight:700; font-size:16px; letter-spacing:.01em; }
.dx__bsub{ display:block; color:var(--gris-500); font-family:var(--font-mono); font-weight:400;
  font-size:9px; letter-spacing:.18em; text-transform:uppercase; margin-top:3px; }
.dx__nav{ margin-top:30px; }
.dx__ntitle{ display:block; color:var(--gris-500); font-family:var(--font-mono); font-size:10px;
  font-weight:600; text-transform:uppercase; letter-spacing:.12em; margin-bottom:10px; padding-left:3px; }
.dx__nav ul{ list-style:none; margin:0 0 24px; padding:0; }
.dx__link{ display:block; width:100%; text-align:left; color:var(--gris-200); background:none; border:none;
  cursor:pointer; font:inherit; padding:7px 10px; border-radius:var(--radius-sm); font-size:14px;
  border-left:2px solid transparent; transition:background var(--dur-fast), color var(--dur-fast); }
.dx__link:hover{ background:var(--gris-900); color:var(--blanc); }
.dx__link.active{ background:var(--gris-900); color:var(--blanc); border-left:2px solid var(--blanc); font-weight:600; }
.dx__ndis{ color:var(--gris-700); font-size:13px; padding:7px 10px; font-style:italic; }
.dx__main{ flex:1; min-width:0; padding:48px 40px 80px; display:flex; justify-content:center; }
.dx__article{ width:100%; max-width:var(--content-max); }
.dx__crumb{ font-size:13px; color:var(--text-muted); margin-bottom:22px; }
.dx__crumb button{ background:none;border:none;cursor:pointer;font:inherit;color:var(--text-muted);padding:0;}
.dx__crumb button:hover{ color:var(--text-primary); }
.dx__crumb span{ margin:0 7px; }
.dx__h1{ font-size:var(--text-2xl); line-height:1.2; letter-spacing:var(--tracking-tight); margin:8px 0 0; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.dx__lead{ font-size:var(--text-lg); color:var(--text-secondary); margin:14px 0 24px; line-height:1.5; }
.dx__h2{ font-size:var(--text-xl); margin:36px 0 12px; padding-bottom:8px; border-bottom:1px solid var(--gris-200); }
.dx__p{ margin:12px 0; }
.dx__p strong{ font-weight:700; } .dx__p em{ font-style:italic; }
.dx__ol,.dx__ul{ padding-left:22px; margin:12px 0; } .dx__ol li,.dx__ul li{ margin:6px 0; }
.dx__grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; margin:22px 0; }
.dx__foot{ margin-top:52px; padding-top:20px; border-top:1px solid var(--gris-200); display:flex;
  justify-content:space-between; gap:16px; font-size:14px; }
.dx__pager{ background:none;border:none;cursor:pointer;font:inherit;color:var(--text-secondary);text-align:left;padding:0;}
.dx__pager:hover{ color:var(--text-primary); }
.dx__pager.next{ text-align:right; }
.dx__plabel{ display:block; font-family:var(--font-mono); font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--text-faint); margin-bottom:3px; }
`;
(function(){ if(typeof document==="undefined"||document.getElementById("docs-css"))return;
  const s=document.createElement("style"); s.id="docs-css"; s.textContent=DOCS_CSS; document.head.appendChild(s); })();

const DOCS_PAGES = [
  { id:"presentation", nav:"Présentation", crumb:"Présentation",
    eyebrow:"Branche Cadrage", title:"Présentation & principes",
    lead:"Cette branche cadre le projet : ce que l'on construit, pourquoi, et selon quelles règles non-négociables.",
    render:(C)=>(<>
      <C.Callout variant="muted"><em>Nom de code : à définir.</em> Le cadrage spécifie la <strong>v0 (prototype)</strong> ; les sections vision, principes, modèle et architecture valent pour toutes les versions.</C.Callout>
      <h2 className="dx__h2">1. Vision</h2>
      <p className="dx__p">Permettre au joueur de <strong>créer de petits dioramas vivants au format cube</strong>, low-poly (wireframe dans un premier temps), et d'y placer un personnage pour écouter l'univers sonore qu'il a composé.</p>
      <p className="dx__p">L'objectif n'est pas visuel mais <strong>auditif</strong> : maximiser l'immersion au point que, <em>les yeux fermés, le joueur puisse croire qu'il s'est téléporté à l'intérieur du diorama</em>.</p>
      <h2 className="dx__h2">2. Principes non-négociables</h2>
      <ol className="dx__ol">
        <li><strong>Priorité 1 — Qualité audio.</strong> Toute décision arbitre en faveur du réalisme de l'écoute.</li>
        <li><strong>Priorité 2 — Faible coût computationnel.</strong> Sous la contrainte de la priorité 1, on minimise la charge.</li>
        <li><strong>Découplage audio / rendu.</strong> Wireframes d'aujourd'hui et visuels de demain se branchent sur le même graphe de scène.</li>
        <li><strong>Sandbox sans boucle d'engagement.</strong> Le plaisir est dans la création et l'écoute.</li>
      </ol>
    </>) },
  { id:"moteur", nav:"Le moteur (le cœur)", crumb:"Le moteur",
    eyebrow:"Branche Cadrage · §3", title:"Le modèle du moteur",
    lead:"La matrice d'interactions est la rencontre, dans le cube, des Émetteurs et des Surfaces — entendue depuis la tête de l'auditeur.",
    render:(C)=>(<>
      <C.Callout title="Énoncé fondateur."><strong>Émetteurs</strong> × <strong>Surfaces</strong>, médiés par l'<strong>état du monde</strong>, entendus depuis la <strong>tête de l'auditeur</strong> à travers l'acoustique du cube.</C.Callout>
      <h2 className="dx__h2">3.3 Synthèse granulaire</h2>
      <p className="dx__p">Banques de <strong>grains</strong> (impacts réels) dispersés procéduralement (timing, hauteur, gain, panoramique randomisés). La <strong>densité</strong> est pilotée par un paramètre d'intensité → son <strong>infini, non répétitif</strong>.</p>
      <h2 className="dx__h2">3.5 Spatialisation binaurale</h2>
      <p className="dx__p">Autour de la tête, <strong>6 points</strong> forment un bus de haut-parleurs virtuels solidaire d'elle. Seuls ces 6 canaux sont convolués en <strong>HRTF</strong>.</p>
      <C.Callout title="Bénéfice clé."> le coût de spatialisation est <strong>fixe (6 convolutions)</strong>, indépendant du nombre de grains joués.</C.Callout>
    </>) },
  { id:"perimetre", nav:"Périmètre de la v0", crumb:"Périmètre de la v0",
    eyebrow:"Branche Cadrage · §6", title:"Périmètre de la v0", titleTag:"spec",
    lead:"La v0 valide le moteur. Elle livre l'intégralité des mécaniques audio ; tout le reste est porté par les versions suivantes.",
    render:(C)=>(<>
      <h2 className="dx__h2">Ce que livre la v0</h2>
      <ul className="dx__ul">
        <li><strong>Moteur audio complet</strong> : graphe de scène, matrice d'interactions, synthèse granulaire, état du monde, bus 6 canaux, HRTF, réverb. paramétrique.</li>
        <li><strong>Sons :</strong> uniquement <strong>pluie (on/off) × {"{"}métal, terre{"}"}</strong>.</li>
        <li><strong>Graphismes :</strong> <strong>wireframe, en noir / gris / blanc uniquement</strong>.</li>
        <li><strong>Contenu :</strong> une seule scène vitrine.</li>
      </ul>
      <C.Callout title="Objectif."> prouver que la mécanique « sonne juste » — la pluie sur métal et sur terre, entendue depuis une tête qui se déplace.</C.Callout>
    </>) },
];
window.DOCS_PAGES = DOCS_PAGES;

function Glyph(){
  return (<span className="dx__glyph"><span className="dx__gcube">
    <span className="dx__gface" style={{transform:"translateZ(8px)"}}/>
    <span className="dx__gface" style={{transform:"rotateY(90deg) translateZ(8px)",borderColor:"var(--gris-500)"}}/>
    <span className="dx__gface" style={{transform:"rotateX(90deg) translateZ(8px)",borderColor:"var(--gris-500)"}}/>
  </span></span>);
}

function DocsApp(){
  const DS = window.DioramaSonoreDesignSystem_6d9bc4;
  const C = { Callout:DS.Callout, Card:DS.Card, Tag:DS.Tag, Eyebrow:DS.Eyebrow };
  const pages = window.DOCS_PAGES;
  const [idx,setIdx] = React.useState(0);
  const page = pages[idx];
  const go = (i)=>{ if(i>=0&&i<pages.length) setIdx(i); };
  return (
    <div className="dx">
      <aside className="dx__side">
        <button className="dx__brand" onClick={()=>go(0)} style={{background:"none",border:"none",cursor:"pointer"}}>
          <Glyph/>
          <span><span className="dx__bname">Diorama sonore</span><span className="dx__bsub">Documentation</span></span>
        </button>
        <nav className="dx__nav">
          <span className="dx__ntitle">Branche · Cadrage</span>
          <ul>
            {pages.map((p,i)=>(
              <li key={p.id}><button className={"dx__link"+(i===idx?" active":"")} onClick={()=>go(i)}>{p.nav}</button></li>
            ))}
          </ul>
          <span className="dx__ntitle">Autres branches</span>
          <span className="dx__ndis">À venir</span>
        </nav>
      </aside>
      <main className="dx__main">
        <article className="dx__article">
          <div className="dx__crumb">
            <button onClick={()=>go(0)}>Documentation</button><span>/</span>
            <button onClick={()=>go(0)}>Cadrage</button><span>/</span>{page.crumb}
          </div>
          <C.Eyebrow>{page.eyebrow}</C.Eyebrow>
          <h1 className="dx__h1">{page.title}{page.titleTag && <C.Tag variant="spec">spécifiée</C.Tag>}</h1>
          <p className="dx__lead">{page.lead}</p>
          {page.render(C)}
          <div className="dx__foot">
            {idx>0
              ? <button className="dx__pager" onClick={()=>go(idx-1)}><span className="dx__plabel">Précédent</span>← {pages[idx-1].nav}</button>
              : <span/>}
            {idx<pages.length-1
              ? <button className="dx__pager next" onClick={()=>go(idx+1)}><span className="dx__plabel">Suivant</span>{pages[idx+1].nav} →</button>
              : <span/>}
          </div>
        </article>
      </main>
    </div>
  );
}
window.DocsApp = DocsApp;
