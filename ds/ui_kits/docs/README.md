# UI kit — Documentation site

A **code-faithful recreation** of `docs/` from the source repo (`left-eyebr0w/Rompiche`) — the static documentation site with the black sidebar and document column. Unlike the Diorama kit, this one *is* built from source CSS, so it's a true recreation.

## What it shows
- **Black sidebar (280px)** — brand lockup (wordmark + "Documentation" mono sub), a "Branche · Cadrage" nav group with active-state highlight (`border-left: 2px solid white`), and a disabled "Autres branches — à venir".
- **Document column (max 820px)** — breadcrumb, mono eyebrow, h1 (with an optional `spécifiée` tag), lead paragraph, numbered sections, callouts, and a prev/next pager.
- **Interactive:** click any sidebar item, breadcrumb link, or pager to switch among three real Cadrage pages (Présentation, Le moteur, Périmètre de la v0).

## Files
- `index.html` — mounts the app (React UMD + Babel + DS bundle).
- `DocsSite.jsx` — sidebar, document layout, page data, and page switching. Composes DS `Callout`, `Tag`, `Eyebrow`.

## Composition notes
Layout chrome is rebuilt on DS tokens for visual parity with `docs/assets/style.css`; prose blocks and callouts use the design-system primitives. Strictly monochrome.
