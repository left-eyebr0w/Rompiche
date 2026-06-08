# Documentation — Diorama sonore

Site de documentation statique (HTML + CSS, sans outil de build). Il s'ouvre
directement dans un navigateur : double-cliquez sur `docs/index.html`, ou
servez le dossier (`python3 -m http.server` depuis `docs/`).

## Organisation

La documentation est découpée en **branches** (sections thématiques), chacune
contenant plusieurs **pages**.

```
docs/
├── index.html              # Accueil : liste des branches
├── assets/style.css        # Thème partagé (noir / gris / blanc)
└── cadrage/                # Branche « cadrage »
    ├── index.html          # Présentation (vision + principes)
    ├── le-moteur.html      # Le modèle du moteur (le cœur)
    ├── architecture.html   # Architecture technique & coûts
    ├── perimetre-v0.html   # Périmètre de la v0 (prototype)
    ├── decisions.html      # Points ouverts & journal des décisions
    └── feuille-de-route.html # Versions v0 / v1 / v2
```

## Ajouter une nouvelle branche

1. Créer un dossier `docs/<nom-de-branche>/`.
2. Y copier la structure d'une page existante (sidebar, breadcrumb, pager) en
   adaptant les chemins relatifs (`../assets/style.css`, `../index.html`).
3. Référencer la nouvelle branche dans la grille de cartes de `docs/index.html`
   et dans la barre latérale des autres pages.

## Ajouter une page à une branche

1. Dupliquer une page existante de la branche.
2. Ajouter l'entrée correspondante dans la liste `<ul>` de la barre latérale de
   **toutes** les pages de la branche (et marquer la page courante `class="active"`).
3. Mettre à jour les liens « précédent / suivant » (`.page-foot`).

Le thème est entièrement piloté par `assets/style.css` ; aucune dépendance
externe.
