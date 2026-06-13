# Phase 4 — Threads, budgets & durcissement

> **Position** : dernière phase. Honore la **séparation des threads** (I6), les **budgets plateforme** (I2), le **replay complet** (§14) et les optimisations finales.
> **Réf. spec** : §9 (Orchestration & threads), §12 (Budgets), §14 (Replay déterministe), §12.3 (leviers d'optimisation).
> **Pré-requis** : Phases 0-3 livrées — moteur fonctionnel 3 couches + LOD ; tout l'aléa est seedé (Phase 0).

---

## 1. Objectif

Le moteur **sonne** déjà juste (Phases 0-3). La Phase 4 le rend **robuste et rejouable** :

1. **Séparer game thread / audio thread** par ring buffer non bloquant (I6).
2. **Profils plateforme** : mobile / desktop / VR (voix, secteurs, ordre, sample rate).
3. **Optimisations** : culling par attention, coupe des grains négligeables, pré-mixage.
4. **Replay déterministe** complet : modes A (re-trigger) et B (re-simulation).

---

## 2. Séparation des threads (§9)

```mermaid
sequenceDiagram
  participant GT as Game thread<br/>(décision)
  participant RB as Ring buffer<br/>(SPSC, non bloquant)
  participant AT as Audio thread<br/>(worklets + Resonance)
  participant OUT as Sortie binaurale

  GT->>GT: météo → λ(t) ; Poisson (PRNG) ; sélection ; LOD
  GT->>RB: ordres (playImpact / setSector / setBed / setListener)
  RB->>AT: consommation non bloquante (par bloc audio)
  AT->>AT: granulateurs, sources HRTF, nappe
  AT->>OUT: mix + décodage binaural
  AT-->>GT: compteurs (busy, steals, niveaux) pour LOD/budget
```

### 2.1 Protocole de messages (ring buffer SPSC)

```
# Anneau pré-alloué (SharedArrayBuffer si dispo, sinon postMessage par lot).
# Un producteur (game thread), un consommateur (audio thread) → sans verrou.
Ordre {
  type:  PLAY_IMPACT | SET_SECTOR | SET_BED | SET_LISTENER | SET_SCALE,
  at:    secondes,              # horodatage audio cible (ordonnancement précis)
  args:  …                      # selon type (sérialisés en champs numériques)
}

# Retour audio→game : compteurs agrégés (pas par voix), lus à ~30 Hz.
Compteurs { busy, steals, niveauMaster, sectorsActive }
```

```
# Game thread — produit, ne bloque jamais.
postOrdre(o):  si ring.plein(): tracer('reject', raison:'ring-full'); sinon ring.push(o)

# Audio thread — consomme tout ce qui est dû pour le bloc courant.
onAudioBlock():
    tant que ring.tête.at ≤ tBlocFin: appliquer(ring.pop())
    rendre()                     # worklets + Resonance
    publierCompteurs()
```

> **Note PWA** (§9) : l'audio thread = `AudioWorkletProcessor` (Couches 2/3) + pipeline Resonance (Couche 1) ; le game thread = boucle applicative (`requestAnimationFrame`/worker). Aucun calcul lourd ne bloque le rendu audio.

---

## 3. Profils plateforme (§12.2)

```
# Résolus à l'init, dérivés de la plateforme détectée (ou choisis en UI debug).
PlatformPreset {
  voicesL1, sectorsL2, ambisonicOrder, sampleRate
}
PRESETS = {
  mobile:  { voicesL1: 12-16, sectorsL2: 4,    order: 1,   sampleRate: 48k },
  desktop: { voicesL1: 32-48, sectorsL2: 8,    order: 1-2, sampleRate: 48k },
  vr:      { voicesL1: 48+,   sectorsL2: 8-12, order: 2-3, sampleRate: 48-96k },
}
```

Le pool fixe `48` et l'ordre `3` codés en dur aujourd'hui (`RainSampler.js:7,13`) deviennent des **dérivés** : `POOL_SIZE ← preset.voicesL1`, `AMBISONIC_ORDER ← preset.order`. `SectorField.N` recoupe `preset.sectorsL2` ∩ échelle (§16.2).

---

## 4. Optimisations (§12.3)

### 4.1 Coupe des grains négligeables

```
# Une voix dont le grain est passé sous le seuil audible est libérée tôt.
traceSample / boucle voix:
    db ← pool.level(v)
    si db < material.seuilWeakDb:
        rec?.emit('env', { …, db, weak: true })     # flag posé en Phase 0
        pool.couperAvecFondu(v, 5ms); pool._release(v)   # rend la voix au budget
```

### 4.2 Culling par attention (§5.3)

`attention` (déjà dans la formule de priorité, Phase 0) abaisse la priorité des sources hors champ de vision/focus ⇒ elles sont volées en premier sous pression. Concentre le budget là où l'oreille écoute.

### 4.3 Pré-mixage des textures denses (§7)

Les nappes/secteurs très denses peuvent être **bakés** hors temps réel et relus comme soundfield (coût constant) plutôt que synthétisés en direct — bascule transparente derrière l'interface `DiffuseBed`/`SectorField`.

---

## 5. Replay déterministe complet (§14)

```mermaid
sequenceDiagram
  participant F as Trace NDJSON
  participant R as ReplayEngine
  participant E as Moteur audio (mêmes banques)
  participant O as Sortie

  F->>R: header (seed, version moteur, banques)
  alt Mode B — Re-simulation
    F->>R: timeline state / scale / weather
    R->>R: PRNG(seed) → Poisson + sélection + LOD
  else Mode A — Re-trigger
    F->>R: events trigger / sector / bed
  end
  R->>E: ordres horodatés (t, at)
  E->>O: rendu binaural
```

| Mode | Entrée | Reconstruit | Usage |
|------|--------|-------------|-------|
| **A — Re-trigger** | `trigger`/`sector`/`bed` de la trace | rejoue les ordres tels quels | rejeu fidèle même sans la graine |
| **B — Re-simulation** | `header.seed` + timeline `state`/`scale`/`weather` | re-déroule Poisson + sélection + LOD à l'identique | tester une variante du moteur sur la même entrée |

```
# ReplayEngine — mode A : rejoue les ordres horodatés.
replayA(trace, engine):
    pour e dans trace où e.type ∈ {trigger, sector, bed}:
        planifier(engine, e, à e.at)        # même graphe Web Audio qu'en live

# Mode B : re-simule depuis la graine et la timeline d'état.
replayB(trace, engine):
    prng ← PRNG(trace.header.seed)
    rejouer state/scale/weather comme entrée du game thread
    laisser le moteur re-tirer Poisson/sélection/LOD avec prng
    # Toute divergence d'événements vs live = régression à investiguer (§14.5)
```

**Ce que la trace doit capturer** (déjà posé Phases 0-3, à vérifier) : `seed` + version moteur (`header`), timeline d'état complète en deltas (`state`/`scale`/`weather`), paramètres reproductibles par grain (`sample`/`detune`/`gainDb` dans `trigger`), banques référencées par id/version.

---

## 6. Schéma d'événement de trace

| `type` | Émis quand | Champs |
|--------|------------|--------|
| `budget` | pression/ajustement budget (~1 Hz) | `busyL1`, `sizeL1`, `steals`, `sectorsActive`, `r1Adj` |

(les autres événements de cette phase — `env.weak`, `lod reason:no-budget` — ont été posés en Phases 0/3 ; la Phase 4 les rend **actionnables**.)

```
# Voix gaspillées par des grains négligeables (doit chuter après §4.1)
jq 'select(.type=="env" and .weak==true)' trace.ndjson | wc -l
```

---

## 7. Étapes ordonnées

1. **`ringBuffer.js`** — SPSC pré-alloué (SharedArrayBuffer + fallback), protocole d'ordres.
2. **Bascule décision→message** : `RainSampler`/`RainManager` produit des ordres ; l'audio thread consomme.
3. **Compteurs audio→game** pour LOD/budget (remplace la lecture directe des analysers cross-thread).
4. **Profils plateforme** : `POOL_SIZE`/`AMBISONIC_ORDER`/`N` dérivés du preset détecté.
5. **Coupe des grains faibles** (`seuilWeakDb`) + **culling attention** activés.
6. **`ReplayEngine.js`** — modes A et B ; UI debug pour charger une trace et la rejouer.
7. **`budget`** émis à ~1 Hz.

---

## 8. Critères de test (Definition of Done)

- [ ] Aucun **underrun** worklet sous charge max (le rendu audio ne bloque jamais sur le game thread). *(I6)*
- [ ] **Mode B identique** : re-simulation depuis `seed` + timeline ⇒ flux d'événements *identique* au live (toute divergence = régression, §14.5).
- [ ] **Mode A fidèle** : re-trigger d'une trace ⇒ même rendu perceptuel sans la graine.
- [ ] **Profils effectifs** : mobile = 12-16 voix / ordre 1 / 4 secteurs ; VR = 48+ / ordre 2-3.
- [ ] **Grains faibles coupés** : `env.weak==true` ⇒ voix réellement libérée (le compteur chute, `busy` baisse à densité égale).
- [ ] Boîte noire toujours verte de bout en bout (M2) ; replay reproductible (M3).

---

## 9. Risques spécifiques

| Risque | Mitigation |
|--------|------------|
| **`SharedArrayBuffer` indisponible** (en-têtes COOP/COEP) | Fallback `postMessage` par lot ; tracer le mode de transport |
| **Divergence live↔replay** (ordre de tirage PRNG) | Discipline stricte : un seul ordre de consommation du PRNG, figé ; `prng.fork()` documenté par sous-système |
| **Coût de la coupe** (analyse RMS par voix) | Réutiliser les analysers existants ; ne couper que sous seuil franc |
| **Latence ordre→rendu** (ring buffer) | Horodatage `at` des ordres + petite avance de planification |
| **Régression de détermin­isme** introduite par une optim | Test « même seed ⇒ même trace » en garde de non-régression à chaque commit |
