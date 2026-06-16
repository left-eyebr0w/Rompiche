# Journal des sujets traités

Suivi chronologique du Grand Refactor Audit. Un bloc par sujet traité.

---

## Sujet 1 — Game loop & source d'horloge (rAF → Worklet) ✅

**Date** : 2026-06-14 · **Statut** : livré, background validé (desktop, onglet caché)

### Problème
La boucle était cadencée par `RafClock` ([main.ts](../../src/main.ts)). En arrière-plan,
rAF gèle → simulation **et** audio s'arrêtent. Or `architecture.md` §2 prescrit le
worklet `clock-processor` comme maître d'horloge (thread audio, jamais gelé).
Le code J5 contredisait donc son propre cadrage.

### Changement
- **Créé** [`src/platform/worklets/clock-processor.js`](../../src/platform/worklets/clock-processor.js)
  — worklet v0 récupéré verbatim (commit `39bd3f6`, éprouvé en prod). Sortie muette,
  poste `currentTime` toutes les ~16 ms.
- **Créé** [`src/platform/WorkletClock.ts`](../../src/platform/WorkletClock.ts)
  — impl primaire de `ClockSource` : `realDt = currentTime − last`, repli rAF intégré
  si l'AudioWorklet échoue (filet desktop, PAS la garantie background).
- **Modifié** [`main.ts`](../../src/main.ts) — `AudioContext` remonté en tête (état
  `suspended`, autorisé sans geste), `RafClock` → `WorkletClock`.

### Décisions
- Option A (boucle logique sur le main thread, réveillée par le worklet) retenue
  vs Option B (boucle dans le worklet) : **A validée empiriquement** car le worklet
  pilotait déjà la simu en background en v0.
- La couture `ClockSource` n'a PAS changé → `ManualClock` + `determinism.test.ts` intacts.

### Conséquence connue (réglée au sujet 2)
Tant que l'`AudioContext` est `suspended` (avant 1ᵉʳ clic), aucun tick → **scène figée**
(le rendu était encore dans la boucle à ce stade).

### Vérification
- `tsc` : pas d'erreur nouvelle · `vitest` : 30/30.
- Background : onglet caché → `__rompiche.ctx.time.tick` continue, son tient.

---

## Sujet 2 — Sortir le rendu du pas fixe ✅

**Date** : 2026-06-14 · **Statut** : livré

### Problème
`RenderSyncSystem` était le système #6 de `SYSTEMS`, donc `renderer.draw()` tournait
dans `loop.step()` à la cadence du pas fixe worklet. Conséquences :
0 rendu si tick court, N rendus si catch-up (GPU jeté), rendu asservi à l'`AudioContext`
(scène figée pré-clic), aucun découplage « audio seul ».

### Changement (Option A)
- **Modifié** [`index.ts`](../../src/engine/systems/index.ts) — `createRenderSyncSystem`
  retiré de `SYSTEMS` ; param `renderer` + imports inutiles supprimés. `faceProjection`
  reste dans la boucle (pur, suit la mesure audio, alimente le HUD).
- **Modifié** [`main.ts`](../../src/main.ts) — boucle de rendu rAF dédiée, lancée dès la
  création du renderer (avant le boot audio).

### Décisions
- Option A (réutiliser `createRenderSyncSystem` via boucle rAF) retenue.
- Option B (interpolation `alpha`) **écartée** : rien ne bouge assez vite aujourd'hui
  (tête = slider lent, pluie animée sur sa propre horloge dans `_tickRain`). À revoir
  quand le monde vivant bougera vite.
- Option C (consolider render + snapshot UI dans une seule boucle rAF) **reportée au
  sujet 8** : il reste donc 2 boucles rAF (rendu + polling snapshot [store.ts](../../src/ui/store.ts)).

### Résultat
- Scène vivante AVANT le 1ᵉʳ geste (régression du sujet 1 réglée).
- Background : rAF gèle → rendu stoppé, simu+audio continuent via worklet.
- 1 seul `draw`/frame écran.

### Vérification
- `tsc` : pas d'erreur nouvelle · `vitest` : 30/30.

### Dette laissée (volontaire)
- Deux boucles rAF coexistent → consolidation au sujet 8.
- Pas d'interpolation visuelle → à reconsidérer avec le monde vivant.

