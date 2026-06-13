> ⚠️ **Ce document n'est PAS le périmètre v1.** C'est la **vision « la totale »** (destination
> à long terme). Le périmètre v1 réellement engagé est le *Pivot* — voir
> [cadrage-v1.md](cadrage-v1.md). Les features ci-dessous sont réparties sur les paliers
> **P2 → P4+** : édition, World Shaper (P3, voir [world-shaper.md](world-shaper.md)), puis
> météo / eau / biomes / faune / objets animables. Chacune se branchera sur le modèle pivot
> sans réécrire le cœur.

---

**CORE GAMEPLAY**
- Creative sandbox relaxant, accès complet immédiat
- Création de scènes from scratch (canvas vide)
- Édition + simulation temps-réel post-création
- Saves comprimés, versionnés, sharables

---

**TERRAIN & MONDE**
- Génération procédurale (Perlin noise + erosion sim)
- 7 biomes : forêt, montagne, désert, toundra, plaine, bord de mer, lac
- Tous paramétrables (humidité, température, rugosité, densité végétation, etc.)
- Brushes complexes (chemins, routes, formes) — paramètres génériques
- World-Shaping inclus

---

**MÉTÉO (réaliste, décorrélée)**
- Vent : direction + altitude (rafales localisées)
- Pluie : 3 couches audio (impacts héros texturés + mid-range + bruit blanc)
- Nuages : variables indépendants
- Pluie s'incline avec vent, intensité d'impact varie
- Affecte acoustique (occlusion, directivité) + animation visuelle

---

**EAU**
- Lacs, rivières, océans
- Propriétés audio simples (sons d'ambiance + impacts pluie spécifiques)
- Rivières : son de courant (white noise filtré) affecté par débit
- Océans/lacs : sons d'ambiance distincts + vagues/clapotis

---

**ANIMATIONS & INTERACTIONS**
- Low-poly animé : eau, végétal, objets, faune
- ~50 objets animables max/scène
- Système de trigger générique : timeline progressive (0-1) basée conditions (vent, pluie, impact)
- **Causalité forte** : vent → animation + sons spécifiques (claquer toile, etc.)
- Interactions générent sons contextuels

---

**FAUNE**
- Comportements intelligents (vole, se cache, migration)
- Densité liée au biome
- Sons spécifiques + animations

---

**MATÉRIAUX & SCÈNES**
- ~50 matériaux, ~5 scènes
- Scènes modulables, créables

---

**ÉDITION**
1. Phase 1 : création terrain/monde (pas temps-réel)
2. Phase 2 : édition + simulation temps-réel

---

**TECHNIQUE**
- Format save binaire (petit fichier)
- Versioning saves
- 60fps mobile (device min : ?)
