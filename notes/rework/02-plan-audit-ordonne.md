# Plan d'audit ordonné — Temps 2

**Ordonnancement** : (1) fondateur & coûteux à changer tard, (2) sert contraintes non-négociables, (3) reste.

---

## Sujet 1 : Game loop & source d'horloge (rAF → Worklet)

**Priorité** : 🔴 **CRITIQUE** · Fondateur + **bloque contrainte background n°2**

**Enjeu** : La boucle est actuellement cadencée par `RafClock` (rAF). En arrière-plan, rAF gèle → simulation + audio s'arrêtent. La contrainte « audio seul, pas de rendu » est structurellement impossible. Tout le reste (audio, render, déterminisme) tourne sur cette horloge.

**Raison de la place** : Elle conditionne l'architecture du thread et le découplage sim/rendu. À trancher **en premier** car ça change la forme du code après.

**Points de contact** : [RafClock.ts](src/platform/RafClock.ts), [ClockSource.ts](src/platform/ClockSource.ts), [loop.ts](src/engine/loop/loop.ts), [main.ts](src/main.ts) (injection).

---

## Sujet 2 : Frontière sim/rendu (sortir `draw` du pas fixe)

**Priorité** : 🔴 **CRITIQUE** · Fondateur + **bloque contrainte background n°1**

