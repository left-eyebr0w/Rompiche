# Rompiche — Document de cadrage v0 → v1

**Dernière mise à jour** : 13 juin 2026
**Statut** : ✅ v0 VALIDÉE — 5/5 critères DoD acquis (13 juin 2026)
**Auteur** : projet solo, artistique, destiné à être rendu public

---

## 0. Intention du projet

Rompiche est un **diorama sonore 3D contemplatif et créatif**. L'utilisateur observe et
édite une scène 3D ; le son émerge de ce qu'il place et des interactions causales qui
naissent de la scène. **L'immersivité sonore est la priorité de premier ordre** : le son
et les événements qui le causent sont le cœur du projet.

Horizon lointain (non engageant) : un mode "sommeil" pour s'endormir dans ses créations.

---

## 1. Vocabulaire canonique

| Terme            | Sens                                                                 |
|------------------|----------------------------------------------------------------------|
| `terre`          | Matériau de sol par défaut (identifiant code). Label UI libre.       |
| **sound gizmos** | Indicateurs visuels de debug audio (octaèdres/points, sortie master).|
| **Couche 1**     | Voix HRTF spatialisées (Resonance Audio), proche. Cœur actif.        |
| **Couche 2**     | Secteurs + granulation (champ moyen). Volontaire, partiellement actif.|
| **Couche 3**     | Nappe diffuse filtrée (fond lointain). Volontaire, actif.            |
| **modèle de monde** | Représentation sérialisable de l'état du monde (pivot du refactoring).|

---

## 2. Périmètre — ce qui EST la v0 (validé)

La v0 est un **moteur audio "sous stéroïdes" assumé**, validé comme base solide.
Font partie intégrante de la v0 et sont **garantis / à stabiliser** :

- ✅ Moteur audio **à 3 couches** (HRTF + secteurs/granulation + nappe diffuse)
- ✅ Génération d'impacts par **processus Poisson** par matériau
- ✅ **Pool de voix** avec priorité/vol (steal)
- ✅ Spatialisation via **Resonance Audio**
- ✅ Repère unique partagé audio/visuel (`coords.js`) — source de vérité
- ✅ Terrain sérialisable (grilles Uint8Array : matériau + relief)
- ✅ Tête auditeur (position via sliders X/Y/Z)
- ✅ **LOD** (LodController)
- ✅ **Vent**
- ✅ **Horloge** segmentée (actuellement visuelle)
- ✅ **Traçage causal** (TraceRecorder, format NDJSON)
- ✅ Rendu **wireframe / visuel simple**
- ✅ **Sound gizmos** (debug audio)
- ✅ Couche `objects` (typée, prête, vide)

---

## 3. Périmètre — exploratoire / hors garantie

Issus de l'exploration computationnelle, **laissés en dormance**, documentés comme
"exploratoire, non garanti, hors périmètre v0/v1". Ne polluent ni la Definition of Done,
ni les tests :

- 🟡 **Replay** (`ReplayEngine`, vide)
- 🟡 **Plateformes** (mobile / desktop / vr)

> Règle : on ne les supprime pas, on ne prétend pas qu'ils sont finis. Ils ne bloquent rien.

---

## 4. Definition of "Done" — v0

La v0 est considérée comme **stabilisée** quand :

- [x] **Tests garde-fous** Playwright capturent le comportement actuel :
      le son sort, la position auditeur bouge le champ sonore, les toggles de surface
      agissent, les 3 couches produisent du signal.
- [x] **Bug du sol-herbe corrigé** : désactiver metal ET bache ne produit plus un silence
      total. Fallback intelligent : les cellules désactivées deviennent candidates `terre`.
      (Voir [etat-v0.md:5.4](etat-v0.md#54-cas-observé--quand-metalfalse-et-bachefalse).)
- [x] **Cohérence du vocabulaire** : `terre` partout dans le code.
- [x] Le **modèle de données** est typé (TypeScript) et documenté comme contrat.
      (`ds/ui_kits/diorama/types/` : 7 fichiers `.d.ts`, point d'entrée `index.d.ts`.)
- [x] Aucune régression du comportement audio validé manuellement en v0.
      (Tests Playwright : 4/4 ✅ audio-output, layers-signal, listener-position, surface-toggles.)

---

## 5. Périmètre v1

> ⚠️ **Section obsolète — déplacée.** Le périmètre v1 a été tranché et unifié dans un
> document dédié : **[cadrage-v1.md](cadrage-v1.md)**. Ce fichier-ci ne fait plus autorité
> que pour la **v0**. Voir le nouveau document pour : le principe directeur (le « Pivot »),
> les paliers ordonnés P0→P4+, l'interface Monde↔Audio à figer, le format de save versionné
> et la DoD v1.

---

## 6. Bug connu — sol-herbe (RÉSOLU en v0)

**Constat initial (cf. etat-v0.md §4.3, §5.4, §10.2)** :
- Le terrain par défaut ne contient que `metal` + `bache` ; aucune cellule `terre`.
- Les toggles de surface coupaient juste le débit Poisson, sans fallback.
- Symptôme : metal=false ET bache=false → silence total.

**Solution appliquée** : Fallback intelligent dans `pickImpact()` [BakedSet.js:66-70](../ds/ui_kits/diorama/BakedSet.js#L66-L70).
Quand surface='terre', on accepte :
- Les cellules vraiment `terre`, ET/OU
- Les cellules des matériaux désactivés (surfaceDensities ≤ 0)

**Comportement actuel** : Désactiver metal ET bache → leurs cellules reviennent au bassin terre → pas de silence.

---

## 7. Repoussé en v2 (non engageant)

- Rendu **low-poly poli**, éclairages, shaders légers.
- **Mode sommeil**.

---

## 8. Stack technique

Vite · React Three Fiber / three.js · Resonance Audio · three-mesh · drei ·
Playwright · **TypeScript (migration en cours, v1 chantier 2)**.

---

## 9. Méthode de travail

- Projet **solo**, artistique, public.
- Allers-retours **utilisateur ↔ Claude Code**, cadrés par des prompts précis.
- **Phases distinctes** : reconnaissance (lecture seule) → cadrage → exécution chantier
  par chantier, avec tests comme filet.
- On ne refactore **jamais** une zone non comprise ou non testée.
