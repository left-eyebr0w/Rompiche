# Rompiche — Architecture cible (post-Grand Refactor)

**Dernière mise à jour** : 14 juin 2026
**Statut** : 🏗️ ARCHITECTURE CADRÉE — cible du Grand Refactor.
**Portée** : décrit l'état visé à la sortie du refactor, pas l'état actuel.

> Document compagnon de [plan.md](plan.md). Le plan dit *quoi* et *dans quel ordre* ; ce
> document dit *à quoi ça ressemble une fois fait*. C'est la référence de conception du Grand
> Refactor (ECS Miniplex + moteur hors React + three.js impératif + audio Web Audio). Il ne
> contient pas de tâches : le découpage fin viendra après.

---

## 1. Principe d'architecture en une phrase

**Un moteur déterministe, à boucle de jeu fixe, organisé en ECS, qui ne connaît ni React ni
le DOM ; autour de lui, des adaptateurs (rendu three.js, audio Web Audio, persistance, entrée)
et une couche UI React qui n'est qu'un observateur/émetteur de commandes.**

```
┌──────────────────────────────────────────────────────────────┐
│  UI (React)        HUD, contrôles, debug — observe + commande │
└───────────────┬───────────────────────────────┬──────────────┘
                │ commands (intents)             │ snapshots (lecture)
┌───────────────▼───────────────────────────────▼──────────────┐
│  ENGINE (TypeScript pur, sans React, sans DOM)                │
│                                                              │
│   World (ECS)  ──  Systems  ──  fixed-step Scheduler         │
│        │                                                     │
│        ├── interfaces-frontières ────────────────┐          │
│        │     WorldQuery     SpatialAudioBackend   │          │
└────────┼──────────────────┼──────────────────────┼──────────┘
         │                   │                      │
┌────────▼────────┐ ┌────────▼────────┐ ┌───────────▼─────────┐
│ Render adapter  │ │ Audio adapter   │ │ Persistence / Input │
│ (three.js       │ │ (WebAudioBackend│ │ (IndexedDB, clavier │
│  impératif)     │ │  + worklets)    │ │  souris, pointer)   │
└─────────────────┘ └─────────────────┘ └─────────────────────┘
```

---

## 2. La boucle de jeu (game loop)

Boucle à **pas de simulation fixe** + **rendu interpolé**, découplée de React.

```
accumulator += realDt
while (accumulator >= FIXED_DT):       # FIXED_DT ≈ 1/60 s
    ctx.input.drainCommands(world)     # appliquer les intents UI
    for sys of SYSTEMS: sys(ctx, FIXED_DT)   # ordre explicite, codé en dur
    accumulator -= FIXED_DT
alpha = accumulator / FIXED_DT
ctx.render.draw(world, alpha)          # interpolation visuelle
ctx.audio.sync(world)                  # pousser l'état spatial vers le backend
```

Décisions :
- **Pas fixe** pour le déterminisme (rejoue/replay, tests reproductibles, PRNG seedé).
- **Horloge audio comme source de temps** pour la cadence des couches sonores (déjà acté :
  `clock-processor` worklet, cf. [archive/postmortem-echelle-L1.md](archive/postmortem-echelle-L1.md)),
  pas `requestAnimationFrame` (gelé hors focus).
- Le **chemin de voix HRTF reste sur le thread principal** ; seules les cadences/synthèses
  vivent dans des worklets. Inchangé par le refactor.

---

## 3. L'ECS — **Miniplex**

On utilise **Miniplex** (`miniplex`), pas un ECS maison. Modèle Miniplex :

| Brique Miniplex | Rôle | Nature |
|---|---|---|
| **Entity** | un **objet JS plat** ; ses propriétés *sont* les composants | `{ transform, voice, … }` |
| **Component** | une **propriété** optionnelle d'entité, **donnée pure** | objet/struct plat |
| **Query** (archetype) | `world.with('a','b')` → vue itérable des entités ayant ces composants | dérivée, réactive |
| **System** | **simple fonction** `(ctx, dt) => …` itérant une/des queries | pas une classe |
| **World** | `new World<Entity>()` : `add`/`remove`/`addComponent`/`removeComponent` | conteneur Miniplex |

Miniplex **n'a pas** de notion formelle de `Scheduler` ni de `Resource`. On les fournit nous-mêmes :

- **Scheduler** = notre boucle (§2) appelle les fonctions-systèmes **dans un ordre explicite,
  codé en dur** (un tableau ordonné de systèmes). Pas de magie d'ordonnancement.
