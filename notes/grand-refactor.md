# Grand Refactor — stratégie de migration

> 🔧 **Deep-dive du chantier « Le Grand Refactor »** ([plan.md](plan.md)). Le *quoi* (architecture
> cible) est dans [architecture.md](architecture.md) ; ce document fige le *comment on y va sans
> perdre le seul code qui sonne juste*. C'est le découpage fin annoncé par [plan.md §5](plan.md).

**Dernière mise à jour** : 14 juin 2026
**Statut** : 🏗️ JALONS J0/J1/J2/J3 COMPLÉTÉS — J4 à démarrer (rendu three.js impératif).

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
**⏳ PROCHAIN**
- **Livrable** : `RenderSyncSystem` → `ThreeRenderer` via `RenderTarget` ; meshes de relief en
  cache (corrige la dette reconnaissance-v0). Interface `RenderTarget` déjà définie.
- **Auto** (neuf) : smoke test de montage de scène (headless/jsdom au mieux possible).
- **Humain** : wireframe et caméra orbitale (spin/zoom, **sans** affecter l'écoute) corrects.

### J5 — UI React = observateur/émetteur ; **bascule** v0 → src
**⏳ APRÈS J4**
- **Livrable** : pont snapshot (`useSyncExternalStore`) + file `Command` / `ControlState` drainée
  par `InputSystem`. **Mort du god-component `DioramaApp`.** Retrait de v0 (ds/ui_kits/diorama) comme
  app par défaut. Types `EngineSnapshot` + `commands` déjà définis.
- **Auto** (neuf, E2E ré-ancré sur nouvelle UI) : `save → reload → load`, `listener bouge`,
  `surfaces`.
- **Humain** : sliders, save/load, déplacement tête — tout répond.

### J6 — Swap audio **temps 2** : `ResonanceBackend` → `WebAudioBackend`
**⏳ APRÈS J5**
- **Livrable** : `PannerNode` HRTF par voix ; **reconstruction explicite** de la réverb
  (`ConvolverNode` ← `enclosedVolume()`) et de l'occlusion (passe-bas sur le send) — ce que
  Resonance offrait gratuitement.
- **Auto** : garde-fous en propriétés invariantes **doivent rester verts** (right>left,
  peakOff<peakOn·0,6, heard) — conçus pour survivre au changement de HRTF.
- **Humain** : **A/B à l'oreille contre Resonance (J3)** — le son change (HRTF différents), on
  valide qu'il reste *crédible et cohérent*. Une fois validé, `ResonanceBackend` supprimé.

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
