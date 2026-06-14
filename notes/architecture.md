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

**Maître d'horloge unique : le worklet `clock-processor`.** Il poste `currentTime` (horloge
audio) depuis le thread audio, jamais gelé hors focus (cf.
[archive/postmortem-echelle-L1.md](archive/postmortem-echelle-L1.md)). C'est lui — et **pas**
`requestAnimationFrame` — qui fournit le `realDt` qui fait avancer la boucle. rAF ne sert plus
qu'au **rendu visuel interpolé**, qui a le droit d'être gelé hors focus (c'est voulu).

```
# Compteur de tick = TEMPS LOGIQUE (déterministe, pilote la simulation)
on worklet message (audioTime):
    realDt = audioTime - lastAudioTime          # temps réel écoulé
    accumulator += min(realDt, MAX_CATCHUP)     # borne anti-spirale au retour d'onglet
    while (accumulator >= FIXED_DT):            # FIXED_DT ≈ 1/60 s
        tickIndex++
        ctx.input.drainCommands(world)          # appliquer les intents UI
        for sys of SYSTEMS: sys(ctx, FIXED_DT)  # ordre explicite, codé en dur
        accumulator -= FIXED_DT

# Rendu (rAF, droit d'être gelé hors focus) :
alpha = accumulator / FIXED_DT
ctx.render.draw(world, alpha)          # interpolation visuelle
# Le seul système qui lit currentTime : AudioSyncSystem planifie les grains
# à t = currentTime + lookahead. Le TEMPS AUDIO ne franchit jamais cette frontière.
```

Deux horloges, deux rôles, qui ne se croisent jamais (voir §7) :

| | **Temps logique (tick)** | **Temps audio (`currentTime`)** |
|---|---|---|
| Rôle | pilote la simulation | planifie le rendu sonore (`start(t)`) |
| Déterministe ? | oui | non (présentation) |
| Lu par | tous les systèmes de simu | **uniquement** `AudioSyncSystem` / backend |

Décisions :
- **Pas fixe** pour découpler la simulation du framerate (un orage ne tombe pas deux fois plus
  vite à 120 Hz, ni en rafale au retour d'onglet) et pour des **tests reproductibles** (PRNG seedé).
- Le **chemin de voix HRTF reste sur le thread principal** ; seules les cadences/synthèses
  vivent dans des worklets. Inchangé par le refactor.

### 2.1 Bootstrap & cycle de vie

Trois contraintes dures encadrent le démarrage (toutes vérifiées sur le v0,
[`RainSampler.init`](../ds/ui_kits/diorama/RainSampler.js)) :

1. **Le geste utilisateur est incontournable.** Un `AudioContext` naît `suspended` (autoplay
   policy) ; tant qu'il n'est pas `resume()`, le `process()` du worklet ne tourne pas → aucun
   tick → **la boucle n'avance pas**. Le maître d'horloge est donc muet avant le premier clic,
   par construction.
2. **La couche `platform` possède l'`AudioContext`.** C'est le seul singleton rare qui exige le
   geste. Elle le crée et l'injecte à la fois dans la `ClockSource` et dans le
   `SpatialAudioBackend`. Le cœur ne dépend ni de l'un ni de l'autre directement : il ne connaît
   qu'une interface `ClockSource`. On évite ainsi que le cœur dépende du backend audio pour son
   horloge (ce qui violerait §9.3).
3. **« Un seul maître d'horloge » = une seule `ClockSource` active**, choisie au runtime — pas
   deux horloges concurrentes. Le fallback rAF du v0 (`clockDriven=false`) cesse d'être une
   entorse : il devient une *implémentation alternative* de la même couture.

```ts
// platform/ — hors cœur, hors audio. La platform crée l'AudioContext (au geste).
interface ClockSource {
  onTick(cb: (realDt: number) => void): void   // realDt en secondes
  start(): Promise<void>                         // resume() du contexte
  stop(): void
}
// Impl primaire : WorkletClock (réutilise clock-processor tel quel)
// Impl repli    : RafClock (dégradé : worklet absent)
// Impl test     : ManualClock (tick(dt) piloté à la main → 5 garde-fous sans AudioContext)
```

**Machine à états explicite**, exposée dans le snapshot (`ready` devient un enum) :

```
constructed → loading → armed → running ⇄ suspended → disposed
              (assets)   (geste attendu)   (resume/suspend)
```

| Phase | Quoi | Geste ? | Audio |
|---|---|---|---|
| `loading` | `addModule` ×3 + fetch banques (marche sur ctx suspendu) | non | — |
| `armed` | World construit, systèmes prêts, **boucle à l'arrêt** | — | silence |
| `running` | `resume()` → ticks worklet → la boucle avance | **1er clic** | son |
| `suspended` | `_lastTick=null` au retour ; accumulator borné par `MAX_CATCHUP` (§2) | — | gelé |

Conséquences actées (14 juin 2026) :
- **L'init n'est plus monolithique** : `loading` (async, pré-geste) est séparé de `start`
  (post-geste). Fin de l'`init()` unique du v0.
- **Pendant `armed`, rien ne simule** : pas de son possible ⟹ pas de boucle. L'UI affiche un
  HUD « cliquez pour démarrer ». Choix assumé pour une app sonore (pas d'aperçu visuel muet).
- **Le cœur tourne en test headless** via `ManualClock`, sans `AudioContext` — c'est ce qui rend
  les 5 garde-fous exécutables sans audio réel.
- **Suspend/resume** : le reset `_lastTick=null` + la borne anti-spirale deviennent un **contrat
  du lifecycle**, pas un détail enfoui dans le tick.

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
| `RainPoissonSystem` | `RainEmitter`, `WorldQuery`, PRNG | **pousse** `frame.impacts` | `tickPoisson` |
| `VoicePoolSystem` | `frame.impacts`, `Voice`, cooldown (Resource) | `Voice` (busy/prio/steal), **pousse** `frame.demotions` | `VoicePool` |
| `LodRoutingSystem` | `frame.impacts`, distance tête | L1 (voix) vs L2/L3 (secteurs) | `LodController`/routage L1 |
| `DiffuseBedSystem` | météo | nappe L3 | `DiffuseBed` |
| `WindSystem` | `Wind` | inclinaison pluie, anim | state vent |
| `RenderSyncSystem` | `Transform`, terrain | scène three.js | `WireframeCube` |
| `AudioSyncSystem` | `Voice`, `Listener`, `currentTime` | `SpatialAudioBackend` | `RainSampler` ↔ Resonance |

> Les canaux `frame.*` (impacts, démotions…) sont des **tampons de frame** vidés à chaque tick,
> pas des composants ni des entités. Mécanique détaillée en §3.4.

### 3.4 Événements & communication inter-systèmes

Miniplex n'a **ni bus d'événements ni resources** : on doit fournir nous-mêmes le canal par
lequel un système en informe un autre. La v0 ne tranche pas la question — elle l'évite : son
[`tickPoisson`](../ds/ui_kits/diorama/RainSampler.js) est un **pipeline synchrone mono-tick** où
chaque impact tiré est passé *immédiatement* à `trigger()`, qui le route vers une voix L1 ou vers
`sectors.absorberImpact()` (L2/L3). **L'impact ne survit jamais au tick qui le produit.** C'est
cette réalité — événement éphémère, à très haut volume — qui dicte le mécanisme.

#### Règle de tri : durée de vie × volume

On choisit le mécanisme selon **combien de temps vit** l'événement et **à quel volume** il arrive :

| | **Tampon de frame (Resource)** | **Entité transitoire (TTL)** |
|---|---|---|
| Durée de vie | **un seul tick** (produit & consommé dans le même tick) | **plusieurs ticks** |
| Volume | élevé (centaines–milliers/s) | modéré |
| Mécanisme | tableau ordonné dans `EngineContext` (`ctx.frame.*`) | `world.add(...)` + composant `Ttl`, despawn à expiration |
| Exemples | **impacts de pluie**, démotions de voix | éclaboussure visible, ride sur l'eau, alerte faune |

#### Pourquoi les impacts ne sont **pas** des entités

L'instinct « tout est entité » spawnerait une entité `{ impact }` par grain. **À proscrire sur le
chemin chaud** : à plein régime le Poisson tire des milliers de grains/s ; spawn/remove d'entités
à ce rythme = réindexation d'archétypes + churn GC à chaque tick → c'est précisément ce qui ruine
le 60 fps mobile visé. On réserve l'entité transitoire aux événements **multi-ticks et de volume
modéré**.

#### Le tampon de frame

Un objet de canaux dans l'`EngineContext`, **vidé par la boucle en début de tick** :

```ts
type Impact = { surface: MaterialId; pos: Vector3; detune: number; sample: SampleRef }

interface FrameEvents {
  impacts: Impact[]        // RainPoissonSystem pousse → VoicePool/LodRouting drainent
  demotions: Demotion[]    // VoicePoolSystem pousse → AudioSync applique le fade-out
  // … autres canaux mono-tick au besoin
}
// EngineContext expose : ctx.frame: FrameEvents

// Dans la boucle (§2), AVANT d'exécuter les systèmes du tick :
for (const k in ctx.frame) ctx.frame[k].length = 0
// puis l'ordre explicite des systèmes garantit producteur-avant-consommateur :
//   RainPoissonSystem (pousse impacts) → VoicePoolSystem → LodRoutingSystem (drainent)
```

Propriétés :
- **Colle à la réalité v0** (pipeline synchrone mono-tick) — pas de sur-conception.
- **Zéro churn d'entités** sur le chemin chaud.
- **Déterministe gratuitement** : ordre du tableau = ordre de production (PRNG seedé, §7) = ordre
  de consommation. L'ordre explicite des systèmes (§3.1) garantit que le producteur tourne avant
  le consommateur dans le même tick.

#### Ce qui n'est PAS un événement (ne va pas dans le tampon)

Le code v0 mêle au flux éphémère des **états persistants** qui doivent vivre ailleurs :

- **Le tampon dans `ctx` viole-t-il « aucun état caché » (§9) ?** Non. Le §9 interdit l'état
  *dans les systèmes*. Le tampon vit dans `EngineContext` (une Resource), vidé explicitement par
  la boucle : état traçable, pas caché. C'est sa place correcte.
- **Cooldown par cellule** ([`_cellCooldown`](../ds/ui_kits/diorama/RainSampler.js), Map persistante)
  → une **Resource** dans `ctx`, pas un événement : il dure entre les ticks.
- **État des voix** (pool, busy, priorité) → des **composants** `Voice` sur des entités
  persistantes, pas un canal.

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
`refDistance`/`maxDistance`/`rolloff` ← `materials`).

**Le swap se fait en DEUX TEMPS** (acté 14 juin 2026) :

1. **Temps 1 — le Grand Refactor garde Resonance** derrière l'interface (`ResonanceBackend`). But :
   restructurer (ECS, hors-React, boucle fixe) **à son identique** — les garde-fous redeviennent
   verts *avec le même son qu'avant*, ce qui **prouve que la restructuration n'a rien cassé**.
2. **Temps 2 — swap `ResonanceBackend` → `WebAudioBackend`**, étape séparée. Seule variable qui
   bouge : le rendu sonore ⟹ toute différence est imputable au renderer, pas au refactor.

Pourquoi ce découpage (l'enjeu) : ce n'est **pas un renommage de méthodes** mais un **transfert de
responsabilité**. Resonance est un moteur de *scène* (ambisonie ordre 3) qui offre gratuitement la
**pièce** : directivité, atténuation, **réflexions et réverb** depuis `dimensions` + `materials`.
Le `PannerNode` ne donne que **direction + distance** (HRTF par source) ; la réverb/occlusion sont
à **reconstruire explicitement** (ConvolverNode ← `enclosedVolume()`, passe-bas sur le send). On
échange « confort + dette + opacité » (Resonance est un projet Google **mort**, coûteux en CPU vs
cible 60 fps mobile) contre « contrôle + légèreté », nécessaire au monde vivant.

> ⚠️ **Conséquence pour les garde-fous** : les HRTF de Resonance et du `PannerNode` natif diffèrent
> ⟹ le binaural **change audiblement**. Les garde-fous doivent donc affirmer des **propriétés
> invariantes** (plus proche = plus fort ; source à gauche = oreille gauche ; ordre des 6 faces)
> et **jamais** un dB/PCM exact (cf. §7 : « valident le comportement, pas l'échantillon »). Un
> garde-fou qui compare un niveau exact casserait au temps 2 sans régression réelle.

### 4.3 `RenderTarget` — frontière rendu
Le moteur ne connaît pas three.js ; il pousse des snapshots à un `RenderTarget`. Impl.
`ThreeRenderer` (wireframe v1, low-poly post-v1). Découple aussi pour d'éventuels tests headless.

### 4.4 `SaveStore` — persistance (déjà conçue)
`save.ts` (format versionné + migrations) reste la couture données. Adaptateur IndexedDB.

---

## 5. Découplage moteur ↔ React

React ne tient **plus** l'état du monde ni la boucle (fin du god-component `DioramaApp`).

- **Sens UI → moteur** : **deux canaux** selon la nature de l'entrée (détail §5.2). Pas de
  mutation directe du World depuis React.
- **Sens moteur → UI** : le moteur expose des **snapshots** lisibles (sélecteurs) ; React
  s'abonne (store externe type `useSyncExternalStore`) pour afficher HUD/debug. Lecture seule.
- **Conséquence** : l'UI peut être réécrite/retirée sans toucher au jeu ; le moteur tourne en
  test headless.

### 5.1 Le snapshot moteur → UI (inventaire YAGNI)

Le pont de lecture est le point sensible : le moteur **mute ses entités en place** à chaque tick
(zéro alloc, §3.4), or React ne détecte un changement que par **nouvelle référence**. Le snapshot
est la couture qui réconcilie les deux sans que l'un saccage les contraintes de l'autre.

Inventaire de **ce que l'UI lit réellement** aujourd'hui (DebugHUD via `samplerRef`, boucle rAF
~30 Hz), filtré YAGNI — seulement l'affiché, pas le « au cas où » :

| Donnée | Source v0 | Forme | Volume |
|---|---|---|---|
| `ready` (moteur démarré) | `sampler.ready` | booléen | trivial |
| `master` (dB post-atténuation) | `getMasterLevel()` | scalaire | trivial |
| `pool` (busy / size / steals) | `poolStats()` | 3 entiers | trivial |
| `materials[]` (label, level dB, rate/s, triggerCount) | `materialMeters()` | ~6 lignes | bas |
| `faceLevels[6]` (niveaux directionnels de la tête) | **projeté côté moteur** | 6 scalaires | bas |

```ts
interface EngineSnapshot {
  ready: boolean
  master: number                                          // dB
  pool: { busy: number; size: number; steals: number }
  materials: { id; label; level; rate; triggerCount }[]   // ~6
  faceLevels: [number, number, number, number, number, number]
}
```

Deux arbitrages actés (14 juin 2026) :

1. **La projection des 6 faces se fait côté moteur**, pas dans React. En v0, le DebugHUD reçoit les
   positions brutes des voix (jusqu'à 14–64 objets `{x,y,z,level}` à ~30 Hz) et recalcule lui-même
   le produit scalaire `dir·n` par face. Au refactor, un **système dédié** fait cette projection et
   le snapshot ne porte que `faceLevels[6]`. Gain : volume du snapshot divisé par ~10, **aucun
   tableau proportionnel au nombre de voix**, et zéro calcul moteur-spécifique dans l'UI.
2. **Les VU-mètres de l'app se branchent sur le vrai `master`.** En v0 ils sont du `Math.random()`
   décoratif (ne lisent rien du moteur) — ils consomment désormais `snapshot.master`.

Exclus du snapshot (YAGNI) : positions brutes des voix (remplacées par #1), VU-mètres aléatoires
(remplacés par #2), tout le bloc TraceRecorder — `recording`/`traceCount`/boutons Rec/Export — déjà
supprimé (§7). État purement UI (caméra `spin`/`zoom`, horloge murale `new Date()`) reste dans React.

**Conséquence pour le mécanisme** : le snapshot est **petit et borné** (≈ 5 scalaires + ~6
matériaux + 6 faces). À ce volume, même une cadence réduite (~10 Hz, découplée des 60 Hz du moteur)
rend le coût d'allocation négligeable — le choix de mécanisme (clone vs buffer+version vs
`useSyncExternalStore`) en devient quasi libre. À trancher au chantier UI.

### 5.2 Le canal UI → moteur (intents) — **deux canaux** (acté 14 juin 2026)

En v0, React tient `DioramaState` ([state.ts](../ds/ui_kits/diorama/state.ts)) et des `useEffect`
diffent des tranches pour appeler des setters impératifs (`setRainParams`, `setListenerPosition`,
`setWeather`, `setScale`…). En triant ces entrées par **nature** (pas par nom), deux sémantiques
de file irréconciliables apparaissent — d'où **deux canaux** plutôt qu'une file unique :

| Famille | Exemples v0 | Sémantique | Canal |
|---|---|---|---|
| **Contrôles continus** | listener `x/y/z`, `density`, `gain`, `wind*` | seule la **dernière valeur** compte | **B — état de contrôle** |
| **Bascules** | `rain`, `metal`, `bache`, `listening` | dernière valeur | **B — état de contrôle** |
| **Actions** | paint, save, load, `setScale` (rebuild monde), reset | **chaque occurrence** compte | **A — file de commandes** |
| **Purement UI** | `spin`, `zoom` (caméra), `clockSegment`, `debug` | ne **traversent jamais** (§6) | — reste dans React |

```ts
// Canal A — file de commandes (actions discrètes). Drainée ET vidée à chaque tick,
// ordre = ordre d'arrivée → déterministe (§7).
type Command =
  | { t: 'paint'; cell: number; mat: MaterialId }
  | { t: 'save'; name: string }
  | { t: 'setScale'; cfg: WorldConfig }
  // … reset, load, spawn…

// Canal B — état de contrôle double-bufferé (continus + bascules). L'UI ÉCRASE,
// l'InputSystem LIT (poll) chaque tick. Pas de file → coalescing inutile.
interface ControlState {
  listener: { x: number; y: number; z: number }   // normalisé [-1,+1]
  density: number; gain: number
  wind: { force: number; rot: number; tilt: number }
  rain: boolean; metal: boolean; bache: boolean; listening: boolean
}

// EngineContext expose : ctx.input.commands (drain+clear) · ctx.input.controls (latest)
```

Pourquoi deux canaux et pas une union discriminée unique : avec une file unique, l'`InputSystem`
devrait encoder à la main, **par type**, la règle « last-wins » (continus) vs « append » (actions).
Le canal B fait disparaître ce pliage *par construction* — un contrôle continu est toujours sa
dernière valeur.

Deux principes tenus quel que soit le canal :
- **Le moteur est l'autorité** : l'UI envoie l'intent brut ; le moteur **clampe/valide** (comme
  les setters v0 clampent déjà l'intensité). L'UI ne pré-mute jamais le World.
- **Les types d'intent vivent dans un module data partagé** (comme `state.ts`), importable par
  l'UI *et* le moteur — donnée pure, le moteur n'importe pas React.

> L'`InputSystem` (§3.3) tourne **en premier** dans l'ordre des systèmes : il applique `controls`
> sur les composants ciblés et exécute les `commands`, avant que les systèmes de simu ne tournent.

---

## 6. Rendu — three.js impératif

Abandon de React Three Fiber. Le `ThreeRenderer` possède sa `Scene`/`Camera`/`Renderer`,
créés une fois, mis à jour par `RenderSyncSystem` à partir des `Transform`/terrain. Caméra
orbitale (spin/zoom) **n'affecte pas l'écoute** (invariant v0 conservé). Meshes de relief mis
en cache (corrige la dette §10.6 de [archive/reconnaissance-v0.md](archive/reconnaissance-v0.md)).

---

## 7. Déterminisme (sans replay)

Pas de rejeu interactif : **`ReplayEngine` et `TraceRecorder`/`TraceSystem` sont supprimés**
(décision du 14 juin 2026). On ne promet pas « rejouer une session » — seulement une
**simulation reproductible en test** et **indépendante du framerate**. Ce qui survit :

- **PRNG seedé** unique en `Resource`, jamais de `Math.random` dans les systèmes ; avancé dans
  un ordre figé. Même seed + même état ⟹ mêmes impacts, mêmes voix, même routage L1/L2/L3.
- **Pas fixe** (§2) : la simulation avance par ticks logiques entiers, pas au gré du `realDt`.
- **Règle de séparation des horloges** : un système de simulation **ne lit jamais `currentTime`**.
  Le temps audio (présentation, non déterministe) ne franchit jamais la frontière vers le cœur ;
  seul `AudioSyncSystem` le lit, pour planifier les grains. C'est ce qui garde le cœur testable.
- **L'audio est un consommateur aval, hors périmètre déterministe.** On garantit *quelles voix
  sonnent à quel tick*, jamais un rendu PCM bit-identique (impossible et inutile avec Web Audio —
  les 5 tests garde-fous valident le comportement, pas l'échantillon).

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
└── platform/           detectPlatform, input, AudioContext owner, ClockSource (Worklet/Raf/Manual)
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
4. **Un seul maître d'horloge** (worklet `clock-processor` → `realDt`) ; un seul PRNG seedé. La
   simulation tourne en **temps logique** (ticks) ; **aucun système de simu ne lit `currentTime`**
   — seul `AudioSyncSystem` touche le temps audio (§2, §7).
5. **Événement éphémère (mono-tick, haut volume) = tampon de frame** (`ctx.frame.*`, vidé chaque
   tick) ; **état persistant = composant ou Resource**. Jamais d'entité par impact (§3.4).
6. **Les saves ne meurent jamais** : tout changement de schéma = migration pure.
7. **Les 5 tests garde-fous restent le contrat** de non-régression du son validé.
```