- **Resources / singletons** (config, horloge, coords, PRNG, `WorldQuery`, backends) = un objet
  **`EngineContext`** passé en 1ᵉʳ argument à chaque système. **Hors ECS** : ce ne sont pas des
  entités. (On évite l'anti-pattern « entité singleton ».)

```ts
type Entity = {
  transform?: Transform
  listener?: Listener
  voice?: Voice
  rainEmitter?: RainEmitter
  wind?: Wind
  // … monde vivant : animable?, fauna?
}
const world = new World<Entity>()
const movers = world.with('transform', 'voice')   // archetype
function audioSyncSystem(ctx: EngineContext, dt: number) {
  for (const e of movers) ctx.audio.source(e).setPosition(e.transform.position)
}
```

Règles d'or ECS :
- **Aucune logique dans les composants.** Donnée seulement → sérialisation triviale = saves.
- **Aucun état caché dans les systèmes.** Tout état vit dans le World (entités) ou
  l'`EngineContext` → déterminisme + traçabilité.
- **Ordre des systèmes explicite** (tableau ordonné dans la boucle).
- **Pas de `@miniplex/react` côté jeu.** R3F est abandonné ; le pont React passe par les
  snapshots/`useSyncExternalStore` (§5), pas par les hooks Miniplex orientés R3F.

### 3.2 Composants (inventaire initial — issu de l'existant)

| Composant | Données | Origine v0 |
|---|---|---|
| `Transform` | position (m), orientation | dispersé (head, voices, objects) |
| `Listener` | offset slider X/Y/Z, hauteur d'oreille (EAR=1.6) | `coords` + state |
| `RainEmitter` | densité, actif | `tickPoisson` params |
| `Voice` | materialId, grain, gainDb, busy, dist | `RainSampler.Voice` |
| `SurfaceMaterial` | materialId (ref table) | `materials` |
| `Wind` | direction, force, tilt | state `wind*` |
| `Animable` (monde vivant) | timeline 0-1, conditions (vent/pluie/impact) | vision.md |
| `Fauna` (monde vivant) | comportement, biome | vision.md |

> Les composants du monde vivant (`Animable`, `Fauna`) sont **listés mais pas implémentés** au
> refactor — ils justifient l'ECS, ils ne le peuplent qu'au chantier du monde vivant.

### 3.3 Systèmes (inventaire initial — mapping de l'existant)

| Système | Lit | Écrit | Origine v0 |
|---|---|---|---|
| `InputSystem` | commands UI | composants ciblés | effects de `DioramaApp` |
| `ListenerSystem` | `Listener` | `Transform` (tête) | `headInputToWorld` |
| `RainPoissonSystem` | `RainEmitter`, `WorldQuery` | événements d'impact | `tickPoisson` |
| `VoicePoolSystem` | impacts, `WorldQuery` | `Voice`, priorité/steal | `VoicePool` |
| `LodRoutingSystem` | impacts, distance tête | L1 vs L2 (secteurs) | `LodController`/routage L1 |
| `DiffuseBedSystem` | météo | nappe L3 | `DiffuseBed` |
| `WindSystem` | `Wind` | inclinaison pluie, anim | state vent |
| `TraceSystem` | tous événements | NDJSON | `TraceRecorder` |
| `RenderSyncSystem` | `Transform`, terrain | scène three.js | `WireframeCube` |
| `AudioSyncSystem` | `Voice`, `Listener` | `SpatialAudioBackend` | `RainSampler` ↔ Resonance |

---

## 4. Les interfaces-frontières (les coutures stables)

Ces interfaces sont le **cœur de la longévité** : derrière elles, l'implémentation change sans
propager le changement. Même philosophie que l'invariant `coords` v0.

### 4.1 `WorldQuery` — déjà figée ([World.ts](../ds/ui_kits/diorama/World.ts))
Le moteur audio n'interroge le monde **que** par là (`nearestSurface`, `raycast`, `isOccluded`,
`enclosedVolume`, `impactPoints`). Impl. actuelle `FlatWorld` (2.5D colonnes) ; le chantier
World Shaper glissera `SdfWorld` dessous sans rien changer côté audio. **Conservée telle quelle par le refactor**
(étoile polaire, pas à réinventer).

### 4.2 `SpatialAudioBackend` — à introduire au refactor
Abstrait la techno de spatialisation. Permet le swap Resonance → Web Audio sans toucher aux
systèmes audio.

```ts
interface SpatialAudioBackend {
  init(ctx: AudioContext): void
  createSource(): SpatialSource          // 1 par Voice
  setListener(pos: Vector3, forward: Vector3, up: Vector3): void
  // occlusion (monde vivant) : filtre passe-bas sur le send
  // réverb   (monde vivant) : ConvolverNode partagé, IR ← enclosedVolume()
}
interface SpatialSource {
  readonly input: AudioNode              // point de connexion du grain
  setPosition(p: Vector3): void
  dispose(): void
}
```

