# Cadrage — Objets posés & scène de test

**Date** : 2026-06-16 · **Statut** : cadré, non commencé
**Chantier** : premier pas post-Grand-Refactor, fondateur de la validation v0.
**But** : une scène crédible (terrain plat + objets de matières variées en hauteur)
qui permette enfin de **valider à l'oreille** la spatialité et l'élévation du moteur
de son — prérequis de tous les autres points de [to-do](../random/to-do.txt).

---

## 1. Pourquoi ce chantier en premier

La [to-do](../random/to-do.txt) est une liste à plat, mais la plupart des points ne
sont **validables que sur une scène crédible** :

| Point to-do | Dépend de la scène/objets ? |
|---|---|
| Isoler L1/L2/L3, tweaker à l'oreille | ✅ sans surfaces en hauteur, rien à entendre en spatialité |
| Vent (inclinaison + force à l'impact) | ✅ l'effet ne se juge qu'avec relief + matières variées |
| Rotation Y de la tête (360°) | ✅ inutile sans repères spatiaux autour de la tête |
| Adapter sliders position aux dimensions | ✅ dépend des dimensions du diorama |
| Visuel pluie · Overlay perf · UI saves | ❌ indépendants |

Le seul item qui dit *« il faut implémenter les objects »* débloque les autres. C'est
aussi le seul **chantier architectural** de la liste (touche ECS + WorldQuery) ; le
reste se branche par-dessus. On le pose tôt, comme on l'a fait pour le refactor.

---

## 2. Le constat qui réduit le chantier : le moteur est déjà 3D-ready

La génération d'impacts **ne connaît pas le terrain**. Elle consomme un **pool plat de
`TerrainVertex`** exposé par le pivot WorldQuery :

```
ctx.world.impactPoints() → TerrainVertex[]   // { position, normale, matériau, expoCiel }
   └─ pickImpact(pool, prng, head, field)     // tirage pondéré par distance 3D à la tête
```

Or `pickImpact` / `spatialWeight` ([terrainMesh.ts:90](../../src/engine/world/terrainMesh.ts#L90))
**travaillent déjà en 3D** : ils lisent `position.y`, pondèrent sur la hauteur (`ky`,
`dy`, `upBias`). Le moteur de pluie **sait déjà frapper des points en hauteur** — il
ignore juste qu'ils existent, parce que [buildTerrainMesh](../../src/engine/world/terrainMesh.ts#L32)
ne produit que des vertices au sol (`y = ground + cell.height`, normale figée `{0,1,0}`).

> **Conséquence centrale** : « objets frappés par la pluie » = **ajouter leurs faces au
> pool de `TerrainVertex`**. Pas de refonte de RainPoisson, ni de l'audio, ni de la PDF
> spatiale. Le pivot [WorldQuery](../../src/engine/world/World.ts#L38) absorbe tout.

Bonus : les composants ECS `surface?: SurfaceMaterial` et `wind?: Wind` (avec `tilt`)
sont **déjà déclarés** dans [Entity.ts](../../src/engine/ecs/Entity.ts) (non peuplés).
On s'appuie dessus.

---

## 3. Décisions de scope (actées avec l'utilisateur, 2026-06-16)

1. **Nature d'un objet** = *primitive posée* (boîte / plan), entité ECS légère
   `{ transform, shape, surface }`. PAS d'intégration au WorldQuery par colonne
   (réservé au chantier World Shaper). Débloque la validation au plus vite.
2. **Interaction pluie↔objets** = *impacts réels sur les surfaces*. Les faces exposées
   des objets entrent dans le pool ; routées L1/L2/L3 par distance comme le terrain.
   C'est ce qui valide vraiment le moteur de son spatialisé.
3. **Zone surfaces métal/bâche désactivables** = *supprimée maintenant*. Terrain
   semi-indenté incohérent → terrain plat propre. Repart sur du sain.

---

## 4. Découpage proposé

| # | Action | Fichier | Détail |
|---|--------|---------|--------|
| 1 | **Composant `shape`** | [Entity.ts](../../src/engine/ecs/Entity.ts) | Ajouter `shape?: Shape` (`{ kind: 'box'｜'plane', size, ... }`). Donnée pure, sérialisable (saves gratuits). Réutilise `transform` + `surface` déjà présents. |
| 2 | **Primitive → vertices d'impact** | **nouveau** `world/objectMesh.ts` | `buildObjectVertices(entity) → TerrainVertex[]` : échantillonne les faces **exposées au ciel** d'une primitive en `TerrainVertex` (position en hauteur, **normale réelle**, matériau, `expoCiel`). Une boîte = 5 faces utiles (dessous ignoré). Densité d'échantillonnage ≈ celle du terrain (cohérence du débit Poisson). PAS de three.js (données pures, comme terrainMesh). |
| 3 | **Fusion dans le pool** | [World.ts](../../src/engine/world/World.ts#L115) | `impactPoints()` renvoie `[...terrain, ...objets]`. `nearestSurface` gagne les objets pour l'audio (parcourt le pool fusionné). FlatWorld reçoit les entités-objets (ou leurs vertices pré-bakés) à la construction. |
| 4 | **Rendu** | `ThreeRenderer` | Dessine les primitives (mêmes `TerrainVertex` que J4, ou géométrie three native par `shape`). Cohérence visuelle wireframe + relief. |
| 5 | **Scène de test** | [setupSimWorld](../../src/engine/systems/index.ts#L50) | Terrain **plat uniforme**. + 3-4 objets matières variées à hauteurs variées (boîte métal, plan bâche incliné, dalle terre surélevée…). Source unique de la scène debug. |
| 6 | **Suppression dette** | [ControlHUD.tsx](../../src/ui/ControlHUD.tsx), [input.ts:52](../../src/engine/systems/input.ts#L52), [rainPoisson.ts:51](../../src/engine/systems/rainPoisson.ts#L51) | Retirer la zone surfaces désactivables de l'UI ; `ctx.surfaces.metal/bache` + `ctrl.metal/bache` ; le filtrage `c.surfaces[v.matériau]` dans rainPoisson ; le terrain semi-indenté. |

---

## 5. Reports volontaires (dette assumée, justifiée)

- **Ombre de pluie (objets abritant le sol)**. Aujourd'hui `expoCiel` calcule l'abri
  entre cellules voisines ([terrainMesh.ts:50](../../src/engine/world/terrainMesh.ts#L50)).
  Un objet en hauteur *devrait* empêcher la pluie de tomber dessous (physiquement juste,
  très parlant). Mais ça demande une passe d'occultation verticale.
  **Reporté** : pour valider le moteur de son, il suffit que les objets *reçoivent* la
  pluie. L'ombre est un raffinement, pas un prérequis de validation.
- **Inclinaison consommée par la PDF**. `spatialWeight` ne lit pas la normale. L'audio
  (`nearestSurface`) et le futur **vent** en auront besoin → le composant porte une
  **vraie normale dès maintenant** (gratuit), même si la PDF l'ignore encore.
- **Intégration WorldQuery par colonne** : réservée au World Shaper (terrain SDF).

---

## 6. Validation (« fini quand »)

- **Auto** : `tsc` vert · `vitest` vert. Test neuf : `buildObjectVertices` produit les
  bonnes faces (count, normales, matériaux) ; `impactPoints()` fusionne terrain+objets ;
  un impact peut tomber sur un objet en hauteur (déterministe, PRNG seedé).
- **Humain (le cœur)** : à l'oreille, on **entend** les impacts venir d'en haut / des
  côtés selon l'objet frappé ; déplacer la tête / tourner change la spatialité de façon
  crédible. C'est la preuve attendue par la to-do (« tester la spatialité et l'élévation »).

---

## 7. Ce que ce chantier prépare pour la suite

- **Vent** : la normale réelle des faces + le composant `wind` (déjà là) permettront
  d'incliner la pluie et de moduler la force à l'impact selon l'orientation.
- **Debug L1/L2/L3 isolable** : une scène avec objets à distances variées rend le
  routage par couche enfin observable/réglable.
- **World Shaper** : `objectMesh` (faces → vertices) est un galop d'essai de la 2ᵉ
  implémentation de WorldQuery, derrière le même pivot.
