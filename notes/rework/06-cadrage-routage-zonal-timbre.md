# Cadrage — Routage zonal L1/L2, équité, timbre voix (flou + pitch)

Date : 2026-06-17. Statut : LIVRÉ (4 étapes, 56/56 tests + build OK ; reste validation oreille).

## Implémenté (résumé)
1. Tirage uniforme : pickImpact (terrainMesh) ignore la distance ; SpatialField DORMANT.
2. Routage zonal : pL1Zonal (lodRouting) → {p, mix}, distance horizontale, plus de
   passe plancher. Config l1l2 = {rProche, largeurT, pProche, pLoin}. Impact.mix + Voice.mix.
3. Timbre : config `timbre` (lowpass/diffusion/pitch ×L1/L2 + delayS/feedback). audioSync
   interpole par voice.mix : passe-bas par grain, pitch (demi-tons→cents) sur detune,
   send wet vers bus de délais partagé du WebAudioBackend (diffusionInput/setDiffusion).
4. UI : sliders zonaux + timbre dans DebugHUD ; courbe P(L1) zonale ; viz frontière =
   2 cercles (rProche, rLoin) ; bouton champ « Disque ».

Quatre changements liés, décidés en discussion. Ce document fige le quoi/comment
avant d'écrire la moindre ligne.

## Décisions (réponses utilisateur)

1. **Enlever la pondération par distance** sur DEUX chemins :
   - PDF de tirage des gouttes (`spatialWeight`, terrainMesh) → tirage UNIFORME des
     cellules exposées au ciel.
   - Routage L1/L2 par distance (`pL1` + passe `plancherL2`, lodRouting) → REMPLACÉ
     par le modèle zonal ci-dessous.
   - **CONSERVÉ** : le vol de voix par distance (`w_dist` dans `priority()`, voicePool).
     On n'y touche pas.

2. **Routage zonal L1/L2** (remplace l'ancienne courbe pL1) :
   - Trois zones concentriques autour de la tête, en distance **HORIZONTALE**
     `d = √(dx²+dz²)` (cohérent avec la PDF disque déjà livrée) :
     - Zone PROCHE (d ≤ rProche) : P(L1) = `pProche` (réglable, défaut ~1).
     - Zone TRANSITION (rProche < d < rLoin) : P(L1) interpole `pProche → pLoin`.
     - Zone LOIN (d ≥ rLoin) : P(L1) = `pLoin` (réglable, défaut ~0).
   - Les zones sont COLLÉES : rLoin = rProche + largeurTransition. La transition est
     l'anneau [rProche, rLoin].
   - Chaque goutte tire `aléa() < P(L1, d)` → L1 sinon L2. Proba locale, pas de
     passe plancher globale.

3. **Équité L1/L2** : assurée par les bornes `pProche`/`pLoin` réglables (ratio fixe
   par zone). « Équitable » = on contrôle directement la proba de spawn par zone, plus
   de biais implicite par la forme d'une sphère.

4. **Timbre des voix : flou + pitch, réglables, INTERPOLÉS dans la transition.**
   - Flou = passe-bas (lowpass) + diffusion (réverb/délai courte). « Les deux combinés ».
   - Pitch = décalage de hauteur, **séparé par couche** (pitch L1, pitch L2).
   - Chaque voix porte un facteur `mix ∈ [0,1]` (0 = timbre L1 pur, 1 = L2 pur),
     calculé à l'allocation depuis la position de la goutte dans la transition.
     Hors transition : mix = 0 (proche) ou 1 (loin). Dans l'anneau : mix = fraction
     linéaire de la position dans [rProche, rLoin].
   - L'audio interpole flou + pitch entre les réglages L1 et L2 selon `mix`.

5. **Continuum spatial** = exactement ce modèle zonal : zones collées + anneau de
   transition où les probabilités s'inversent progressivement. Pas une couche
   visuelle séparée ; c'est le routage réel.

## Modèle mathématique du routage

```
d = √(dx² + dz²)                         // distance horizontale tête→goutte
rProche, largeurT  (config)              // rLoin = rProche + largeurT
pProche, pLoin     (config, ∈ [0,1])

P(L1, d) =
  d ≤ rProche            → pProche
  d ≥ rLoin              → pLoin
  sinon  t = (d−rProche)/largeurT ∈ (0,1)
         P = pProche + (pLoin − pProche) · t      // interpolation linéaire
         mix = t                                   // facteur de timbre de la voix
```

`mix` est porté par l'impact puis la voix. (mix=0 hors transition côté proche,
mix=1 côté loin.)