Impl. : `ResonanceBackend` (transitoire) → `WebAudioBackend` (`PannerNode`, `panningModel:'HRTF'`,
`refDistance`/`maxDistance`/`rolloff` ← `materials`). Cible du swap = fin du refactor.

### 4.3 `RenderTarget` — frontière rendu
Le moteur ne connaît pas three.js ; il pousse des snapshots à un `RenderTarget`. Impl.
`ThreeRenderer` (wireframe v1, low-poly post-v1). Découple aussi pour d'éventuels tests headless.

### 4.4 `SaveStore` — persistance (déjà conçue)
`save.ts` (format versionné + migrations) reste la couture données. Adaptateur IndexedDB.

---

## 5. Découplage moteur ↔ React

React ne tient **plus** l'état du monde ni la boucle (fin du god-component `DioramaApp`).

- **Sens UI → moteur** : commandes/intents (`set rain`, `move listener`, `paint material`…)
  poussées dans une file drainée par `InputSystem`. Pas de mutation directe du World depuis React.
- **Sens moteur → UI** : le moteur expose des **snapshots** lisibles (sélecteurs) ; React
  s'abonne (store externe type `useSyncExternalStore`) pour afficher HUD/debug. Lecture seule.
- **Conséquence** : l'UI peut être réécrite/retirée sans toucher au jeu ; le moteur tourne en
  test headless.

---

## 6. Rendu — three.js impératif

Abandon de React Three Fiber. Le `ThreeRenderer` possède sa `Scene`/`Camera`/`Renderer`,
créés une fois, mis à jour par `RenderSyncSystem` à partir des `Transform`/terrain. Caméra
orbitale (spin/zoom) **n'affecte pas l'écoute** (invariant v0 conservé). Meshes de relief mis
en cache (corrige la dette §10.6 de [archive/reconnaissance-v0.md](archive/reconnaissance-v0.md)).

---

## 7. Déterminisme, trace & replay

- **PRNG seedé** unique en `Resource`, jamais de `Math.random` dans les systèmes.
- Pas fixe + composants = donnée pure ⟹ même seed + même suite de commandes = même monde.
- `TraceSystem` enregistre commandes + événements (NDJSON) ; `ReplayEngine` rejoue la file de
  commandes dans la boucle. Le replay devient un **mode d'entrée**, pas un chemin parallèle.

---

## 8. Arborescence de fichiers cible (indicative)

```
src/
├── engine/
│   ├── ecs/            world.ts (miniplex World), Entity type, queries/archetypes
│   ├── loop/           fixed-step game loop, clock, ordered systems registry
│   ├── components/     Transform, Listener, Voice, RainEmitter, Wind, …  (types data)
│   ├── systems/        RainPoisson, VoicePool, LodRouting, DiffuseBed, AudioSync, RenderSync, …
│   ├── context/        EngineContext (coords, worldConfig, PRNG, WorldQuery, backends)
│   └── world/          FlatWorld (WorldQuery), [SdfWorld — chantier World Shaper]
├── audio/
│   ├── SpatialAudioBackend.ts   (interface)
│   ├── WebAudioBackend.ts       (cible)
│   ├── ResonanceBackend.ts      (transitoire, supprimé après swap)
│   └── worklets/                noise, granulator, clock
├── render/
│   └── ThreeRenderer.ts
├── persistence/
│   └── save.ts, IndexedDbStore.ts
├── ui/                 React : App, ControlHUD, DebugHUD, store-bridge
└── platform/           detectPlatform, input
```

> Migration depuis `ds/ui_kits/diorama/` : le refactor déplace et renomme. Les fichiers TS
> déjà sains (`coords`, `materials`, `save`, `Terrain`, `World`, `state`, `worldConfig`,
> `BakedSet`, `objects`) se reclassent quasi tels quels.

---

## 9. Règles d'or (à tenir après le refactor)

1. **Le moteur n'importe jamais React ni three.js ni le DOM.**
2. **Composants = donnée pure ; systèmes = logique pure ; aucun état caché.**
3. **L'audio n'accède au monde que par `WorldQuery`** ; ne connaît la spatialisation que par
   `SpatialAudioBackend`.
4. **Une seule source de temps** (horloge audio) ; un seul PRNG seedé.
5. **Les saves ne meurent jamais** : tout changement de schéma = migration pure.
6. **Les 5 tests garde-fous restent le contrat** de non-régression du son validé.
```
