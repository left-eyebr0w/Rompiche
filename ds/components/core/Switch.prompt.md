Monochrome on/off toggle for the engine's binary controls — météo on/off, enabling/disabling a scene element.

```jsx
<Switch label="Pluie" showState defaultChecked />
<Switch label="Surface métal" inverse onChange={e => setMetal(e.target.checked)} />
```

Off = outlined track with ink thumb; On = solid ink track with white thumb. `label` adds text, `showState` adds a mono ON/OFF readout, `inverse` is for the dark viewport. Controlled (`checked`) or uncontrolled (`defaultChecked`). Never colored.
