# Cadrage — Pluie 3 couches (L2/L3) + debug isolable

**Date** : 2026-06-17 · **Statut** : cadré (scope **Option 3** acté par l'utilisateur), non commencé
**Chantier** : 2ᵉ pas post-Grand-Refactor. Suit « Objets posés & scène de test »
([04](04-cadrage-objets-scene.md)), dont la validation oreille est acquise (scène crédible
livrée, spatialité jugée juste par l'utilisateur le 2026-06-17).
**But** : réaliser **la pluie 3 couches de la [vision](../vision.md#L27)** (impacts héros L1
+ secteurs mid-field L2 + nappe diffuse L3), et se donner par-dessus les **outils de réglage
fin à l'oreille, in-game** — isoler chaque couche, lire son niveau réel, ajuster ses
paramètres sans recompiler. Couvre les lignes 3-4 de la [to-do](../random/to-do.txt).

> **Scope acté (2026-06-17)** : Option 3 (les 3 couches complètes), pas l'instrument seul.
> Le centre de gravité n'est donc PAS le menu mais le **branchement audio L2/L3** ; le menu
> est l'instrument de réglage par-dessus. Cohérent avec « v1 = toute la vision » ([plan](../plan.md#L17)).

---

## 1. Le constat qui définit (et déplace) le chantier

La to-do demande de *« pouvoir isoler les différentes couches en debug pour les tweaker
séparément »* et *« mieux ranger le sous-menu L1 actuel »*. En lisant le code, un fait
dur change la nature du chantier :

> **Aujourd'hui, seule L1 sonne. L2 et L3 ne sont rendues nulle part.**

Le pipeline de systèmes ([index.ts](../../src/engine/systems/index.ts)) est :

```
Input → RainPoisson → LodRouting → VoicePool → AudioSync → FaceProjection
```

- [LodRouting](../../src/engine/systems/lodRouting.ts#L46) **tague** chaque impact
  `imp.layer = 'L1' | 'L2' | 'L3'` selon la distance (`r1`/`r2`/`overlap` de `ctx.bands`).
- Mais [VoicePool](../../src/engine/systems/voicePool.ts#L58) ne traite **que** L1
  (`if (imp.layer !== 'L1') continue`). **Les impacts L2/L3 sont taggés puis abandonnés** :
  aucun `DiffuseBedSystem` ni système de secteurs n'existe (`grep` confirme : zéro fichier
  bed/sector dans `src/`). Le `débitMax` L2, le filtre L3, le `dropletRate` BULK sont
  **configurés mais morts**.

**Conséquence** : « isoler L1/L2/L3 pour tweaker à l'oreille » suppose que les 3 couches
existent à l'oreille. Ce n'est pas le cas. Le chantier a donc **deux moitiés**, et il faut
choisir leur ampleur (cf. §3) :

| Moitié | Nature | État de départ |
|---|---|---|
| **A — l'instrument de mesure/réglage** (le menu debug) | UI + snapshot | L1 réglable ✅, pas de vue par couche, pas de solo/mute, bandes `r1/r2` non exposées |
| **B — donner une voix à L2/L3** | moteur (systèmes audio) | inexistant — L2/L3 routées dans le vide |

---

## 2. Ce qui existe déjà (à réutiliser, ne pas réinventer)

- **DebugHUD** ([DebugHUD.tsx](../../src/ui/DebugHUD.tsx)) : panneau Ctrl+Alt+D fonctionnel.
  Affiche 6 faces, master, pool (busy/size/steals), méters **par matériau**, et le bloc
  **sliders L1 héros** (rate/core/σ/p/floor/ky/upBias) + courbe SVG + toggle viz sphère 3D.
  C'est la base du « sous-menu L1 actuel » à mieux ranger.
- **Snapshot** ([EngineSnapshot.ts](../../src/ui/EngineSnapshot.ts)) : `ready`, `master`,
  `pool`, `materials[]`, `faceLevels[6]`. **Pas de découpage par couche** aujourd'hui.
- **Config par couche déjà typée** ([worldConfig.ts](../../src/engine/context/worldConfig.ts)) :
  `layers.L1/L2/L3`, `l1Field`, `dropletRate`, frontières `r1/r2/overlap` résolues par
  `résoudreCouches`. Les leviers existent en données ; il manque leur branchement audio (B)
  et leur exposition UI (A).
- **Mesure réelle** : les méters lisent des `AnalyserNode` par voix (pas de `Math.random`,
  cf. pied du HUD). Toute nouvelle jauge par couche doit suivre la même règle : **mesure
  réelle, jamais décorative**.

---

## 3. Le trésor : le code L2/L3 qui sonnait juste vit dans l'historique git

Règle du projet : **on préserve le seul code qui sonne juste**. Le v0 implémentait L2 et L3
en entier. Supprimé au J6 (commit `a9118e4`), il survit au commit `4c3d0f9` :

| Fichier v0 (`4c3d0f9:ds/ui_kits/diorama/`) | Couche | Cœur de ce qu'il fait |
|---|---|---|
| `DiffuseBed.js` | **L3** | `noise-processor` (bruit pink) → BiquadFilter **passe-bande** → gain → master. Piloté par **`weather.intensité`** (pas par impact) : `centre=800+1700·i`, `largeur=1500+3500·i`, niveau `−12 dBFS` (`−18` en diorama). **Non localisé** (fond pur). |
| `SectorField.js` | **L2** | **N sources statiques** réparties en cercle (`rayon=(r1+r2)/2`), chacune un `granulator-processor` alimenté par les banques. Débit = impacts absorbés (`absorberImpact`, +2 grains/s, decay 0,85/tick) **+ baseline far-field** (`world.rainSurfaceAt` × intensité × K). Occlusion + matMix échantillonnés le long du secteur. |
| `worklets/noise-processor.js`, `worklets/granulator-processor.js` | — | les générateurs DSP, **portables verbatim** comme `clock-processor` l'a été (sujet 1). |
| `LodController.js`, `lod.js` | routage | logique de bandes/hystérésis (déjà reprise dans [lodRouting.ts](../../src/engine/systems/lodRouting.ts)). |

**Conséquence** : le chantier n'est pas une invention mais un **portage derrière les coutures
neuves**. Deux adaptations structurantes vs le v0 :

1. **L2 ne s'appuie plus sur Resonance.** Le v0 fait `scene.createSource()` (Resonance). La
   couture actuelle [SpatialAudioBackend](../../src/audio/SpatialAudioBackend.ts) expose déjà
   `createSource()` (PannerNode HRTF) — **les secteurs deviennent N sources statiques** à
   position fixe, créées une fois. Pas de nouveau type de couture : on réutilise l'existante.
2. **Les worklets manquent dans `src/`** : seul `clock-processor` a été porté. Il faut
   rapatrier `noise-processor` (L3) et `granulator-processor` (L2) + leur câblage `banks`
   (les banques existent déjà côté src, cf. [banks.ts](../../src/audio/banks.ts)).

---

## 4. Découpage proposé (Option 3 — les 3 couches)

Ordre : **L3 d'abord (le moins risqué, fond non spatialisé), puis L2 (spatialisé, lourd),
puis l'instrument** qui mesure/règle les trois. Chaque couche validée à l'oreille avant la
suivante (méthode jalons du Grand Refactor).

### Phase L3 — la nappe diffuse (la plus rentable, la moins risquée) ✅ LIVRÉE (2026-06-17)
| # | Action | Fichier | Détail | État |
|---|--------|---------|--------|------|
| 1 | **Porter le worklet bruit** | `audio/worklets/noise-processor.js` | Verbatim depuis `4c3d0f9`. `addModule` au boot (à côté de `clock-processor`). | ✅ |
| 2 | **Classe DiffuseBed** | `audio/DiffuseBed.ts` | Port v0 : graphe bruit→passe-bande→gain→`masterGain` du WebAudioBackend (au lieu du master Resonance). `setIntensity(i)` : centre `800+1700·i`, Q `centre/(1500+3500·i)`, niveau `lerp(−80,−12,i)` dB. AnalyserNode interne → `levelDb()` réel. | ✅ |
| 3 | **DiffuseBedSystem (L3)** | `systems/diffuseBed.ts` | Pont pur : lit la densité de l'émetteur actif (= intensité, levier UI temps-réel — **fidèle au v0 piloté par l'intensité, PAS par les impacts**), appelle `bed.setIntensity`, recopie `bed.levelDb()` dans `ctx.l3Level`. Ajouté au pipeline **seulement si le bed existe** (jamais headless). | ✅ |
| 4 | **Niveau L3 dans le snapshot** | `EngineSnapshot.ts` + `store.ts` + `DebugHUD.tsx` | `snapshot.layers.{L1,L2,L3}.level` (L1 = somme des voix busy, L2 = −∞ jusqu'à Phase L2, L3 = `ctx.l3Level`). Section « Couches · niveaux réels » dans le HUD. | ✅ |

> **Validation Phase L3** : `tsc` vert, `vitest` 43/43 (+3 neufs : `diffuseBed.test.ts`), `vite build` OK
> (worklet inliné en data-URL comme `clock-processor`). **Reste la validation oreille** (solo nappe).
> **Écart assumé vs cadrage initial** : la nappe est pilotée par l'**intensité** (densité de pluie),
> pas par les impacts L2/L3 du tampon de frame — c'est le comportement v0 qui sonnait juste. Les
> impacts L2/L3 seront consommés par la **Phase L2** (secteurs), pas par la nappe.

### Phase L2 — les secteurs **3D** (spatialisé, le gros morceau) — ✅ LIVRÉE 2026-06-17

> **Livré** : worklet `granulator-processor.js` (verbatim v0) ; `sectorGeometry.ts` (pavage
> anneaux d'élévation, pur+testé) ; pont voix↔grain dans `voicePool.ts` (budget L2 séparé +
> `pVoix` glissant + conservation via canal frame `sectorGrains`) ; `SectorField.ts` (N sources
> HRTF sphériques + granulateurs, « bac à grains ») + `sectorField.ts` (système) ; pool L2
> (`setupSimWorld`, `Voice.layer`) ; snapshot `layers.L2` réel ; sliders live `r1/r2/pente` du
> pont (DebugHUD). **`tsc` vert · `vitest` 52/52** (+9 : `sectorGeometry`, `l2Bridge`
> conservation+déterminisme, `pVoix`) · `vite build` OK. **Reste la validation oreille** (solo L2,
> juger « champ vs points », régler la courbe P(voix) en direct).

**Décisions actées (utilisateur)** : (a) secteurs **sur la sphère** (azimut + élévation),
pas le cercle plat du v0 — pour rester cohérent avec L1 et l'élévation validée par les objets ;
(b) **pavage en anneaux d'élévation, ~8-10 secteurs** (anneau horizon + anneau haut + zénith) —
on valide d'abord que peu de secteurs sonnent « champ » avant d'investir dans un pavage fin ;
(c) rendu **un PannerNode HRTF par secteur** via la couture `SpatialAudioBackend` existante.

#### Recadrage majeur de la NATURE de L2 (acté 2026-06-17) — « un flux, deux rendus »

Le v0 faisait de L2 une **texture de fond par secteurs** (crépitement diffus, alimenté surtout
par une baseline far-field échantillonnant le monde). **On s'en écarte délibérément.** Le rôle
voulu des 3 couches devient un **continuum de discernabilité**, comme la vraie pluie :

- **L1** (~0-10 m) : gouttes individuelles nettes, une voix HRTF chacune.
- **L2** (~10-20 m) : *le même genre d'effet* — des gouttes encore localisables, mais trop
  nombreuses/lointaines pour mériter chacune une voix. **L2 prolonge L1, ce n'est pas un fond.**
- **L3** (>20 m) : le brouhaha indistinct, non localisé (livré, piloté par l'intensité).

**Le vrai enjeu = rendre les transitions inaudibles** (la pluie est un continuum, pas des
régimes). Mécanisme acté : **un seul processus Poisson** génère les gouttes de la zone L2 (débit
**conservé**), et chaque goutte est rendue voix OU grain par **budget + probabilité combinés** :

1. **Budget (déterministe)** : quota de voix L2 (petit, ~8-12). Plein → la goutte part en grain.
   Les gouttes **proches/fortes** gagnent les voix en priorité (logique de vol de voix, cf. L1).
2. **Probabilité (cas non tranchés)** : si une voix est libre, promotion avec `P(voix)` qui
   **glisse de ~1 à r1 vers ~0 à r2**. Même distance → parfois voix, parfois grain : aucune ligne.
3. **Conservation** : la goutte non promue **n'est pas jetée** — elle incrémente le débit du
   granulateur de son secteur 3D. Donc voix + grains = tout le flux, toujours. **Pas de trou ni de
   double comptage** (le piège classique des hybrides : densité perçue constante par construction).

**Continuité aux frontières (un seul principe : crossfade glissant)** :
- **r1 (L1↔L2)** : la courbe `P(voix)` de L2 **vaut ~1 à r1** et décroît ensuite → prolonge L1,
  ne repart pas de zéro. Réutilise l'`overlap` déjà présent dans `bands`.
- **r2 (L2↔L3)** : **symétrique** — les grains L2 directionnels se fondent progressivement dans
  la nappe L3 non-localisée (zone de recouvrement autour de r2). Même logique aux deux bouts.

**Conséquences pour le portage** :
- La **baseline far-field** du v0 (crépitement même sans impact) devient **secondaire/optionnelle** :
  L2 est pilotée par les **vraies gouttes** du flux Poisson, pas par un échantillonnage du monde.
- Le secteur 3D devient le **« bac à grains »** des gouttes L2 non promues, pas une source de fond
  autonome. Le granulateur v0 (Poisson interne) reste utile : il transforme un *débit* (grains/s
  absorbés) en crépitement — exactement ce qu'on lui demande ici.
- La courbe `P(voix)` (seuil de chute + pente) est le **levier central** du réalisme → **réglable
  live** au slider debug (comme le champ L1), pas figée.

**Le risque à surveiller à l'oreille** : un PannerNode rend chaque secteur comme un **point
précis** → avec peu de secteurs, on risque d'entendre « 8 sources ponctuelles » au lieu d'un
champ continu. **Garde-fou** : si l'effet « points » domine, densifier le grain / rapprocher les
secteurs / ajouter un léger flou, avant de monter le nombre de secteurs. À juger à l'écoute.

| # | Action | Fichier | Détail |
|---|--------|---------|--------|
| 4 | **Porter le worklet granulateur** | **nouveau** `audio/worklets/granulator-processor.js` | Verbatim depuis `4c3d0f9` (déjà lu : Poisson seedé, pool 64 grains zéro-alloc, env 30 ms, matMix pondéré, passe-bas occlusion). **Direction-agnostique** : il fait un crépitement ; la spatialisation vient du PannerNode. + câblage `banks` (postMessage), réutilise [banks.ts](../../src/audio/banks.ts). |
| 5 | **Géométrie sphérique des secteurs** | dans `sectorField.ts` | Remplace le cercle plat v0 (`angle=2πk/N`, `y=0`) par des **anneaux d'élévation** : positions `dir(azimut, élévation)` × `rayon=(r1+r2)/2`. `_sectorFor(impact)` classe un impact par azimut **et** élévation (vs azimut seul en v0). |
| 6 | **Promotion voix-ou-grain** (le pont) | `lodRouting.ts` ou nouveau `l2Routing.ts` + `voicePool.ts` | Pour chaque impact `layer==='L2'` : tenter une **voix L2** (quota dédié ~8-12, vol par proximité/force) ; sinon, ou selon `P(voix)` glissant (~1 à r1 → ~0 à r2, courbe réglable), **rabattre vers le grain** du secteur 3D de la goutte. **Conservation** : jamais jetée — voix OU grain. `P(voix)≈1` à r1 pour prolonger L1 sans marche. |
| 7 | **SectorFieldSystem (L2, bac à grains)** | **nouveau** `systems/sectorField.ts` | N sources **statiques** (`backend.createSource()`, position sphérique fixe, `setMaterial`), 1 granulateur/secteur. Reçoit le **débit** des gouttes L2 rabattues (incrémente le secteur de la goutte, decay). Baseline far-field v0 **secondaire/optionnelle** (L2 pilotée par les vraies gouttes). Pont pur ; **absent en headless** (comme `diffuseBed`). |
| 8 | **Voix L2 (rendu net lointain)** | `audioSync.ts` (réutilisé) ou pool L2 dédié | Les gouttes promues en voix L2 = mêmes voix HRTF que L1, **budget séparé**, atténuées par la distance. Mêmes banques que L1/grains → timbre continu à la frontière. |
| 9 | **Pont L2↔L3 + niveau** | `lodRouting.ts`, `diffuseBed.ts`, [store.ts](../../src/ui/store.ts) | Vers r2, les grains L2 se fondent dans la nappe L3 (crossfade symétrique). AnalyserNode agrégé → `snapshot.layers.L2.level` réel (remplace le `−∞` placeholder de Phase L3). |
| 10 | **Slider live : courbe `P(voix)`** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx) + `worldConfig` | Seuil de chute + pente de `P(voix)` exposés en sliders (comme le champ L1) → réglage du pont à l'oreille, en direct. Le **levier central** du réalisme. |

### Phase Instrument — le pupitre de réglage (le menu de la to-do) — ✅ LIVRÉE 2026-06-17

> **Livré** : levier `ctx.layerGain.{L1,L2,L3}` (Resource muable) appliqué par le moteur sur
> les **3 chemins** — voix L1/L2 ([audioSync.ts:142](../../src/engine/systems/audioSync.ts#L142)),
> grains L2 ([sectorField.ts](../../src/engine/systems/sectorField.ts#L14)), nappe L3
> ([diffuseBed.ts](../../src/engine/systems/diffuseBed.ts#L27)) ; **solo/mute** par couche dans
> le HUD (l'UI ne fait que produire les gains) ; **sections repliables** (`Section`, ordre
> Sortie·Couches·Pool·Matériaux·L1·Pont·Routage·Tête, fin du menu L1 flottant) ; **sliders de
> routage** `r1/r2/overlap` sur `ctx.bands` (distincts du pont P(voix)). **`tsc` vert · `vitest`
> 55/55** (+3 : routage reclasse à distance fixe, `layerGain.L2=0` coupe les grains, régression
> neutre) · `vite build` OK. **Reste la validation oreille/œil** (solo isole bien chaque couche,
> menu lisible, déplacer r1 transfère audiblement les impacts du 1ᵉʳ plan vers les secteurs).


> **Ré-cadrage 2026-06-17** : les items 8-11 d'origine ont été écrits *avant* la livraison de
> L3 et L2. Confrontés au code livré, ils ont vieilli — ce cadrage les remplace :
> - **Snapshot par couche** : ✅ **déjà fait** (`layers.{L1,L2,L3}.level`, mesure réelle
>   AnalyserNode, section « Couches » dans le HUD). Plus rien à faire ici.
> - **Sliders P(voix)** : ✅ déjà livrés en Phase L2 (`r1/r2/pente` du **pont**). À ne pas
>   confondre avec les bandes de **routage** ci-dessous (`ctx.bands`), qui sont distinctes.
> - Restent donc **3 chantiers** : solo/mute (le cœur, moteur), rangement (UI), bandes de routage.
>
> **Scope acté (utilisateur, 2026-06-17)** : ampleur **complète** — solo/mute + rangement +
> bandes de routage r1/r2. Le solo/mute est *l'outil* qui servira à valider L2 à l'oreille
> (isoler « champ vs points ») ; on le cadre/code maintenant, validation L2 + instrument ensemble.

#### Le cœur : solo/mute par couche — **3 chemins d'extinction, 1 seul levier**

Règle dure (inchangée) : **l'UI n'éteint rien ; elle écrit un gain de couche dans `ctx`, le
moteur l'applique.** Levier unique proposé : `ctx.layerGain: { L1, L2, L3 }` (linéaire 0..1,
défaut 1). « Solo X » = mettre les autres à 0 ; « mute X » = mettre X à 0. La logique
solo/mute (un seul solo actif, etc.) vit **dans l'UI** ; elle ne fait que produire les 3 gains.

Les 3 couches s'éteignent par **3 chemins différents** (vérifiés dans le code livré) :

| Couche | Où appliquer le gain | Point d'insertion exact |
|---|---|---|
| **L1 + voix L2** | palier de gain de chaque grain | [audioSync.ts:142](../../src/engine/systems/audioSync.ts#L142) `rainLin` → multiplier par `layerGain[voice.layer]` (la voix porte déjà `layer`). |
| **grains L2** | débit absorbé | [sectorField.ts:16](../../src/engine/systems/sectorField.ts#L16) : ne pas `absorb()` si `layerGain.L2===0` (ou passer le gain à `field.update` comme master de secteurs). |
| **L3 nappe** | intensité de la nappe | [diffuseBed.ts:27](../../src/engine/systems/diffuseBed.ts#L27) : `bed.setIntensity(intensity * layerGain.L3)`. |

> **Subtilité** : L2 a **deux** chemins (voix HRTF *et* grains). `layerGain.L2` doit couper les
> **deux** — sinon « solo L1 » laisserait crépiter les grains L2. C'est le seul piège.

| # | Action | Fichier | Détail |
|---|--------|---------|--------|
| 9a | **Levier `ctx.layerGain`** | [EngineContext.ts](../../src/engine/context/EngineContext.ts), `createContext.ts` | `layerGain: { L1: number; L2: number; L3: number }`, défaut `{1,1,1}`. Resource muable, écrite par l'UI, lue par les 3 systèmes audio. |
| 9b | **Appliquer dans les 3 systèmes** | `audioSync.ts`, `sectorField.ts`, `diffuseBed.ts` | Les 3 points d'insertion du tableau ci-dessus. Pur côté logique (les systèmes lisent `ctx`). |
| 9c | **Solo/mute dans le HUD** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx), `store.ts` | Boutons solo/mute dans la section « Couches » existante. État local UI → écrit `ctx.layerGain`. Un solo actif coupe les autres ; clic re-solo = retour normal. |
| 10 | **Rangement du menu (sections repliables)** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx) | Sections **repliables** (titre cliquable) : `Sortie` (master+pool), `Couches` (niveaux + solo/mute), `L1 héros` (sliders sphère, rangés **sous** L1), `Pont L1↔L2` (P(voix), déjà là), `Routage` (#11), `Tête` (6 faces). Fin de la section L1 flottante. État replié purement UI. |
| 11 | **Bandes de routage r1/r2 réglables** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx) + [`ctx.bands`](../../src/engine/context/EngineContext.ts#L62) | Sliders `r1`/`r2`/`overlap` de **`ctx.bands`** (lus chaque tick par [lodRouting.ts:28](../../src/engine/systems/lodRouting.ts#L28)) : déplacer **où** un impact est taggé L1/L2/L3. Écriture live, ré-routage au tick suivant. **Distinct du pont P(voix)** : `bands` décide la *couche d'un impact* ; P(voix) décide *voix-ou-grain dans L2*. |

**Tests neufs (auto)** : `layerGain.L2=0` → un impact L2 n'augmente **pas** le débit secteur
(garde-fou « couper une couche réduit son niveau », re-exprime le `peakOff < peakOn·0,6` de
l'origine, cf. §7) ; `bands` modifié → un impact à distance fixe change de `layer` (frontière
déplacée). Le solo/mute UI et le repliable restent en **validation oreille/œil** (pas de test).

---

## 5. Reports volontaires (dette assumée)

- **Persistance des réglages debug** : sliders volatils (rechargement = reset). Sauver un
  preset de réglage est un confort, pas un prérequis de validation.
- **Occlusion/matMix fins des secteurs** : le v0 les calcule (`_occlusionLocale`,
  `_couvertureMatériau`). Portables, mais en monde plat l'occlusion ≈ 0 — on porte la
  structure, on ne s'attarde pas sur le réglage tant que le relief n'est pas là.
- **`dropletRate` BULK** : redevient le levier d'intensité du flux L2/L3 (aujourd'hui mort,
  cf. [03](03-journal-sujets.md)). Reconnecté ici comme débit d'alimentation L2/L3.

---

## 6. Validation (« fini quand »)

- **Auto** : `tsc` vert · `vitest` vert. Tests neufs : `DiffuseBedSystem` → niveau croissant
  avec l'intensité (déterministe) ; `SectorFieldSystem` → un impact `L2` augmente le débit du
  **bon secteur** (angle), decay sans alimentation ; snapshot `layers` cohérent.
- **Humain (le cœur)** : à l'oreille — **solo L1** = impacts héros nets seuls ; **solo L2** =
  fond directionnel par secteurs ; **solo L3** = nappe diffuse seule ; les trois ensemble =
  une pluie pleine et crédible. Déplacer `r1` transfère audiblement des impacts du premier
  plan vers les secteurs. **A/B mental contre le souvenir du v0** (qui faisait déjà les 3).

---

## 7. Ce que ce chantier prépare

- **Réglage de toute la suite** : vent, biomes, eau se règleront via ce pupitre par couche —
  outil transversal de mise au point sonore.
- **Réverb/occlusion dormantes** ([architecture §6 J6](../architecture.md)) : les secteurs L2
  rallument le besoin d'occlusion directionnelle (déjà câblée transparente) quand le relief
  viendra (World Shaper).
- **Filet E2E à recaler** (dette connue, [03](03-journal-sujets.md)) : les specs `j3/j5`
  testent des `surface-toggles` supprimés. Le solo/mute par couche offre un **nouveau point
  d'accroche** propre pour ré-ancrer les garde-fous (« couper une couche réduit son niveau » —
  re-exprime le garde-fou `peakOff < peakOn·0,6` de l'origine).
```
