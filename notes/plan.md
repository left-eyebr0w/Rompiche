# Rompiche — Le plan : comment on réalise la vision

**Dernière mise à jour** : 14 juin 2026 (J5 complété)
**Rôle** : dit *dans quel ordre* et *selon quels principes* on construit la v1.
Le *quoi* est dans [vision.md](vision.md) ; le *comment c'est bâti* dans
[architecture.md](architecture.md).

> ⚠️ **Ce plan n'est pas une suite de segments à valider.** Ce ne sont pas des paliers
> numérotés qu'on coche l'un après l'autre. C'est une **carte de chantiers nommés**, reliés
> par des dépendances. L'ordre exprime une *intention*, pas un contrat de jalons. Le seul
> repère ferme : **le Grand Refactor passe avant tout le reste.**

---

## 1. Le périmètre

**La v1, c'est toute la [vision](vision.md).** Pas un sous-ensemble « pivot », pas une
« totale » repoussée. Le diorama sonore éditable, sculptable et vivant décrit dans la vision
*est* ce qu'on livre. Le présent document n'en réduit pas l'ambition : il en organise la
réalisation.

---

## 2. Les principes qui tiennent

### 2.1 « Ne jamais casser » — sauf une fois
La règle du projet est de ne jamais mettre le socle par terre. **Le Grand Refactor en est
l'unique exception** : c'est un moment, assumé et borné, où l'on a le droit de tout démonter
en même temps pour remonter propre — parce que c'est le dernier moment peu coûteux pour le
faire (code encore petit, aucun utilisateur). Avant lui : la v0 validée. Après lui : on
n'enfreint plus la règle.

### 2.2 Les deux invariants qui survivent à tout, refactor compris
1. **Les données ne meurent jamais.** Format de save versionné + migrations pures
   (`migrate(vN) → vN+1`). Une création s'ouvre dans toutes les versions futures.
2. **Les tests garde-fous sont le contrat.** Ils peuvent être rouges *pendant* le refactor ;
   ils redeviennent verts pour déclarer le refactor terminé. C'est la preuve que le
   comportement sonore validé en v0 a été restitué.
   > 📍 **Affiné par [grand-refactor.md](grand-refactor.md)** : le refactor n'est plus « un seul
   > saut sans étapes validées » mais une **série de jalons (J0→J6) validés à l'oreille + tests
   > qui grandissent**. Les 5 garde-fous d'origine ont le droit de mourir (ils sont ré-ancrés sur
   > les nouvelles coutures), la v0 sert d'oracle A/B. Voir le deep-dive pour le détail.

### 2.3 On construit derrière des coutures stables
`WorldQuery` (monde ↔ audio) et `SpatialAudioBackend` (audio ↔ spatialisation) isolent les
implémentations. On ajoute une feature en se branchant dessus, jamais en réécrivant le cœur.
Détail dans [architecture.md](architecture.md).

---

## 3. Les chantiers

### 🔧 Le Grand Refactor — *passe avant tout* 🏗️ J0/J1/J2/J3/J4/J5 ✅
La refonte holistique qui amène le code à l'architecture cible : TypeScript complet, moteur
sorti de React, boucle de jeu à pas fixe, ECS (Miniplex), rendu three.js impératif (abandon
de React Three Fiber), et bascule audio de Resonance (abandonné) vers Web Audio natif.
Organisé en jalons J0→J6, validés à l'oreille + tests qui grandissent (détail : [grand-refactor.md](grand-refactor.md)).
- **Dépend de** : rien (point de départ).
- **État** : ✅ J0 (coutures), J1 (boucle headless), J2 (simulation pure), J3 (audio Resonance), J4 (rendu three.js), J5 (UI React + bascule v0→src) complétés. `tsc` vert, tests unitaires + E2E J3/J5 ré-ancrés.
- **Prochain** : J6 (swap Web Audio) — **dernier jalon**, clôt le refactor.
- **Fini quand** : J6 complet — tests garde-fous re-verts, `tsc` vert, architecture cible en place, v0 retirée.

### 🎨 L'édition du terrain
Peindre des matériaux, lever du relief, sur le terrain plat actuel — « j'édite, le son suit »
(rebake audio incrémental, annuler/refaire). L'*edit overlay* par colonne est déjà préparé
dans le monde plat.
- **Dépend de** : le Grand Refactor.

### ⛰️ Le World Shaper (terrain sculptable)
La sculpture de terrain par champ SDF / chunks / marching cubes, introduite comme **2ᵉ
implémentation de `WorldQuery`** — l'audio ne voit pas la différence. Spec dédiée :
[terrain-sdf.md](terrain-sdf.md).
- **Dépend de** : le Grand Refactor ; bénéficie de la boucle d'édition.

### 🌧️ Le monde vivant
Tout ce qui fait respirer le diorama, par briques branchées sur l'ECS et le monde
interrogeable :
- **Météo** (vent en altitude, pluie inclinée, nuages découplés)
- **Eau** (lacs, rivières, océans + leurs sons)
- **Biomes** (les 7 de la vision, paramétrables)
- **Faune** (comportements, sons, densité par biome)
- **Objets animables** (timeline 0-1 pilotée par conditions, causalité forte son/anim)
- **Dépend de** : le Grand Refactor ; chaque brique se branche sans toucher au cœur. Ces
  briques sont **largement indépendantes entre elles** — d'où l'absence d'ordre imposé.

---

## 4. Carte des dépendances

```
        ┌─────────────────────┐
        │   Le Grand Refactor │   (l'exception : avant tout)
        └──────────┬──────────┘
                   │
   ┌───────────────┼───────────────────────────┐
   ▼               ▼                             ▼
Édition du     World Shaper              Le monde vivant
 terrain      (terrain SDF)        météo · eau · biomes ·
   │               ▲               faune · objets animables
   └──── nourrit ──┘                 (briques indépendantes)
```

La v1 est atteinte quand la vision est réalisée : un diorama sonore qu'on édite, qu'on
sculpte, et qui vit — sur l'architecture cible.

---

## 5. Méthode

Reconnaissance (lecture seule) → cadrage → exécution, chantier par chantier, tests comme
filet. Le découpage fin d'un chantier se fait **juste avant de l'attaquer**, pas d'avance :
on ne spécule pas sur les chantiers lointains, qui se préciseront en chemin. Le prochain à
découper est **le Grand Refactor**.
