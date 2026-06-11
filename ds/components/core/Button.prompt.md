Primary action control for Diorama sonore — strictly monochrome, emphasis by value and weight (never color); use `mono` for the technical/uppercase voice.

```jsx
<Button variant="primary">Lancer l'écoute</Button>
<Button variant="secondary" iconLeft={<Icon name="move" />}>Déplacer</Button>
<Button variant="ghost" size="sm" mono>v0.5</Button>
```

Variants: `primary` (solid ink), `secondary` (black outline on white), `ghost` (chrome-free, fills gray on hover), plus `inverse` and `inverse-ghost` for use on the dark `#0d0d0d` viewport. Sizes `sm | md | lg`. Set `mono` for uppercase tracked monospace labels (spec values, technical actions). No bounce on press; focus shows a 2px black ring.
