# World Shaper — Spécification Détaillée des Mécanismes

> ⚠️ **Palier futur, pas la v1.** Cette spec décrit le **Palier P3** de la trajectoire
> (cf. [cadrage-v1.md](cadrage-v1.md)). Le World Shaper sera introduit comme une **2ᵉ
> implémentation du terrain derrière l'interface `WorldQuery`** figée en v1 — un remplacement
> d'implémentation, jamais une réécriture du cœur. Ne pas commencer avant que le Pivot (v1)
> soit livré et que la boucle d'édition (P2) soit validée sur le terrain plat.


Puisque vous avez déjà la PWA + l'audio, on se concentre sur **le cœur géométrique et ses contrats**. Je vais structurer ça comme une vraie spec technique, en pensant aux pièges et aux décisions à figer **avant** d'écrire le code.

---

## 0. Décisions structurantes à figer d'abord

Avant tout mécanisme, ces choix conditionnent tout le reste :

| Décision | Options | Impact |
|---|---|---|
| **Topologie du champ** | Dense grid / Sparse (octree) / Hash brick | Mémoire, taille du monde, complexité |
| **Stockage scalaire** | `f32` / `i8` quantifié / SDF signé | Précision vs poids réseau (important en PWA) |
| **Surface** | Marching Cubes / Surface Nets / Dual Contouring | Présence d'arêtes franches, coût |
| **Origine du monde** | Borné / Infini par chunks | Persistance, navigation |
| **Référentiel** | Mètres réels (pour l'audio !) | Cohérence acoustique |

> ⚠️ **Point critique pour vous** : comme l'audio est spatialisé, **1 unité = 1 mètre** doit être une invariante absolue traversant tout le système. Notez-la maintenant.

---

## 1. Le Champ Scalaire — Contrat fondamental

### 1.1 Définition

```
field : ℝ³ → ℝ
field(p) = distance signée à la surface (convention SDF recommandée)
```

**Recommandation forte : utiliser une SDF (Signed Distance Field)** plutôt qu'un champ de densité arbitraire.

```
Densité brute          │  SDF
───────────────────────┼──────────────────────────
f<0 dedans, f>0 dehors │  f = distance exacte à surface
gradient incohérent    │  ‖∇f‖ = 1 partout
normales bruitées      │  normales = ∇f directement
booléens difficiles    │  min/max = union/intersection
```

L'investissement SDF paie immédiatement pour : **les outils d'édition, les normales propres, et les requêtes acoustiques** (distance au mur = gratuit).

### 1.2 Quantification du stockage

Pour une PWA (réseau + mémoire) :

```
Stockage : i8 dans [-1, +1] × clamp_distance

  value_stored = clamp(round(sdf / max_dist * 127), -127, 127)
  sdf_reconstructed = value_stored / 127 * max_dist

  où max_dist ≈ 2 × voxel_size  (on ne stocke que la bande proche surface)
```

Les voxels loin de la surface sont saturés à ±127 → **compressent extrêmement bien** (RLE).

---

## 2. Structure spatiale — Chunks & adressage

### 2.1 Géométrie d'un chunk

```
CHUNK
├── dimension     : 32³ cellules (négociable : 16/32/64)
├── overlap       : +1 voxel sur chaque face (apron)  ← CRUCIAL
└── world_origin  : position du coin (0,0,0) en mètres
```

> ⚠️ **Le piège classique** : Marching Cubes a besoin des 8 coins de chaque cellule. Les cellules du bord d'un chunk ont besoin des voxels du chunk voisin. **Sans apron (bordure dupliquée), vous aurez des trous (cracks) entre chunks.**

```
Chunk A          Chunk B
┌────────┐?────┐┌────────┐
│        ││XXXX││        │
│   32³  ││ apron du voisin B
│        ││ stocké dans A
└────────┘└────┘└────────┘
          ↑
   les cellules de bord
   ont besoin de ces données
```

### 2.2 Adressage

```
world_to_chunk(p_meters):
    cell = floor(p_meters / voxel_size)
    chunk_coord = floor(cell / CHUNK_DIM)
    local_cell  = cell mod CHUNK_DIM
    return (chunk_coord, local_cell)
```

Clé de chunk : `(i32, i32, i32)` → tuple morton-encodé pour le cache.

---

## 3. Le Mailleur (Mesher) — Spécification de l'algo

### 3.1 Choix d'algorithme — décision

| Critère | Marching Cubes | Surface Nets | Dual Contouring |
|---|---|---|---|
| Simplicité | ✅✅ | ✅ | ❌ |
| Arêtes franches | ❌ | ❌ | ✅ |
| Vertices/cellule | jusqu'à 15 | 1 | 1 |
| Données Hermite requises | non | non | oui (normales) |

> **Recommandation** : commencer par **Marching Cubes** (vous avez déjà les références), migrer vers **Surface Nets** plus tard si vous voulez moins de triangles. Les arêtes franches du Dual Contouring ne sont probablement pas nécessaires pour un diorama organique.

### 3.2 Contrat du mesher

```
mesh_chunk(scalar_field, isovalue) → ChunkMesh

ChunkMesh {
    positions   : Vec3[]      // en mètres, repère monde
    normals     : Vec3[]      // depuis gradient du champ
    materials   : u8[]        // material dominant par vertex (voir §5)
    indices     : u32[]
    bounds      : AABB        // pour culling + requêtes acoustiques
}
```

### 3.3 Détails à figer

```
Interpolation des positions :
    t = (isovalue - val_a) / (val_b - val_a)
    pos = lerp(corner_a, corner_b, t)     ← jamais le milieu fixe !

Normales (depuis SDF) :
    n = normalize(∇field)
    ∇field ≈ central differences :
      ((f(x+h)-f(x-h)), (f(y+h)-f(y-h)), (f(z+h)-f(z-h)))

Winding order : CCW (cohérence rendu + face acoustique)
Dédoublonnage vertices : optionnel phase 1, recommandé phase 2
```

---

## 4. Édition — Le mécanisme central du "Shaping"

C'est ici que se joue l'expérience. **Toute édition = opération CSG sur le champ.**

### 4.1 Opérations de base (brosses)

```
Brush {
    type      : Add | Subtract | Smooth | Paint | Flatten
    shape_sdf : (p) → f32     // sphère, cube, capsule...
    radius    : f32 (mètres)
    strength  : f32 [0,1]
    material  : u8 (pour Add/Paint)
}
```

### 4.2 Composition SDF (le moteur d'édition)

```
ADD (union)          : field = min(field, brush_sdf)
SUBTRACT (creuser)   : field = max(field, -brush_sdf)
SMOOTH               : field = blur local du champ
FLATTEN              : field tend vers un plan local

Variantes "smooth" (transitions douces) :
  smin(a, b, k) = -log(exp(-k·a) + exp(-k·b)) / k
```

### 4.3 Application incrémentale (perf!)

```
apply_brush(brush, position):
    affected = AABB(position, brush.radius + voxel_size)
    
    for each chunk intersecting affected:
        for each voxel in (chunk ∩ affected):
            v = field(voxel)
            field(voxel) = combine(v, brush_sdf(voxel), brush.type)
        mark_dirty(chunk)
        mark_dirty(neighbors sharing apron)   ← ne pas oublier !
    
    schedule_remesh(dirty_chunks)
```

> ⚠️ **Piège** : modifier un voxel de bord doit **invalider l'apron du voisin**, sinon désync entre chunks.

### 4.4 Boucle de remaillage (asynchrone)

```
Frame loop:
    collect dirty chunks
    sort by distance to camera/listener
    remesh budget : N chunks par frame (ou Web Worker)
    swap mesh atomiquement
```

> 💡 **PWA-spécifique** : le remaillage doit tourner dans un **Web Worker** (voire WASM) pour ne pas bloquer le thread audio/UI. Le transfert mesh → main thread via `Transferable` (ArrayBuffer).

---

## 5. Matériaux — Le pont vers l'acoustique

### 5.1 Stockage

```
Par voxel : material_id : u8
```

Au bord (surface entre 2 matériaux), il faut décider le matériau du triangle.

```
Stratégie : material du vertex = material du voxel "solide" le plus proche
Le triangle hérite du material majoritaire de ses 3 vertices.
```

### 5.2 Table de matériaux

```
Material {
    id                  : u8
    name                : "roche" | "eau" | "bois" | "métal"...
    
    // Visuel
    albedo, roughness, ...
    
    // ACOUSTIQUE (votre cible)
    absorption_coeff    : f32[bands]  // par bande de fréquence
    scattering_coeff    : f32
    transmission_loss   : f32         // son qui traverse le mur
}
```

> 💡 L'absorption **par bande de fréquence** (ex: 125/500/2k/8k Hz) est ce qui rend un diorama sonore crédible : la roche absorbe les aigus différemment de l'eau.

---

## 6. Couche acoustique dérivée

Comment le World Shaper **nourrit** votre moteur audio :

### 6.1 Requêtes que la géométrie doit savoir répondre

```
raycast(origin, dir) → hit { distance, point, normal, material }
    → occlusion, premières réflexions

nearest_surface(p) → { distance, material }
    → GRATUIT avec SDF ! field(p) donne déjà la distance

is_occluded(source, listener) → bool / float [0,1]
    → atténuation, murs

enclosed_volume(p) → f32  (estimé)
    → réverbération (RT60)
```

### 6.2 Estimation de réverbération (Sabine simplifié)

```
RT60 ≈ 0.161 × V / (Σ Sᵢ·αᵢ)

  V  = volume de la cavité (mètres³)
  Sᵢ = surface du matériau i
  αᵢ = absorption du matériau i
```

> Le World Shaper expose `V` et les `Sᵢ` par matériau ; votre moteur audio calcule le RT60. **Séparation des responsabilités claire.**

### 6.3 Quand recalculer l'acoustique ?

```
Édition géométrie → chunk dirty → remesh
                                → recompute zone acoustique (debounced)
                                → notify audio engine
```

---

## 7. Persistance & sérialisation (PWA)

```
Format de sauvegarde :
{
    world_meta : { voxel_size, materials[], version }
    chunks : [
        { coord, RLE_compressed_scalars, RLE_materials }
    ]
}

Stockage : IndexedDB (pas localStorage — trop petit)
Streaming : ne charger que les chunks autour du listener
```

> ⚠️ Versionnez le format **dès le jour 1**. Vous changerez la structure et casserez les saves sinon.

---

## 8. Tableau récapitulatif des mécanismes & responsabilités

| Mécanisme | Entrée | Sortie | Thread |
|---|---|---|---|
| Génération initiale | seed/params | champ scalaire | Worker |
| Édition (brush) | input utilisateur | champ modifié + dirty flags | Main (léger) |
| Remaillage | champ + dirty | mesh | Worker/WASM |
| Requêtes acoustiques | géométrie | métadonnées audio | Main (cache) |
| Persistance | champ | blob IndexedDB | Worker |

---

## 9. Liste des "pièges auxquels penser" (synthèse)

1. ☐ **Apron/overlap** entre chunks → sinon cracks
2. ☐ **Invalidation des voisins** lors d'édition de bord
3. ☐ **1 unité = 1 mètre** invariant (cohérence audio)
4. ☐ **Remaillage hors du thread principal** (Web Worker)
5. ☐ **Quantification i8** pour le réseau/mémoire
6. ☐ **Versioning du format** de save dès le début
7. ☐ **Normales depuis le gradient SDF**, pas les faces
8. ☐ **Debounce** du recalcul acoustique
9. ☐ **Materiaux par bande de fréquence**
10. ☐ **Budget de remaillage par frame** (éviter les freezes)

---

Sur quoi voulez-vous qu'on **plonge en profondeur** maintenant ?

- 🔷 **A.** La structure de données précise (octree vs hash grid) et son adressage
- 🔷 **B.** Le pipeline d'édition complet (brushes, CSG, undo/redo)
- 🔷 **C.** Le contrat exact World Shaper ↔ moteur audio
- 🔷 **D.** L'implémentation Marching Cubes / Surface Nets pas à pas