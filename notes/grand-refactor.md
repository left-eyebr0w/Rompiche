# Grand Refactor — stratégie de migration

> 🔧 **Deep-dive du chantier « Le Grand Refactor »** ([plan.md](plan.md)). Le *quoi* (architecture
> cible) est dans [architecture.md](architecture.md) ; ce document fige le *comment on y va sans
> perdre le seul code qui sonne juste*. C'est le découpage fin annoncé par [plan.md §5](plan.md).

**Dernière mise à jour** : 14 juin 2026
**Statut** : ✅ J0/J1/J2/J3/J4/J5 COMPLÉTÉS — J6 à démarrer (swap Web Audio).

---

## 1. Le vrai problème : le filet est boulonné à ce qu'on démolit

Le risque du Grand Refactor n'est **pas** « le son va casser ». C'est que **les prises du filet de
sécurité sont arrachées par le refactor lui-même**.

Les 5 garde-fous ([`tests/`](../tests/)) sont déjà **en propriétés invariantes** (bonne nouvelle —
ils survivront au swap HRTF, cf. [architecture.md §4.2](architecture.md)) :

- `right > left` & `|right − left| > 0.1` — la tête bouge → le champ change
- `peakOff < peakOn * 0.6` — couper les surfaces réduit L1
- `heard === true`, `l1/l2/l3 === true` — ça sort, les 3 couches vivent

Mais ce sont des tests **Playwright E2E** accrochés aux **internes v0** que le refactor détruit :
le DOM de l'UI (sliders, bouton save), le pont global `window.__rompiche.scene().head`, la forme
interne du sampler (`s.pool.voices`, `s.sectors.count`, `s.bed.exists`). Le god-component
`DioramaApp` meurt, `RainSampler` éclate en systèmes + backend → **ces points d'accroche
s'évaporent en cours de route**.

D'où la question qui pilote toute la stratégie : **comment garder un contrat de non-régression
quand les prises du filet sont arrachées ?**

---

## 2. La réponse : strangler derrière les coutures, validation humaine + tests qui grandissent

Décisions actées (14 juin 2026) :

1. **Jalons green-ables, pas un big-bang.** On découpe le refactor en paliers ; chaque palier est
   validé avant le suivant. (Réconcilie [plan.md §2.2](plan.md) — voir §5 ci-dessous.)
2. **Validation itérative à hauteur d'humain.** Chaque palier se valide **à l'oreille / à l'œil**
   *et* par un **test neuf** (unitaire headless quand c'est le cœur, E2E quand c'est l'UI/l'audio).
   La suite de tests **grandit** palier par palier — on ne fige pas les 5 d'origine.
3. **On pense les coutures (et leurs tests) en premier ; on s'autorise à casser les 5 garde-fous
   d'origine** pendant le trajet. Ils ne sont pas sacrés : ils seront **re-exprimés** sur les
   nouvelles coutures, pas maintenus verts en continu.
4. **La v0 reste l'oracle de référence.** Tant que le nouveau chemin ne sonne pas comme avant, on
   garde `ds/ui_kits/diorama` exécutable comme **étalon A/B à l'oreille**. C'est l'outil clé de la
   validation humaine du §2.2.

**Les coutures sont la surface d'accroche des tests**, stable par construction :
`EngineSnapshot` (lecture, [architecture.md §5.1](architecture.md)), `Command`/`ControlState`
(écriture, §5.2), `ManualClock` headless (§2.1), `SpatialAudioBackend` (§4.2), `WorldQuery` (déjà
figée, §4.1). On ré-ancre les tests dessus, puis on refactore derrière un filet qui ne bouge plus.

---

## 3. La séquence de jalons

Chaque jalon liste son **livrable**, sa **validation auto** (test neuf) et sa **validation
humaine**. Le nouveau code naît dans `src/` ([architecture.md §8](architecture.md)) à côté de la
v0 (`ds/ui_kits/diorama`) qui tourne encore — bascule réelle au J5.

### J0 — Échafaudage & coutures (« penser en premier »)
**✅ COMPLÉTÉ**
- **Livrable** : les interfaces-types seules — `EngineContext`, `ClockSource`,
  `SpatialAudioBackend`, `EngineSnapshot`, `Command`/`ControlState`, `RenderTarget`. Aucun
  comportement. Reclassement des fichiers TS déjà sains (`coords`, `materials`, `save`, `Terrain`,
  `World`, `state`, `worldConfig`, `BakedSet`, `objects`).
