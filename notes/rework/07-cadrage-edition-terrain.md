# Cadrage — Édition du terrain (galop d'essai du World Shaper)

**Date** : 2026-06-18 · **Statut** : **1ᵉʳ lot LIVRÉ** (peinture) — relief différé (§3)

> **Livré 2026-06-18 (peinture matériau)** : `shared/edit.ts` (brush minimal paint/raise) ;
> commande `{t:'edit'}` (remplace `paint`) ; couture `EditableWorld` (applyEdit/flushRemesh)
> + `DirtyRegion` + `isEditable` sur `FlatWorld` ([World.ts](../../src/engine/world/World.ts)) ;
> rebake INCRÉMENTAL par région (option B) via `buildCellVertex` + `cellSlot`
> ([terrainMesh.ts](../../src/engine/world/terrainMesh.ts)) ; invalidation du re-tri par
> `meshVersion` dans `RainBuckets` (le couplage caché §5) ; `EditSystem` (2 temps, après Input,
> avant RainPoisson, [edit.ts](../../src/engine/systems/edit.ts)) ; overlay `_edits` inerte
> SUPPRIMÉ (mutation directe du Terrain → persistance RLE gratuite) ; section debug « Édition
> terrain » dans le HUD (peindre un disque sous l'auditeur, rayon réglable).
> **`tsc` vert · `vitest` 63/63** (+6 : [edition.test.ts](../../src/engine/world/edition.test.ts)
> — applyEdit ciblé, deux temps, rebake incrémental, budget, **bout-en-bout « le son suit »**)
> · `vite build` OK. **Reste la validation oreille** (peindre métal sous la tête, entendre le
> timbre changer) et le **2ᵉ temps : le relief** (raise → rebake occlusion, §3).
> **Décisions §7 tranchées** : (1) peinture seule d'abord ✅ ; (2) mutation directe du Terrain ✅ ;
> (3) rebake B (incrémental) directement ✅.

**Chantier** : « L'édition du terrain » de [plan.md](../plan.md#L63). Premier des chantiers
post-Grand-Refactor à toucher la **boucle d'édition** (commande → mutation monde → rebake → son).
**But re-défini avec l'utilisateur (2026-06-18)** : ce chantier n'est PAS une fin en soi. Son
but premier est de **préparer le World Shaper** ([terrain-sdf.md](../terrain-sdf.md)) en validant
**la boucle d'édition** sur le terrain plat actuel — la plomberie commune que `SdfWorld`
réutilisera sans réécriture.

> **Décisions actées (utilisateur, 2026-06-18)** — ce re-cadrage repart d'elles :
> 1. La décision *« éditer = peindre + lever du relief »* n'est plus tenue pour acquise : le
>    **périmètre du geste** est rouvert (cf. §3).
> 2. **But premier = préparer le World Shaper** (pas un outil de création joueur fini, pas un
>    simple outil de debug).
> 3. Ce qu'il faut **répéter** pour être un vrai galop d'essai = **la boucle**
>    `commande → rebake → son`, pas le geste ni les contrats abstraits.
> 4. **MAIS** abstraire le **geste** dès maintenant : une couche « outil d'édition » (brush
>    abstrait = *zone affectée + opération*) commune aux deux mondes, pour que `SdfWorld`
>    réutilise le même canal de commandes sans réécriture.

---

## 1. Le constat qui définit le chantier (vérifié dans le code, 2026-06-18)

