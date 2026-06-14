# Assets audio

Banques de samples du moteur, organisées **par famille sonore**. Surtout pas à
plat : chaque famille a sa propre logique d'organisation interne, et de nouvelles
familles viendront s'ajouter ici.

```
src/assets/audio/
  impacts/        Impacts de pluie, rangés par matériau de surface
    metal/        → MaterialId 'metal'
    bache/        → MaterialId 'bache'
    terre/        → MaterialId 'terre'
  …               (familles à venir : ambiances, vent, signaux UI, etc.)
```

## Conventions

- **Une famille = un dossier de premier niveau** (`impacts/`, plus tard
  `ambiences/`, `wind/`, …). La structure *interne* d'une famille lui est propre.
- **Formats supportés** : `.wav`, `.flac`, `.ogg`, `.mp3`.
- **Chargement** : les banques sont résolues par `import.meta.glob` côté code
  (pas de manifeste à tenir à jour). Déposer un fichier dans le bon dossier
  suffit à l'inclure ; voir `src/engine/components/materials.ts` pour la famille
  `impacts/`.
- **`.gitkeep`** : garde les dossiers vides versionnés tant qu'ils n'ont pas de
  samples. À retirer quand le dossier contient des fichiers.

## Ajouter une nouvelle famille

1. Créer `src/assets/audio/<famille>/…` selon sa propre organisation.
2. Câbler un `import.meta.glob` dédié dans le module moteur concerné.
3. Documenter la famille dans l'arborescence ci-dessus.