## Config — nouveaux champs

`worldConfig.layers.l1l2` : REMPLACER `{ centre, largeur, pente, plancherL2 }` par
`{ rProche, largeurT, pProche, pLoin }`.

Nouveau bloc `worldConfig.timbre` (ou étendre `grain`), réglable live :
```
timbre: {
  // Flou passe-bas : fréquence de coupure par couche (Hz). Plus bas = plus sourd.
  lowpassHzL1, lowpassHzL2,
  // Diffusion (halo) : quantité de wet [0..1] par couche.
  diffusionL1, diffusionL2,
  // Pitch par couche (cents ou demi-tons). S'ajoute au détune aléatoire existant.
  pitchL1, pitchL2,
}
```
Valeurs interpolées par voix : `param = lerp(paramL1, paramL2, voice.mix)`.

## Structures à étendre

- `Impact` (frame.ts) : ajouter `mix?: number`.
- `Voice` (Entity.ts) : ajouter `mix: number`.

## Points d'implémentation par fichier

1. **terrainMesh.ts** — `spatialWeight` : retirer la pondération, retourner un poids
   constant (1) pour tout point exposé. Garder `expoCiel` comme filtre binaire.
   `pickImpact` devient un tirage uniforme parmi les cellules exposées.
   (Décider : supprimer `SpatialField`/sliders core/sigma/p/floor, ou les neutraliser.
   → À TRANCHER avec l'utilisateur : ces sliders ne servent plus si tirage uniforme.)

2. **lodRouting.ts** — remplacer `pL1` par `pL1Zonal(d, rProche, largeurT, pProche,
   pLoin)` retournant `{ p, mix }`. Distance horizontale. Supprimer la passe plancher.
   Renseigner `imp.layer` et `imp.mix`.

3. **voicePool.ts** — `assign()` : copier `imp.mix` → `target.mix`. NE PAS toucher
   `priority()` (w_dist conservé).

4. **audioSync.ts** — section onset : insérer dans la chaîne du grain
   `bufferSource → [lowpass] → grainGain → [diffusion send] → src.input`, avec
   coupure + pitch (detune += pitch interpolé) + wet diffusion calculés depuis
   `voice.mix` et les params L1/L2. Un seul nœud de réverb/délai partagé (send/return),
   pas un par grain.

5. **DebugHUD.tsx** — nouveaux sliders : rProche, largeurT, pProche, pLoin ;
   lowpass/diffusion/pitch ×(L1,L2). Retirer les anciens (centre/largeur/pente/
   plancherL2 ; et selon décision PDF, core/sigma/p/floor).

6. **ThreeRenderer.ts** — la viz de frontière (`rebuildFrontier`) doit refléter
   rProche (cercle intérieur) et rLoin (cercle extérieur) collés. La viz de champ L1
   (`rebuildShells`) n'a plus de sens si tirage uniforme → à retirer ou repenser.

## Décisions finales (tranchées)

- **PDF uniforme : SpatialField gardé DORMANT.** On ne supprime pas `SpatialField`,
  les sliders cœur/σ/p/plancher, ni les cercles de champ L1. MAIS le tirage devient
  uniforme : `pickImpact` ignore le poids et tire uniformément parmi les cellules
  exposées. Câbler explicitement + commenter que SpatialField est neutralisé (code
  dormant, réversible). NE PAS laisser croire que les sliders agissent encore.
- **Diffusion : réseau de délais (feedback).** Un/deux `DelayNode` avec retour,
  partagés en send/return (pas un par grain). Params : temps, feedback, wet.
- **Pitch : sliders en DEMI-TONS côté UI**, convertis ×100 → cents en interne
  (le `detune` du bufferSource est en cents). pitchL1/pitchL2 en demi-tons.
