# Rompiche — Cadrage v1 (unifié)

**Dernière mise à jour** : 13 juin 2026
**Statut** : 🎯 v1 CADRÉE — périmètre tranché
**Auteur** : projet solo, artistique, destiné à être rendu public

> Ce document **remplace et tranche** les notes en tension :
> - [cadrage-v0-v1.md](cadrage-v0-v1.md.md) → reste valide pour la v0 ; sa section v1 est remplacée ici.
> - [v1.md](v1.md) → requalifié en **vision « la totale »** (paliers v1.x / v2), pas en v1.
> - [world-shaper.md](world-shaper.md) → spec technique d'un **palier futur** (Palier 3), pas de la v1.

---

## 0. Principe directeur

La v1 n'est **pas** une liste de features. C'est le passage du *modèle de monde plat*
(deux `Uint8Array`) au **modèle pivot extensible**, fait de telle sorte que toute la suite
(world-shaper, biomes, eau, faune, météo) puisse s'y brancher **ensuite, un morceau à la
fois, sans jamais réécrire le cœur ni casser l'audio v0 validé**.

Contrainte absolue, posée par l'auteur : **« Ne jamais casser. Toujours avancer. »**
Elle n'interdit pas l'ambition — elle interdit l'irréversible. Toute l'ambition vit dans la
**trajectoire** ; aucune étape ne met le socle par terre.

> Le risque mortel du projet n'est pas la difficulté du world-shaper. C'est de **réécrire le
> modèle de monde deux fois** parce que le premier jet n'anticipait pas le SDF. La v1 existe
> précisément pour éviter ça.

---

## 1. Définition de la v1 (tranchée)

**v1 = le Pivot.** Et rien d'autre.

Sont DANS la v1 :
1. **Migration TypeScript — phase A** : `tsconfig` permissif (`allowJs: true`), typage
   prioritaire du modèle de données (state, terrain, materials, objects, coords, worldConfig).
   *(Les `.d.ts` existants dans [types/](../ds/ui_kits/diorama/types/) sont le point de départ.)*
2. **Modèle de monde sérialisable + versionné dès le jour 1**. Format unique, `version` en
   tête, qui contient déjà : échelle (invariant **1 unité = 1 mètre**, déjà tenu par
   [coords.js](../ds/ui_kits/diorama/coords.js)), table matériaux, et un **terrain abstrait
   derrière une interface** — l'`Uint8Array` n'est plus exposé directement aux consommateurs.
3. **Interface Monde ↔ Audio figée** (voir §3). C'est le vrai pivot : la frontière stable
   derrière laquelle l'implémentation du terrain pourra changer (plat → SDF) sans que l'audio
   ne s'en aperçoive.
4. **Save / Load** sans perte (IndexedDB ; compression RLE repoussable à plus tard).

Sont HORS v1 (requalifiés en paliers ultérieurs, voir §2) :
édition de terrain, World Shaper / SDF, biomes, eau, faune, objets animables, météo enrichie,
polish visuel. **On reste en wireframe.**

---

## 2. La totale, ordonnée en paliers

Chaque palier est jouable, testé, et ne casse pas le précédent. C'est l'opérationnalisation
de « toujours avancer ».

| Palier | Contenu | État |
|---|---|---|
| **P0** | Socle v0 : 3 couches audio, Poisson, pool de voix, Resonance, tests Playwright 4/4, fix sol-herbe, `.d.ts`. | ✅ acquis |
| **P1** | **LE PIVOT = la v1** : TS-A + modèle sérialisable versionné + interface Monde↔Audio + save/load. | 🎯 cible |
| **P2** | Édition non destructive du terrain *plat actuel* (peindre matériau, lever relief) **via l'interface P1**, avec rebake audio incrémental. Valide la boucle « j'édite → le son suit » sur le modèle simple. | v1.1 |
| **P3** | **World Shaper** ([world-shaper.md](world-shaper.md)) : champ SDF / chunks / marching cubes comme **2ᵉ implémentation** du terrain derrière la même interface P1. L'audio ne voit pas la différence. | v1.2 |
| **P4+** | Reste de [v1.md](v1.md) : météo découplée, eau, biomes, faune, objets animables. Chacun se branche sur le monde éditable + interrogeable acoustiquement. Aucun ne touche au cœur. | v1.x / v2 |