La doc ([plan.md:66](../plan.md#L66)) annonce *« l'edit overlay par colonne est déjà préparé »*.
En lisant le code, ce « préparé » est **un squelette inerte, pas une demi-implémentation** :

| Pièce | État réel | Référence |
|---|---|---|
| Canal de commandes `paint` / `setScale` | **Déclarés mais NO-OP** : `case 'paint': case 'setScale': break` | [input.ts:35](../../src/engine/systems/input.ts#L35) |
| Edit overlay `_edits: Map<string, ColumnSurface>` | **Inerte** : lu dans `rainSurfaceAt`, **jamais écrit**. Clé `${round(x)},${round(z)}` douteuse (arrondi ≠ pas de grille) | [World.ts:73](../../src/engine/world/World.ts#L73), [World.ts:92](../../src/engine/world/World.ts#L92) |
| Pool d'impacts `_mesh` | **Figé au constructeur** : `buildTerrainMesh(...) + objets`, baké **une seule fois**. Aucun chemin de rebake | [World.ts:84](../../src/engine/world/World.ts#L84) |
| `Terrain` (donnée) | **Déjà mutable et prêt** : `material`/`height` en `Uint8Array`, `index(x,z)` O(1), `fill()` | [Terrain.ts:25](../../src/engine/world/Terrain.ts#L25) |
| Persistance | **Déjà prête** : `serializeWorld` encode `terrain.material`/`height` en RLE ; `kind:'flat-grid'` réserve la place du `'sdf-chunks'` | [save.ts:58](../../src/persistence/save.ts#L58) |
| `store.pushCommand` | **Câblé** (UI pousse déjà `reset`) | [store.ts:123](../../src/ui/store.ts#L123), [App.tsx:179](../../src/ui/App.tsx#L179) |

> **Le vrai trou n'est pas la donnée — c'est le REBAKE.** Le `Terrain` se modifie déjà
> trivialement (`material[i] = …`). Ce qui manque, c'est **propager** une mutation jusqu'au
> pool d'impacts (`_mesh`) et donc jusqu'au son, **sans tout reconstruire ni casser le 60 fps**.
> C'est exactement la boucle que le World Shaper devra faire tourner aussi. **D'où le galop d'essai.**

---

## 2. Ce que le chantier valide (et ce qu'il NE fait pas)

**Valide (le cœur)** : la **boucle d'édition** de bout en bout —
```
commande UI (brush) → InputSystem applique → mutation du monde (Terrain/overlay)
                    → rebake INCRÉMENTAL du pool d'impacts → la pluie sonne sur le neuf
```
sur le **terrain plat actuel**, avec un **brush abstrait** réutilisable par le SDF.

**Ne fait PAS (reports assumés, cf. §6)** :
- Pas de geste 3D de sculpture (c'est le SDF qui l'apportera) — voir §3 sur le périmètre du geste.
- Pas d'outil de création joueur fini (ergonomie, presets de brush, UX) — debug-grade suffit.
- Pas le `SdfWorld` lui-même (chantier suivant, [terrain-sdf.md](../terrain-sdf.md)).

---

## 3. Le périmètre du geste — décision rouverte, recommandation

L'utilisateur a rouvert *« éditer = peindre + relief »*. Croisé avec « but = préparer le SDF » et
« ce qui compte = la boucle », voici l'arbitrage proposé :

### Recommandation : **peindre le matériau d'abord, relief en option différée**

- **Peindre un matériau** (`paint`) suffit déjà à exercer **toute la boucle** : muter le monde →
  rebake → le son change (un impact sur la zone repeinte joue le nouveau matériau). C'est le
  **plus court chemin** vers la preuve « j'édite, le son suit ».
- **Lever du relief** (`raise`/`lower` de `terrain.height`) ajoute la 3ᵉ dimension. Techniquement
  c'est **la même boucle** (mutation `height[b]` → rebake), mais ça touche aussi `skyOcclusion`
  (un relief abrite ses voisins) et la géométrie du mesh. **C'est le vrai pré-figurateur du
  geste SDF** (sculpter du volume). À garder en **2ᵉ temps**, une fois la boucle de peinture verte.

> **Pourquoi pas le relief d'emblée** : il introduit le rebake de l'occlusion verticale
> (`makeSkyOcclusion` reconstruit) en plus du rebake du pool — deux préoccupations d'un coup.
> On valide la boucle « pure » sur la peinture (rebake pool seul), puis on rajoute le relief
> qui **étend** le rebake à l'occlusion. Incrément franc, pas big-bang.

**À TRANCHER avec l'utilisateur** : valider ce découpage (peinture → puis relief), ou exiger le
relief dans le même lot.

---

## 4. L'abstraction « outil d'édition » (brush) — commune plat ↔ SDF

C'est la **décision structurante** du re-cadrage (réponse utilisateur : *abstraire le geste dès
maintenant*). On ne câble pas `paint` en dur sur la grille ; on définit un **brush abstrait** que
les deux mondes savent appliquer.

### 4.1 Forme du brush (donnée pure, sérialisable, dans `shared/`)

```ts
// shared/edit.ts — donnée pure, importable UI + moteur (jamais de React/three).
interface EditBrush {
  shape: { kind: 'disc'; center: Vector3; radius: number }   // zone affectée (extensible)
  op:
    | { t: 'paint'; mat: MaterialId }       // peindre un matériau
    | { t: 'raise'; delta: number }         // lever/abaisser le relief (2ᵉ temps, §3)
}
```

- **`shape`** = *zone affectée* : un disque en (x,z) aujourd'hui (suffit au plat). Le SDF
  réutilisera la **même** notion (sphère/disque d'influence d'une brosse). Extensible (`box`, `path`).
- **`op`** = *opération* : **volontairement minimal** (`paint` d'abord, `raise` ensuite). Décision
  actée (2026-06-18) : on **n'anticipe pas** le vocabulaire CSG du SDF (`add`/`sub`/`smooth`/
  `flatten`/`strength`, [sdf §4.1-4.2](../terrain-sdf.md#L157)). Le SDF **élargira l'union `op`** —
  re-typage indolore (l'UI, le canal `{t:'edit'}`, l'InputSystem et la couture ne bougent pas ; seul
  `applyEdit` gagne des `case`). On investit l'anticipation là où elle est coûteuse (la couture
  async §4.3), pas sur une union de types triviale à étendre. Cf. §4bis pt 2.

### 4.2 Le canal de commandes existe déjà — on l'étend

[commands.ts:12](../../src/shared/commands.ts#L12) a déjà `{ t: 'paint'; cell; mat }`. On le
**remplace** par une commande portant un `EditBrush` (plus une cellule isolée mais une zone) :
```ts
| { t: 'edit'; brush: EditBrush }     // remplace l'actuel { t:'paint'; cell; mat }
```
Pourquoi : peindre cellule-par-cellule ne pré-figure rien du SDF ; un **brush à zone** est le
geste commun. La commande reste **discrète** (canal A, file drainée/vidée, déterministe — chaque
coup de brosse compte) — conforme à [architecture.md §5.2](../architecture.md#L408).

### 4.3 Qui applique le brush ? — le monde, en DEUX temps (édition / remaillage)

**Décision actée (utilisateur, 2026-06-18)** : la couture sépare **`applyEdit` (synchrone, léger,
mute le monde + marque dirty)** de **`scheduleRemesh` (asynchrone, budgété par frame)**. Cette
séparation **n'est pas un luxe pour le plat** — elle existe pour que `SdfWorld` glisse son
remaillage en Web Worker derrière la **même** couture, sans réécrire ni le canal ni l'InputSystem
(cf. §4bis et la spec SDF §4.4/§8 : « Édition = Main léger » vs « Remaillage = Worker »).

`WorldQuery` gagne **une couture d'édition** (le SDF l'implémentera aussi) :
```ts
interface EditableWorld {            // implémentée par FlatWorld (puis SdfWorld)
  // TEMPS 1 — synchrone, léger : mute le monde, marque la zone salie, NE remaille PAS.
  applyEdit(brush: EditBrush): DirtyRegion
  // TEMPS 2 — consommé par la BOUCLE (pas l'InputSystem) : draine les zones dirty en
  // attente, reconstruit le pool d'impacts dans un BUDGET borné (N zones/frame).
  // FlatWorld le fait tout de suite (terrain petit) ; SdfWorld délègue au Worker et
  // swap le mesh atomiquement quand il revient. Signature identique des deux côtés.
  flushRemesh(budget: number): void
}
```
- `FlatWorld.applyEdit` : pour `paint`, parcourt les cellules `terrain.index()` sous le disque,
  écrit `terrain.material[i]`, **empile la `DirtyRegion`** dans une file interne. Retourne l'AABB.
- `FlatWorld.flushRemesh` : draine la file, reconstruit **seulement** les `TerrainVertex` des zones
  salies (cf. §5) et les patche dans `_mesh`. Synchrone et instantané (terrain petit) — mais
  **passe par la file**, donc le contrat est déjà celui qu'attend le SDF.
- **Câblage** : `InputSystem` ne fait que `world.applyEdit(brush)` (temps 1, dans le tick, après
  drain des commandes). Le **temps 2** (`flushRemesh`) est appelé par la **boucle de jeu**, une fois
  par frame, avec un budget — comme un mini-système. Le moteur reste l'autorité (clampe le brush
  hors-terrain). Conforme aux règles d'or ECS (aucun état caché : la file dirty vit dans le World).

> **Pourquoi côté monde et en deux temps** : ce qui sera **différent** entre plat et SDF, c'est
> (a) l'écriture (grille vs champ scalaire) et (b) le coût du remaillage (trivial vs Worker). En
> mettant les deux derrière `EditableWorld` **et** en isolant le remaillage budgété dès le plat, le
> canal de commandes + l'InputSystem + l'UI + la boucle sont **inchangés** au passage SDF — seules
> les deux méthodes changent d'implémentation. C'est l'esprit « 2ᵉ implémentation derrière la
> couture » de [architecture.md §4](../architecture.md#L287), poussé jusqu'au pipeline async.

---

## 4bis. Confrontation au World Shaper — la couture est-elle compatible ?

Vérification faite contre [terrain-sdf.md](../terrain-sdf.md) en entier (2026-06-18). Le but du
chantier étant **de préparer le SDF**, on confronte chaque pièce de la couture 07 aux besoins réels
du shaping. Verdict : **compatible APRÈS les deux corrections du §4.3 et du brush** (ci-dessous).

### Ce qui est déjà aligné

| Besoin SDF | Pièce couture 07 | OK ? |
|---|---|---|
| Brush = forme + opération ([sdf §4.1](../terrain-sdf.md#L157)) | `EditBrush { shape, op }` | ✅ même structure |
| Application par AABB de zone ([sdf §4.3](../terrain-sdf.md#L181)) | `applyEdit → DirtyRegion` (AABB) | ✅ |
| Mutation côté monde, pas UI | couture `EditableWorld` | ✅ point clé |
| Persistance versionnée RLE + `kind` discriminé ([sdf §7](../terrain-sdf.md#L291)) | `save.ts` déjà prêt (`flat-grid`↔`sdf-chunks`) | ✅ déjà en place |
| Canal de commandes discret/déterministe | canal A (file drainée) | ✅ |

### Les divergences traitées (sinon : réécriture forcée au passage SDF)

1. **Remaillage asynchrone (le point structurant).** La spec SDF est catégorique
   ([sdf §4.4](../terrain-sdf.md#L199), [§8](../terrain-sdf.md#L310), pièges 4 & 10) : remailler
   **dans un Web Worker**, budgété par frame, swap atomique. Une couture `rebake()` synchrone aurait
   forcé une réécriture. **→ Corrigé en §4.3** : `applyEdit` (sync) / `flushRemesh(budget)`
   (consommé par la boucle). FlatWorld remaille tout de suite mais **par la file** → le SDF ne
   change que l'implémentation de `flushRemesh`.

2. **Vocabulaire du brush (CSG add/sub/smooth/flatten + strength).** Le cœur du shaping est CSG
   sur le champ ([sdf §4.2](../terrain-sdf.md#L169)) ; le brush 07 ne fait que `paint`/`raise`.
   **Décision actée (utilisateur, 2026-06-18) : rester minimal**, on étendra l'enum `op` au SDF.
   Arbitrage assumé et cohérent : on **anticipe la plomberie** (la couture async, coûteuse à
   changer) mais **pas le vocabulaire** (ajouter une variante à l'union `op` est indolore — l'UI et
   la couture ne bougent pas, seul `applyEdit` gagne des `case`). Le canal `{ t:'edit'; brush }`,
   lui, ne changera pas. *Le seul re-typage au SDF = élargir l'union `op`, voulu.*

3. **Apron / invalidation des voisins** (pièges SDF 1 & 2, [sdf §2.1](../terrain-sdf.md#L72) /
   [§4.3](../terrain-sdf.md#L181)). Un edit de bord de chunk doit salir les chunks voisins. La
   `DirtyRegion = AABB` du plat **suffit comme contrat** : `flushRemesh` est libre d'élargir en
   interne la zone aux chunks partageant l'apron (le plat n'a pas de chunks, donc no-op ; le SDF
   gère). **→ À documenter** : `flushRemesh` peut traiter une zone PLUS LARGE que l'AABB reçu. Aucun
   changement de signature requis. (noté ici, pas une dette.)

4. **Recompute acoustique debounced** ([sdf §6.3](../terrain-sdf.md#L281), piège 8). Au SDF, un
   remesh déclenche aussi un recalcul de zone acoustique (réverb/occlusion) notifié à l'audio. En
   plat, `enclosedVolume`/`isOccluded` valent 0 (monde ouvert) → **rien à faire**. Mais la place est
   la bonne : `flushRemesh` est le point naturel où brancher ce recompute plus tard. (report, pas dette.)

> **Conclusion** : avec la couture en deux temps (§4.3) et le brush volontairement minimal, **le
> passage au SDF ne touche ni le canal de commandes, ni l'InputSystem, ni l'UI, ni la boucle** —
> uniquement les corps de `applyEdit`/`flushRemesh` et l'union `op`. C'est le résultat visé.

---

## 5. Le rebake incrémental — le point dur (vérifié : tout est à faire)

Aujourd'hui `_mesh` est figé ([World.ts:84](../../src/engine/world/World.ts#L84)). Trois options,
recommandation incluse :

| Option | Principe | Coût / risque |
|---|---|---|
| **A — rebake total** | À chaque edit, reconstruire tout `_mesh` (`buildTerrainMesh` + objets). | Simple, mais O(toutes cellules) à chaque coup de brosse → **pic GC**, contraire au 60 fps mobile. **Acceptable en 1ᵉʳ jet** (debug-grade), à remplacer. |
| **B — rebake par région (recommandé)** | `applyEdit` retourne la `DirtyRegion` (AABB) ; `rebake` ne régénère **que** les vertices de cette zone et les **patche** dans `_mesh` (pool partitionné par cellule, ou index cellule→plage). | Vrai incrémental. Demande un **mesh indexable par cellule**. C'est l'investissement utile (le SDF rebake aussi par chunk). |
| **C — pool mutable en place** | Garder un `Map<cellKey, TerrainVertex[]>` ; un edit remplace les entrées de la zone. `impactPoints()` reste une vue aplatie. | Évite de reconstruire un gros tableau. Re-trie `RainBuckets` ([terrainMesh.ts:97](../../src/engine/world/terrainMesh.ts#L97)) au prochain `update`. |

**Recommandation** : **viser B (région), accepter A comme étape transitoire** (un commit « ça
marche, c'est lent », puis un commit « c'est incrémental »). Le SDF voudra B/C de toute façon.

> **Conséquence sur `RainPoisson`** : il cache `buckets = new RainBuckets(mesh)` **une fois**
> ([rainPoisson.ts:31](../../src/engine/systems/rainPoisson.ts#L31)). Après un rebake, les buckets
> doivent **re-référencer** le pool à jour. Soit `RainBuckets` lit une vue vivante, soit le système
> se ré-abonne. **À cadrer en implémentant** — c'est le vrai couplage caché du rebake.

---

## 6. Reports volontaires (dette assumée)

- **Geste 3D de sculpture** : c'est le SDF qui l'apporte ; ici on valide la boucle, pas le geste fin.
- **Annuler/refaire (undo)** : mentionné par [plan.md:64](../plan.md#L63). **Reporté** : le canal A
  est une file de commandes ordonnée → un historique undo se branchera dessus proprement plus tard.
  Pas un prérequis pour valider « le son suit l'édition ».
- **Ergonomie de brush** (taille réglable, aperçu, presets, raccourcis) : debug-grade suffit pour
  valider la boucle. Polish UX = chantier création joueur, plus tard.
- **Relief → occlusion fine** : lever du relief devrait rebaker `skyOcclusion`
  ([skyOcclusion.ts](../../src/engine/world/skyOcclusion.ts)). Porté au 2ᵉ temps (§3), pas au 1ᵉʳ.
- **Persistance des edits** : déjà gratuite (le `Terrain` muté se sérialise en RLE via
  [save.ts](../../src/persistence/save.ts)). Rien à faire tant qu'on mute `terrain` directement.
  ⚠️ Si on passe par l'overlay `_edits` au lieu de muter `terrain`, il faudra le sérialiser —
  d'où la question §7.

---

## 7. Décisions à trancher avant de coder

**Déjà tranchées (utilisateur, 2026-06-18)** :
- ✅ **Couture rebake** : deux temps `applyEdit` / `flushRemesh(budget)` consommé par la boucle
  (§4.3) — anticipe le Worker du SDF.
- ✅ **Brush minimal** : `paint`/`raise` seulement ; l'union `op` s'étendra au SDF (§4.1, §4bis pt 2).

**Restent à trancher** :
1. **Périmètre du 1ᵉʳ lot** : peinture seule puis relief (recommandé §3), ou peinture+relief d'emblée ?
2. **Mutation directe vs overlay** : muter `terrain.material` directement (persistance RLE gratuite,
   overlay `_edits` supprimé) **OU** écrire dans l'overlay `_edits` (sparse, réversible, mais à
   sérialiser) ? → Recommandation : **muter `terrain` directement**, supprimer `_edits` (inerte et
   sa clé est douteuse). L'overlay sparse n'a de sens que si les edits doivent vivre séparément de
   la base — pas le cas en v1.
3. **Rebake** : valider la trajectoire A→B (§5), ou viser B directement ?

---

## 8. Validation (« fini quand »)

- **Auto** : `tsc` vert · `vitest` vert. Tests neufs :
  - `applyEdit({paint})` change le matériau des cellules sous le disque (et pas au-delà) ;
  - après `applyEdit`+`rebake`, `impactPoints()` contient des vertices au nouveau matériau dans
    la zone (déterministe, PRNG seedé) ;
  - un impact tiré dans la zone repeinte porte le nouveau matériau (boucle headless) ;
  - rebake par région ne touche pas les vertices hors zone (garde-fou incrémental).
- **Humain (le cœur)** : à l'oreille — **peindre une flaque de métal sous la tête, entendre les
  impacts changer de timbre** sans recharger ; déplacer le brush, le son suit la zone éditée.
  C'est la preuve « j'édite, le son suit ».

---

## 9. Ce que ce chantier prépare

- **World Shaper** : `EditableWorld` (applyEdit/rebake) + `EditBrush` + le canal `edit` sont
  **exactement** la boucle que `SdfWorld` réutilise — il n'implémente que `applyEdit`/`rebake` à
  sa façon (champ scalaire + chunks), tout le reste (UI, commandes, InputSystem) est déjà là.
- **Monde vivant** : un monde dont le pool d'impacts se re-bake à la demande débloque aussi les
  mutations dynamiques (eau qui monte, etc.) derrière la même couture.