- **Auto** : ✅ `tsc --noEmit` vert.
- **Humain** : ✅ signatures révisées. Tous les types-frontières en place dans `src/`.

### J1 — Le cœur headless tourne à vide
**✅ COMPLÉTÉ**
- **Livrable** : ✅ World Miniplex + boucle à pas fixe + `ManualClock` + `EngineContext`.
  Boucle `createLoop(ctx, systems)` avec accumulator, `FIXED_DT = 1/60`, `MAX_CATCHUP = 0.25`.
- **Auto** (neuf, unitaire) : ✅ Test déterminisme dans `src/engine/loop/determinism.test.ts`
  (N ticks identiques pour même seed PRNG).
- **Humain** : ✅ Boucle testée headless, aucune dépendance à l'audio ou au DOM.

### J2 — Porter la simulation pure (sans audio) derrière le tampon de frame
**✅ COMPLÉTÉ**
- **Livrable** : ✅ `RainPoissonSystem` → `LodRoutingSystem` → `VoicePoolSystem` en ordre
  explicite via `src/engine/systems/index.ts`. Impacts poussés dans `ctx.frame.impacts`,
  lisant `WorldQuery` (FlatWorld v0 réutilisé). Cooldown **ré-indexé en temps logique**
  (correction du `performance.now()` v0 qui brisait le déterminisme).
- **Auto** (neuf, unitaire) : ✅ Test d'impacts déterministes + portage du garde-fou
  surfaces dans `src/engine/systems/simulation.test.ts`.
