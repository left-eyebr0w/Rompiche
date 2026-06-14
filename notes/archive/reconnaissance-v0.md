# État du projet Rompiche v0 — Synthèse d'exploration

**Date** : 13 juin 2026  
**Scope** : Reconnaissance en lecture seule de l'architecture v0  
**Focus** : Représentation des données du monde et couplage audio/rendu

---

## 1. Vue d'ensemble de l'arborescence

### Structure du projet

```
ds/ui_kits/diorama/
├── DioramaApp.jsx           [Point d'entrée React] État mondial centralisé
├── WireframeCube.jsx        [Rendu visuel] R3F/three.js, wireframe monochrome
├── ControlHUD.jsx           [UI contrôles] Toggles, sliders (x,y,z), densité
├── DebugHUD.jsx             [Debug visuel] Overlay voix, niveaux, traçage
├── RainSampler.js           [Audio] Moteur sonore spatialisé, pool de voix
├── Terrain.js               [Données terrain] Grilles fines (matériau) et blocs (relief)
├── materials.js             [Registre matériaux] 3 matériaux (metal, bache, terre)
├── objects.js               [Couche props] Objets discrets (chemin vide par défaut)
├── worldConfig.js           [Config statique] Presets & plateforme
├── coords.js                [Repère unique] Source de vérité pour monde & audio
├── BakedSet.js              [Impact bakés] Points de frappe précalculés
├── DiffuseBed.js            [Couche 3] Nappe diffuse lointaine
├── SectorField.js           [Couche 2] Champ de secteurs (futures voix lointaines)
├── LodController.js         [LOD] Gestion distances & promotions/démotions
├── TraceRecorder.js         [Traçage causal] Enregistrement ‹ boîte noire ›
├── RainSampler.js           [Émis de pluie] Processus Poisson, sélection samples
├── ReplayEngine.js          [Replay] Rejoue traces (phase future)
├── ringBuffer.js            [Audio→game] SPSC ring buffer
├── prng.js                  [PRNG seedé] Aléa déterministe
├── lod.js                   [LOD params] Calcul des seuils de réduction
├── samples/                 [Banques audio] metal/, bache/, terre/ (globs .wav)
└── worklets/                [Audio worklets] noise-processor, granulator-processor
    ├── noise-processor.js   [Synthèse bruit] Rose/brown, couleur configurée
    └── granulator-processor.js [Futur granulation] Préparé, non utilisé v0

docs/
├── etat-v0.md              [Ce fichier] Synthèse reconnaissance
├── migration/              Phases de refactoring (PHASE-0 à PHASE-4)
└── ...

package.json                [Dépendances] react, react-dom, three, r3f, resonance-audio, vite
```

---

## 2. Modèle de données du monde

### 2.1 État global centralisé (React)

