# Système de surfaces — conception & plan d'implémentation

> Diorama sonore · document d'architecture (v0 → v1)
> Cible : un terrain **éditable finement**, composé de surfaces de matériaux variés,
> sur lesquelles la pluie tombe et **depuis lesquelles le son provient correctement**.

---

## 1. Vision

Aujourd'hui le terrain est figé : moitié gauche = `métal`, moitié droite = `bâche`/`terre`
([`WireframeCube.jsx:138-145`](ds/ui_kits/diorama/WireframeCube.jsx#L138-L145)), et le son est
rangé dans une grille audio 3×2 collée aux murs avec un *hack* « métal-gauche / bâche-droite »
([`RainSampler.js:53-67`](ds/ui_kits/diorama/RainSampler.js#L53-L67)).

On veut passer à :

- un **terrain éditable** où l'on « peint » des matériaux et où l'on « lève » du relief, à une
  résolution fine ;
- des gouttes qui **frappent la surface réellement présente** à leur point de chute (y compris un
  toit/abri surélevé) ;
- un son **spatialisé depuis la géométrie réelle** du terrain, qui suit l'auditeur quand il bouge,
  sans logique codée en dur par zone.

## 2. Le principe directeur : découpler la résolution du terrain du nombre d'émetteurs

**Le piège à éviter absolument : un émetteur audio par cellule.** Une maille 100×100 = 10 000 nœuds
WebAudio = injouable. Les jeux AAA gèrent des terrains de millions de triangles avec seulement
quelques **dizaines** d'émetteurs : la maille (donnée) et le son (runtime) vivent dans deux couches
séparées.

> **Règle d'or — le son est piloté par les *événements d'impact*, pas par un balayage du terrain.**
> On ne traite jamais les 10 000 cellules ; on ne traite que les gouttes qui tombent vraiment —
> clairsemées et proportionnelles à la **pluie**, jamais à la **taille du terrain**. Le coût audio
> est borné par le **nombre de matériaux**, pas par la finesse de la maille.

C'est déjà l'esprit du code actuel : [`WireframeCube.jsx:233-243`](ds/ui_kits/diorama/WireframeCube.jsx#L233-L243)
émet un événement `onImpact(surface, { x, z })` par goutte.

## 3. Carrés ou triangles ?

**Modèle de données = grille de carrés. Pas de triangles.**

La seule question que l'audio (et la physique de chute) pose au terrain est :
*« à `(x, z)`, quel matériau et quelle hauteur ? »*. Une grille y répond en **O(1)** (quantifier
`x,z` → indice de cellule). Un maillage triangulaire imposerait un *point-in-triangle* + index
spatial : tout ce coût pour rien.

Les **triangles ne sont qu'une affaire de rendu** : si un jour on veut des pentes lisses, on
triangule le *heightfield* pour le dessin. La triangulation est une **sortie graphique**, jamais le
modèle qui porte le matériau ou le son.

```
Cellule = { material: MaterialId,   // ce qui sonne : 'metal' | 'bache' | 'terre' | …
            height:   number }      // relief (heightfield), 0 = sol
Terrain = Cellule[rows][cols]       // éditable : peindre un matériau / lever une hauteur
```

## 4. Système de coordonnées (référence)

Pour éviter les bugs de repère, on fixe les conventions issues du code existant
(`size = 380`, donc `half = 190`) :

| Grandeur | Valeur / formule | Source |
|---|---|---|
| `half` | `size / 2` = 190 | [`RainSampler.js:24`](ds/ui_kits/diorama/RainSampler.js#L24) |
| Sol (monde) | plan `y = -half` | [`WireframeCube.jsx:140`](ds/ui_kits/diorama/WireframeCube.jsx#L140) |
| Étendue XZ des impacts | ≈ `[-half, +half]` | spawn de pluie |
| `limit` (course de l'auditeur) | `half - HC/2 - 10` ≈ 130.5, `HC = round(size·0.26)` | [`RainSampler.js:25-26`](ds/ui_kits/diorama/RainSampler.js#L25-L26) |
| Position auditeur | `(nx·limit, ny·limit, −nz·limit)`, `n ∈ [−1,1]` | [`RainSampler.js:110-117`](ds/ui_kits/diorama/RainSampler.js#L110-L117) |

> ⚠️ **Piège du Z** : l'auditeur subit une **inversion de Z** (`−nz`), pas les impacts qui arrivent
> en coordonnées Three.js brutes ([`WireframeCube.jsx:241-243`](ds/ui_kits/diorama/WireframeCube.jsx#L241-L243)).
> Le nouveau système doit **tout exprimer dans un seul repère** (le repère monde Three.js) et ne
> faire la conversion vers Resonance Audio qu'au dernier moment, en un seul endroit.

### 4.1 Échelle métrique (nouveau — il faut de *vraies* distances)

Le code actuel n'a pas d'échelle réelle. On en fixe une, ancrée sur **le cube de la tête = 1 m de
côté** (il vaut `HC ≈ 99` unités-monde) :

```
METER = HC                      // ≈ 99 unités-monde  →  1 mètre
BLOCK = 1 m   = METER           // bloc de gameplay (peut contenir des objets)
CELL  = 0,5 m = METER / 2       // résolution surface + audio (2× plus fine que le bloc)
```

Conséquences chiffrées (avec `size = 380`) :

| Élément | Taille monde | Taille métrique |
|---|---|---|
| Pièce (`2·half`) | 380 u | ≈ 3,84 m |
| Cube tête (`HC`) | 99 u | 1 m |
| Bloc | 99 u | 1 m |
| Cellule (surface/audio) | 49,5 u | 0,5 m |
| Course auditeur (`±limit`) | ±130,5 u | ≈ ±1,32 m |

> **Deux grilles, deux rôles.** Le **bloc (1 m)** porte le gameplay, les objets et le **relief**
> (hauteurs en pas de 1 m). La **cellule (0,5 m)** porte le **matériau de surface et la résolution
> acoustique** — chaque face de bloc = **2×2 cellules**. On peint donc le son plus finement que les
> blocs, exactement comme demandé.

### 4.2 Mapping monde → grilles

```
col = floor((x + half) / CELL),  row = floor((z + half) / CELL)   // grille surface (0,5 m)
bx  = floor((x + half) / BLOCK), bz  = floor((z + half) / BLOCK)   // grille blocs (1 m)
```

## 5. Architecture en trois couches

```
┌─ COUCHE 1 · TERRAIN (donnée, éditable) ────────────────────────────┐
│  Grille de carrés { material, height }.                            │
│  Édition = peindre un matériau / lever une hauteur (brush).        │
│  Résolution arbitrairement fine — sans impact sur le coût audio.   │
└────────────────────────────────────────────────────────────────────┘
        │  terrain.cellAt(x, z) → { material, height }     (O(1))
        ▼
┌─ COUCHE 2 · IMPACT (événementiel) ─────────────────────────────────┐
│  Goutte en (x,z) → lookup cellule → matériau + hauteur de frappe.  │
│  Gère l'abri/occlusion via le heightfield (cf. §8).               │
│  Généralise le `ix < 0 ? 'metal' : …` actuel.                     │
└────────────────────────────────────────────────────────────────────┘
        │  router.push({ pos, material, t })
        ▼
┌─ COUCHE 3 · ACOUSTIQUE (runtime, petit & borné) ───────────────────┐
│  UN émetteur multi-position PAR MATÉRIAU (≈5, jamais 10 000).      │
│  Alimenté par un réservoir des impacts récents de ce matériau.     │
│  Position/spread/niveau recalculés à chaque frame depuis ce nuage. │
└────────────────────────────────────────────────────────────────────┘
```

Le coût de la couche 3 dépend du **nombre de matériaux**, jamais de la finesse du terrain : la
scalabilité est garantie par construction.

## 6. Couche 1 — Le terrain

Deux résolutions (cf. §4.1) : le **matériau** vit sur la grille fine (cellule 0,5 m), le **relief**
sur la grille blocs (1 m, hauteurs entières, où vivront aussi les objets).

```js
class Terrain {
  constructor({ size, cell = CELL, block = BLOCK }) {
    this.size = size                    // étendue monde (= 2·half)
    this.cell = cell                    // 0,5 m — résolution matériau/audio
    this.block = block                  // 1 m  — résolution relief/objets
    this.cols = this.rows = Math.ceil(size / cell)
    this.bcols = this.brows = Math.ceil(size / block)
    this.material = new Uint8Array(this.cols * this.rows)    // grille fine → MATERIALS[]
    this.height   = new Uint8Array(this.bcols * this.brows)  // grille blocs → hauteur (en blocs)
    // (objets dans les blocs : tableau/Map séparé, hors périmètre audio v1)
  }

  // monde → indice grille fine ; -1 hors-terrain
  index(x, z) {
    const c = Math.floor((x + this.size / 2) / this.cell)
    const r = Math.floor((z + this.size / 2) / this.cell)
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1
    return r * this.cols + c
  }

  // monde → indice grille blocs
  bindex(x, z) {
    const c = Math.floor((x + this.size / 2) / this.block)
    const r = Math.floor((z + this.size / 2) / this.block)
    if (c < 0 || r < 0 || c >= this.bcols || r >= this.brows) return -1
    return r * this.bcols + c
  }

  cellAt(x, z) {
    const i = this.index(x, z)
    if (i < 0) return null
    const b = this.bindex(x, z)
    return {
      material: MATERIALS[this.material[i]],
      height: this.height[b] * this.block,   // relief monde, pas de bloc
    }
  }

  // édition (brush) — matériau sur la grille fine, relief sur la grille blocs
  paintMaterial(x, z, { material, radius = this.cell }) { /* … boucle locale grille fine … */ }
  raise(x, z, { delta = 1, radius = this.block }) { /* … boucle locale grille blocs … */ }
}
```

Décisions :

- **`Uint8Array`** plats (pas de tableau d'objets) : compacts, rapides, sérialisables tels quels
  (sauvegarde/chargement de terrain triviale). Le relief en **hauteur de blocs** (entier) suffit et
  reste compact.
- **`MATERIALS`** = registre central `{ id, label, banks, attenuation, … }`. Le matériau porte sa
  banque de samples (généralise [`RainSampler.banks`](ds/ui_kits/diorama/RainSampler.js#L22)) et ses
  paramètres acoustiques.
- **L'édition est purement locale** (un *brush* touche un disque de cellules/blocs) : O(rayon²),
  indépendant de la taille du terrain.
- **Les objets dans les blocs** (1 m) sont hors périmètre audio v1 : prévoir un conteneur séparé,
  mais ne pas le coupler au pipeline de pluie pour l'instant.

## 7. Couche 2 — Le routeur d'impacts

Remplace le `_zoneFor` + la logique `ix < 0 ? …` actuels.

```js
class ImpactRouter {
  constructor(terrain, materials) {
    this.terrain = terrain
    // un réservoir circulaire d'impacts récents PAR matériau
    this.reservoirs = new Map(materials.map(m => [m.id, new ImpactReservoir(64)]))
  }

  // appelé à chaque goutte (depuis onImpact)
  push(x, z, t) {
    const hit = resolveHit(this.terrain, x, z)   // applique l'abri/occlusion (§8)
    if (!hit) return
    this.reservoirs.get(hit.material.id).add(hit.x, hit.y, hit.z, t)
  }
}
```

`ImpactReservoir` = anneau de N derniers impacts `{x, y, z, t}`. Les vieux impacts décroissent
(fenêtre glissante ~300–500 ms) : c'est lui qui encode **où** et **à quelle cadence** un matériau
est frappé, donc sa **position perçue**, son **étendue** et son **niveau**.

## 8. Le relief (`height`) — frappe en hauteur, abri & occlusion

Le champ `height` n'est pas que décoratif : il offre gratuitement deux mécaniques voulues.

- **Frappe sur surface surélevée** (« pluie sur le toit » vs « au sol ») : `resolveHit` teste la
  colonne sous la goutte ; si une cellule de relief intercepte sa trajectoire, l'impact se produit
  **là**, plus haut (`hit.y = -half + height`), et c'est **cette** surface qui sonne.
- **Abri / occlusion** (le test « ciel au-dessus » de Minecraft) : une cellule **surplombée** par une
  cellule plus haute est *abritée* → la goutte n'y parvient pas, ou bien on étouffe le grain
  (filtre passe-bas / gain réduit). Ainsi **lever une bâche change naturellement la surface qui sonne
  et crée l'étouffement « sous abri »**, sans logique dédiée.

```js
function resolveHit(terrain, x, z) {
  const cell = terrain.cellAt(x, z)
  if (!cell) return null
  // v1 : frappe au sol de la cellule. v2 : tracer la colonne pour les toits/abris.
  const half = terrain.size / 2
  return { material: cell.material, x, z, y: -half + cell.height, sheltered: false }
}
```

> Implémentation **incrémentale** : la v1 ignore le relief (`height = 0`, `sheltered = false`) et se
> contente du matériau ; les toits/abris (`v2`) n'ajoutent que la traversée de colonne, sans toucher
> aux couches 1 et 3.

## 9. Couche 3 — Émetteur multi-position par matériau (le cœur du positionnement)

Pour **chaque matériau**, un seul émetteur, alimenté par son réservoir. À chaque frame, depuis le
nuage d'impacts récents et la position de la tête, on calcule :

| Grandeur | Calcul | Effet perçu |
|---|---|---|
| **Direction** | impact récent le plus proche de la tête | d'où vient le son (panning HRTF) |
| **Distance** | distance de ce point le plus proche | atténuation **réactivée** (fini le `minDistance` géant) |
| **Spread** | étendue **angulaire** des impacts autour de la tête | enveloppe : étroit si patch lointain, large si on est *dessus* |
| **Niveau** | cadence d'impacts (impacts/s) du matériau | densité de pluie (≈ Minecraft : volume ∝ intensité) |

Ce modèle résout les cas que la grille 3×2 ne savait pas gérer :

- **Auditeur au milieu d'une grande zone** → distance ≈ 0, spread maximal → ça **enveloppe** au lieu
  de pointer un mur (le *bed* du cinéma).
- **Deux patchs disjoints du même matériau** (gauche *et* droite) → le réservoir contient les deux,
  l'émetteur multi-position couvre les deux côtés → **aucune logique de régions à coder**.
- **L'auditeur bouge** → le point le plus proche se recalcule → la direction suit la géométrie. Le
  *hack* « métal-gauche / bâche-droite » **disparaît**.

```js
class MaterialEmitter {
  constructor(scene, ctx, material) {
    this.material = material
    // K = 3 sous-sources Resonance pour le rendu multi-position
    // Atténuation RÉELLE (exponentielle) en distances métriques (cf. §4.1) :
    //   minDistance 0,5 m (≈ CELL)  ·  maxDistance ≈ 4 m (≈ la pièce)
    this.voices = Array.from({ length: 3 }, () =>
      scene.createSource({
        rolloff: 'logarithmic',          // ≈ exponentielle perçue
        minDistance: 0.5 * METER,
        maxDistance: 4.0 * METER,
      }))
    this.bank = material.banks    // buffers de samples
  }

  // recalculé chaque frame depuis le réservoir + la tête
  update(reservoir, head) {
    const pts = reservoir.recent(head.t)
    if (!pts.length) return
    const nearest = closestTo(pts, head)              // → direction + distance
    const spread  = angularSpread(pts, head)          // → envergure
    // place les K voix : la plus proche sur `nearest`, les autres réparties sur l'arc `spread`
    placeVoices(this.voices, nearest, spread, head)
    this.level = impactRate(pts) * this.material.gain // → niveau
  }
}
```

> **Réutilisation directe de l'existant** : on conserve le chargement de banques, le déclenchement de
> grains avec `detune`, et le compteur de niveau RMS via `AnalyserNode`
> ([`RainSampler.js:119-152`](ds/ui_kits/diorama/RainSampler.js#L119-L152)). Seule **l'allocation
> et le placement des sources** changent (6 points figés → K voix mobiles par matériau).

## 10. Plan d'implémentation (par incréments livrables)

Chaque phase est jouable et testable seule ; aucune ne casse la précédente.

### Phase 0 — Préparation (refactor sans changement visible)
- [ ] Extraire un registre `MATERIALS` (id, label, banks, gain, attenuation). Migrer
      `banks: { metal, bache, terre }` vers ce registre.
- [ ] Unifier le repère : que les impacts et l'auditeur partagent **un seul** système de
      coordonnées monde ; isoler la conversion Resonance dans une seule fonction (régler le piège du
      Z, §4).

### Phase 1 — Le terrain comme donnée (sans édition)
- [ ] Implémenter `Terrain` (grille `Uint8Array`/`Float32Array`, `index`, `cellAt`).
- [ ] Initialiser la grille pour **reproduire à l'identique** la scène actuelle (métal à gauche,
      bâche à droite) → non-régression visuelle et sonore.
- [ ] Brancher `WireframeCube` pour lire le matériau de chaque goutte via `terrain.cellAt`
      au lieu du `ix < 0 ? …` codé en dur.

### Phase 2 — Le pipeline événementiel
- [ ] Implémenter `ImpactReservoir` (anneau + fenêtre glissante) et `ImpactRouter`.
- [ ] Router les `onImpact` vers le réservoir du matériau.

### Phase 3 — Émetteurs multi-position (le saut d'immersion)
- [ ] Implémenter `MaterialEmitter` (K voix, `update` : nearest + spread + level).
- [ ] **Réactiver l'atténuation par distance** (`minDistance`/`maxDistance` réalistes) — supprimer
      le contournement [`RainSampler.js:64`](ds/ui_kits/diorama/RainSampler.js#L64).
- [ ] Remplacer les 6 zones fixes par les émetteurs par matériau. Supprimer `_zoneFor`,
      `zoneCenters` et le *hack* gauche/droite.
- [ ] Adapter `DebugHUD`/le VU-mètre aux nouveaux émetteurs.

### Phase 4 — Édition du terrain
- [ ] `Terrain.paint` (brush : matériau + rayon).
- [ ] UI de peinture dans `ControlHUD` (choix matériau, taille de brush) + interaction souris sur
      le sol du viewport (raycast Three.js → `(x, z)` → `paint`).
- [ ] Re-générer le rendu du sol depuis la grille (hachures métal / grille bâche / points terre par
      cellule).
- [ ] Sérialisation : sauvegarder/charger un terrain (les typed-arrays se sérialisent directement).

### Phase 5 — Relief & abri (heightfield)
- [ ] `height` éditable (brush « élever »).
- [ ] `resolveHit` : traversée de colonne → frappe sur surface surélevée + détection d'abri.
- [ ] Étouffement « sous abri » (passe-bas / gain) sur les impacts abrités.
- [ ] Rendu du relief (hauteur des cellules ; triangulation **uniquement** si pentes lisses voulues).

### Phase 6 (optionnel) — Acoustique de pièce
- [ ] Dériver des **zones de réverbération** depuis des cellules-murs (enceinte) ; portails entre
      pièces. À n'aborder qu'une fois 0–5 stabilisées.

## 11. Migration depuis `RainSampler` actuel

| Aujourd'hui | Devient | Phase |
|---|---|---|
| `ix < 0 ? 'metal' : 'bache'` ([WireframeCube.jsx:242](ds/ui_kits/diorama/WireframeCube.jsx#L242)) | `terrain.cellAt(x,z).material` | 1 |
| `banks: { metal, bache, terre }` | registre `MATERIALS[].banks` | 0 |
| `_zoneFor(x,z)` + grille 3×2 | `ImpactRouter` + réservoirs par matériau | 2 |
| 6 sources fixes aux murs | K voix mobiles par matériau | 3 |
| `minDistance: h*3` (atténuation off) | `minDistance`/`maxDistance` réalistes | 3 |
| *hack* métal-gauche/bâche-droite | émerge de la géométrie (supprimé) | 3 |
| sol peint en dur ([WireframeCube.jsx:138-145](ds/ui_kits/diorama/WireframeCube.jsx#L138-L145)) | rendu généré depuis `Terrain` | 4 |
| `cooldown` par zone | cooldown **par cellule** (0,5 m) | 2-3 |

## 12. Invariants & garde-fous

- **Le nombre de voix spatialisées est un BUDGET FIXE** (`POOL_SIZE`, indépendant du terrain,
  de la pluie ET du nombre de matériaux — pool partagé). Toute idée « une source par
  cellule/région » reste un signal d'alerte.
- **Un seul repère monde**, conversion Resonance isolée en un point (piège du Z).
- **Tout est piloté par les impacts** : le coût suit la pluie, pas le terrain.
- **Chaque phase reproduit la précédente à l'identique avant d'ajouter** (la phase 1 doit sonner
  exactement comme l'actuel).
- **Le matériau porte ses paramètres** (banque, gain, atténuation, étouffement) : ajouter un
  matériau = une entrée dans `MATERIALS`, zéro code de placement.

## 13. Décisions arrêtées

1. **Échelle & finesse** ✅ — `BLOCK = 1 m`, `CELL = 0,5 m`, cube tête = 1 m (cf. §4.1). Le matériau
   se peint au 0,5 m, plus fin que les blocs (qui pourront contenir des objets).
2. **Voix spatialisées** ✅ — ~~3 voix par matériau~~ → ~~8 voix-secteurs~~ → **pool partagé de
   48 voix possédées par les grains** depuis le 2026-06-12 : chaque grain acquiert une voix,
   est joué depuis la position monde de SON impact (posée une seule fois), puis libère la voix
   à la fin du sample. Plus de placement différé ni de sources partagées mobiles — le
   télescopage spatial des grains disparaît, l'enveloppement émerge goutte par goutte
   (révision 2 de [DIAGNOSTIC-SPATIALISATION.md](DIAGNOSTIC-SPATIALISATION.md)). Vol de voix
   avec fondu 5 ms si le pool est épuisé.
3. **Fenêtre du réservoir** ✅ — décroissance des impacts sur **~300–500 ms** (règle l'inertie du
   niveau et du spread).
4. **Cooldown** ✅ — **anti-mitraillage par cellule** (0,5 m), pas par matériau. Remplace le cooldown
   par zone actuel ([RainSampler.js:126](ds/ui_kits/diorama/RainSampler.js#L126)).
5. **Atténuation** ✅ — courbe **logarithmique** (≈ exponentielle perçue), `minDistance = 0,5 m`,
   `maxDistance = 8 m` depuis le 2026-06-12 (~~4 m~~ : Resonance coupe NET à zéro au-delà de
   `maxDistance`, or la diagonale du monde fait ~5,4 m — une tête excentrée rendait toute une
   bande de pluie muette). Ajustables par matériau (cf. §9).
6. **Gouttes-objets isolées** ✅ — **non**. On garde un *bed* pur par matériau, sans objets ponctuels
   « spotlightés ».

> Réglages fins (`maxDistance` par matériau, durée exacte de la fenêtre, rayon du brush) à calibrer à
> l'oreille pendant les Phases 3–4.

---

*Document vivant — à mettre à jour au fil des phases. Les références de ligne pointent vers l'état
du code au moment de la rédaction.*