- **Humain** : ✅ Simulation portée fidèlement de la v0, aucun son attendu (pas d'`AudioSyncSystem` encore).

### J3 — Brancher l'audio = `ResonanceBackend` (swap **temps 1**)
**✅ COMPLÉTÉ**
- **Livrable** : `AudioSyncSystem` consomme `Voice` + `frame` et pilote `ResonanceBackend` (qui
  emballe le code Resonance existant). **Ça sonne de nouveau, à l'identique du v0.**
  Interface `SpatialAudioBackend` déjà définie dans `src/audio/SpatialAudioBackend.ts`.
  Nouveaux fichiers : `ResonanceBackend.ts`, `audioSync.ts`, `RafClock.ts`, `banks.ts`.
  Point d'entrée : `src/index.html` + `src/main.ts`.
- **Auto** (neuf, E2E ré-ancré) : ✅ 3 tests E2E verts (`j3-audio-output`, `j3-listener-position`,
  `j3-surface-toggles`) + 16 tests unitaires Vitest + `tsc` vert.
- **Humain** : **A/B à l'oreille contre la v0 (ds/ui_kits/diorama)** — doit être indiscernable. C'est la
  **preuve que la restructuration cœur/ECS n'a rien cassé**.

### J4 — Rendu three.js impératif (abandon R3F)
**✅ COMPLÉTÉ**
- **Livrable** : `RenderSyncSystem` → `ThreeRenderer` via `RenderTarget` ; meshes de relief en
  cache (corrige la dette reconnaissance-v0). Interface `RenderTarget` déjà définie.
- **Auto** (neuf) : ✅ 5 tests unitaires de `computeCameraPosition` (orbit caméra).
- **Humain** : ✅ wireframe + relief mergé + cube tête pulse + orbite molette/drag — tout fonctionne.

#### Découpage J4

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 1 | `src/render/ThreeRenderer.ts` | **Créer** | Implémentation de `RenderTarget` (three.js impératif). Construit les géométries statiques (cube monde, grille sol, relief mergé par matériau, cube tête + 6 faces). Stocke `spin`/`zoom`/`headPosition` comme propriétés internes mutables. `draw(world, alpha)` calcule la caméra orbitale (tilt 22.5° fixe) et positionne le cube tête + pulse. |
| 2 | `src/engine/systems/renderSync.ts` | **Créer** | Pont ECS → ThreeRenderer. Lit `listenerWorld(ctx)` (`head.ts`), définit la position tête sur le renderer, appelle `ctx.render.draw()`. Pas d'entité ECS tête en J4 (viendra en J5 avec InputSystem). |
| 3 | `src/render/threeRenderer.test.ts` | **Créer** | Smoke test : extrait `computeCameraPosition()` en fonction pure et la teste. Constructeur minimale avec DOM mocké. |
| 4 | `src/main.ts` | **Modifier** | Crée `ThreeRenderer` avec `(ctx.coords.size, ctx.coords, terrain)`, l'injecte dans `ctx.render`. Ajoute `renderSyncSystem` aux systèmes. Handlers DOM : `mousedown→mousemove` pour spin, `wheel` pour zoom (Ctrl+). |
| 5 | `src/index.html` | **Modifier** | `<title>Rompiche — J4</title>`, `#root { position: relative }` pour superposition texte au canvas. |
| 6 | `src/engine/systems/index.ts` | **Modifier** | Exporte `createRenderSystem()` en dernière position. |

#### Décisions de design J4
- **Entité tête ECS** : pas encore — on continue via `listenerWorld(ctx)` (J5 créera `{ transform, listener }`).
- **Spin/zoom** : vivent dans ThreeRenderer (propriétés), pilotés par handlers DOM dans `main.ts`. En J5 ils migrent dans le state UI React (§6 archi).
- **Rain particules visuelles** : hors scope J4 (J5+).
- **Pulse tête** : inclus — scale sinusoïdal `1 + 0.03 * sin(time * 3)` quand `listening` est vrai.

### J5 — UI React = observateur/émetteur ; **bascule** v0 → src
**✅ COMPLÉTÉ**
- **Livrable** : ✅ pont snapshot (`useSyncExternalStore`) + file `Command` / `ControlState` drainée
  par `InputSystem`. **Mort du god-component `DioramaApp`** — l'app par défaut est désormais React
  sur `src/` ([main.ts](../src/main.ts) monte [App.tsx](../src/ui/App.tsx)). v0 (ds/ui_kits/diorama)
  n'est plus l'app par défaut mais **reste exécutable comme oracle A/B** (suppression au J6).
  Types `EngineSnapshot` + `commands` déjà définis (J0).
- **Auto** (neuf, E2E ré-ancré sur nouvelle UI) : ✅ 3 E2E (`j5-save-reload`, `j5-listener-position`,
  `j5-surface-toggles`) re-expriment les garde-fous sur les coutures J5 + `tsc` vert.
- **Humain** : ✅ sliders, save/load, déplacement tête, orbite/zoom, panneau debug (Ctrl+Alt+D) — tout répond.

#### Découpage J5

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 1 | `src/ui/store.ts` | **Créer** | `EngineStore` : `getSnapshot`/`subscribe` (polling RAF, 1 maj /6 frames ≈ 10 Hz) projette `EngineSnapshot` (pool, materials, faceLevels, master) ; `pushCommand` → `ctx.input.commands` ; getter `controls` → `ctx.input.controls` (écriture directe muable). |
| 2 | `src/ui/App.tsx` | **Créer** | Remplace `DioramaApp`. Monte le canvas `ThreeRenderer` dans le viewport, branche le store (`useSyncExternalStore`), handlers spin (drag) / zoom (Ctrl+molette) / debug (Ctrl+Alt+D), méter master, save/load via `persistence/save`. |
| 3 | `src/ui/ControlHUD.tsx` | **Créer** | Panneau contrôles (DS bundle `Switch`/`Slider`/`Button`) : pluie/vent, surfaces métal/bâche, tête XYZ, densité, sauvegardes. Écrit dans `ctx.input.controls`. |
| 4 | `src/ui/DebugHUD.tsx` | **Créer** | Panneau debug : 6 faces de la tête (`faceLevels`), master, pool (busy/size/steals), matériaux, sliders live du champ L1 héros (`worldConfig.l1Field`) + courbe SVG. |
| 5 | `src/engine/systems/input.ts` | **Créer** | `InputSystem` (1ʳᵉ position) : draine `ctx.input.commands` (save/load/reset), applique `ControlState` (surfaces, densité/pluie via `rainEmitter`), resume/suspend l'`AudioContext` au flanc de `listening`. |
| 6 | `src/engine/systems/faceProjection.ts` | **Créer** | Projette le niveau réel des voix sur les 6 faces de la tête → `ctx.faceLevels` **côté moteur** (l'UI ne calcule rien ; `EngineSnapshot` ne porte que `faceLevels[6]`). |
| 7 | `src/engine/systems/index.ts` | **Modifier** | `InputSystem` en tête de `createSimSystems` ; `faceProjection` en dernière position de `createEngineSystems` ; `inputDeps` propagés. |
| 8 | `src/main.ts` | **Modifier** | Monte React `App`, expose `window.__rompiche` (ctx/world/rms/field), **boot auto sans clic** (barre de chargement, sim+rendu démarrent suspended), déverrouillage audio au 1er geste (politique autoplay). |
| 9 | `src/index.html` | **Modifier** | `<title>Rompiche — J5</title>`, conteneur `#ui` superposé au canvas, `#overlay` (point d'accroche test). |
| 10 | `tests/helpers-j5.js` + 3 `.spec.js` | **Créer** | `gotoJ5` (clic `#overlay` → attend RMS), `setSlider`/`setSwitch` pilotent les composants DS contrôlés. 3 garde-fous ré-ancrés. |

#### Décisions de design J5
- **Snapshot par polling RAF (≈10 Hz), pas push tick-driven** : découple la cadence UI de la boucle
  à pas fixe ; `useSyncExternalStore` ne re-rend que si la frontière a changé.
- **`ControlState` muable pollé, pas de re-dispatch React** : l'UI écrit directement dans
  `ctx.input.controls` (le moteur reste l'autorité et clampe). Seul le canal `Command` (discret) passe
  par la file drainée.
- **`faceLevels` projetés côté moteur** (`faceProjection`) : fidèle à [[snapshot-bridge]] / `EngineSnapshot`
  YAGNI — le snapshot ne transporte que 6 nombres.
- **Pas d'entité tête ECS** : la promesse J4 d'une entité `{ transform, listener }` au J5 est **reportée** ;
  `audioSync`/`faceProjection` lisent toujours `listenerWorld(ctx)` / `headInputToWorld(controls)`. À acter
  comme dette (reporté ou abandonné) — candidat naturel à trancher au J6 ou après.
- **DS bundle réutilisé tel quel** (`window.DioramaSonoreDesignSystem_*`, IIFE) : pas de réécriture des
  composants visuels.
- **v0 conservée comme oracle A/B** : non supprimée en J5 ; suppression prévue à la validation finale du J6.

### J6 — Swap audio **temps 2** : `ResonanceBackend` → `WebAudioBackend`
**⏳ À DÉMARRER — dernier jalon (clôt le refactor)**
- **Livrable** : `PannerNode` HRTF par voix ; **reconstruction explicite** de la réverb
  (`ConvolverNode` ← `enclosedVolume()`) et de l'occlusion (passe-bas sur le send) — ce que
  Resonance offrait gratuitement. Bascule derrière la **même couture** `SpatialAudioBackend` :
  `audioSync` ne change pas.
- **Auto** : garde-fous en propriétés invariantes **doivent rester verts** (right>left,
  peakOff<peakOn·0,6, heard) — conçus pour survivre au changement de HRTF. + `tsc` vert.
- **Humain** : **A/B à l'oreille contre Resonance (J3)** — le son change (HRTF différents), on
  valide qu'il reste *crédible et cohérent*. Une fois validé, `ResonanceBackend` supprimé.

> 🔑 **Constat de cadrage (code lu 14 juin 2026)** : dans le monde plat v1,
> [`World.ts`](../src/engine/world/World.ts) renvoie `isOccluded → 0` et `enclosedVolume → 0`.
> **Réverb et occlusion sont donc fonctionnellement nulles dans la scène vitrine.** Le cœur réel de
> J6 = le swap HRTF par voix ; la réverb/occlusion sont câblées *correctes mais dormantes* (send à
> 0, filtre transparent) — elles s'activeront aux chantiers terrain / monde vivant, sans mentir d'ici là.

#### Découpage J6

| # | Fichier | Action | Détail |
|---|---------|--------|--------|
| 1 | `src/audio/WebAudioBackend.ts` | **Créer** | Implémente `SpatialAudioBackend`. `init` : `masterGain` (gain 3, comme v0) → `destination`. `createSource()` → `PannerNode { panningModel:'HRTF', distanceModel:'inverse' }` (décision actée), `input` = le panner branché sur master ; `setPosition` → `panner.positionX/Y/Z`. `setListener` → `AudioListener.positionX/Y/Z` + `forward*/up*`. `currentTime` → `ctx.currentTime`. Expose `masterGain`. |
| 2 | `src/audio/SpatialAudioBackend.ts` | **Modifier** | Ajouter `setMaterial(id: MaterialId)` à `SpatialSource` (décision actée : la couture porte le matériau, `audioSync` reste agnostique de la techno). `WebAudioBackend` mappe `refDistance`/`maxDistance`/`rolloffFactor` du `PannerNode` par matériau (reporte `setMaxDistance(material.maxDistance·meter)` + `rolloff:'logarithmic'` de la v0). `ResonanceBackend.setMaterial` = no-op (Resonance gère via son `createSource`). |
| 3 | `src/engine/systems/audioSync.ts` | **Modifier** | Appeler `src.setMaterial(voice.materialId)` à la création de voix / au changement de matériau. Aucune autre modif (reste branché sur la couture). |
| 4 | — réverb (dormante) | **dans #1** | `ConvolverNode` partagé sur un send ; IR ← `enclosedVolume()` (Sabine). `enclosedVolume=0` en v1 → **send à 0 (dry total)**. Structure correcte, inactive. |
| 5 | — occlusion (dormante) | **dans #1** | `BiquadFilter` passe-bas par source sur le send, piloté par `isOccluded()`. `isOccluded=0` en v1 → **filtre transparent**. |
| 6 | Entité tête ECS | **Créer (dette J4→J5 reprise ici, décision actée)** | Créer l'entité `{ transform, listener }` ; `audioSync` + `faceProjection` lisent la position depuis l'entité au lieu de `listenerWorld(ctx)` / `headInputToWorld(controls)`. `InputSystem` écrit `controls.listener` → entité. Solde la dette laissée par J5. |
| 7 | `src/main.ts` | **Modifier** | `new ResonanceBackend()` → `new WebAudioBackend()`. `backend.masterGain` reste branché à l'`AnalyserNode` master. **Seul point de bascule.** |
| 8 | `src/audio/webAudioBackend.test.ts` | **Créer** | Unitaire (OfflineAudioContext) : `createSource().input` connectable ; `setPosition`/`setListener`/`setMaterial` poussent dans les bons `AudioParam`. Smoke du graphe. |
| 9 | Garde-fous E2E | **Vérifier, pas réécrire** | `j5-listener-position`, `j5-surface-toggles` (`peakOff<peakOn·0,7`), test L/R binaural ([layers-signal](../tests/layers-signal.spec.js)) restent verts **sans modif**. Un test qui comparerait un dB/PCM exact = c'est lui le bug. |
| 10 | `ResonanceBackend.ts` + dép `resonance-audio` + v0 | **Supprimer** | **Seulement après validation A/B humaine.** Retire `ResonanceBackend`, désinstalle `resonance-audio`, retire `ds/ui_kits/diorama` comme oracle. → architecture cible en place, refactor terminé. |

#### Décisions de design J6 (actées 14 juin 2026)
- **`distanceModel:'inverse'`** pour approcher le `rolloff:'logarithmic'` de la v0 ; calage fin à l'oreille en A/B.
- **`SpatialSource.setMaterial(id)`** : la couture porte le matériau ; `audioSync` reste agnostique de la techno de spatialisation.
- **Entité tête ECS traitée dans J6** : la dette reportée de J4/J5 est soldée ici, pas plus tard.
- **Réverb/occlusion dormantes** : câblées correctes mais à send=0 / filtre transparent tant que le monde est plat (`enclosedVolume`/`isOccluded` = 0).

---

## 4. Fini quand

- Tous les garde-fous (ré-ancrés + neufs) verts, `tsc` vert.
- L'architecture cible en place ([architecture.md](architecture.md)) ; v0 retirée.
- Validation humaine A/B OK au J3 (parité Resonance) et au J6 (crédibilité Web Audio).

---

## 5. Réconciliation avec plan.md

[plan.md §2.2](plan.md) dit « un seul saut, pas une série d'étapes validées ; garde-fous rouges
*pendant*, re-verts *à la fin* ». Ce document **affine** cette intention sans la renier :

- L'esprit « **une seule exception où l'on a le droit de tout démonter** » tient : on ne promet
  pas de garder l'app livrable à chaque commit.
- Mais « pas d'étapes validées » est **remplacé** par « **jalons validés à l'oreille + tests qui
  grandissent** » : sur le seul code qui sonne juste, un filet humain-dans-la-boucle vaut mieux
  qu'un re-vert tout à la fin en aveugle.

> À répercuter dans [plan.md §2.2](plan.md) quand on attaquera le refactor : remplacer « série
> d'étapes validées : non » par un renvoi à ce document.
