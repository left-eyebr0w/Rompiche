# Diagnostic — Spatialisation audio

> Diorama sonore · analyse des symptômes et pistes de correction

---

## Symptômes observés

1. Le son reste identique (pour une même config) quelle que soit la position de l'auditeur.
2. Les gouttes d'une zone arrivent systématiquement du mauvais côté : côté métal (gauche monde), la
   majorité devrait sonner en face, derrière et à gauche, mais elle arrive à droite.

---

## Verdict

**Problème de conception**, à ~90 %. Aucune erreur de frappe isolée n'explique les deux
symptômes ; c'est la combinaison de trois défauts structurels qui se cumulent.

---

## Cause 1 — L'orientation de l'auditeur n'est jamais transmise à Resonance

### Ce qui se passe

`setListenerOrientation` n'est jamais appelé. Resonance Audio considère donc que l'auditeur
regarde *toujours* vers `−Z` monde, avec `+X` = droite audio — de façon immuable.

Mais le sens du « gauche/droite/devant » pour l'utilisateur vient de **l'orbite caméra** (`spin`,
[WireframeCube.jsx:279-291](ds/ui_kits/diorama/WireframeCube.jsx#L279-L291)). Dès qu'on tourne
la vue, l'écran et le son divergent : la bâche (côté `+X` monde) sonne toujours à droite-audio
quelle que soit l'orientation de la caméra.

### Conséquence directe

C'est la **cause principale** du symptôme 2. Le son ne suit jamais la vue, donc il arrive
presque toujours du « mauvais » côté par rapport à ce qu'on voit.

### Correction

Transmettre le quaternion de la caméra (ou l'angle `spin`) à `scene.setListenerOrientation()`
à chaque frame. Exemple en convention Resonance (`forward`, `up`) :

```js
// spinRad = THREE.MathUtils.degToRad(spin)
const fwdX =  Math.sin(spinRad)   // +X quand spin = 90°
const fwdZ = -Math.cos(spinRad)   // −Z monde = avant par défaut
scene.setListenerOrientation(fwdX, 0, fwdZ,  0, 1, 0)
```

---

## Cause 2 — Les voix sont placées relativement à la tête, pas dans le monde

### Ce qui se passe

Dans [`RainSampler.js:120`](ds/ui_kits/diorama/RainSampler.js#L120) :

```js
this._set(i, head.x + Math.cos(az) * meanRH, meanY, head.z + Math.sin(az) * meanRH)
```

Les voix sont ancrées sur `head.x / head.z`. Quand l'auditeur se déplace, ses voix se
déplacent avec lui : le vecteur *auditeur → voix* reste constant. Le déplacement de la tête
n'a donc aucun effet sur l'azimut perçu.

De plus, le terrain est divisé en deux demi-plans (`cx < 0 ? 'metal' : 'bache'`,
[Terrain.js:68](ds/ui_kits/diorama/Terrain.js#L68)). La course de l'auditeur est minuscule
(`±limit ≈ ±130` dans un monde de 380) : le centroïde angulaire d'un demi-plan géant vu de
l'intérieur **ne bouge quasiment pas** quand on se déplace de ±130 unités. Résultat : la
direction perçue est quasi-constante → « son identique partout ».

### Correction

Placer les voix en **coordonnées monde absolues** (les impacts existent déjà en coordonnées
monde absolues dans le réservoir). Ne pas décaler par `head` au moment du placement des
sources — Resonance calcule lui-même le vecteur source → auditeur.

---

## Cause 3 — Les sources sont collées au sol, l'auditeur est au centre

### Ce qui se passe

`meanY` est calculé à partir des impacts, qui sont tous insérés à `y = ground = −half`
([RainSampler.js:277](ds/ui_kits/diorama/RainSampler.js#L277)). L'auditeur est quant à lui
à `y ≈ 0` (position neutre). L'angle d'élévation entre l'auditeur et toutes les sources est
donc très accentué vers le bas (`≈ −45°` selon la distance), ce qui **écrase les indices
gauche/droite HRTF** et aplatit les différences de panoramique.

### Correction

Soit projeter les sources sur le plan horizontal de l'auditeur (ignorer `y` ou l'interpoler
vers `head.y`), soit adopter une hauteur de source plus réaliste (ex. légèrement sous
l'auditeur plutôt qu'au fond du cube).

---

## Cause annexe — Modèle centroïde inadapté aux grandes zones

Le modèle « centroïde angulaire + éventail de K voix » est conçu pour des patches *localisés*
(un carré d'impact lointain et relativement petit). Pour une grande zone qui **entoure**
l'auditeur, le centroïde de tous les vecteurs unitaires tend vers zéro (résultante nulle ou
très faible), et l'éventail de 3 voix ne suffit pas à recréer un vrai enveloppement.

Ce défaut contribue au symptôme 1 (le son semble « venir de nulle part ») dans les configs où
l'auditeur est au milieu d'une zone. Il est traité en §9 de
[SYSTEME-SURFACES.md](SYSTEME-SURFACES.md) mais n'est pas encore résolu par l'implémentation
actuelle.

---

## Ordre de correction recommandé

| Priorité | Correction | Fichier(s) | Gain attendu |
|---|---|---|---|
| 1 | Transmettre l'orientation caméra à `setListenerOrientation` | `RainSampler.js`, `DioramaApp.jsx` | Corrige le gauche/droite inversé |
| 2 | Placer les voix en coordonnées monde absolues (supprimer `+ head.x/z`) | `RainSampler.js:120` | Corrige l'invariance au déplacement |
| 3 | Projeter les sources sur le plan de l'auditeur (ou à mi-hauteur) | `RainSampler.js:110` | Récupère les indices HRTF G/D |
| 4 | Remplacer le centroïde par une répartition par secteurs angulaires pondérés | `RainSampler.js:91-121` | Enveloppement réel dans les grandes zones |

Les corrections 1, 2 et 3 sont indépendantes et peuvent être appliquées dans n'importe quel
ordre. La correction 4 est un refactor plus profond de `MaterialEmitter.update`.

---

## Statut des corrections (2026-06-12)

Les 4 corrections sont appliquées :

| # | Correction | Implémentation |
|---|---|---|
| 1 | ~~Orientation caméra → `setListenerOrientation`~~ **REVERTÉE** (voir révision 1) | Orientation auditeur FIXE : `LISTENER_FORWARD` (coords.js), posée une fois dans `RainSampler.init` ; plus de câblage sur `spin` |
| 2 | Voix en coordonnées monde absolues | Chaque grain est joué depuis la position monde de SON impact (pool de voix, révision 2) |
| 3 | Hauteur des sources | `Y_FLATTEN` : composante verticale tête→grain écrasée, figée au déclenchement (provisoire jusqu'au relief, phase 5) |
| 4 | ~~Secteurs angulaires~~ **REMPLACÉE** (voir révision 2) | Pool de voix possédées par les grains : l'enveloppement émerge de la géométrie réelle, goutte par goutte |

> ~~**Note (placement intra-secteur)** : chaque voix-secteur se pose sur l'impact le plus proche
> de la tête dans son secteur…~~ — obsolète depuis la révision 2 : il n'y a plus de secteurs ni
> de placement différé, chaque grain porte sa propre position.

> ⚠️ L'exemple de code de la Cause 1 ci-dessus a un signe inversé : la caméra étant en
> `(+sin spin, ·, +cos spin)` et regardant l'origine ([WireframeCube.jsx:285-289](ds/ui_kits/diorama/WireframeCube.jsx#L285-L289)),
> l'avant monde était `(−sin, 0, −cos)`. (Conservé pour mémoire — voir révision ci-dessous.)

---

## Révision 1 (2026-06-12) — la correction 1 est annulée : orientation auditeur FIXE

La correction 1 partait du postulat « écran-gauche = audio-gauche » : faire suivre au champ
sonore l'orbite caméra (`spin`). À l'usage, ce postulat est **faux** pour ce diorama.

`spin` est une **orbite de la vue** autour de la scène, pas une rotation de la tête de
l'auditeur. La tête (position `head`) est l'**input de référence et reste fixe** ; orbiter la
caméra ne fait que changer le point de vue, comme tourner autour d'une maquette posée sur une
table — sans que les oreilles ne tournent. Faire pivoter `setListenerOrientation` avec `spin`
faisait donc tourner tout le champ sonore à chaque orbite : les gouttes changeaient de côté
alors que rien ne bougeait dans le monde.

**Décision** : l'orientation de l'auditeur est désormais **fixe**, ancrée au monde
(avant = −Z, haut = +Y), posée une seule fois à l'init. Le gauche/droite/devant audio
correspond aux directions du monde, indépendamment de l'angle de vue.

| Avant (correction 1) | Après (révision) |
|---|---|
| `spinToForward(spin)` → `setListenerOrientation` à chaque changement de `spin` | `LISTENER_FORWARD` constant, posé une fois dans `RainSampler.init` |
| Champ sonore tourne avec l'orbite caméra | Champ sonore ancré au monde, stable |

> Si un jour un vrai contrôle « tourner la tête » est ajouté (distinct de l'orbite caméra),
> c'est *lui* — et non `spin` — qui devra piloter `setListenerOrientation`.

---

## Révision 2 (2026-06-12) — télescopage des grains : pool de voix possédées par les grains

### Le bug (« les sons s'interrompent les uns les autres »)

Le modèle voix-secteurs faisait partager **une seule source Resonance mobile** à tous les grains
d'un même secteur (8 par matériau). Deux mécanismes cassaient les grains en cours :

1. **La boucle `update()` (60 Hz)** replaçait chaque voix-secteur sur l'impact le plus proche de
   la fenêtre de 400 ms : dès qu'une goutte plus proche arrivait (ou que l'ancienne sortait de la
   fenêtre), la source **sautait** ailleurs — traînant avec elle les grains encore en train de
   résonner (un sample de pluie dure 100-300 ms). `setPosition` sans lissage à chaque frame
   → zipper, clics, sensation de coupure.
2. **`triggerGrain` recalait** la voix d'un secteur réactivé sur le nouvel impact, emportant la
   traîne du grain précédent.

Un grain ne possédait jamais sa position : le grain suivant la déplaçait sous lui.

### Le correctif : `VoicePool`

`POOL_SIZE` (24) sources Resonance pré-créées à l'init, partagées entre matériaux, jamais
créées/détruites ensuite (zéro churn de nœuds). Cycle de vie d'un grain :

```
acquire → setPosition sur l'impact (UNE fois) → grain joue → onended → release
```

- **La position d'une voix ne bouge jamais pendant qu'un grain y joue** — chaque goutte sonne
  d'où elle est tombée, jusqu'au bout. Les deux mécanismes ci-dessus disparaissent à la racine.
- **Dimensionnement** : concurrence ≈ débit × durée de grain (~50 imp/s × 0,2 s ≈ 10 voix en
  moyenne, pics ~2×) → 24 voix absorbent quasiment tout. Même budget que l'ancien modèle
  (3 matériaux × 8 secteurs = 24 sources permanentes).
- **Vol de voix** (pool épuisé, rare) : la voix la plus ancienne est réaffectée après un fondu
  de 5 ms (`STEAL_FADE_S`) — inaudible, jamais de clic. Le compteur de vols est affiché dans le
  DebugHUD : s'il grimpe, le pool est sous-dimensionné pour le débit.
- **Supprimés** : `MaterialEmitter`, les secteurs, la boucle `_startLoop`/`update` de
  repositionnement. Le réservoir ne garde que les timestamps (débit du DebugHUD).
- **Conservés** : cooldown par cellule (80 ms, limiteur de débit), `Y_FLATTEN` (appliqué au
  déclenchement), distances d'atténuation par matériau (posées à l'acquisition de la voix via
  `setMinDistance`/`setMaxDistance`).
- **Mobile** : réduire `POOL_SIZE` (12-16) et `AMBISONIC_ORDER` (1-2) — deux constantes en tête
  de `RainSampler.js`.

---

*Rédigé le 2026-06-12 · référence de code : commit `0969860` · révisé le 2026-06-12 (×2)*
