# Diorama sonore — Design System

> Codename repo: **Rompiche**. Product name: **Diorama sonore** ("Sound diorama").

A sandbox where a player composes small living **dioramas in cube format** — wireframe today, low-poly tomorrow — and drops a character inside to *listen* to the sonic world they built. The stated goal is not visual but **auditory**: maximize immersion to the point that, **eyes closed, you could believe you'd teleported inside the cube**. The audio engine is the product; the visual render is just one view of the same scene graph.

This design system captures the project's deliberately spare visual language — **wireframe, black / gray / white, technical, document-like** — and packages it as tokens, components, foundation specimens, and full-screen UI recreations so any agent can design on-brand for Diorama sonore.

---

## Sources

Everything here was reverse-engineered from the project's documentation site. If you have access, explore these to do a better job:

- **GitHub — `left-eyebr0w/Rompiche`** → <https://github.com/left-eyebr0w/Rompiche>
  - `docs/` — a static HTML+CSS documentation site (no build tool). The shared theme lives in `docs/assets/style.css` and is the single richest source of the brand's real visual decisions (color ramp, spacing, callouts, tags, cards, sidebar).
  - `docs/cadrage/` — the "framing" branch: vision & principles, the engine model, technical architecture & cost, v0 scope, decisions, and roadmap. This is where the product's voice and concepts come from.

There is **no Figma file and no separate app codebase** in the repo — the v0 prototype (the wireframe cube + control HUD) is specified in prose but not yet implemented. The `Diorama` UI kit in this system is therefore a faithful *interpretation* of the written v0 spec (§3.5 six-point bus, §6 cube-as-room, wireframe noir/gris/blanc), not a code recreation. It is the one surface here built from spec rather than source — treat it as a strong proposal, not ground truth.

---

## CONTENT FUNDAMENTALS

How Diorama sonore writes.

- **Language: French.** All product and documentation copy is in French. Keep it French unless asked otherwise. (e.g. *"Un bac à sable où l'on compose de petits univers sonores au format cube."*)
- **Register: precise, technical, declarative.** Reads like an engineering spec written by someone who cares about craft. Short, load-bearing sentences. Defines its terms and then uses them with discipline: *Émetteur*, *Surface*, *Résonateur*, *grain*, *bus 6 canaux*, *état du monde*.
- **Voice: impersonal / collective.** Uses the indefinite **"on"** ("on compose", "on minimise", "on sépare") and the infinitive for goals ("Permettre au joueur de…"). Rarely "je"; addresses the reader implicitly, not as "vous". It describes the system, not the user.
- **Capitalized domain nouns as proper concepts.** Roles and core objects are Capitalized mid-sentence — **Émetteur, Surface, Résonateur** — signalling they are defined entities in the model, not loose words.
- **Versioned, honest, living.** Copy openly labels maturity: *"document vivant"*, *"v0.5"*, *"(résolu v0.4)"*, *"TBD"*, *"à définir"*, *"à affiner"*. It states what is decided and what is still open. Decisions carry the version that settled them.
- **Hierarchy of priorities is explicit.** *"Priorité 1 — Qualité audio. Priorité 2 — Faible coût computationnel."* The writing arbitrates trade-offs out loud.
- **Emphasis via bold, sparingly but often.** Key terms and conclusions are **bolded** inline to make a dense spec scannable. Italics carry asides and felt/experiential language (*"les yeux fermés"*, *"sonne juste"*).
- **Casing.** Sentence case for headings and body. **UPPERCASE only for eyebrows / kicker labels** ("BRANCHE CADRAGE", "DOCUMENTATION DU PROJET") and tags ("spécifiée", "TBD"), always with wide letter-spacing.
- **Numbering.** Sections are numbered (§1 Vision, §2 Principes, §3 Le moteur, 3.1, 3.2…) — the spec-document structure is part of the identity.
- **Emoji: essentially no.** One ⚠️ appears in the whole doc set, flagging a budget risk. Treat emoji as off-brand; use a tag or a callout instead.
- **Vibe:** a thoughtful indie/research project. Calm, rigorous, a little poetic about the *listening* experience but rigorous about the engineering. "Sandbox without an engagement loop — the pleasure is in creating and listening."

**Do / Don't**
- ✅ "Le bus 6 canaux est solidaire de la tête : coût de spatialisation **fixe**."
- ✅ "Météo : modèle en intensités continues [0–1] — épinglé à {0, 1} pour le proto."
- ❌ "🎧 Crée ton monde sonore et partage-le avec tes amis ! 🚀" (wrong language register, emoji, engagement-loop framing)

---

## VISUAL FOUNDATIONS

### Color — strict monochrome
The defining constraint. The v0 spec reads *"graphismes wireframe, en noir / gris / blanc **uniquement**"*. **No hue is permitted.** Every bit of structure, depth, state and emphasis is built from **value and weight alone**. This is the single most important brand rule.
- Ramp: `--noir #111` · `--gris-900 #1c1c1c` · `--gris-700 #3a3a3a` · `--gris-500 #6e6e6e` · `--gris-300 #b8b8b8` · `--gris-200 #d6d6d6` · `--gris-100 #ececec` · `--blanc #fff`, on an off-white `--bg #fafafa` canvas.
- **Two contexts:** light "document" context (ink on off-white paper) and the dark **viewport** context (`--canvas-noir #0d0d0d`) where the wireframe lives — white strokes, gray receding edges.
- Emphasis = solid black fill or a black 2px border, never a color.

