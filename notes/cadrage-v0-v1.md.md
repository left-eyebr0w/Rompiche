# Rompiche — Document de cadrage v0 → v1

**Dernière mise à jour** : 13 juin 2026
**Statut** : référence active
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

- [ ] **Tests garde-fous** Playwright capturent le comportement actuel :
      le son sort, la position auditeur bouge le champ sonore, les toggles de surface
      agissent, les 3 couches produisent du signal.
- [ ] **Bug du sol-herbe corrigé** : désactiver metal ET bache ne produit plus un silence
      total incohérent. Le comportement attendu est défini et testé (voir §6).
- [ ] **Cohérence du vocabulaire** : `terre` partout dans le code.
- [ ] Le **modèle de données** est typé (TypeScript) et documenté comme contrat.
- [ ] Aucune régression du comportement audio validé manuellement en v0.

---

## 5. Périmètre v1

La v1 transforme le proto en **base de jeu extensible**, **en restant en wireframe /
visuel simple** (pas de polish visuel — repoussé en v2).

Chantiers v1, **dans l'ordre** :

1. **Tests garde-fous** (filet comportemental) — *avant* tout refactoring.
2. **Migration TypeScript progressive** :
   - *TS-A* : `tsconfig` permissif (`allowJs: true`), typage prioritaire du **modèle de
     données** (state, terrain, materials, objects, coords).
   - *TS-B* : migration du reste, durcissement vers `strict`.
3. **Modèle de monde sérialisable** (pivot) + **fix du sol-herbe**.
4. **Refonte UI / contrôles**.

Objectif transversal : **cohérence interne forte**, élimination des désharmonisations.

---

## 6. Bug connu — sol-herbe (à corriger en v1, chantier 3)

**Constat factuel (cf. etat-v0.md §4.3, §5.4, §10.2)** :
- Le terrain par défaut ne contient que `metal` + `bache` ; **aucune cellule `terre`**.
- Les toggles de surface **coupent le débit Poisson** au lieu de **remplacer le matériau**.
- Conséquence : metal=false ET bache=false → `terre` a 0 point exposé → **silence total**.

**Décision de comportement attendu** : *à trancher lors du chantier 3* (deux options
ouvertes : (a) un vrai sol `terre` sous-jacent qui sonne par défaut ; (b) une autre
sémantique). Documenté ici comme question ouverte, à résoudre avec test associé.

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