> **Pourquoi cet ordre tient la contrainte** : le SDF (P3) est introduit comme un
> *remplacement d'implémentation*, jamais comme une réécriture — à condition que l'interface
> P1 soit juste. « Ne jamais casser » se gagne ou se perd **au Palier 1**.

---

## 3. L'interface Monde ↔ Audio (le pivot à figer en v1)

C'est la seule frontière qui compte. Une fois figée, l'implémentation derrière (terrain plat
aujourd'hui, SDF demain) est interchangeable. Reprise et adaptée de
[world-shaper.md §6.1](world-shaper.md).

Le moteur audio ne doit **jamais** lire `terrain.material` (Uint8Array) en direct. Il
interroge le monde uniquement via :

```ts
interface WorldQuery {
  /** Matériau + distance à la surface la plus proche d'un point monde (mètres). */
  nearestSurface(p: Vector3): { distance: number; material: Material } | null

  /** Lancer de rayon : occlusion, premières réflexions. */
  raycast(origin: Vector3, dir: Vector3): {
    distance: number; point: Vector3; normal: Vector3; material: Material
  } | null

  /** Occlusion source→auditeur, [0,1]. */
  isOccluded(source: Vector3, listener: Vector3): number

  /** Volume estimé de la cavité (m³) → réverbération (RT60, Sabine). */
  enclosedVolume(p: Vector3): number

  /** Points d'impact pluie disponibles (remplace l'accès direct à BakedSet). */
  impactPoints(): ReadonlyArray<ImpactPoint>
}
```

**Implémentation v1 (triviale, mais réelle)** : un adaptateur au-dessus du `Terrain` plat
actuel. `nearestSurface` ≈ `terrain.cellAt(x,z)` ([terrain.d.ts](../ds/ui_kits/diorama/types/terrain.d.ts)),
`enclosedVolume`/`isOccluded` retournent des valeurs neutres (pas de murs en wireframe).
L'objectif n'est pas la richesse acoustique — c'est de **router tous les accès du sampler à
travers cette interface** pour que P3 puisse glisser le SDF dessous sans rien changer côté audio.

**Invariant** : si audio et monde divergent un jour, on ne corrige **que** l'implémentation
de `WorldQuery`, jamais le sampler.

---

## 4. Format de sauvegarde (versionné dès le jour 1)

```ts
interface WorldSave {
  version: number              // ⚠️ présent dès la v1, incrémenté à chaque changement de schéma
  meta: { voxelSize: number; scale: '1u=1m'; createdAt: string }
  materials: MaterialTable     // table matériaux (id, acoustique par bande plus tard)
  terrain: TerrainPayload      // OPAQUE derrière une union discriminée par `kind`
  objects: WorldObject[]
  seed: number
  preset: Preset
}

type TerrainPayload =
  | { kind: 'flat-grid'; material: /*RLE*/ Uint8Array; height: /*RLE*/ Uint8Array }  // v1
  | { kind: 'sdf-chunks'; /* … */ }                                                  // P3, futur
```

Le champ `kind` est ce qui permet d'ajouter le SDF **sans casser** les saves « flat-grid » :
un loader connaît les deux. Migration de version = fonction pure `migrate(vN) → vN+1`.

---

## 5. Definition of Done — v1

La v1 est livrable quand :

- [ ] `tsconfig.json` permissif en place ; modèle de données entièrement typé (TS-A).
- [ ] Tous les accès du `RainSampler` au terrain passent par `WorldQuery` (aucun accès direct
      à `terrain.material` résiduel dans le moteur audio).
- [ ] `WorldSave` versionné implémenté ; **save → reload → état identique** (test Playwright).
- [ ] Les **4 tests garde-fous v0 passent toujours** (audio-output, layers-signal,
      listener-position, surface-toggles) — preuve de non-régression.
- [ ] Aucune feature P2+ introduite (pas d'édition, pas de SDF, pas de polish). Périmètre tenu.

---

## 6. Méthode (inchangée, rappelée)

- Chantier par chantier, tests comme filet. On ne refactore jamais une zone non comprise/testée.
- Reconnaissance (lecture seule) → cadrage → exécution. Ce document clôt le cadrage v1.
- Les notes [v1.md](v1.md) et [world-shaper.md](world-shaper.md) **ne sont pas supprimées** :
  elles deviennent la documentation des paliers P2→P4+. Règle v0 maintenue : on ne jette pas
  l'exploration, on ne prétend pas qu'elle est finie, elle ne bloque rien.
</content>
</invoke>
