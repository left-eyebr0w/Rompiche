# Phase 0 — Socle transverse

> **Position** : première phase implémentée (fondations d'abord). Rend le moteur **déterministe**, **paramétrable en échelle** et corrige le **défaut de verticalité** — sans encore ajouter de couche.
> **Réf. spec** : §2.3 (`WorldConfig`), §4 (moteur d'échelle), §5.1-5.4 (Poisson, points bakés, priorité), §13-14 (instrumentation, replay), §15 (modèle de données).
> **Pré-requis** : aucun (point de départ = code actuel, Couche 1 seule).

> **Comment lire les tâches** — chaque tâche est atomique et indépendamment vérifiable :
> **T-x — Titre** · `chemin` (new) ou `chemin:ligne` (edit existant)
> *Action* (quoi) → *Signatures/pseudo-code* (noms exacts) → *Dépend* (tâches préalables) → *Test* (vérification mécanique).
> Valeurs **résolues** (aucune n'est « à calibrer » ; les affinages éventuels sont notés `// calibrable` mais ont une valeur de départ concrète).

---

## 1. Objectif & structures cibles

### 1.1 `WorldConfig` / `LayerConfig` (§2.3, §15.4) — valeurs résolues

```
WorldConfig {
  size:   mètres,                      # côté du volume jouable
  preset: 'diorama'|'room'|'courtyard'|'field'|'custom',
  layers: LayerConfig,
  weather:{ intensité:0..1, vent:0..1, dir:radians },
  seed:   entier ≥ 1                   # graine PRNG (défaut 1)
}

LayerConfig {
  L1: { rMax, voices, priorité:{w_gain,w_dist,w_att,w_age}, seuilWeakDb },
  L2: { rMax, sectors, débitMax },
  L3: { ordre, filtre:{centreHz,largeurHz} },
  crossfade: fraction(0..1),           # largeur de recouvrement
  hystérésis: mètres                   # dérivée (Phase 3) ; posée ici pour figer le contrat
}
```

**Presets résolus** (les `—` = couche repliée, §4.2) :

| preset | size | L1.rMax (`r1`) | L2.rMax (`r2`) | L2.sectors | crossfade | L3 actif |
|--------|------|------|------|-----------|-----------|----------|
| `diorama`  | 4  | 2.5 | —  | 0  | 0.30 | mince |
| `room`     | 12 | 4   | 10 | 4  | 0.25 | réduit |
| `courtyard`| 30 | 5   | 22 | 8  | 0.20 | plein |
| `field`    | 80 | 6   | 35 | 12 | 0.15 | plein |

**Constantes communes résolues** (mêmes pour tous les presets sauf mention) :
`L1.voices = 48` · `L1.priorité = { w_gain:0.40, w_dist:0.40, w_att:0.15, w_age:0.10 }` · `L1.seuilWeakDb = -45` · `L2.débitMax = 120` (grains/s) · `L3.ordre = 1` · `L3.filtre = { centreHz:1600, largeurHz:4000 }`.

### 1.2 `BakedSet` / `PointImpact` (§5.2, §15.2)

```
PointImpact { position:(x,y,z), normale:(x,y,z), matériau:id, expoCiel:0..1 }
BakedSet    { points:[PointImpact], index: grille (cellule = coords.CELL) }
```

---

## 2. Tâches d'exécution

### Groupe A — PRNG seedé (`prng.js`)

**T-0.A1 — Créer le PRNG** · `ds/ui_kits/diorama/prng.js` (new)
- *Action* : implémenter un générateur déterministe `mulberry32` + une fabrique `makePrng(seed)` exposant `aléa()` et `fork()`.
- *Signatures* :
  ```
  export function makePrng(seed):           # seed entier ≥ 1
    let state = seed >>> 0
    aléa():                                 # → [0,1)
      state = (state + 0x6D2B79F5) >>> 0
      t = state
      t = Math.imul(t ^ (t >>> 15), t | 1)
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    fork():                                 # graine fille pour un sous-système (worklet…)
      return makePrng(Math.floor(aléa() * 0xFFFFFFFF) + 1)
    return { aléa, fork, seed }
  ```
- *Dépend* : —
- *Test* : `makePrng(1).aléa()` renvoie deux fois la même séquence sur deux appels neufs ; `fork().seed !== seed`.

---

### Groupe B — Moteur d'échelle (`worldConfig.js`)

**T-0.B1 — Presets & fabrique `WorldConfig`** · `ds/ui_kits/diorama/worldConfig.js` (new)
- *Action* : déclarer `PRESETS` (table §1.1) et `makeWorldConfig({ preset, seed = 1 })` retournant un `WorldConfig` complet (layers résolus depuis les constantes communes + ligne du preset).
- *Signatures* : `export const PRESETS = {...}` · `export function makeWorldConfig(opts) → WorldConfig`.
- *Dépend* : —
- *Test* : `makeWorldConfig({preset:'room'}).layers.L2.sectors === 4` ; `…('diorama').layers.L1.rMax === 2.5`.

**T-0.B2 — Résolution des frontières + collapse** · `ds/ui_kits/diorama/worldConfig.js`
- *Action* : `résoudreCouches(worldRadius, cfg) → { r1, r2, overlap, collapse }` (§4.1-4.2).
- *Signatures* :
  ```
  export function résoudreCouches(worldRadius, cfg):
    r1 = min(cfg.layers.L1.rMax, worldRadius)
    r2 = cfg.layers.L2.rMax == null ? r1 : min(cfg.layers.L2.rMax, worldRadius)
    overlap = cfg.layers.crossfade * max(0, r2 - r1)
    collapse = worldRadius <= r1 ? 'diorama'      # L2 OFF, L3 mince
             : worldRadius <= r2 ? 'small'        # L1+L2, L3 réduit
             : 'full'
    return { r1, r2, overlap, collapse }
  ```
- *Dépend* : T-0.B1
- *Test* : `résoudreCouches(2, diorama).collapse === 'diorama'` et `r2 === r1` ; `résoudreCouches(80, field).collapse === 'full'`.

---

### Groupe C — Échelle dans `coords.js`

**T-0.C1 — `worldRadius` explicite** · `ds/ui_kits/diorama/coords.js:10` (`makeCoords`)
- *Action* : ajouter `worldRadius: half` à l'objet retourné (lignes 13-23) pour que `résoudreCouches` reçoive un rayon issu de la source unique d'échelle (I5). Ne **pas** toucher aux conversions `worldToResonance`/`headInputToWorld`.
- *Dépend* : —
- *Test* : `makeCoords(80).worldRadius === 40`.

---

### Groupe D — Relief consommé + points bakés (`Terrain.js`, `BakedSet.js`)

**T-0.D1 — Relief de test non trivial** · `ds/ui_kits/diorama/Terrain.js:66` (`makeDefaultTerrain`)
- *Action* : après le `fill` matériau, remplir `height` avec un **bloc surélevé** (preuve de la face HAUT) : un carré de `2` blocs de haut dans le quadrant `x<0 && z<0`. Écrire `terrain.height[...] = 2` pour les blocs concernés.
- *Pseudo-code* :
  ```
  for b in blocs où (centreX < 0 && centreZ < 0): terrain.height[b] = 2
  ```
- *Dépend* : —
- *Test* : `terrain.cellAt(-half/2, -half/2).height === 2 * block` ; ailleurs `=== 0`.

**T-0.D2 — Bake des points d'impact** · `ds/ui_kits/diorama/BakedSet.js` (new)
- *Action* : `bakeImpactPoints(terrain, coords) → BakedSet`. Pour chaque cellule fine : `position = (cx, ground + height, cz)`, `matériau = cellAt().material.id`, `normale = (0,1,0)` (toit plat ; relief surélevé garde +Y), `expoCiel` = `0` si une cellule voisine est plus haute d'au moins 1 bloc (sous abri), sinon `1`.
- *Signatures* :
  ```
  export function bakeImpactPoints(terrain, coords) → BakedSet
  # index : Map cléCellule → [indices de points] (réutiliser _cellKey de RainSampler, cf. T-0.E1)
  ```
- *Dépend* : T-0.D1
- *Test* : `bakeImpactPoints(...).points.length === terrain.cols*terrain.rows` ; au moins un point a `position.y > ground` (le bloc surélevé).

**T-0.D3 — Sélection pondérée d'un point** · `ds/ui_kits/diorama/BakedSet.js`
- *Action* : `pickImpact(bakedSet, surface, prng) → PointImpact|null`, tirage round-robin pondéré par `expoCiel`, filtré par `matériau === surface`.
- *Signatures* : `export function pickImpact(bakedSet, surface, prng)`.
- *Dépend* : T-0.D2, T-0.A1
- *Test* : deux appels même `seed` → même séquence de `position`.

---

### Groupe E — `RainSampler` : Poisson, priorité, relief, PRNG

**T-0.E1 — Injecter `WorldConfig` + PRNG + BakedSet** · `ds/ui_kits/diorama/RainSampler.js:185` (constructeur)
- *Action* : le constructeur accepte `(worldCfg)` au lieu de `(size)`. Conserver `this.coords = makeCoords(worldCfg.size)`. Stocker `this.cfg = worldCfg`, `this.prng = makePrng(worldCfg.seed)`, `this.bands = résoudreCouches(this.coords.worldRadius, worldCfg)`. Construire `this.baked = bakeImpactPoints(terrain, this.coords)` (le terrain est passé via un setter `setTerrain` appelé avant `init`, ou en argument).
- *Dépend* : T-0.A1, T-0.B2, T-0.D2
- *Test* : `new RainSampler(makeWorldConfig({preset:'room'}))` expose `.bands.r1 === 4` et `.prng`.

**T-0.E2 — Pool dimensionné par config** · `ds/ui_kits/diorama/RainSampler.js:7,13,241`
- *Action* : remplacer `POOL_SIZE` (const ligne 7) par `this.cfg.layers.L1.voices` au point de création du `VoicePool` (ligne 241) ; remplacer `AMBISONIC_ORDER` (ligne 13) par une valeur issue de la config (`this.cfg.layers.L3.ordre` n'est PAS l'ordre de scène — garder `ambisonicOrder: 3` par défaut mais le sortir en `this.cfg.ambisonicOrder ?? 3`). `VoicePool` reçoit `voices` en argument.
- *Dépend* : T-0.E1
- *Test* : `poolStats().size === cfg.layers.L1.voices`.

**T-0.E3 — Vol de voix par PRIORITÉ** · `ds/ui_kits/diorama/RainSampler.js:144` (`_oldest`) et `:99` (sélection dans `play`)
- *Action* : remplacer `_oldest()` par `_lowestPriority(head)` calculant pour chaque voix busy `priorité = w_gain·gainNorm + w_dist·(1−distNorm) + w_att·attention − w_age·âgeNorm` (§5.3). `attention = 1` (culling reporté en Phase 4). Normalisations : `gainNorm = (db+60)/60` clampé [0,1] ; `distNorm = min(1, dist/r2)` ; `âgeNorm = min(1, âge_ms/1000)`. `play(...)` passe `head` et les poids `this.cfg.layers.L1.priorité`.
- *Signatures* :
  ```
  _lowestPriority(head, w):
    best=null; bestP=+∞
    for v in voices où v.busy:
      p = w.w_gain*gainNorm(v) + w.w_dist*(1-distNorm(v,head)) + w.w_att*1 - w.w_age*ageNorm(v)
      if p < bestP: bestP=p; best=v
    return best
  ```
- *Dépend* : T-0.E1
- *Test* : à pool plein, la voix volée (event `steal.victim`) est celle de plus faible `prio` (ajouter `prio` au champ `steal`, cf. T-0.F2), pas forcément la plus ancienne.

**T-0.E4 — Déclenchement par Poisson (game thread)** · `ds/ui_kits/diorama/RainSampler.js:289` (`trigger`)
- *Action* : ajouter une boucle d'horloge `tickPoisson(dtMs, surfaceDensities)` qui, par matériau, accumule le temps et tire des impacts aux intervalles `−ln(prng.aléa())/λ` avec `λ = densitéPluie × surfaceExposée × facteurMatériau`. Chaque impact tiré appelle `pickImpact(this.baked, surface, this.prng)` puis le `trigger` existant avec `pos = point.position` (hauteur **réelle**). Le `trigger` reste la voie d'entrée ; il n'est plus appelé par le visuel (cf. T-0.H1).
- *Signatures* : `tickPoisson(dtMs, { metal, bache, terre })` ; `λ(surface) = density * exposé(surface) * MAT_FACTOR[surface]`. `MAT_FACTOR = { metal:1, bache:1, terre:1 } // calibrable`.
- *Dépend* : T-0.D3, T-0.E1
- *Test* : deux runs même `seed` + même densité ⇒ mêmes timestamps/points d'impact (comparaison des events `trigger`).

**T-0.E5 — Supprimer `Y_FLATTEN`, utiliser le relief** · `ds/ui_kits/diorama/RainSampler.js:17,315`
- *Action* : supprimer la const `Y_FLATTEN` (ligne 17) et le calcul `pos.y = head.y + (ground - head.y)*Y_FLATTEN` (ligne 315). `pos.y` vient désormais de `point.position.y` (relief réel, fourni par `pickImpact`).
- *Dépend* : T-0.E4
- *Test* : `grep -n "Y_FLATTEN" RainSampler.js` → vide ; les events `trigger.y` varient (plus tous au sol).

**T-0.E6 — PRNG pour sample & detune** · `ds/ui_kits/diorama/RainSampler.js:318` et `DioramaApp.jsx:122`
- *Action* : remplacer `Math.floor(Math.random()*bank.length)` (ligne 318) par un **round-robin seedé** : index = `this._rr[surface] = (this._rr[surface]+1+floor(prng.aléa()*bank.length)) % bank.length`. Le `detune` (généré dans `DioramaApp.jsx:122`) passe au game thread : le calcul `(prng.aléa()-0.5)*40` se fait dans `trigger`, plus dans React.
- *Dépend* : T-0.A1, T-0.E1
- *Test* : `grep -rn "Math.random" ds/ui_kits/diorama/*.js *.jsx` ne renvoie que du visuel pur non audible (idéalement vide). *(M3)*

---

### Groupe F — Instrumentation (`TraceRecorder.js`, traces)

**T-0.F1 — `seed` dans le header** · `ds/ui_kits/diorama/TraceRecorder.js:54,115`
- *Action* : `start(ctx, meta)` accepte `meta.seed` et `meta.engine` (version) ; `toNDJSON` (ligne 115) ajoute `seed: this.meta.seed` au header.
- *Dépend* : —
- *Test* : la 1re ligne NDJSON contient `"seed"` et `"engine"`.

**T-0.F2 — Champs manquants `steal`/`faces`/`env`** · `ds/ui_kits/diorama/RainSampler.js:138,364,350`
- *Action* :
  - `steal` (ligne 138) : ajouter `prio` (de la victime) et garantir `victim.remaining` (durée restante = `dur - age`).
  - `faces` (ligne 364) : ajouter `head.fwd` (= `LISTENER_FORWARD`), `head.up` (= `[0,1,0]`), `size` (= `poolStats().size`), `steals` (= `pool.stealCount`).
  - `env` (ligne 350) : ajouter `weak: db < material.seuilWeakDb` (flag posé maintenant, **coupe** en Phase 4).
- *Dépend* : T-0.E3
- *Test* : `jq 'select(.type=="faces")|.head.fwd' trace.ndjson` non null ; `jq 'select(.type=="env")|.weak' …` présent (booléen).

**T-0.F3 — Événement `scale`** · `ds/ui_kits/diorama/RainSampler.js` (nouvelle méthode) + émission au montage/changement
- *Action* : `setScale(worldCfg)` recalcule `this.bands` et émet `rec.emit('scale', { preset, size, r1, r2, overlap })`. Appelé à l'init et à tout changement de preset.
- *Dépend* : T-0.B2, T-0.E1
- *Test* : changer de preset ⇒ une ligne `scale` avec les bons `r1/r2`.

---

### Groupe G — `DioramaApp` : câblage

**T-0.G1 — Remplacer `SIZE` par `WorldConfig`** · `ds/ui_kits/diorama/DioramaApp.jsx:10,87`
- *Action* : supprimer `const SIZE = Math.min(420, 380)` (ligne 10) ; introduire `const worldCfg = React.useMemo(() => makeWorldConfig({ preset: state.preset ?? 'diorama', seed: state.seed ?? 1 }), [state.preset, state.seed])`. `new RainSampler(SIZE)` (ligne 89) devient `new RainSampler(worldCfg)` ; le terrain (ligne 65) utilise `worldCfg.size`.
- *Dépend* : T-0.B1, T-0.E1
- *Test* : l'app monte ; changer `state.preset` reconstruit le sampler sans crash.

**T-0.G2 — `seed`/`preset` suivis + boucle Poisson** · `ds/ui_kits/diorama/DioramaApp.jsx:138,182`
- *Action* : ajouter `'preset','seed'` à `TRACKED` (ligne 138). Ajouter une boucle RAF (à côté de celle ligne 182) appelant `sampler.tickPoisson(dt, {metal,bache,terre})` selon `state.density`/`state.rain` — c'est elle qui pilote l'audio (le visuel devient cosmétique, T-0.H1).
- *Dépend* : T-0.E4
- *Test* : pluie ON ⇒ impacts audio même si le viewport est masqué.

---

### Groupe H — `WireframeCube` : découplage visuel/audio

**T-0.H1 — Couper `onImpact` audio du wrap de phase** · `ds/ui_kits/diorama/WireframeCube.jsx:257-285`
- *Action* : retirer l'appel `cb(surface, {x,z})` (ligne 282) de la détection de wrap. Le visuel reste piloté par le shader ; les impacts **audio** viennent désormais de `tickPoisson` (T-0.E4). `onImpact` peut rester branché pour un usage purement visuel (flash) mais ne déclenche plus de son.
- *Dépend* : T-0.G2
- *Test* : couper le rendu Three.js (commenter `animate`) ⇒ le son continue (l'audio ne dépend plus du visuel).

---

## 3. Critères de sortie de la phase (récap)

- [ ] `grep -rn "Math.random" ds/ui_kits/diorama/*.js *.jsx` ≈ vide (M3). *(T-0.E6)*
- [ ] Deux runs même `seed` + même timeline `state` ⇒ events `trigger` identiques (`sample`/`detune`/`grain`). *(T-0.E4/E6, §14)*
- [ ] Face HAUT alimentée : `jq -r 'select(.type=="faces")|.db[4]' trace.ndjson | grep -v null | wc -l` > 0. *(T-0.D1/E5)*
- [ ] Changement de preset ⇒ event `scale`, aucun artefact audible. *(T-0.F3)*
- [ ] Diorama : `bands.collapse === 'diorama'`, L2 sectors = 0. *(T-0.B2)*
- [ ] Boîte noire verte : tous les events Couche 1 préexistants encore émis (M2).

---

## 4. Risques spécifiques

| Risque | Mitigation |
|--------|------------|
| **Désync œil/oreille** après découplage (T-0.H1) | Optionnel : piloter aussi le visuel depuis `tickPoisson` (même PRNG) plus tard |
| **Terrain plat** ⇒ face HAUT non prouvée | Relief de test imposé (T-0.D1) |
| **Ordre de tirage PRNG** non figé ⇒ replay instable | Un seul ordre de consommation : Poisson → pickImpact → sample → detune, documenté ici |
| **Régression de schéma de trace** | Comparer une trace de référence avant/après (M2) |
