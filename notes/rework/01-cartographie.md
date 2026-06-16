# Cartographie — Temps 1 du Grand Refactor Audit

**Date** : 2026-06-14 · **Scope** : J5 v0 production (sortie prototype)

## a) Responsabilités par couche

### Platform (adaptateurs, hors moteur)
- **ClockSource** (`src/platform/ClockSource.ts`) : couture maître d'horloge
  - Trois impls prévues : Worklet (processeur audio), Raf (fallback), Manual (test)
  - ✓ **RafClock existe** ; ✗ **WorkletClock absent** (annoncé, bloquant pour background)
- **main.ts** : point d'entrée
  - Câble : clock → ctx → world → systems → loop
  - Monte React, boot audio (autoplay policy), analyse RMS via global

### Engine — cœur pur (sans DOM/audio/rendu)
- **EngineContext** : Resources/singletons passés à chaque système
  - `audio`, `render` optionnels → couture headless (mode background + test)
- **createContext.ts** : assemble contexte headless
- **loop.ts** : boucle à pas fixe
  - `FIXED_DT = 1/60` · `MAX_CATCHUP = 0.25` (anti-spirale)
  - Vide tampons de frame en début de tick
  - Accumule realDt, exécute 0..N ticks logiques
- **frame.ts** : types des tampons mono-tick (impacts, demotions, grainOnsets)
- **ecs/** : World Miniplex nu + inventaire Entity (données pures)
- **world/World.ts** : `WorldQuery` (pivot Monde↔Audio figé) + impl FlatWorld (2.5D plat)

### Systèmes ECS (fonctions pures `(ctx, dt) => void`, ordre explicite)
Tous exécutés sequentiellement à chaque tick logique via `createEngineSystems()` :

1. **InputSystem** — draine commandes + applique controls (position tête, densité, surfaces)
2. **RainPoissonSystem** — génère impacts Poisson (PUR, pas d'audio)
3. **LodRoutingSystem** — cooldown cellule + tag L1/L2/L3 par distance (PUR)
4. **VoicePoolSystem** — alloue/vole voix L1, pousse onsets/demotions (PUR)
5. **AudioSyncSystem** — ⚠️ **IMPUR** : crée BufferSources, programme timeline audio, mesure RMS
6. **RenderSyncSystem** — ⚠️ **IMPUR** : pousse état au renderer, **appelle `draw()`**
7. **FaceProjectionSystem** — projette niveaux voix sur 6 faces tête (PUR, mais position 7 = après rendu)

### Audio (couche optionnelle)
- **SpatialAudioBackend** : couture (interface)
- **WebAudioBackend** : implémentation cible (PannerNode HRTF)
- Legacy : ResonanceBackend (Google mort, swap prévu)

### Render (couche optionnelle)
- **RenderTarget** : couture (interface)
- **ThreeRenderer** : implémentation (WebGL, scène debug + wireframe, head cube, rain particles)

### UI (React, hors moteur)
- **store.ts** : pont lecture moteur→UI
  - `createEngineStore()` : snapshots toutes 6 frames (via polling rAF)
  - `useSyncExternalStore` subscribe
- **App.tsx**, ControlHUD, DebugHUD : composants React
- Écriture UI→moteur via `ctx.input.commands` + mutations `ctx.input.controls`

### Persistance
- **save.ts** : `WorldSave` versionné (v3)
  - Terrain en RLE (paires [valeur, répétition])
  - Sous-ensemble UI state sauvegardé
  - Entités ECS **NON sauvegardées** (pool/voix reconstruits par `setupSimWorld`)
  - IndexedDB (slots nommés), `migrate()` fourni

## b) Flux d'une frame

```
RafClock.tick(realDt)                    ← horloge MURALE (rAF) [PROBLÈME BACKGROUND]
  └─ accumulator += min(realDt, 0.25)
     while accumulator >= 1/60:          ← peut tourner 0, 1 ou N fois
        step():
          clearFrame(ctx)                ← vide impacts/demotions/grainOnsets
          ctx.time.tick++ ; seconds += 1/60
          for sys of SYSTEMS:
            input() → rainPoisson() → lodRouting() → voicePool()
            → audioSync() → renderSync() → faceProjection()   [RENDU DANS LE PAS FIXE]
        accumulator -= 1/60

UI.store.poll() [~6ème frame]
  → snapshot = takeSnapshot()            ← lit state ECS
  → notifie React
```

**Constat majeur** :
- Rendu exécuté **dans la boucle à pas fixe** (renderSync = système #6)
- 0 rendu si frame rapide · **N rendus si rAF retard** → GPU travail jeté
- Pas d'interpolation (draw reçoit toujours `alpha=0`)

## c) Flux des données d'un monde

| Phase | Description |
|-------|-------------|
| **Création** | `createHeadlessContext()` → terrain défaut → `FlatWorld` → `setupSimWorld()` peuple (tête + émetteur + pool voix) |
| **Édition** | UI mute `ctx.input.controls` (sliders) OU pousse `Command` (save/load/reset) ; `InputSystem` les applique. **Édition terrain (`paint`/`setScale`) est no-op** — overlay `_edits` inerte. |
| **Simulation** | Boucle ci-dessus (7 systèmes chaque tick) |
| **Sérialisation** | `serializeWorld()` : terrain RLE + sous-ensemble UI state → IndexedDB. **Entités ECS non persistées**. |
| **Désérialisation** | `deserializeWorld()` + `setupSimWorld()` reconstruit pool/voix/émetteur |

## d) Santé du découplage (contrainte « mode background »)

### ✓ Points sains
- Cœur sim pur et testable headless (`determinism.test.ts` fonctionne)
- Audio/render optionnels, injectés via coutures (EngineContext.audio/render)
- Pivot WorldQuery propre et figé
- Dépendances inversées : UI→store→ctx, systèmes→ctx+backends, cœur jamais →DOM

### ✗ Faiblesses structurelles vs. background

| # | Problème | Impact | Raison |
|---|----------|--------|--------|
| 1 | **Horloge est rAF** | En arrière-plan, rAF gèle → **boucle stop** → pas de simu NI audio | Worklet absent ; clockSource n'injecte que RafClock aujourd'hui |
| 2 | **Rendu dans SYSTEMS** | Pas de bouton « couper rendu, garder simu+audio » ; GPU travail jeté si catch-up | renderSync est système #6 de la boucle fixe |
| 3 | renderSync lit `window.__rompiche.debug` | Couplage au global navigateur dans un système | Portabilité headless altérée |
| 4 | audioSync avance `playhead += FIXED_DT/tick` | Si rAF gèle+reprend, `MAX_CATCHUP` jette du temps → **désync horloge logique/audio** | Deux horloges (logique/audio) pas découplées en paramètre |

### Conclusion sur le découplage
- **Actuellement** : mode background **impossible** (rAF + render couplé)
- **Pour l'activer** : WorkletClock + sortir render du pas fixe + deux horloges explicites
- **Urgence** : fondateur, à traiter avant d'empiler des systèmes audio

---

## Dépendances visuelles

```
UI (React)
  ├─ store (polling rAF)
  │   ├─ ctx (lecture seule snapshots)
  │   └─ world (lecture entités)
  └─ ctx.input.commands, ctx.input.controls (écriture)

Engine (cœur pur)
  ├─ EngineContext (Resources)
  │   ├─ ctx.audio (optionnel) → WebAudioBackend
  │   └─ ctx.render (optionnel) → ThreeRenderer
  ├─ GameWorld (Miniplex)
  └─ SYSTEMS (7 fonctions)
      └─ RainPoissonSystem → lodRouting → voicePool
         → audioSync (backends audio)
         → renderSync (appelle renderer.draw)

Persistent
  └─ IndexedDB ↔ save.ts ↔ UI (handleSave/handleLoad)
```

---

## Notes architecturales (cohérence avec architecture.md)

- ✓ Pas de mix accidentel data-oriented (ECS) et OOP : les systèmes sont purs, composants = données
- ⚠️ Mais frictions repérées :
  - `ctx.headWorldPos` duplique entité tête (cache pour systèmes sans world)
  - `ctx.poisson['terre']` réutilise slot de matériau comme état unique Poisson
  - Pas de requête ECS centralisée pour iterables (world.with() est distribué)
- ⚠️ Édition terrain inerte (`paint`/`setScale` ne font rien) + entités non persistées
  - Chantier P2 : sera résolu lors de l'implémentation du monde vivant