**Enjeu** : `RenderSyncSystem` (système #6) exécute `renderer.draw()` à chaque tick logique. Conséquences :
- 0 rendu si frame rAF rapide (pas d'accumulation ≥1/60)
- **N rendus** si rAF lent et boucle catch-up (GPU travail jeté)
- Pas de découplage « audio seul, couper le rendu »
- Pas d'interpolation, donc `alpha` inutile

Déplacer le render hors SYSTEMS + câbler à rAF directement = découplage + perf mobile. Mais ça change la forme de la loop, donc juste après sujet 1.

**Points de contact** : [loop.ts](src/engine/loop/loop.ts) (structure boucle), [renderSync.ts](src/engine/systems/renderSync.ts), [main.ts](src/main.ts) (peut-être callback rAF dédié).

---

## Sujet 3 : Architecture du temps & déterminisme (2 horloges logique/audio)

**Priorité** : 🔴 **CRITIQUE** · Fondateur

**Enjeu** : Actuellement, `AudioSyncSystem` avance `playhead += FIXED_DT` à chaque tick logique. Conséquences :
- Playhead dépend du nombre de ticks (pas du temps audio réel)
- Si rAF gèle+reprend, `MAX_CATCHUP` jette du temps → désync horloge logique et timeline audio
- Pas de séparation explicite : quand utiliser `ctx.time.seconds` (logique) vs. `backend.currentTime` (audio) ?

Fixer formellement :
- Horloge **logique** : `ctx.time` (avancée par la boucle, déterministe, PRNG seedé)
- Horloge **audio** : `backend.currentTime` (matérielle, jamais lue par les systèmes sim)
- Comment les deux se resynchronisent en cas de gel/reprise ?

**Raison de la place** : Dépend du sujet 1 (horloge déterministe via WorkletClock ou pas). À clarifier avant d'ajouter des systèmes audio.

**Points de contact** : [audioSync.ts](src/engine/systems/audioSync.ts) (playhead), [loop.ts](src/engine/loop/loop.ts) (accumulation), [EngineContext.ts](src/engine/context/EngineContext.ts) (LogicalClock).

---

## Sujet 4 : Pipeline de sérialisation (que capture un save ?)

**Priorité** : 🟡 **IMPORTANT** · Contrainte n°3 (partageable)

**Enjeu** : Un save capture aujourd'hui :
- ✓ Terrain (RLE) + contrôles UI (subset)
- ✗ Entités ECS (pool voix, émetteur, listeners) **non persistées**
- ✗ Édition terrain (`paint`, `setScale`) **inerte** (overlay vide)

Définir tôt ce qu'est « un monde shareable » oriente la structure ECS :
- Persiste-t-on l'état du pool de voix ? Les voix jouant ?
- Le monde vivant (Fauna/Animable) sera-t-il sérialisé ? Si oui, comment ?
- Édition terrain récupérée pour P3 ?

**Raison de la place** : Haut niveau, décision de scope → impacte structure ECS. Après les 3 jalons temps (loop/render/time), car on voudra peut-être persister `ctx.time.tick` ou l'état Poisson.

**Points de contact** : [save.ts](src/persistence/save.ts), [Entity.ts](src/engine/ecs/Entity.ts) (inventaire composants), [App.tsx](src/ui/App.tsx) (handleSave/handleLoad).

---

## Sujet 5 : Gestion mémoire & GC par frame (perf mobile)

**Priorité** : 🟠 **ÉLEVÉ** · Contrainte n°1 (perf mobile)

**Enjeu** : Chemin chaud à chaque tick :
- `RainPoissonSystem` réalloue `scratch[]` (copie des vertices)
- Pousse N objets `Impact` vers `ctx.frame.impacts` (mono-tick, vidés chaque tick)
- Ticke `Poisson` (accumulateur par matériau)

Sur mobile, fréquentes allocations peuvent créer la GC et les freezes. Audit :
- Piscine d'objets pour Impact ? ReusePool pour impacts ?
- Récupérer scratch avec une Map<size, typed array> ?
- Pré-allouer les tampons de frame à la taille max ?

**Raison de la place** : Après les 3 jalons structurels (loop/render/time), avant d'ajouter le monde vivant. Les chiffres (nb impacts/s) proviennent du sujet 1 et 3.

**Points de contact** : [rainPoisson.ts](src/engine/systems/rainPoisson.ts), [frame.ts](src/engine/loop/frame.ts), [loop.ts](src/engine/loop/loop.ts) (clearFrame).

---

## Sujet 6 : Structure des systèmes ECS & frontière des Resources

**Priorité** : 🟡 **MOYEN** · Cohérence paradigmatique (contrainte n°4)

**Enjeu** : Frictions repérées :
- `ctx.headWorldPos` duplique l'entité tête (cache pour systèmes sans world)
- Pas de requête ECS centralisée (world.with() dispersé dans chaque système)
- `ctx.poisson['terre']` réutilise slot comme état unique (confus)
- RenderSync lit `window.__rompiche.debug` (global dans un système)

Clarifier :
- Entité tête : est-ce une source unique ou un cache ?
- Where do pooled queries (voices, headEntities) live ? Factory ou injection ?
- Isoler les Resources éphémères (poisson state) des configs (worldConfig, bands)

**Raison de la place** : Transversal mais non-bloquant. Après les jalons temps car la refonte peut impacter les systèmes.

**Points de contact** : [EngineContext.ts](src/engine/context/EngineContext.ts), tous les systèmes, [Entity.ts](src/engine/ecs/Entity.ts).

---

## Sujet 7 : Architecture audio (voix, spatialisation, L2/L3)

**Priorité** : 🟡 **IMPORTANT** · Pilier ambiance

**Enjeu** : L'audio est bien isolé derrière sa couture (SpatialAudioBackend), mais la logique pointe des détails :
- Voice pool (L1 héros : 4-8 voix) vs. L2/L3 (secteurs/nappe, à venir)
- Priority weighting (gain, distance, attention, age)
- GRAIN_DURATION_S placeholder (durée réelle PCM à J3)
- Grain state (onset/demotion/fade-out) piloté par tampons mono-tick

Audit :
- Portée exacte du pool (actuellement ~20 voix configurable) ?
- Priorité : gain absolu vs. adaptatif ? Attention : pourquoi 1.0 avant, 0.4 sinon ?
- Comment gérer L2/L3 en multi-voix ?

**Raison de la place** : Important, pilier, mais peut évoluer sans casser le cœur (couture). Après les fondations temps.

**Points de contact** : [voicePool.ts](src/engine/systems/voicePool.ts), [audioSync.ts](src/engine/systems/audioSync.ts), [WebAudioBackend.ts](src/audio/WebAudioBackend.ts).

---

## Sujet 8 : Testabilité & pont moteur→UI

**Priorité** : 🟢 **BAS** · Transversal

**Enjeu** : Le headless marche (tests possibles sans audio/DOM), mais le pont UI :
- Store polle en rAF (1/6 frames), pas réactif aux perturb audio immédiates
- Snapshots recalculés même si aucun changement (minimisérait les rendus React ?)
- Tests du store : comment mocker ctx + world ?

**Raison de la place** : Dépend des choix 1-7. Vient en dernier.

**Points de contact** : [store.ts](src/ui/store.ts), [App.tsx](src/ui/App.tsx), tests des systèmes.

---

## Tableau récapitulatif

| # | Sujet | Priorité | Fondateur | Contrainte | Dépend de | Bloque |
|----|-------|----------|-----------|-----------|-----------|--------|
| 1 | Game loop & horloge (Worklet) | 🔴 1ᵉʳ | Oui | Background n°2 | — | 2, 3, 7, 8 |
| 2 | Frontière sim/render | 🔴 2ᵉ | Oui | Background n°1 | 1 | 5, 8 |
| 3 | 2 horloges (logique/audio) | 🔴 3ᵉ | Oui | Déterminisme | 1 | 5, 7 |
| 4 | Sérialisation | 🟡 4ᵉ | Moyen | Shareable | 1, 3 | — |
| 5 | Perf GC mobile | 🟠 5ᵉ | Oui | Perf mobile | 1, 3 | — |
| 6 | Structure ECS | 🟡 6ᵉ | Non | Paradigme | 1-5 | — |
| 7 | Architecture audio | 🟡 7ᵉ | Non | Ambiance | 1, 3 | — |
| 8 | Testabilité | 🟢 8ᵉ | Non | QA | 1-7 | — |

---

## Prochaine étape

**Choix utilisateur** : quel sujet traiter en premier ?

Recommandation : **Sujet 1** (Game loop & horloge) — c'est le fondement de tout le reste et la clé du mode background (contrainte non-négociable).