### Typography
- **IBM Plex Sans** for UI and prose; **IBM Plex Mono** as the "technical voice" — eyebrows, tags, parameter labels, readouts, anything naming a spec value.
- ⚠️ **Substitution flagged:** the source used the OS system stack with no bundled fonts. IBM Plex is a deliberate upgrade chosen for its engineered, neutral, monochrome character — it reads almost identically to the original neutral stack while staying consistent across machines. Loaded via Google Fonts. **If you want exact parity with the source, or self-hosted woff2 for offline/PWA use, say so and I'll swap it.**
- Body line-height is generous (**1.65**) — it reads like documentation. Headings are tight (1.15–1.3), large h1 carries `-0.01em` tracking.
- Eyebrows: mono, uppercase, `letter-spacing: 0.14em`, `--gris-500`.

### Layout & structure
- **Document-like.** Content column capped at **820px**; a **280px** sidebar on the docs surface. Lots of breathing room, left-aligned, no centered hero theatrics.
- Numbered sections; breadcrumb at top; prev/next pager at the bottom of every doc page.
- The app surface inverts this: a **full-bleed dark viewport** with a compact, dense control HUD docked to one edge.

### Backgrounds & texture
- **No gradients, no photography, no illustration, no patterns.** Flat fills only. The off-white `#fafafa` page and the near-black `#0d0d0d` viewport are the only two "grounds".
- The only "imagery" the brand owns is **geometry**: the wireframe cube, its 6 face-points (the binaural bus), the listener-head marker, scene elements. These are line drawings in CSS/3D, never filled illustrations.

### Borders, corners, cards
- **Hairline 1px borders** (`--gris-200`) are the primary separators. Emphasis borders are **2px solid black** or **dashed** (for TBD / placeholder states).
- **Tight radii:** 4px (inputs, buttons), 6px (cards), pill (`999px`) only for tags. Nothing is heavily rounded.
- **Cards:** white fill, 1px `--gris-200` border, 6px radius, near-invisible shadow. On hover the border goes **black** and the card lifts `2px` with a soft `0 4px 14px rgba(0,0,0,.06)` shadow. Disabled cards: dashed border + ~55% opacity.
- **Callouts:** left border (3px) + white fill + 4px radius on the right; black border = important, gray border = muted aside.

### Shadows
Whisper-quiet. Depth is carried by value, not by elevation. Largest shadow in the system is `0 8px 28px rgba(0,0,0,.10)`; most surfaces use `rgba(0,0,0,.04–.06)`.

### Motion
- **Fast and calm.** `0.12s` transitions on hover/active, `cubic-bezier(0.2,0,0.2,1)`-ish easing. **No bounce, no spring.** Fades and small `translateY(-2px)` lifts.
- In the viewport, the signature motion is **continuous interpolation** — the listener moving, the soundfield "morphing" — slow, smooth, never stepped.

### Hover / press states
- **Hover:** background fills to a near neighbor on the ramp (`--gris-100` on light, `--gris-900` on dark), or border darkens to black. Links: underline color goes from gray to black.
- **Active/press:** no scale-down by default; emphasis via the 2px black border (the active nav item gets a `border-left: 2px solid black`).
- **Focus:** solid black focus ring/outline — monochrome, high-contrast, accessible.

### Transparency & blur
Used almost never. The aesthetic is opaque and flat. The one place subtlety is allowed: a protection scrim could darken the viewport behind the HUD, but prefer a solid panel.

---

## ICONOGRAPHY

- **The source ships no icon system** — no icon font, no SVG sprite, no PNG icons. It uses **Unicode glyphs as icons**: HTML entity arrows `→` (`&rarr;`) and `←` (`&larr;`) for pager/next-prev and card affordances, and exactly **one emoji** (⚠️) to flag a risk. That restraint is the brand's real icon language: text-as-icon, monochrome.
- **For richer UI** (the Diorama control HUD needs play/move/weather/visibility affordances) this system links **[Lucide](https://lucide.dev)** from CDN — thin, even-stroke, monochrome line icons that match the wireframe/technical aesthetic.
  - ⚠️ **Substitution flagged:** Lucide is *not* in the source; it's the closest CDN match (1px-feel even stroke, no fill, geometric) to the brand's line-drawing character. If you have a preferred icon set, tell me.
  - Usage: keep icons monochrome (`currentColor`), stroke-only, ~1.5–2px stroke, sized 16–20px in UI. Never multicolor, never filled, never add a colored background chip.
- **Brand "marks"** (the wireframe cube, the 6-point bus) are rendered as CSS/3D line geometry in `assets/`, not as raster logos — consistent with "the only imagery is geometry."

---

## INDEX / MANIFEST

Root files:
- `styles.css` — global entry point (link this one file). `@import`s the four token files.
- `tokens/` — `fonts.css`, `colors.css`, `typography.css`, `spacing.css`.
- `readme.md` — this guide.
- `SKILL.md` — Agent-Skills front-matter wrapper so this folder works as a downloadable Claude skill.
- `assets/` — brand marks (wordmark, wireframe cube) as small HTML/CSS specimens.

Foundation specimen cards (Design System tab): under `guidelines/` — Colors, Type, Spacing, Brand.

Components (`components/core/`): **Button, Tag, Eyebrow, Callout, Card, Switch, Slider** — each with `.jsx`, `.d.ts`, `.prompt.md`, plus one `@dsCard` HTML per group.

UI kits:
- `ui_kits/diorama/` — the v0 prototype: full-bleed wireframe cube viewport + control HUD (interpretation of the written spec).
- `ui_kits/docs/` — the documentation website (black sidebar, branch/page navigation) — a code-faithful recreation of `docs/`.
