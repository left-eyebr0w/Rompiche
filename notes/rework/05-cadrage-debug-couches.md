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

### Phase L3 — la nappe diffuse (la plus rentable, la moins risquée)
| # | Action | Fichier | Détail |
|---|--------|---------|--------|
| 1 | **Porter le worklet bruit** | **nouveau** `audio/worklets/noise-processor.js` | Verbatim depuis `4c3d0f9`. `addModule` au boot (à côté de `clock-processor`). |
| 2 | **DiffuseBedSystem (L3)** | **nouveau** `systems/diffuseBed.ts` | Porte `DiffuseBed.js` : graphe bruit→passe-bande→gain→master via le backend. Piloté par `worldConfig.weather.intensité` (et/ou densité). Branché après VoicePool. Filtre L3 `centreHz/largeurHz` déjà en config. |
| 3 | **Niveau L3 mesuré** | `diffuseBed.ts` + snapshot | AnalyserNode sur le gain de nappe → niveau réel (jamais décoratif). |

### Phase L2 — les secteurs (spatialisé, le gros morceau)
| # | Action | Fichier | Détail |
|---|--------|---------|--------|
| 4 | **Porter le worklet granulateur** | **nouveau** `audio/worklets/granulator-processor.js` | Verbatim depuis `4c3d0f9` + câblage `banks` (postMessage). |
| 5 | **SectorFieldSystem (L2)** | **nouveau** `systems/sectorField.ts` | Porte `SectorField.js` : N sources **statiques** (via `backend.createSource()`, position fixe en cercle), `absorberImpact` consommant les impacts `layer==='L2'` du tampon de frame + baseline far-field via `WorldQuery`. Decay/débit/matMix repris. |
| 6 | **Brancher le routage** | [lodRouting.ts](../../src/engine/systems/lodRouting.ts), [voicePool.ts](../../src/engine/systems/voicePool.ts) | Les impacts `L2` vont au SectorField (au lieu d'être abandonnés) ; `L3` nourrissent la nappe (densité/baseline). Plus aucun impact taggé puis perdu. |

### Phase Instrument — le pupitre de réglage (le menu de la to-do)
| # | Action | Fichier | Détail |
|---|--------|---------|--------|
| 7 | **Snapshot par couche** | [EngineSnapshot.ts](../../src/ui/EngineSnapshot.ts), [store.ts](../../src/ui/store.ts) | `layers: { L1:{level,rate,voices}, L2:{level,rate,sectors}, L3:{level} }`, projeté **côté moteur** (§5.1 archi). ~10 Hz. |
| 8 | **Vue + solo/mute par couche** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx) | Section « Couches » : 3 lignes (niveau dB réel + débit + jauge) + **solo/mute** par couche → gain de couche dans `ctx`, appliqué par le moteur (l'UI n'éteint rien). |
| 9 | **Rangement du menu** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx) | Sections **repliables** : `Sortie` (master+pool), `Couches` (#8), `L1 héros` (sliders existants rangés **sous** la couche L1), `Tête` (6 faces). Fin de la section L1 flottante. |
| 10 | **Bandes r1/r2 réglables** | [DebugHUD.tsx](../../src/ui/DebugHUD.tsx) + `ctx.bands` | Sliders `r1`/`r2`/`overlap` : déplacer **où** une couche prend le relais, à l'oreille. Écriture live, ré-routage au tick suivant. |

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
