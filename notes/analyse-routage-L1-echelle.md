# Analyse — L1 muette après le passage « 1u = 1m » (routage par distance vs hauteur d'auditeur)

**Date** : 14 juin 2026
**Statut** : ✅ Résolu — correctif appliqué, 5/5 tests verts
**Contexte** : consolidation du repo avant la suite. Deux chantiers de consolidation
ont été menés et **validés** (voir §1) ; un **troisième problème, préexistant et
indépendant**, a été mis au jour pendant la vérification et fait l'objet de cette note.

---

## 1. Ce qui est acquis (hors sujet de cette note)

Deux chantiers terminés, typecheck vert, tests garde-fous verts **dès lors que le
repère est à HEAD** (voir §4) :

- **Suppression du principe de preset.** `Preset`, table `PRESETS`, champ `preset`
  retirés ; config diorama inlinée (`WORLD` dans `worldConfig.ts`). Save `version`
  2→3 + `migrate_2_to_3` qui purge `preset` des anciennes saves. Propagé partout
  (state, save, DioramaApp, RainSampler, ReplayEngine, debug, barrel types).
- **Worklet-horloge pour L1** (`worklets/clock-processor.js`). La cadence de
  `tickPoisson` quitte `requestAnimationFrame` (gelé quand l'onglet perd le focus)
  pour un `AudioWorkletProcessor` persistant, comme L2/L3. Le chemin de voix HRTF
  reste sur le thread principal, intact. Subtilité corrigée : le `dt` transporte
  l'horloge **audio** (`currentTime`), pas `performance.now()` — sinon les rafales
  de messages dues aux stalls React/WebGL écrasent le `dt` et affament le Poisson.
  Fallback rAF conservé si le worklet est absent.

Ces deux chantiers **ne sont pas** la cause du problème ci-dessous.

---

## 2. Symptôme

Après application de l'ensemble du working tree, deux tests garde-fous tombent :

- `surface-toggles` : `peakRms(l1)` attendu > 1e-4, **mesuré 0**.
- `layers-signal` : L1/L2/L3 attendus actifs, L1 muette.

`tickPoisson` tourne pourtant à plein régime (~5300 appels à `trigger()` sur 3 s),
mais **aucune voix L1 n'est jamais occupée** (`pool.busy = 0`).

Note de l'utilisateur : Il y a aussi un sacré lag. À quoi est-il du ?

---

## 3. Cause racine

Le terrain est interrogé via l'interface `WorldQuery` ; chaque impact est routé
par **distance 3D** à la tête dans `RainSampler.trigger()` :

```js
const dist = Math.hypot(pos.x-head.x, pos.y-head.y, pos.z-head.z)
if (this.sectors?.actif && dist >= r1 - overlap) {  // r1-overlap = 9.6 m
  this.sectors.absorberImpact(...)                  // → L2
  return                                            // jamais de voix L1
}
```

Géométrie mesurée (`window.__rompiche.scene()`), monde `size = 25` → `half = 12.5` :

| Repère | tête `y` | sol (`ymin` impacts) | sommet relief metal (`ymax`) |
|---|---|---|---|
| **Ancien** (`METER = round(size·0,26) = 7`) | 0 | −12.5 | **+1.5** |
| **Nouveau** (`METER = 1`, invariant 1u=1m) | 0 | −12.5 | **−10.5** |

Deux faits se combinent :

1. **L'auditeur flotte à `y = 0`**, soit `half = 12.5 m` AU-DESSUS du sol
   (`ground = −half`). `headInputToWorld` mappe le slider Y normalisé autour de
   0 : position de repos = centre vertical du cube, pas hauteur d'oreille.
2. **Le relief est mis à l'échelle par `BLOCK = METER`.** Le bloc-relief de test
   (2 blocs) montait à `−12.5 + 2·7 = +1.5` dans l'ancien repère → **juste sous
   l'auditeur**, donc à < 9.6 m → routé en **L1**. Dans le nouveau repère
   `BLOCK = 1` → le relief plafonne à `−12.5 + 2·1 = −10.5`, et **plus aucun
   impact** n'arrive à 9.6 m d'un auditeur à 12.5 m de haut → **tout part en L2**.

> Le test garde-fou L1 s'appuyait, sans le formuler, sur le relief surdimensionné
> de l'ancien repère. La correction « 1u = 1m » est **juste** (elle supprime le
> hack viewport) ; elle ne fait que **révéler** un défaut latent : la hauteur de
> repos de l'auditeur est un vestige de l'ère du hack, masqué jusqu'ici.

---

## 4. Preuve d'isolation

- Working tree complet (mes 2 chantiers + chantier coords) → `surface-toggles` et
  `layers-signal` **rouges** (L1 = 0).
- Mes 2 chantiers **+ `coords.ts`/`BakedSet.ts`/`materials.ts`/`WireframeCube.jsx`
  remis à HEAD** (`git stash push -- …` ciblé) → **2 verts**.

Donc : la régression vient **exclusivement** du chantier d'échelle préexistant
(`coords.ts` : `METER` 7→1 ; `BakedSet.ts` : `sigma` 2.5→10 + `preFiltered`),
pas des chantiers preset/worklet.

---

## 5. Le vrai défaut, formulé

Dans un diorama de 25 m désormais à l'échelle métrique réelle, **un auditeur
humain ne flotte pas à 12.5 m du sol**. Sa hauteur de repos devrait être ~1.6 m
au-dessus du sol (`y ≈ −10.9`), le slider Y offrant une course autour de là.

Tant que la tête reste à `y = 0`, le routage par distance enverra quasi tout en
L2 sur un sol plat : aucun impact au sol n'est à moins de ~11 m. L1 (les voix
HRTF proches, cœur du moteur) devient inatteignable sans relief géant.

---

## 6. Correction appliquée

**Option 1 retenue** : ancrage de la tête à hauteur d'oreille.

Fichiers modifiés :

- **`coords.ts`** — ajout de `EAR = 1.6 m` dans `makeCoords`. `headInputToWorld`
  mappe le repos (`y = 0`) sur `ground + EAR` au lieu du centre vertical ; clamp
  au sol pour que le slider ne descende pas sous terre. Signature : `(input, limit)`
  → `(input, coords)`.
- **`WireframeCube.jsx`** — tête visuelle réutilise `headInputToWorld` au lieu de
  `[head.x * limit, head.y * limit, -head.z * limit]` recopié. Visuel et auditeur
  Resonance partagent maintenant exactement le même point monde (I5 résolu).
- **`RainSampler.js`** et **`DebugHUD.jsx`** — passent `coords` au lieu de `limit`.

**Résultat** : 5/5 tests garde-fous verts, typecheck vert. Recalibration de `r1`
inutile — les bandes tiennent telles quelles avec la tête à 1,6 m.

---

## 7. État du repo à la clôture de cette note

- Chantiers preset + worklet : appliqués, non commités.
- Chantier coords/échelle + ancrage tête : appliqué, non commité.
- Aucun commit effectué. Les **5 tests sont verts**.
