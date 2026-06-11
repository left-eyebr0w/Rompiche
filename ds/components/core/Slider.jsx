import React from "react";

/* Slider: monochrome parameter control with optional mono value readout. */
const CSS = `
.ds-slider{ display:flex; flex-direction:column; gap:.45rem; font-family:var(--font-sans);
  color:var(--text-primary); }
.ds-slider__top{ display:flex; align-items:baseline; justify-content:space-between; gap:1rem; }
.ds-slider__label{ font-size:var(--text-sm); }
.ds-slider__value{ font-family:var(--font-mono); font-size:var(--text-xs);
  letter-spacing:var(--tracking-tag); color:var(--text-secondary); font-variant-numeric:tabular-nums; }
.ds-slider input[type=range]{
  -webkit-appearance:none; appearance:none; width:100%; height:1.1rem; background:transparent; cursor:pointer; margin:0;
}
/* track */
.ds-slider input[type=range]::-webkit-slider-runnable-track{
  height:2px; background:var(--gris-300); border-radius:var(--radius-pill); }
.ds-slider input[type=range]::-moz-range-track{
  height:2px; background:var(--gris-300); border-radius:var(--radius-pill); }
/* thumb */
.ds-slider input[type=range]::-webkit-slider-thumb{
  -webkit-appearance:none; appearance:none; margin-top:-7px;
  width:16px; height:16px; border-radius:var(--radius-pill);
  background:var(--noir); border:2px solid var(--blanc); box-shadow:0 0 0 1px var(--noir); }
.ds-slider input[type=range]::-moz-range-thumb{
  width:16px; height:16px; border-radius:var(--radius-pill);
  background:var(--noir); border:2px solid var(--blanc); box-shadow:0 0 0 1px var(--noir); }
.ds-slider input[type=range]:focus-visible::-webkit-slider-thumb{ outline:var(--border-bold) solid var(--focus-ring); outline-offset:2px; }
/* inverse: dark viewport */
.ds-slider--inverse{ color:var(--on-ink-primary); }
.ds-slider--inverse .ds-slider__value{ color:var(--on-ink-muted); }
.ds-slider--inverse input[type=range]::-webkit-slider-runnable-track{ background:var(--gris-700); }
.ds-slider--inverse input[type=range]::-moz-range-track{ background:var(--gris-700); }
.ds-slider--inverse input[type=range]::-webkit-slider-thumb{ background:var(--blanc); border-color:var(--canvas-noir); box-shadow:0 0 0 1px var(--blanc); }
.ds-slider--inverse input[type=range]::-moz-range-thumb{ background:var(--blanc); border-color:var(--canvas-noir); box-shadow:0 0 0 1px var(--blanc); }
.ds-slider--disabled{ opacity:.4; pointer-events:none; }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Slider");
  el.textContent = CSS;
  document.head.appendChild(el);
}

export function Slider({
  label = null,
  value,
  defaultValue,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  formatValue,
  showValue = true,
  inverse = false,
  disabled = false,
  className = "",
  ...rest
}) {
  ensureStyles();
  const current = value != null ? value : defaultValue;
  const display =
    typeof formatValue === "function" ? formatValue(current) : current;
  const cls = [
    "ds-slider",
    inverse ? "ds-slider--inverse" : "",
    disabled ? "ds-slider--disabled" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls}>
      {(label != null || showValue) && (
        <div className="ds-slider__top">
          {label != null && <span className="ds-slider__label">{label}</span>}
          {showValue && <span className="ds-slider__value">{display}</span>}
        </div>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        defaultValue={defaultValue}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
    </div>
  );
}
