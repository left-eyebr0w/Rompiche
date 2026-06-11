# UI kit — Diorama (v0 prototype)

The product's signature surface: a **full-bleed dark viewport** holding the wireframe cube, docked to a compact **control HUD**. This is an *interpretation of the written v0 spec* (`docs/cadrage/`), not a code recreation — there is no app code in the source repo. Treat it as a strong, on-brand proposal.

## What it shows
- **Wireframe cube viewport** — the cube-as-room, the **6 face-points** of the head-locked bus (§3.5), the **listener head** (movable, with a pulse when listening), a split ground (**métal / terre**), and **rain** (on/off).
- **Control HUD** — the minimal "test the engine" controls from the v0 scope:
  - *État du monde*: rain on/off, and a **read-only clock** (aube / jour / crépuscule / nuit) driven by the real local time — the spec forbids a time control in the UI.
  - *Éléments · surfaces*: enable/disable métal and terre.
  - *Tête de l'auditeur*: X / Y / Z sliders (continuous free movement).
  - *Paramètres de grains*: densité, gain.
  - *Lancer l'écoute* primary action.
- A faux **6-channel level meter** in the top-right reacts to listening + rain + density.

## Files
- `index.html` — mounts the app (React UMD + Babel + Lucide + the DS bundle).
- `WireframeCube.jsx` — the CSS-3D scene (no Three.js; faithful to the noir/gris/blanc wireframe).
- `ControlHUD.jsx` — the docked panel; composes DS `Switch` / `Slider` / `Button` / `Tag` / `Eyebrow`. Also defines the Lucide `Icon` helper.
- `DioramaApp.jsx` — screen shell, state, top bar (wordmark + clock + meter).

## Composition notes
Built from the design system: every control is a DS primitive in its `inverse` (dark) variant. Icons are **Lucide** (substituted — see README ICONOGRAPHY), monochrome, 1.6px stroke. No color anywhere — strictly noir / gris / blanc per the v0 spec.