---

## Sujet 3 — Architecture du temps & déterminisme (deux horloges) ✅

**Date** : 2026-06-14 · **Statut** : livré

### Problème
Les deux horloges sont conformes à `architecture.md` §7 (logique `ctx.time` déterministe ;
audio `currentTime` lue uniquement par audioSync). Mais le **playhead** d'audioSync avait
un garde-fou **asymétrique** : il resynchronisait si le playhead prenait du retard
(under-run), mais **pas** s'il dérivait trop en avance. Au retour de background (rafale
de ticks bornée par `MAX_CATCHUP` pendant que le temps audio avance peu), la latence
audio pouvait **grimper sans borne**.

### Changement (Option A + test)
- **Modifié** [`audioSync.ts`](../../src/engine/systems/audioSync.ts) :
  - `LOOKAHEAD` + nouveau `MAX_DRIFT = LOOKAHEAD + FIXED_DT` remontés en consts module.
  - Extraction d'une fonction **pure exportée** `resolvePlayhead(playhead, now)` avec
    **double garde-fou symétrique** (bas = under-run, haut = dérive). Invariant garanti :
    `t − now ∈ [0.005, MAX_DRIFT]`.
  - Le système appelle `resolvePlayhead` au lieu de la logique inline.
- **Créé** [`playhead.test.ts`](../../src/engine/systems/playhead.test.ts) — 5 tests :
  amorçage, régime normal, under-run, **rafale background** (100 ticks horloge figée →
  dérive bornée), scénario mixte (500 itérations, invariant maintenu).

### Décisions
- Option C (refonte timeline absolue) **écartée** : sur-ingénierie, casserait du code
  éprouvé anti-jitter.
- Métrique runtime (`playhead − currentTime` exposée dans `__rompiche`) **non ajoutée** :
  le test couvre la vérification ; à plomber seulement si besoin de debug live.

### Vérification
- `tsc` : pas d'erreur nouvelle · `vitest` : 35/35 (6 fichiers).

---

## Correctif intercalaire — Slider debug « débit /s » mort 🐛✅

**Date** : 2026-06-14 · **Statut** : corrigé (hors plan, signalé par l'utilisateur)

### Symptôme
Le slider « débit /s » de l'overlay debug (Ctrl+Alt+D) ne changeait PAS la quantité
de pluie. (À ne pas confondre avec le slider « Densité » du panneau principal, lui
fonctionnel.)

### Cause
La simplification **J4** ([rainPoisson.ts](../../src/engine/systems/rainPoisson.ts) §7) a fusionné
la pluie en **un seul flux Poisson** piloté par `dropletRate × density`, et a abandonné
`l1Field.rate` (le débit du flux héros L1 dédié, prévu par
[worldConfig.ts:54](../../src/engine/context/worldConfig.ts#L54)). Or le slider debug
[DebugHUD.tsx:205](../../src/ui/DebugHUD.tsx#L205) écrivait toujours dans `l1Field.rate`,
que `rainPoisson` **destructurait sous `_r` et ignorait** → slider orphelin.

### Décision (utilisateur) : « rendre le slider vivant »
Honorer l'intention « flux héros L1 découplé » du worldConfig.
- **Modifié** [`rainPoisson.ts`](../../src/engine/systems/rainPoisson.ts) — le débit lit
  désormais `l1Field.rate × density` (au lieu de `dropletRate × density`).
- **Modifié** [`simulation.test.ts`](../../src/engine/systems/simulation.test.ts) — le helper
  `runSim` force `l1Field.rate` (param renommé `heroRate`) au lieu de `dropletRate`.

### Conséquences
- Le slider « débit /s » pilote enfin la quantité. La « Densité » reste un multiplicateur.
- **Changement perceptif** : débit par défaut passe de `120×density` à `60×density`
  (l1Field.rate=60) → pluie de base ~2× moins dense. À réajuster à l'oreille via le slider.
- `dropletRate` (120) devient **inutilisé**, réservé au futur flux BULK L2/L3 (documenté
  dans worldConfig). À reconnecter au sujet 7 (architecture audio / découplage L1-L2-L3).

### Vérification
- `tsc` propre · `vitest` : 35/35.