**Localisation** : [DioramaApp.jsx:51-61](ds/ui_kits/diorama/DioramaApp.jsx#L51-L61)

L'état du monde est un **objet React unique**, contenant :

```javascript
{
  // Météo
  rain: boolean,              // Pluie active ?
  wind: boolean, windTilt: 0-1, windRotation: 0-360, windForce: 0-1,
  
  // Surfaces (toggles UI)
  metal: boolean,             // Surface métal active ?
  bache: boolean,             // Surface bâche active ?
  
  // Auditeur (position dans l'espace normalisé [−1, +1])
  x: -1..1, y: -1..1, z: -1..1,
  
  // Pluie (paramétrages)
  density: 0-1,               // Densité des grains
  gain: -60..0,               // Gain maître audio (dB)
  
  // Moteur
  listening: boolean,         // Écoute active ?
  recording: boolean,         // Enregistrement trace ? (dérivé)
  
  // Contrôles visuels
  spin: degrees,              // Orbite caméra autour du monde
  zoom: 0.4-2.5,              // Zoom caméra
  
  // Config système
  preset: 'diorama'|'room'|'courtyard'|'field', // Taille du monde
  seed: number,               // Graine déterministe (PRNG)
  platform: 'mobile'|'desktop'|'vr',             // Profil audio
  
  // Horloge
  clockMode: 'sync'|'manual',
  clockSegment: 'aube'|'jour'|'crépuscule'|'nuit',
  
  // Debug
  debug: boolean,             // Affiche DebugHUD ?
}
```

**Mutation** : Via `set(patch)` — setState classique React, synchrone.

**Dérivation** : 
- `worldCfg = useMemo(..., [preset, seed, platform])` — rerecalculé si preset/seed/platform changent
- `terrain = useMemo(..., [worldCfg.size])` — rerecalculé si taille change
- `objects = useMemo(makeDefaultObjects, [])` — vide par défaut

### 2.2 Terrain : représentation des surfaces

**Localisation** : [Terrain.js](ds/ui_kits/diorama/Terrain.js)

Le terrain est une **classe immuable qui porte deux grilles Uint8Array sérialisables** :

```javascript
class Terrain {
  // Grille fine (résolution 0.5 m) — le matériau visible de la pluie
  material: Uint8Array       // [cols × rows] → indice MATERIAL_INDEX
  
  // Grille blocs (résolution 1 m) — le relief/hauteur
  height: Uint8Array        // [bcols × brows] → hauteur en blocs (converti en mètres)
  
  // Métadonnées
  size, cell=0.5, block=1
  cols, rows, bcols, brows
}
```

**Initialisation par défaut** : [Terrain.js:70-84](ds/ui_kits/diorama/Terrain.js#L70-L84)

```javascript
terrain.fill((cx, cz) => (cx < 0 ? 'metal' : 'bache'))
// → Division moitié gauche/droite : 50% metal, 50% bache
// → AUCUNE cellule 'terre' dans le terrain de base

// Relief test : bloc de 2 m surélevé au quadrant (x<0, z<0)
```

**Accès** : `terrain.cellAt(x, z)` → `{ material: {id, label, ...}, height: meters }`  
Query O(1) via quantification sur la grille fine.

**Sérialisation** : Les deux Uint8Array sont **sérialisables tels quels** — structure plate, pas de références.

### 2.3 WorldConfig : présélections & résolution d'échelle

**Localisation** : [worldConfig.js](ds/ui_kits/diorama/worldConfig.js)

Contient **trois strates de configuration** :

1. **PRESETS** (monde) — tailles + résolution audio
   ```javascript
   { diorama: {size: 4, L1rMax: 2.5, ...},
     room:    {size: 12, L1rMax: 4, ...},
     ... }
   ```

2. **PLATFORM_PRESETS** (appareil) — budget voix & secteurs
   ```javascript
   { mobile: {voicesL1: 14, sectorsL2: 4, ...},
     desktop: {voicesL1: 40, sectorsL2: 8, ...},
     vr: {voicesL1: 64, sectorsL2: 12, ...} }
   ```

3. **COMMON** — paramètres partagés (priorité L1, seuils, filtres L3)

**Fonction clé** : `makeWorldConfig({preset, seed, platform})` → résout les couches (r1/r2/overlap) via `résoudreCouches()`.

**État à l'utilisation** :
- `worldCfg` reste **immuable** au runtime
- Dérivé React depuis `state.preset/seed/platform`
- Passé à `RainSampler` à l'init ; recalculé avec `setScale()` si preset/seed changent

### 2.4 Objects : couche props (prête mais vide)

**Localisation** : [objects.js](ds/ui_kits/diorama/objects.js)

Structure minimale :
```javascript
type WorldObject = {
  id: string,
  materialId: 'metal'|'bache'|'terre',  // Matériau obligatoire
  size: [w, h, d],                       // Dimensions monde
  position: [x, y, z],                   // Position monde
}
```

**État actuel** : `makeDefaultObjects()` retourne `[]` — aucun objet placé.

**Chemin de données** : Prêt pour un futur `Gamemaster` qui composera/placera les props.

### 2.5 Materials : registre central des matériaux

**Localisation** : [materials.js](ds/ui_kits/diorama/materials.js)

Trois matériaux déclarés :
```javascript
MATERIALS = [
  { id: 'metal', label: 'Métal', 
    urls: [...globs samples/metal],
    gain: 1, minDistance: 0.5, maxDistance: 8, 
    debugColor: 0xe8c96d },
  
  { id: 'bache', label: 'Bâche', 
    urls: [...], gain: 1, minDistance: 0.5, maxDistance: 8,
    debugColor: 0x7ec8e3 },
  
  { id: 'terre', label: 'Terre',
    urls: [...], gain: 1, minDistance: 0.5, maxDistance: 8,
    debugColor: 0x9ae87a },
]

MATERIAL_INDEX = { 'metal': 0, 'bache': 1, 'terre': 2 }  // ← indices Uint8Array
```

**Invariant** : Toute surface (cellule terrain, objet) **DOIT** porter un matériau connu.  
→ `requireMaterial(id)` lève si inconnu (point d'application du contrat en un seul lieu).

**Distances** (§13, not yet consumed) : minDistance/maxDistance en mètres, appliquées à la création de voix (Couche 1).

---

## 3. Couplage rendu / son / logique

### 3.1 Flux de données global

```
DioramaApp (state React)
    ├─→ WireframeCube (rendu visuel)
    │   ├─ WorldScene (cube + sol)
    │   ├─ Relief (blocs relief, visibilité = metal ∧ bache toggles)
    │   ├─ Objects (props vides)
    │   ├─ HeadCube (tête auditeur)
    │   └─ Rain (pluie shader, impact visuel seul)
    │
    └─→ RainSampler (moteur audio)
        ├─ init() → crée contexte audio, charge samples
        ├─ setTerrain() → bake tous points d'impact
        ├─ tickPoisson() → génère impacts Poisson par surface (météo)
        ├─ trigger() → joue grain spatialisé sur voix libre
        └─ VoicePool → 40 voix (desktop) spatialisées + analyser
```

### 3.2 Partage du repère : coords.js est la source unique

**Localisation** : [coords.js](ds/ui_kits/diorama/coords.js)

`makeCoords(size)` produit **UNE SEULE source de vérité** partagée par audio et visuel :

```javascript
{
  size: 4|12|30|80 (mètres monde),
  half: size/2,
  HC: Math.round(size × 0.26),   // Tête auditeur = 1 m (HC unités)
  limit: half − HC/2 − 10%,       // Course ±0.18 (diorama) ou ±... (autres presets)
  METER: HC,                       // Échelle métrique
  CELL: METER/2 = 0.5 m,         // Grille matériaux
  BLOCK: METER = 1 m,            // Grille relief
  ground: −half,                  // Plan sol en Y monde
  worldRadius: half,              // Rayon pour résoudreCouches()
}
```

**Repère partagé** :
- **Visuel** : WireframeCube utilise `limit` pour placer la tête, l'orbite caméra tourne mais la tête ne bouge pas (seules les sliders X/Y/Z la déplacent)
- **Audio** : RainSampler utilise même `limit` et conversion `headInputToWorld()` pour transformer les sliders en position monde, puis `worldToResonance()` (identité actuellement)

**Invariant** : Si audio et visuel divergent, **on ne change QUE worldToResonance()**.

### 3.3 Liaison auditeur : position sync

**Auditeur visuel** : [WireframeCube.jsx:196-237](ds/ui_kits/diorama/WireframeCube.jsx#L196-L237)
- Cube 1×1×1 + pulse quand `listening=true`
- Position monde : `[x*limit, y*limit, -z*limit]`
- Repère intact : +Y = haut, −Z = avant (convention Resonance)

**Auditeur audio** : [RainSampler.js:426-431](ds/ui_kits/diorama/RainSampler.js#L426-L431)
- Même conversion de sliders → monde → Resonance
- Orienté FIXE : avant = −Z monde, haut = +Y
- Orbiter la caméra (spin) n'affecte PAS l'écoute → le champ sonore reste stable

**Synchronisation** : [DioramaApp.jsx:136-138](ds/ui_kits/diorama/DioramaApp.jsx#L136-L138)
```javascript
React.useEffect(() => {
  samplerRef.current?.setListenerPosition(state.x, state.y, state.z)
}, [state.x, state.y, state.z])
```

---

## 4. Système sonore : sélection & spatialisation

### 4.1 Pool de voix (Couche 1)

**Localisation** : [RainSampler.js:40-193](ds/ui_kits/diorama/RainSampler.js#L40-L193)

```javascript
class Voice {
  src: ResonanceAudio.source,   // Objet spatialisé Resonance Audio
  analyser: AnalyserNode,       // Mesure RMS du grain
  pos: {x,y,z},                 // Position monde réelle
  materialId: 'metal'|'bache'|'terre',
  grainSrc: AudioBufferSource,
  grainGain: GainNode,
  busy: boolean,
  grainId, impactId, gainDb, dist,
}

class VoicePool {
  voices: Voice[],              // 14 (mobile) à 64 (VR), 40 (desktop)
  free: number[],               // Indices voix libres
  
  play(buffer, gainDb, detune, pos, material, now, trace, head, w, seuilWeakDb, r2)
    // Acquiert voix libre ou vote voix par priorité (gain, distance, attention, âge)
    // Connecte : source → analyser → src.input (Resonance)
    // Émet trace si recorder
}
```

**Priorité vol** : `w_gain × gainNorm + w_dist × (1−distNorm) + w_att × attention − w_age × âgeNorm`  
où `w_att` se désactive si pas de secteurs (diorama).

### 4.2 Génération d'impacts : Poisson threadé

**Localisation** : [RainSampler.js:436-496](ds/ui_kits/diorama/RainSampler.js#L436-L496)

Appelé à ~60 Hz (chaque frame) depuis [DioramaApp.jsx:245-265](ds/ui_kits/diorama/DioramaApp.jsx#L245-L265) :

```javascript
tickPoisson(dtMs, surfaceDensities, density)
  // surfaceDensities = {metal: 0|1, bache: 0|1, terre: 1}
  // density = 0..1 (multiplicateur global)
  
  for each material m:
    surfFactor = surfaceDensities[m.id] ?? 1
    if (surfFactor <= 0) continue  // ← CUT COMPLÈTEMENT
    
    exposed = points.filter(p.matériau === m.id && p.expoCiel).count
    λ = density × surfFactor × exposed × MAT_FACTOR[m] × 0.05
    
    // Intervalle Poisson : −ln(u) / λ
    while (accum >= nextInterval):
      point = pickImpact(baked, m, prng, head)  // Pondération gaussienne (σ=2.5m)
      trigger(m, {x, y, z, ...})
```

### 4.3 Sélection des surfaces : BakedSet

**Localisation** : [BakedSet.js:15-99](ds/ui_kits/diorama/BakedSet.js#L15-L99)

Points bakés = toutes cellules du terrain précalculées :

```javascript
function bakeImpactPoints(terrain, coords):
  points = []
  for each cell (cx, cz):
    { position: {x, y, z},
      normale: {0,1,0},
      matériau: terrain.cellAt(cx, cz).material.id,  // metal ou bache (pas terre par défaut)
      expoCiel: abrité ? 0 : 1 }  // Exposition ciel basée sur relief voisin
  return {points, index}

function pickImpact(bakedSet, surface, prng, head):
  candidates = bakedSet.points.filter(p.matériau === surface)
  if (!candidates) return null
  // Pondération gaussienne par proximité (σ=2.5m)
  → retourne point aléatoire pondéré
```

**Problème observé** : Si `pickImpact()` est appelé avec `surface='terre'` et qu'aucun point ne porte `matériau='terre'` (car le terrain par défaut n'a que metal+bache), retourne `null` → l'impact est ignoré.

---

## 5. Logique des toggles d'éléments

### 5.1 Toggles UI : metal / bache

**Localisation** : 
- État : [DioramaApp.jsx:54](ds/ui_kits/diorama/DioramaApp.jsx#L54)
- UI : [ControlHUD.jsx:110-113](ds/ui_kits/diorama/ControlHUD.jsx#L110-L113)

```javascript
<Switch label="Surface métal" checked={state.metal} onChange={...} />
<Switch label="Surface bâche" checked={state.bache} onChange={...} />
```

### 5.2 Effet visuel : relief masqué

**Localisation** : [WireframeCube.jsx:142-174](ds/ui_kits/diorama/WireframeCube.jsx#L142-L174)

```javascript
function Relief({terrain, metal, bache}) {
  // ... parcourt les blocs du terrain
  const visFor = {metal, bache, terre: true}  // terre toujours visible
  
  blocks.map(b => (
    <SolidWire ... visible={visFor[b.matId] !== false} />
  ))
}
```

→ Les blocs de relief dont le `matId` est 'metal' ou 'bache' disparaissent du rendu visuel quand le toggle est faux.

### 5.3 Effet audio : débit coupé dans tickPoisson

**Localisation** : [DioramaApp.jsx:256-261](ds/ui_kits/diorama/DioramaApp.jsx#L256-L261)

```javascript
const surfaceDensities = {
  metal: st.metal ? 1 : 0,
  bache: st.bache ? 1 : 0,
  terre: 1,  // Toujours actif
}
s.tickPoisson(dtMs, surfaceDensities, st.density)
```

Puis dans [RainSampler.js:442-444](ds/ui_kits/diorama/RainSampler.js#L442-L444) :

```javascript
for (const m of MATERIALS) {
  const surfFactor = surfaceDensities[m.id] ?? 1
  if (surfFactor <= 0) { this._poissonNext[m.id] = 0; continue }
  // ... calcul du débit λ
}
```

### 5.4 Cas observé : quand metal=false ET bache=false

**Attendu** : Pas de son metal/bache, mais son de terre (puisque `terre: 1`).

**Résolu en v0** (§6 corrigé) : Logique de fallback intelligent dans `pickImpact()`.

Quand surface='terre', le filtre accepte désormais :
1. Les cellules vraiment marquées `matériau='terre'`, OU
2. Les cellules d'autres matériaux **actuellement désactivés** (surfaceDensities ≤ 0)

Voir [BakedSet.js:66-70](ds/ui_kits/diorama/BakedSet.js#L66-L70) :
```javascript
if (surface === 'terre') {
  candidates = bakedSet.points.filter(p => {
    if (p.matériau === 'terre') return true
    return (surfaceDensities[p.matériau] ?? 1) <= 0  // ← fallback
  })
}
```

**Comportement actuel** : Quand metal=false ET bache=false, leurs cellules reviennent au bassin terre → impact joué comme 'terre'. Le débit Poisson global pour `terre` continue (jamais coupé), et trouve des candidates. Cohérent et sans silence.

---

## 6. Debug & gizmos graphiques

### 6.1 DebugHUD : overlay visuels

**Localisation** : [DebugHUD.jsx](ds/ui_kits/diorama/DebugHUD.jsx)

Affichée quand `state.debug=true` (Ctrl+Alt+D) :

1. **Boîte noire (traçage causal)**
   - État : enregistrement on/off
   - Compteur événements

2. **Directives des 6 faces** (HEAD_FACES)
   - Projection des voix sur chaque face
   - Niveau RMS par direction
   - Barre visuelle de présence

3. **Zones hit** : matériaux en cours de frappe (pulse visuelle ~90ms)

4. **Stats pool** : voix actives, vols, secteurs

5. **Master level** : niveau de sortie global (AnalyserNode)

### 6.2 VoiceOverlay : marqueurs voix dans la scène 3D

**Localisation** : [WireframeCube.jsx:309-355](ds/ui_kits/diorama/WireframeCube.jsx#L309-L355)

Rendu 3D uniquement si `debug=true` :

```javascript
function VoiceOverlay({samplerRef}) {
  const voices = sampler.debugVoices()  // Voix actives du pool
  
  for each voice:
    octaèdre + pied
    couleur = materialById(voice.materialId).debugColor
    taille ∝ RMS level
    opacité ∝ RMS level
}
```

---

## 7. UI & contrôles

### 7.1 Disposition

**Localisation** : [DioramaApp.jsx:334-398](ds/ui_kits/diorama/DioramaApp.jsx#L334-L398)

```
.dio (flexbox row)
  ├─ (optionnel DebugHUD gauche) — 280px
  ├─ .dio__view (flex:1) — canvas R3F + overlay branding + hints
  └─ .hud (ControlHUD droite) — 340px
```

Le canvas R3F est **100% le reste de l'espace**, ne se déplace pas selon l'UI.

### 7.2 ControlHUD : sections

**Localisation** : [ControlHUD.jsx:54-152](ds/ui_kits/diorama/ControlHUD.jsx#L54-L152)

1. **État du monde** : Pluie, Vent toggles
2. **Profil plateforme** : Select mobile/desktop/vr
3. **Éléments · surfaces** : Toggles metal/bache
4. **Tête de l'auditeur** : Sliders X/Y/Z
5. **Paramètres de vent** : Sliders rotation/force
6. **Paramètres de pluie** : Slider densité

Toutes les mutations réactualisent `state` via `set(patch)` → effects React enchaînés.

### 7.3 Masthead : branding, clock, meter

**Localisation** : [DioramaApp.jsx:363-388](ds/ui_kits/diorama/DioramaApp.jsx#L363-L388)

- **Logo** : Cube stylisé 3D
- **Titre** : "Diorama sonore v0 · prototype"
- **Horloge** : Segmentée (aube/jour/crépuscule/nuit) ou manuelle
- **Heure réelle** : HH:MM (mis à jour 1×/s)
- **Mètre 6 canaux** : 6 barres, hauteur = débit aléatoire selon listening+rain+density

---

## 8. Traçage causal : boîte noire (TraceRecorder)

### 8.1 Enregistrement

**Localisation** : [DioramaApp.jsx:95-189](ds/ui_kits/diorama/DioramaApp.jsx#L95-L189)

Enregistrement manuel (Ctrl+Alt+R ou bouton DebugHUD) :

```javascript
recRef.current = new TraceRecorder()  // Créé une fois

// Au démarrage (toggleRecording):
rec.start(ctx, {size, seed, engine:'rompiche/0.1'})
rec.state(snapshot_initial)  // Version 1 : état complet

// À chaque changement état tracé :
rec.state(patch)  // Deltas uniquement (champs qui ont changé)

// Boucle d'échantillonnage ~30Hz (recording):
s.traceSample(rec)  // Émet 'env' pour chaque voix active
```

**Champs tracés** : `rain, wind, windTilt, windRotation, windForce, metal, bache, x, y, z, density, gain, preset, seed`  
(voir [DioramaApp.jsx:147-148](ds/ui_kits/diorama/DioramaApp.jsx#L147-L148))

### 8.2 Événements émis

Voir [RainSampler.js:546-557](ds/ui_kits/diorama/RainSampler.js#L546-L557), [564](ds/ui_kits/diorama/RainSampler.js#L564), etc. :

- `impact` : point de frappe détecté (surface, x, z)
- `trigger` : grain joué (grain id, impact id, surface, position, durée, sample idx)
- `acquire` : voix acquise du pool (grain id, voice idx, material, stolen?, weak?)
- `release` : voix libérée (grain id, voice idx, raison)
- `steal` : vol de voix (victim voice, fade duration)
- `env` : enveloppe de grain (grain id, level RMS, position, weak?)
- `budget` : budget L1 ajusté (busy count, pool size, steals, sectors actifs)
- `scale` : configuration échelle (preset, size, r1, r2, overlap)
- `bed` : nappe diffuse (niveau dB, filtre centre/largeur)

**Export** : `rec.download()` → NDJSON téléchargé (`trace.ndjson`).

---

## 9. Tests

### 9.1 Infrastructure Playwright

**Localisation** : `package.json` indique Playwright comme devDependency.

**Aucun test défini actuellement** :
- Pas de script `test` dans package.json
- Pas de fichiers `.test.js` / `.spec.js` dans le projet
- Pas de configuration `playwright.config.js` au root

**Infrastructure disponible** : Playwright est installé (v1.60.0) mais non utilisé en phase v0.

---

## 10. Zones floues & dette technique observée

### 10.1 Représentation monde : pas de schéma/format défini

**Observation** : L'état v0 est dispersé entre :
- React state (booléens, nombres, enums)
- Uint8Array (terrain.material, terrain.height)
- Arrays (objects = [])
- WorldConfig (objets immuables)

Aucun schéma centralisé (ex. Protocol Buffers, JSON Schema) ne décrit « la structure du monde sérialisable ». Le système dépend d'accesseurs React + manually paired Uint8Arrays.

### 10.2 Fallback terrain : RÉSOLU

**Avant** : Aucun fallback. Les toggles coupaient juste le débit Poisson.  
**Maintenant** : `pickImpact()` fait un fallback sémantique : si metal/bache sont désactivés, leurs cellules deviennent candidates pour `terre`. Voir §5.4.

### 10.3 Couplage serré audio ↔ terrain

**Observation** : RainSampler maintient une copie bakée du terrain (BakedSet) créée à l'init. Si le terrain change (futur Gamemaster place des objets), le baked ne se met pas à jour automatiquement. Il faudrait rappeler `setTerrain(newTerrain)` et rebaker.

### 10.4 Worklets préparés mais partiels

**Observation** :
- `noise-processor.js` fonctionne (nappe diffuse génère bruit pink/brown)
- `granulator-processor.js` existe mais n'est pas connecté/utilisé

Chemin prêt pour la granulation future (Couche 2/3), mais en v0 seules les voix HRTF (L1) sont actives.

### 10.5 LOD & secteurs : implémentation 80% complète

**Observation** : 
- LodController existe, gère promotions/démotions
- SectorField existe, accumule impacts lointains
- Mais les paramètres LOD ne sont pas tuning de l'UI
- Les secteurs sont une « Couche 2 » amortie : l'interface n'expose pas les seuils

### 10.6 Relief : représentation vs affichage

**Observation** : Le relief est stocké dans `terrain.height` (grille 1 m), mais le rendu `Relief` recalcule les géométries THREE.BoxGeometry **à chaque rerender** (dans useMemo, dépendant de `terrain`). Pas de cache de meshes.

---

## 11. Questions ouvertes

### 11.1 Saves et seed

**Q** : Comment envisager la sérialisation complète du monde (pour saves/load)?

**Déterminisme** : Le PRNG est seedé (`seed` paramètre), donc à même seed + même preset + même terrain = même pluie détalisée. Mais :
- Le terrain et objects doivent aussi être sérialisables
- Le state React est déjà sérialisable (primitifs + Uint8Array)
- Comment représenter des objets custom? Schema.org? ProtoBuf?

### 11.2 Édition de terrain future

**Q** : Si le Gamemaster peut éditer le terrain ou placer des objets, comment actualiser:
- Les impacts bakés (BakedSet)?
- Les voix actuellement actives (elles jouent des samples du terrain ancien)?
- L'affichage Relief (recalculer les meshes)?

**Hypothèse** : Snapshot `terrain` clé de réaction → recalculer BakedSet + rebake impacts pendant un "fade" audio?

### 11.3 Horloge : rôle métaphorique vs playback

**Q** : L'horloge (aube/jour/crépuscule/nuit) a **aucun effet** en v0. Elle est purement visuelle. Quand l'ajouter au moteur sonore (eq. timbre/réverbération)?

### 11.4 Platform detection vs override

**Q** : `detectPlatform()` utilise UA + navigator.xr, mais l'UI permet de sélectionner manuellement. Si un mobile sélectionne 'desktop' → 40 voix, qu'arrive-t-il au budget? Est-ce intentionnel?

### 11.5 TraceRecorder : format et replay

**Q** : Le trace est NDJSON brut. Comment parser/valider? Comment `ReplayEngine` le consommera-t-il? (Fichier existe mais vide).

### 11.6 Découplage audio ↔ rendu

**Q** : L'impact visuel dans `Rain` recompute le matériau de chaque goutte ([WireframeCube.jsx:294-298](ds/ui_kits/diorama/WireframeCube.jsx#L294-L298)). Cette logique existe deux fois : visuelle + audio (pickImpact → baked → matériau). Fusionner?

---

## 12. Résumé synthétique

### Architecture générale

Rompiche v0 est un **moteur hybryde à trois couches**:

1. **Couche 1 (près)** : Pool de 40 voix HRTF spatialisées (Resonance Audio), générées par processus Poisson, chacune jouant un sample court
2. **Couche 2 (moyen, préparée)** : Secteurs + worklet granulateur (SectorField, granulator-processor) — pré-wireframe mais inactif
3. **Couche 3 (loin)** : Nappe diffuse pink-filtered (DiffuseBed + noise-processor worklet) — fournit le fond

### Données du monde

- **État** : Objet React centralisé (météo, toggles, position auditeur)
- **Terrain** : Deux grilles Uint8Array (matériau 0.5m + relief 1m), sérialisables
- **Config** : WorldConfig immuable dérivée du preset/seed/platform
- **Props** : Couche objects vide (prête pour futur Gamemaster)

### Couplage

- **Repère unique** : coords.js source de vérité partagée audio/visuel
- **Synchronisation** : Auditeur React ↔ RainSampler via refs + effects
- **Découpling léger** : L'impact visuel et l'impact audio lisent séparément les matériaux du terrain

### Problème v0 (RÉSOLU)

Bug du sol-herbe : quand metal ET bache désactivés.  
**Solution** : Fallback dans `pickImpact()` — les cellules désactivées reviennent à `terre`.  
Voir §5.4 et §6 pour détails.

---

**Document généré** : 13 juin 2026  
**Mise à jour** : 13 juin 2026 — bug sol-herbe corrigé, fallback appliqué  
**Scope** : Reconnaissance v0 + suivi des corrections
