Monochrome range control for the engine's continuous parameters — listener position, grain density, gain, weather intensity.

```jsx
<Slider label="Densité" min={0} max={1} step={0.01} defaultValue={0.4}
  formatValue={v => v.toFixed(2)} />
<Slider label="Tête — axe X" inverse min={-1} max={1} step={0.01} defaultValue={0} />
```

Thin 2px track, ink thumb. `formatValue` controls the mono readout (tabular figures); `showValue={false}` hides it. `inverse` for the dark viewport. Controlled or uncontrolled.
