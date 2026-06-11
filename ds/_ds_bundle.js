/* @ds-bundle: {"format":3,"namespace":"DioramaSonoreDesignSystem_6d9bc4","components":[{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Callout","sourcePath":"components/core/Callout.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Eyebrow","sourcePath":"components/core/Eyebrow.jsx"},{"name":"Slider","sourcePath":"components/core/Slider.jsx"},{"name":"Switch","sourcePath":"components/core/Switch.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"}],"sourceHashes":{"components/core/Button.jsx":"bb92badd0dd9","components/core/Callout.jsx":"0055bb47b8da","components/core/Card.jsx":"181fdb5f5296","components/core/Eyebrow.jsx":"49ba49b4149c","components/core/Slider.jsx":"7672ef930a73","components/core/Switch.jsx":"2f0f414e227e","components/core/Tag.jsx":"6c00d3ae7247","ui_kits/diorama/ControlHUD.jsx":"b97661a7e94c","ui_kits/diorama/DioramaApp.jsx":"e3c178af48b4","ui_kits/diorama/WireframeCube.jsx":"aec8e889a590","ui_kits/docs/DocsSite.jsx":"e0da709efa56"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.DioramaSonoreDesignSystem_6d9bc4 = window.DioramaSonoreDesignSystem_6d9bc4 || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/core/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Self-contained styles, injected once. Monochrome — emphasis by value + weight. */
const CSS = `
.ds-btn{
  --_bg: var(--noir);
  --_fg: var(--blanc);
  --_bd: var(--noir);
  display:inline-flex; align-items:center; justify-content:center; gap:.5em;
  font-family:var(--font-sans); font-weight:var(--weight-semibold);
  line-height:1; white-space:nowrap; cursor:pointer; user-select:none;
  border:var(--border-hair) solid var(--_bd); border-radius:var(--radius-sm);
  background:var(--_bg); color:var(--_fg);
  transition: background var(--dur-fast) var(--ease-standard),
              color var(--dur-fast) var(--ease-standard),
              border-color var(--dur-fast) var(--ease-standard),
              opacity var(--dur-fast) var(--ease-standard);
}
.ds-btn:focus-visible{ outline:var(--border-bold) solid var(--focus-ring); outline-offset:2px; }
/* sizes */
.ds-btn--sm{ font-size:var(--text-sm); padding:.4rem .7rem; }
.ds-btn--md{ font-size:var(--text-md); padding:.55rem 1rem; }
.ds-btn--lg{ font-size:var(--text-lg); padding:.7rem 1.3rem; }
/* primary: solid ink */
.ds-btn--primary{ --_bg:var(--noir); --_fg:var(--blanc); --_bd:var(--noir); }
.ds-btn--primary:hover{ --_bg:var(--gris-900); }
/* secondary: outline */
.ds-btn--secondary{ --_bg:var(--blanc); --_fg:var(--noir); --_bd:var(--noir); }
.ds-btn--secondary:hover{ --_bg:var(--gris-100); }
/* ghost: no chrome until hover */
.ds-btn--ghost{ --_bg:transparent; --_fg:var(--noir); --_bd:transparent; }
.ds-btn--ghost:hover{ --_bg:var(--gris-100); }
/* on dark viewport */
.ds-btn--inverse{ --_bg:var(--blanc); --_fg:var(--noir); --_bd:var(--blanc); }
.ds-btn--inverse:hover{ --_bg:var(--gris-200); }
.ds-btn--inverse-ghost{ --_bg:transparent; --_fg:var(--blanc); --_bd:var(--gris-700); }
.ds-btn--inverse-ghost:hover{ --_bg:var(--gris-900); --_bd:var(--gris-500); }
.ds-btn[disabled]{ cursor:not-allowed; opacity:.4; }
.ds-btn--mono{ font-family:var(--font-mono); font-weight:var(--weight-medium);
  letter-spacing:var(--tracking-tag); text-transform:uppercase; font-size:var(--text-xs); }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Button");
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Button({
  children,
  variant = "primary",
  size = "md",
  mono = false,
  iconLeft = null,
  iconRight = null,
  as = "button",
  className = "",
  ...rest
}) {
  ensureStyles();
  const Tag = as;
  const cls = ["ds-btn", `ds-btn--${variant}`, `ds-btn--${size}`, mono ? "ds-btn--mono" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), iconLeft, children != null && /*#__PURE__*/React.createElement("span", null, children), iconRight);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Callout.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Callout: left-bordered aside. Mirrors source .callout / .callout.muted. */
const CSS = `
.ds-callout{
  border-left:3px solid var(--noir);
  background:var(--blanc);
  padding:.9rem 1.2rem; margin:1.5rem 0;
  border-radius:0 var(--radius-sm) var(--radius-sm) 0;
  box-shadow:var(--shadow-xs);
  font-family:var(--font-sans); color:var(--text-primary);
  line-height:var(--leading-normal); font-size:var(--text-md);
}
.ds-callout--muted{
  border-left-color:var(--gris-500);
  color:var(--text-secondary); font-size:var(--text-sm);
}
.ds-callout--inverse{
  background:var(--gris-900); border-left-color:var(--blanc);
  color:var(--on-ink-primary); box-shadow:none;
}
.ds-callout__title{ font-weight:var(--weight-bold); }
.ds-callout > :first-child{ margin-top:0; }
.ds-callout > :last-child{ margin-bottom:0; }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Callout");
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Callout({
  children,
  variant = "default",
  title = null,
  className = "",
  ...rest
}) {
  ensureStyles();
  const cls = ["ds-callout", variant !== "default" ? `ds-callout--${variant}` : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", _extends({
    className: cls
  }, rest), title && /*#__PURE__*/React.createElement("strong", {
    className: "ds-callout__title"
  }, title, " "), children);
}
Object.assign(__ds_scope, { Callout });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Callout.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Card: white panel, hairline border → black on hover, soft lift. */
const CSS = `
.ds-card{
  display:block; background:var(--surface);
  border:var(--border-hair) solid var(--border);
  border-radius:var(--radius-md);
  padding:var(--space-5); color:var(--text-primary);
  text-decoration:none;
  transition: border-color var(--dur-fast) var(--ease-standard),
              transform var(--dur-fast) var(--ease-standard),
              box-shadow var(--dur-fast) var(--ease-standard);
}
a.ds-card, .ds-card--interactive{ cursor:pointer; }
a.ds-card:hover, .ds-card--interactive:hover{
  border-color:var(--border-strong);
  transform:translateY(-2px);
  box-shadow:var(--shadow-md);
}
.ds-card--disabled{ opacity:.55; pointer-events:none; border-style:dashed; }
.ds-card--flush{ padding:0; }
.ds-card__head{ display:flex; align-items:flex-start; justify-content:space-between; gap:var(--space-3); }
.ds-card__title{ margin:0 0 .35rem; font-family:var(--font-sans);
  font-size:var(--text-lg); font-weight:var(--weight-semibold); line-height:var(--leading-snug); }
.ds-card__body{ margin:0; font-size:var(--text-sm); color:var(--text-muted);
  line-height:var(--leading-normal); }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Card");
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Card({
  children,
  title = null,
  meta = null,
  interactive = false,
  disabled = false,
  flush = false,
  as = "div",
  className = "",
  ...rest
}) {
  ensureStyles();
  const Tag = as;
  const cls = ["ds-card", interactive ? "ds-card--interactive" : "", disabled ? "ds-card--disabled" : "", flush ? "ds-card--flush" : "", className].filter(Boolean).join(" ");
  const hasHead = title != null || meta != null;
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), hasHead && /*#__PURE__*/React.createElement("div", {
    className: "ds-card__head"
  }, title != null && /*#__PURE__*/React.createElement("h3", {
    className: "ds-card__title"
  }, title), meta), children != null && /*#__PURE__*/React.createElement("div", {
    className: "ds-card__body"
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Eyebrow.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Eyebrow / kicker: uppercase mono label above a heading. */
const CSS = `
.ds-eyebrow{
  display:inline-block; font-family:var(--font-mono);
  font-weight:var(--weight-semibold); font-size:var(--type-eyebrow-size);
  letter-spacing:var(--tracking-eyebrow); text-transform:uppercase;
  color:var(--text-muted); line-height:1.2;
}
.ds-eyebrow--inverse{ color:var(--on-ink-faint); }
.ds-eyebrow--ink{ color:var(--text-primary); }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Eyebrow");
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Eyebrow({
  children,
  tone = "muted",
  as = "span",
  className = "",
  ...rest
}) {
  ensureStyles();
  const Tag = as;
  const cls = ["ds-eyebrow", tone === "inverse" ? "ds-eyebrow--inverse" : "", tone === "ink" ? "ds-eyebrow--ink" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement(Tag, _extends({
    className: cls
  }, rest), children);
}
Object.assign(__ds_scope, { Eyebrow });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Eyebrow.jsx", error: String((e && e.message) || e) }); }

// components/core/Slider.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
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
function Slider({
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
  const display = typeof formatValue === "function" ? formatValue(current) : current;
  const cls = ["ds-slider", inverse ? "ds-slider--inverse" : "", disabled ? "ds-slider--disabled" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("div", {
    className: cls
  }, (label != null || showValue) && /*#__PURE__*/React.createElement("div", {
    className: "ds-slider__top"
  }, label != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-slider__label"
  }, label), showValue && /*#__PURE__*/React.createElement("span", {
    className: "ds-slider__value"
  }, display)), /*#__PURE__*/React.createElement("input", _extends({
    type: "range",
    min: min,
    max: max,
    step: step,
    value: value,
    defaultValue: defaultValue,
    onChange: onChange,
    disabled: disabled
  }, rest)));
}
Object.assign(__ds_scope, { Slider });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Slider.jsx", error: String((e && e.message) || e) }); }

// components/core/Switch.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Switch: monochrome on/off toggle. Off = outlined track, On = solid ink. */
const CSS = `
.ds-switch{ display:inline-flex; align-items:center; gap:.6rem; cursor:pointer;
  font-family:var(--font-sans); font-size:var(--text-sm); color:var(--text-primary); user-select:none; }
.ds-switch input{ position:absolute; opacity:0; width:0; height:0; }
.ds-switch__track{
  position:relative; flex:0 0 auto; width:2.4rem; height:1.3rem;
  border-radius:var(--radius-pill);
  border:var(--border-hair) solid var(--border-strong);
  background:var(--blanc);
  transition: background var(--dur-base) var(--ease-standard);
}
.ds-switch__thumb{
  position:absolute; top:50%; left:.18rem; transform:translateY(-50%);
  width:.86rem; height:.86rem; border-radius:var(--radius-pill);
  background:var(--noir);
  transition: transform var(--dur-base) var(--ease-standard),
              background var(--dur-base) var(--ease-standard);
}
.ds-switch input:checked + .ds-switch__track{ background:var(--noir); }
.ds-switch input:checked + .ds-switch__track .ds-switch__thumb{
  transform:translate(1.1rem,-50%); background:var(--blanc); }
.ds-switch input:focus-visible + .ds-switch__track{ outline:var(--border-bold) solid var(--focus-ring); outline-offset:2px; }
.ds-switch--disabled{ opacity:.4; cursor:not-allowed; }
/* inverse: dark viewport */
.ds-switch--inverse{ color:var(--on-ink-primary); }
.ds-switch--inverse .ds-switch__track{ border-color:var(--gris-500); background:transparent; }
.ds-switch--inverse .ds-switch__thumb{ background:var(--blanc); }
.ds-switch--inverse input:checked + .ds-switch__track{ background:var(--blanc); }
.ds-switch--inverse input:checked + .ds-switch__track .ds-switch__thumb{ background:var(--noir); }
.ds-switch__label{ line-height:1.2; }
.ds-switch__state{ font-family:var(--font-mono); font-size:var(--text-2xs);
  letter-spacing:var(--tracking-tag); text-transform:uppercase; color:var(--text-muted); }
.ds-switch--inverse .ds-switch__state{ color:var(--on-ink-faint); }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Switch");
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Switch({
  checked,
  defaultChecked,
  onChange,
  label = null,
  showState = false,
  inverse = false,
  disabled = false,
  className = "",
  ...rest
}) {
  ensureStyles();
  const cls = ["ds-switch", inverse ? "ds-switch--inverse" : "", disabled ? "ds-switch--disabled" : "", className].filter(Boolean).join(" ");
  // derive ON/OFF for the state label when controlled or uncontrolled
  const stateOn = checked != null ? checked : defaultChecked;
  return /*#__PURE__*/React.createElement("label", {
    className: cls
  }, /*#__PURE__*/React.createElement("input", _extends({
    type: "checkbox",
    checked: checked,
    defaultChecked: defaultChecked,
    onChange: onChange,
    disabled: disabled
  }, rest)), /*#__PURE__*/React.createElement("span", {
    className: "ds-switch__track"
  }, /*#__PURE__*/React.createElement("span", {
    className: "ds-switch__thumb"
  })), label != null && /*#__PURE__*/React.createElement("span", {
    className: "ds-switch__label"
  }, label), showState && /*#__PURE__*/React.createElement("span", {
    className: "ds-switch__state"
  }, stateOn ? "on" : "off"));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Switch.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/* Tag / pill label. Mirrors the source .tag (default / spec / tbd-dashed). */
const CSS = `
.ds-tag{
  display:inline-flex; align-items:center; gap:.4em; vertical-align:middle;
  font-family:var(--font-mono); font-weight:var(--weight-medium);
  font-size:var(--text-2xs); letter-spacing:var(--tracking-tag);
  text-transform:uppercase; line-height:1;
  padding:.28em .6em; border-radius:var(--radius-pill);
  border:var(--border-hair) solid var(--border-muted);
  color:var(--text-secondary); background:var(--blanc);
}
/* spec = decided / authoritative: black border + ink */
.ds-tag--spec{ border-color:var(--noir); color:var(--noir); }
/* tbd = open / placeholder: dashed */
.ds-tag--tbd{ border-style:dashed; color:var(--text-muted); }
/* solid = filled ink chip */
.ds-tag--solid{ background:var(--noir); color:var(--blanc); border-color:var(--noir); }
/* on dark viewport */
.ds-tag--inverse{ background:transparent; color:var(--on-ink-muted); border-color:var(--on-ink-border); }
.ds-tag--inverse.ds-tag--spec{ color:var(--blanc); border-color:var(--blanc); }
.ds-tag__dot{ width:.42em; height:.42em; border-radius:var(--radius-pill); background:currentColor; }
`;
let injected = false;
function ensureStyles() {
  if (injected || typeof document === "undefined") return;
  injected = true;
  const el = document.createElement("style");
  el.setAttribute("data-ds", "Tag");
  el.textContent = CSS;
  document.head.appendChild(el);
}
function Tag({
  children,
  variant = "default",
  inverse = false,
  dot = false,
  className = "",
  ...rest
}) {
  ensureStyles();
  const cls = ["ds-tag", variant !== "default" ? `ds-tag--${variant}` : "", inverse ? "ds-tag--inverse" : "", className].filter(Boolean).join(" ");
  return /*#__PURE__*/React.createElement("span", _extends({
    className: cls
  }, rest), dot && /*#__PURE__*/React.createElement("span", {
    className: "ds-tag__dot"
  }), children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// ui_kits/diorama/ControlHUD.jsx
try { (() => {
/* ControlHUD — the v0 "test the engine" panel. Composes DS primitives
   (Switch, Slider, Button, Tag, Eyebrow). Presentational: state lives in App. */
const HUD_CSS = `
.hud{ width:340px; flex:0 0 340px; height:100%; background:var(--canvas-noir);
  border-left:1px solid var(--on-ink-border); display:flex; flex-direction:column;
  font-family:var(--font-sans); color:var(--on-ink-primary); }
.hud__head{ padding:20px 22px 16px; border-bottom:1px solid var(--on-ink-border);
  display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
.hud__title{ font-size:15px; font-weight:600; margin:6px 0 0; }
.hud__body{ flex:1; overflow-y:auto; padding:8px 22px 22px; }
.hud__sec{ padding:18px 0; border-bottom:1px solid var(--on-ink-border); }
.hud__sec:last-child{ border-bottom:none; }
.hud__sech{ display:flex; align-items:center; gap:8px; margin-bottom:14px; }
.hud__sech .ic{ color:var(--on-ink-muted); display:flex; }
.hud__sech .ic svg{ width:15px; height:15px; }
.hud__stack{ display:flex; flex-direction:column; gap:14px; }
/* clock segments (read-only — driven by real local time) */
.hud__clock{ display:grid; grid-template-columns:repeat(4,1fr); gap:1px;
  background:var(--on-ink-border); border:1px solid var(--on-ink-border); border-radius:var(--radius-sm); overflow:hidden; }
.hud__seg{ background:var(--canvas-noir); padding:8px 4px; text-align:center;
  font-family:var(--font-mono); font-size:9px; letter-spacing:.06em; text-transform:uppercase; color:var(--on-ink-faint); }
.hud__seg.active{ background:var(--blanc); color:var(--noir); font-weight:600; }
.hud__seg{ appearance:none; border:none; cursor:pointer;
  transition:background var(--dur-base) var(--ease-standard), color var(--dur-base) var(--ease-standard); }
.hud__seg:hover:not(.active){ background:rgba(255,255,255,.07); color:var(--on-ink-primary); }
.hud__clockmode{ display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:9px; }
.hud__synced{ font-family:var(--font-mono); font-size:9px; letter-spacing:.06em; text-transform:uppercase;
  color:var(--on-ink-faint); display:flex; align-items:center; gap:6px; }
.hud__synced::before{ content:""; width:5px; height:5px; border-radius:50%; background:var(--on-ink-faint); }
.hud__synced.live::before{ background:var(--blanc); }
.hud__foot{ padding:18px 22px; border-top:1px solid var(--on-ink-border); display:flex; flex-direction:column; gap:10px; }
.hud__note{ font-family:var(--font-mono); font-size:10px; color:var(--on-ink-faint); letter-spacing:.04em; line-height:1.5; }
.hud__btn-full > *{ width:100%; }
`;
(function () {
  if (typeof document === "undefined" || document.getElementById("hud-css")) return;
  const s = document.createElement("style");
  s.id = "hud-css";
  s.textContent = HUD_CSS;
  document.head.appendChild(s);
})();

/* Lucide icon — the substituted CDN icon set (thin monochrome line). */
function Icon({
  name,
  size = 16
}) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    if (window.lucide && ref.current) {
      ref.current.innerHTML = "";
      const el = document.createElement("i");
      el.setAttribute("data-lucide", name);
      ref.current.appendChild(el);
      try {
        window.lucide.createIcons({
          attrs: {
            width: size,
            height: size,
            "stroke-width": 1.6
          }
        });
      } catch (e) {}
    }
  }, [name, size]);
  return /*#__PURE__*/React.createElement("span", {
    className: "ic",
    ref: ref
  });
}
window.Icon = Icon;
function ControlHUD(props) {
  const DS = window.DioramaSonoreDesignSystem_6d9bc4;
  const {
    Switch,
    Slider,
    Button,
    Tag,
    Eyebrow
  } = DS;
  const {
    state,
    set,
    segments,
    clock,
    clockMode
  } = props;
  return /*#__PURE__*/React.createElement("aside", {
    className: "hud"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud__head"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "inverse"
  }, "Contr\xF4les moteur"), /*#__PURE__*/React.createElement("h2", {
    className: "hud__title"
  }, "Sc\xE8ne vitrine")), /*#__PURE__*/React.createElement(Tag, {
    variant: "spec",
    inverse: true,
    dot: true
  }, "v0")), /*#__PURE__*/React.createElement("div", {
    className: "hud__body"
  }, /*#__PURE__*/React.createElement("section", {
    className: "hud__sec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud__sech"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "cloud-rain"
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "inverse"
  }, "\xC9tat du monde")), /*#__PURE__*/React.createElement("div", {
    className: "hud__stack"
  }, /*#__PURE__*/React.createElement(Switch, {
    inverse: true,
    label: "Pluie",
    showState: true,
    checked: state.rain,
    onChange: e => set({
      rain: e.target.checked
    })
  }), /*#__PURE__*/React.createElement(Switch, {
    inverse: true,
    label: "Vent",
    showState: true,
    checked: state.wind,
    onChange: e => set({
      wind: e.target.checked
    })
  }), /*#__PURE__*/React.createElement(Slider, {
    inverse: true,
    label: "Vent \u2014 direction / force",
    min: -1,
    max: 1,
    step: 0.05,
    value: state.windDir,
    disabled: !state.wind,
    formatValue: v => v === 0 ? "nul" : (v < 0 ? "\u2190 " : "\u2192 ") + Math.abs(v).toFixed(2),
    onChange: e => set({
      windDir: parseFloat(e.target.value)
    })
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "hud__note",
    style: {
      marginBottom: 8
    }
  }, "Horloge interne \xB7 ", clockMode === "manual" ? "r\u00e9glage manuel" : "synchronis\u00e9e"), /*#__PURE__*/React.createElement("div", {
    className: "hud__clock"
  }, segments.map(s => /*#__PURE__*/React.createElement("button", {
    key: s,
    type: "button",
    className: "hud__seg" + (s === clock ? " active" : ""),
    onClick: () => set({
      clockMode: "manual",
      clockSegment: s
    })
  }, s))), /*#__PURE__*/React.createElement("div", {
    className: "hud__clockmode"
  }, /*#__PURE__*/React.createElement("span", {
    className: "hud__synced" + (clockMode === "sync" ? " live" : "")
  }, clockMode === "sync" ? "synchronis\u00e9e \u00e0 l'heure locale" : "d\u00e9coupl\u00e9e de l'heure r\u00e9elle"), /*#__PURE__*/React.createElement(Button, {
    variant: "inverse-ghost",
    size: "sm",
    mono: true,
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: "refresh-cw",
      size: 12
    }),
    disabled: clockMode === "sync",
    onClick: () => set({
      clockMode: "sync"
    })
  }, "Resync"))))), /*#__PURE__*/React.createElement("section", {
    className: "hud__sec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud__sech"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "box"
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "inverse"
  }, "\xC9l\xE9ments \xB7 surfaces")), /*#__PURE__*/React.createElement("div", {
    className: "hud__stack"
  }, /*#__PURE__*/React.createElement(Switch, {
    inverse: true,
    label: "Surface m\xE9tal",
    showState: true,
    checked: state.metal,
    onChange: e => set({
      metal: e.target.checked
    })
  }), /*#__PURE__*/React.createElement(Switch, {
    inverse: true,
    label: "Surface terre",
    showState: true,
    checked: state.earth,
    onChange: e => set({
      earth: e.target.checked
    })
  }))), /*#__PURE__*/React.createElement("section", {
    className: "hud__sec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud__sech"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "move-3d"
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "inverse"
  }, "T\xEAte de l'auditeur")), /*#__PURE__*/React.createElement("div", {
    className: "hud__stack"
  }, /*#__PURE__*/React.createElement(Slider, {
    inverse: true,
    label: "Axe X \u2014 gauche / droite",
    min: -1,
    max: 1,
    step: 0.01,
    value: state.x,
    formatValue: v => v.toFixed(2),
    onChange: e => set({
      x: parseFloat(e.target.value)
    })
  }), /*#__PURE__*/React.createElement(Slider, {
    inverse: true,
    label: "Axe Y \u2014 bas / haut",
    min: -1,
    max: 1,
    step: 0.01,
    value: state.y,
    formatValue: v => v.toFixed(2),
    onChange: e => set({
      y: parseFloat(e.target.value)
    })
  }), /*#__PURE__*/React.createElement(Slider, {
    inverse: true,
    label: "Axe Z \u2014 avant / arri\xE8re",
    min: -1,
    max: 1,
    step: 0.01,
    value: state.z,
    formatValue: v => v.toFixed(2),
    onChange: e => set({
      z: parseFloat(e.target.value)
    })
  }))), /*#__PURE__*/React.createElement("section", {
    className: "hud__sec"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud__sech"
  }, /*#__PURE__*/React.createElement(Icon, {
    name: "sliders-horizontal"
  }), /*#__PURE__*/React.createElement(Eyebrow, {
    tone: "inverse"
  }, "Param\xE8tres de grains")), /*#__PURE__*/React.createElement("div", {
    className: "hud__stack"
  }, /*#__PURE__*/React.createElement(Slider, {
    inverse: true,
    label: "Densit\xE9",
    min: 0,
    max: 1,
    step: 0.01,
    value: state.density,
    formatValue: v => v.toFixed(2),
    onChange: e => set({
      density: parseFloat(e.target.value)
    })
  }), /*#__PURE__*/React.createElement(Slider, {
    inverse: true,
    label: "Gain",
    min: -24,
    max: 0,
    step: 0.5,
    value: state.gain,
    formatValue: v => v.toFixed(1) + " dB",
    onChange: e => set({
      gain: parseFloat(e.target.value)
    })
  })))), /*#__PURE__*/React.createElement("div", {
    className: "hud__foot"
  }, /*#__PURE__*/React.createElement("div", {
    className: "hud__btn-full"
  }, /*#__PURE__*/React.createElement(Button, {
    variant: state.listening ? "inverse-ghost" : "inverse",
    iconLeft: /*#__PURE__*/React.createElement(Icon, {
      name: state.listening ? "pause" : "play",
      size: 15
    }),
    onClick: () => set({
      listening: !state.listening
    })
  }, state.listening ? "Écoute en cours" : "Lancer l'écoute")), /*#__PURE__*/React.createElement("div", {
    className: "hud__note"
  }, "Bus 6 canaux \xB7 HRTF natif \xB7 r\xE9verb. param\xE9trique interpol\xE9e")));
}
window.ControlHUD = ControlHUD;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/diorama/ControlHUD.jsx", error: String((e && e.message) || e) }); }

// ui_kits/diorama/DioramaApp.jsx
try { (() => {
/* DioramaApp — full v0 screen: dark viewport (wireframe cube) + control HUD. */
const APP_CSS = `
.dio{ position:fixed; inset:0; display:flex; background:var(--canvas-noir); font-family:var(--font-sans); }
.dio__view{ position:relative; flex:1; min-width:0; overflow:hidden; }
.dio__scrim{ position:absolute; inset:0; background:
  radial-gradient(120% 90% at 50% 40%, rgba(255,255,255,.03), transparent 60%); pointer-events:none; }
.dio__top{ position:absolute; top:0; left:0; right:0; padding:20px 26px; display:flex;
  align-items:flex-start; justify-content:space-between; z-index:6; }
.dio__brand{ display:flex; align-items:center; gap:12px; }
.dio__glyph{ width:26px;height:26px;perspective:180px;flex:0 0 26px; }
.dio__gcube{ width:18px;height:18px;position:relative;margin:4px;transform-style:preserve-3d;transform:rotateX(-24deg) rotateY(-32deg);}
.dio__gface{ position:absolute;width:18px;height:18px;border:1.4px solid var(--wire); }
.dio__name{ color:var(--on-ink-primary); font-size:16px; font-weight:600; letter-spacing:-.01em; line-height:1; }
.dio__sub{ font-family:var(--font-mono); font-size:9px; letter-spacing:.18em; text-transform:uppercase;
  color:var(--on-ink-faint); margin-top:4px; }
.dio__topr{ text-align:right; }
.dio__clock{ font-family:var(--font-mono); font-size:11px; letter-spacing:.1em; text-transform:uppercase; color:var(--on-ink-muted); }
.dio__mode{ font-family:var(--font-mono); font-size:9px; letter-spacing:.16em; text-transform:uppercase;
  color:var(--on-ink-faint); margin-bottom:3px; }
.dio__time{ font-family:var(--font-mono); font-size:22px; color:var(--on-ink-primary); font-variant-numeric:tabular-nums; line-height:1.2; }
.dio__meter{ display:flex; gap:4px; justify-content:flex-end; margin-top:10px; }
.dio__bar{ width:5px; background:var(--wire-faint); border-radius:1px; transition:height .12s linear, background .2s; }
.dio__hint{ position:absolute; left:26px; bottom:22px; z-index:6; font-family:var(--font-mono);
  font-size:10px; letter-spacing:.06em; color:var(--on-ink-faint); line-height:1.7; }
.dio__hint b{ color:var(--on-ink-muted); font-weight:500; }
`;
(function () {
  if (typeof document === "undefined" || document.getElementById("dio-css")) return;
  const s = document.createElement("style");
  s.id = "dio-css";
  s.textContent = APP_CSS;
  document.head.appendChild(s);
})();
const SEGMENTS = ["aube", "jour", "crépuscule", "nuit"];
function segmentFor(h) {
  if (h >= 5 && h < 8) return "aube";
  if (h >= 8 && h < 18) return "jour";
  if (h >= 18 && h < 21) return "crépuscule";
  return "nuit";
}
function DioramaApp() {
  const now = new Date();
  const [state, setState] = React.useState({
    rain: true,
    wind: false,
    windDir: 0.4,
    metal: true,
    earth: true,
    listening: false,
    x: 0.18,
    y: 0,
    z: -0.30,
    density: 0.42,
    gain: -6,
    spin: -32,
    zoom: 1,
    clockMode: "sync",
    clockSegment: "jour"
  });
  const [time, setTime] = React.useState(now);
  const set = patch => setState(s => ({
    ...s,
    ...patch
  }));

  // Drag orbit — axe Y uniquement
  const drag = React.useRef({
    active: false,
    lastX: 0
  });
  const viewRef = React.useRef(null);
  React.useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Fin du drag même si la souris quitte le viewport
  React.useEffect(() => {
    const onUp = () => {
      drag.current.active = false;
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, []);

  // Ctrl+molette → zoom (non-passive pour pouvoir appeler preventDefault)
  React.useEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const onWheel = e => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      setState(s => ({
        ...s,
        zoom: Math.min(2.5, Math.max(0.4, s.zoom + (e.deltaY > 0 ? -0.08 : 0.08)))
      }));
    };
    el.addEventListener('wheel', onWheel, {
      passive: false
    });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const handleMouseDown = e => {
    drag.current = {
      active: true,
      lastX: e.clientX
    };
  };
  const handleMouseMove = e => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.lastX;
    drag.current.lastX = e.clientX;
    setState(s => ({
      ...s,
      spin: s.spin + dx * 0.5
    }));
  };
  const realClock = segmentFor(time.getHours());
  const clock = state.clockMode === "manual" ? state.clockSegment : realClock;
  const hhmm = time.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit"
  });

  // a faux 6-channel level meter, animates when listening / raining
  const [levels, setLevels] = React.useState([3, 6, 4, 7, 5, 4]);
  React.useEffect(() => {
    const active = state.listening;
    const t = setInterval(() => {
      setLevels(prev => prev.map((_, i) => {
        const base = active ? state.rain ? 18 : 9 : 4;
        const span = active ? (state.rain ? 22 : 12) * state.density + 6 : 3;
        return Math.max(3, Math.round(base + Math.random() * span));
      }));
    }, active ? 140 : 600);
    return () => clearInterval(t);
  }, [state.listening, state.rain, state.density]);
  const WireframeCube = window.WireframeCube;
  const ControlHUD = window.ControlHUD;
  return /*#__PURE__*/React.createElement("div", {
    className: "dio"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dio__view",
    ref: viewRef,
    onMouseDown: handleMouseDown,
    onMouseMove: handleMouseMove
  }, /*#__PURE__*/React.createElement(WireframeCube, {
    size: Math.min(420, 380),
    head: {
      x: state.x,
      y: state.y,
      z: state.z
    },
    rain: state.rain,
    metal: state.metal,
    earth: state.earth,
    listening: state.listening,
    spin: state.spin,
    zoom: state.zoom,
    density: state.density,
    wind: state.wind,
    windDir: state.windDir
  }), /*#__PURE__*/React.createElement("div", {
    className: "dio__scrim"
  }), /*#__PURE__*/React.createElement("div", {
    className: "dio__top"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dio__brand"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dio__glyph"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dio__gcube"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dio__gface",
    style: {
      transform: "translateZ(9px)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dio__gface",
    style: {
      transform: "rotateY(90deg) translateZ(9px)",
      borderColor: "var(--wire-dim)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dio__gface",
    style: {
      transform: "rotateX(90deg) translateZ(9px)",
      borderColor: "var(--wire-dim)"
    }
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "dio__name"
  }, "Diorama sonore"), /*#__PURE__*/React.createElement("div", {
    className: "dio__sub"
  }, "v0 \xB7 prototype"))), /*#__PURE__*/React.createElement("div", {
    className: "dio__topr"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dio__mode"
  }, "horloge \xB7 ", state.clockMode === "manual" ? "manuel" : "sync"), /*#__PURE__*/React.createElement("div", {
    className: "dio__clock"
  }, clock), /*#__PURE__*/React.createElement("div", {
    className: "dio__time"
  }, hhmm), /*#__PURE__*/React.createElement("div", {
    className: "dio__meter"
  }, levels.map((l, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    className: "dio__bar",
    style: {
      height: Math.max(6, l) + "px",
      background: state.listening ? "var(--wire)" : "var(--wire-dim)"
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    className: "dio__hint"
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Glisser"), " dans le viewport pour orbiter la vue"), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("b", null, "Ctrl+molette"), " pour zoomer \xB7 ", /*#__PURE__*/React.createElement("b", null, "Axes XYZ"), " pour d\xE9placer l'auditeur"))), /*#__PURE__*/React.createElement(ControlHUD, {
    state: state,
    set: set,
    segments: SEGMENTS,
    clock: clock,
    clockMode: state.clockMode
  }));
}
window.DioramaApp = DioramaApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/diorama/DioramaApp.jsx", error: String((e && e.message) || e) }); }

// ui_kits/diorama/WireframeCube.jsx
try { (() => {
/* WireframeCube
   - wc-head-wrap has explicit HC×HC dimensions → top:50%;left:50%; children
     correctly resolve to the geometric centre.
   - Head-cube is fully solidary with the world-cube: no counter-rotation.
     It orbits naturally as the view spins, like any other element in the scene.
   - Rain: système de particules CSS 3D. Chaque goutte est un point (x,z) aléatoire
     dans l'espace du cube, animé le long de l'axe Y monde (plafond→sol).
     Chaîne preserve-3d : wc-cube → conteneur pluie → wrapper par goutte → span. */
const WC_CSS = `
.wc-stage{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  perspective:1200px; overflow:hidden; }
.wc-cube{ position:relative; transform-style:preserve-3d;
  transform: rotateX(-22deg) rotateY(var(--wc-spin,-32deg));
}
/* world-cube faces */
.wc-face{ position:absolute; border:1.5px solid; background:rgba(255,255,255,.01);
  top:50%; left:50%; }
.wc-face.wc-front{ border-color:var(--wire); }
.wc-face.wc-back,
.wc-face.wc-side,
.wc-face.wc-top,
.wc-face.wc-bottom{ border-color:var(--wire-dim); }
/* ground zones on bottom face */
.wc-zone{ position:absolute; top:0; height:100%; transition:opacity .2s var(--ease-standard); }
.wc-zone.off{ opacity:.15; }
.wc-zlabel{ position:absolute; font-family:var(--font-mono); font-size:10px; letter-spacing:.12em;
  text-transform:uppercase; color:var(--on-ink-faint); }
/* head-wrap: explicit size so % children resolve to the geometric centre */
.wc-head-wrap{ position:absolute; top:50%; left:50%; transform-style:preserve-3d;
  transition: transform .08s linear; }
/* head-cube (6-point binaural bus, solidary with the head).
   Counter-rotation is applied via inline style — see JSX. */
.wc-hcube{ position:absolute; top:0; left:0; transform-style:preserve-3d; }
.wc-hface{ position:absolute; border:1px dashed var(--wire); background:rgba(255,255,255,.02);
  top:50%; left:50%; }
.wc-hface.wc-hfront{ border-color:var(--blanc); }
/* speaker-point dot at centre of each head-cube face */
.wc-pt{ position:absolute; top:50%; left:50%; width:6px;height:6px;margin:-3px;border-radius:50%;
  background:var(--wire); box-shadow:0 0 0 3px rgba(255,255,255,.08); }
.wc-pt.wc-pt-main{ background:var(--blanc); width:7px;height:7px;margin:-3.5px;
  box-shadow:0 0 0 4px rgba(255,255,255,.12); }
/* head: white dot at the geometric centre of the head-cube — positioned via inline px (% fails in preserve-3d) */
.wc-head{ position:absolute; width:13px;height:13px;
  border-radius:50%; background:var(--blanc);
  box-shadow:0 0 0 4px rgba(255,255,255,.10),0 0 20px rgba(255,255,255,.2); z-index:5; }
.wc-head.listening{ animation: wc-pulse 1.8s ease-in-out infinite; }
@keyframes wc-pulse{ 0%,100%{ box-shadow:0 0 0 4px rgba(255,255,255,.10),0 0 16px rgba(255,255,255,.18);}
  50%{ box-shadow:0 0 0 9px rgba(255,255,255,.05),0 0 32px rgba(255,255,255,.38);} }
/* 3D rain — gouttes en espace-monde, tombent le long de l'axe Y du cube.
   Le wrapper donne la position statique (x,y0,z) ; le span anime la chute
   de -2H à +2H autour de y0. Sans animation (prefers-reduced-motion),
   chaque span est à translateY(0) et la position y0 suffit à remplir le volume. */
@keyframes wc-fall3d { from{ transform:translateY(-400px); } to{ transform:translateY(400px); } }
.wc-drop3d{ position:absolute; top:0; left:-.5px; width:1px; height:12px;
  background:linear-gradient(to bottom, var(--wire), transparent); pointer-events:none;
  animation: wc-fall3d linear infinite; }
@media (prefers-reduced-motion:reduce){ .wc-drop3d{ animation:none; } }
`;
(function () {
  if (typeof document === "undefined") return;
  let s = document.getElementById("wc-css");
  if (!s) {
    s = document.createElement("style");
    s.id = "wc-css";
    document.head.appendChild(s);
  }
  s.textContent = WC_CSS;
})();
function WireframeCube({
  size = 360,
  head = {
    x: 0,
    y: 0,
    z: 0
  },
  rain = true,
  metal = true,
  earth = true,
  listening = false,
  spin = -32,
  zoom = 1,
  density = 0.5,
  wind = false,
  windDir = 0
}) {
  const W = size,
    H = W / 2;
  const faceStyle = {
    width: W,
    height: W,
    marginLeft: -H,
    marginTop: -H
  };

  /* Head-cube: ~26% of world side */
  const HC = Math.round(W * 0.26);
  const HCH = HC / 2;
  const hcFaceStyle = {
    width: HC,
    height: HC,
    marginLeft: -HCH,
    marginTop: -HCH
  };

  /* Head position within the world (clamped so head-cube stays inside) */
  const limit = H - HCH - 10;
  const hx = head.x * limit;
  const hy = -head.y * limit;
  const hz = head.z * limit;

  /* Particules pluie — pool stable de gouttes réparties dans tout le VOLUME du
     cube : (x,z) aléatoires + phase de chute décalée (delay négatif) pour que
     toute la hauteur soit peuplée dès t=0 (et non une seule tranche). On n'affiche
     qu'une fraction du pool, pilotée par la densité ; le vent incline l'axe de chute. */
  const RAIN_POOL = 80;
  const drops = React.useMemo(() => Array.from({
    length: RAIN_POOL
  }, () => {
    const dur = 0.55 + Math.random() * 0.7;
    return {
      x: ((Math.random() * 2 - 1) * (H - 14)).toFixed(1),
      y0: ((Math.random() * 2 - 1) * (H - 14)).toFixed(1),
      // position statique Y : remplit le volume même sans animation
      z: ((Math.random() * 2 - 1) * (H - 14)).toFixed(1),
      delay: (-Math.random() * dur).toFixed(2),
      // négatif → phase aléatoire dans la chute
      dur: dur.toFixed(2),
      op: (0.45 + Math.random() * 0.55).toFixed(2)
    };
  }), [size]);
  const dropCount = rain ? Math.round(12 + density * (RAIN_POOL - 12)) : 0;
  const windAngle = wind ? windDir * 30 : 0; // inclinaison de la pluie (°)
  const streakH = 12 + (wind ? Math.abs(windDir) * 12 : 0); // traînées allongées par le vent

  const worldFaces = [{
    cn: "wc-front",
    t: `translateZ(${H}px)`,
    ground: false
  }, {
    cn: "wc-back",
    t: `rotateY(180deg) translateZ(${H}px)`,
    ground: false
  }, {
    cn: "wc-side",
    t: `rotateY(90deg) translateZ(${H}px)`,
    ground: false
  }, {
    cn: "wc-side",
    t: `rotateY(-90deg) translateZ(${H}px)`,
    ground: false
  }, {
    cn: "wc-top",
    t: `rotateX(90deg) translateZ(${H}px)`,
    ground: false
  }, {
    cn: "wc-bottom",
    t: `rotateX(-90deg) translateZ(${H}px)`,
    ground: true
  }];
  const headFaces = [{
    cn: "wc-hfront",
    t: `translateZ(${HCH}px)`
  }, {
    cn: "",
    t: `rotateY(180deg) translateZ(${HCH}px)`
  }, {
    cn: "",
    t: `rotateY(90deg) translateZ(${HCH}px)`
  }, {
    cn: "",
    t: `rotateY(-90deg) translateZ(${HCH}px)`
  }, {
    cn: "",
    t: `rotateX(90deg) translateZ(${HCH}px)`
  }, {
    cn: "",
    t: `rotateX(-90deg) translateZ(${HCH}px)`
  }];
  return /*#__PURE__*/React.createElement("div", {
    className: "wc-stage",
    style: {
      transform: `scale(${zoom})`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "wc-cube",
    style: {
      width: W,
      height: W,
      "--wc-spin": spin + "deg"
    }
  }, worldFaces.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: "w" + i,
    className: "wc-face " + f.cn,
    style: {
      ...faceStyle,
      transform: f.t
    }
  }, f.ground && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "wc-zone" + (metal ? "" : " off"),
    style: {
      left: 0,
      width: "50%",
      backgroundImage: "repeating-linear-gradient(45deg,var(--wire-dim) 0 1px,transparent 1px 12px)"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "wc-zlabel",
    style: {
      top: 7,
      left: 7
    }
  }, "m\xE9tal")), /*#__PURE__*/React.createElement("div", {
    className: "wc-zone" + (earth ? "" : " off"),
    style: {
      left: "50%",
      width: "50%",
      backgroundImage: "radial-gradient(var(--wire-dim) .7px,transparent 1px)",
      backgroundSize: "11px 11px"
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "wc-zlabel",
    style: {
      top: 7,
      right: 7
    }
  }, "terre")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "absolute",
      left: "50%",
      top: 0,
      bottom: 0,
      width: 1,
      background: "var(--wire-faint)"
    }
  })))), /*#__PURE__*/React.createElement("div", {
    className: "wc-head-wrap",
    style: {
      width: HC,
      height: HC,
      marginLeft: -HCH,
      marginTop: -HCH,
      transform: `translate3d(${hx}px,${hy}px,${hz}px)`
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "wc-hcube",
    style: {
      width: HC,
      height: HC
    }
  }, headFaces.map((f, i) => /*#__PURE__*/React.createElement("div", {
    key: "h" + i,
    className: "wc-hface " + (f.cn || ""),
    style: {
      ...hcFaceStyle,
      transform: f.t
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "wc-pt" + (i === 0 ? " wc-pt-main" : "")
  })))), /*#__PURE__*/React.createElement("div", {
    className: "wc-head" + (listening ? " listening" : ""),
    style: {
      top: HCH - 6.5,
      left: HCH - 6.5
    }
  }), "        "), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      width: 0,
      height: 0,
      transformStyle: 'preserve-3d',
      opacity: rain ? 0.85 : 0,
      transition: 'opacity .35s',
      pointerEvents: 'none'
    }
  }, drops.slice(0, dropCount).map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: "r" + i,
    style: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      transform: `translate3d(${d.x}px,${d.y0}px,${d.z}px) rotateZ(${windAngle}deg)`,
      transformStyle: 'preserve-3d',
      transition: 'transform .4s var(--ease-standard)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "wc-drop3d",
    style: {
      animationDelay: d.delay + 's',
      animationDuration: d.dur + 's',
      opacity: d.op,
      height: streakH + 'px'
    }
  }))))));
}
window.WireframeCube = WireframeCube;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/diorama/WireframeCube.jsx", error: String((e && e.message) || e) }); }

// ui_kits/docs/DocsSite.jsx
try { (() => {
/* DocsSite — faithful recreation of docs/ (black sidebar + document column).
   Rebuilt on DS tokens + primitives; visual parity with docs/assets/style.css. */
const DOCS_CSS = `
.dx{ display:flex; min-height:100vh; background:var(--bg); font-family:var(--font-sans);
  color:var(--text-primary); line-height:var(--leading-normal); }
.dx__side{ width:var(--sidebar-w); flex:0 0 var(--sidebar-w); background:var(--noir);
  color:var(--gris-200); padding:28px 20px; position:sticky; top:0; height:100vh; overflow-y:auto;
  border-right:1px solid var(--gris-700); }
.dx__brand{ display:flex; align-items:center; gap:11px; color:var(--blanc); text-decoration:none; }
.dx__glyph{ width:24px;height:24px;perspective:160px;flex:0 0 24px; }
.dx__gcube{ width:16px;height:16px;position:relative;margin:4px;transform-style:preserve-3d;transform:rotateX(-24deg) rotateY(-32deg);}
.dx__gface{ position:absolute;width:16px;height:16px;border:1.3px solid var(--blanc); }
.dx__bname{ font-weight:700; font-size:16px; letter-spacing:.01em; }
.dx__bsub{ display:block; color:var(--gris-500); font-family:var(--font-mono); font-weight:400;
  font-size:9px; letter-spacing:.18em; text-transform:uppercase; margin-top:3px; }
.dx__nav{ margin-top:30px; }
.dx__ntitle{ display:block; color:var(--gris-500); font-family:var(--font-mono); font-size:10px;
  font-weight:600; text-transform:uppercase; letter-spacing:.12em; margin-bottom:10px; padding-left:3px; }
.dx__nav ul{ list-style:none; margin:0 0 24px; padding:0; }
.dx__link{ display:block; width:100%; text-align:left; color:var(--gris-200); background:none; border:none;
  cursor:pointer; font:inherit; padding:7px 10px; border-radius:var(--radius-sm); font-size:14px;
  border-left:2px solid transparent; transition:background var(--dur-fast), color var(--dur-fast); }
.dx__link:hover{ background:var(--gris-900); color:var(--blanc); }
.dx__link.active{ background:var(--gris-900); color:var(--blanc); border-left:2px solid var(--blanc); font-weight:600; }
.dx__ndis{ color:var(--gris-700); font-size:13px; padding:7px 10px; font-style:italic; }
.dx__main{ flex:1; min-width:0; padding:48px 40px 80px; display:flex; justify-content:center; }
.dx__article{ width:100%; max-width:var(--content-max); }
.dx__crumb{ font-size:13px; color:var(--text-muted); margin-bottom:22px; }
.dx__crumb button{ background:none;border:none;cursor:pointer;font:inherit;color:var(--text-muted);padding:0;}
.dx__crumb button:hover{ color:var(--text-primary); }
.dx__crumb span{ margin:0 7px; }
.dx__h1{ font-size:var(--text-2xl); line-height:1.2; letter-spacing:var(--tracking-tight); margin:8px 0 0; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.dx__lead{ font-size:var(--text-lg); color:var(--text-secondary); margin:14px 0 24px; line-height:1.5; }
.dx__h2{ font-size:var(--text-xl); margin:36px 0 12px; padding-bottom:8px; border-bottom:1px solid var(--gris-200); }
.dx__p{ margin:12px 0; }
.dx__p strong{ font-weight:700; } .dx__p em{ font-style:italic; }
.dx__ol,.dx__ul{ padding-left:22px; margin:12px 0; } .dx__ol li,.dx__ul li{ margin:6px 0; }
.dx__grid{ display:grid; grid-template-columns:repeat(auto-fill,minmax(240px,1fr)); gap:16px; margin:22px 0; }
.dx__foot{ margin-top:52px; padding-top:20px; border-top:1px solid var(--gris-200); display:flex;
  justify-content:space-between; gap:16px; font-size:14px; }
.dx__pager{ background:none;border:none;cursor:pointer;font:inherit;color:var(--text-secondary);text-align:left;padding:0;}
.dx__pager:hover{ color:var(--text-primary); }
.dx__pager.next{ text-align:right; }
.dx__plabel{ display:block; font-family:var(--font-mono); font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--text-faint); margin-bottom:3px; }
`;
(function () {
  if (typeof document === "undefined" || document.getElementById("docs-css")) return;
  const s = document.createElement("style");
  s.id = "docs-css";
  s.textContent = DOCS_CSS;
  document.head.appendChild(s);
})();
const DOCS_PAGES = [{
  id: "presentation",
  nav: "Présentation",
  crumb: "Présentation",
  eyebrow: "Branche Cadrage",
  title: "Présentation & principes",
  lead: "Cette branche cadre le projet : ce que l'on construit, pourquoi, et selon quelles règles non-négociables.",
  render: C => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(C.Callout, {
    variant: "muted"
  }, /*#__PURE__*/React.createElement("em", null, "Nom de code : \xE0 d\xE9finir."), " Le cadrage sp\xE9cifie la ", /*#__PURE__*/React.createElement("strong", null, "v0 (prototype)"), " ; les sections vision, principes, mod\xE8le et architecture valent pour toutes les versions."), /*#__PURE__*/React.createElement("h2", {
    className: "dx__h2"
  }, "1. Vision"), /*#__PURE__*/React.createElement("p", {
    className: "dx__p"
  }, "Permettre au joueur de ", /*#__PURE__*/React.createElement("strong", null, "cr\xE9er de petits dioramas vivants au format cube"), ", low-poly (wireframe dans un premier temps), et d'y placer un personnage pour \xE9couter l'univers sonore qu'il a compos\xE9."), /*#__PURE__*/React.createElement("p", {
    className: "dx__p"
  }, "L'objectif n'est pas visuel mais ", /*#__PURE__*/React.createElement("strong", null, "auditif"), " : maximiser l'immersion au point que, ", /*#__PURE__*/React.createElement("em", null, "les yeux ferm\xE9s, le joueur puisse croire qu'il s'est t\xE9l\xE9port\xE9 \xE0 l'int\xE9rieur du diorama"), "."), /*#__PURE__*/React.createElement("h2", {
    className: "dx__h2"
  }, "2. Principes non-n\xE9gociables"), /*#__PURE__*/React.createElement("ol", {
    className: "dx__ol"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Priorit\xE9 1 \u2014 Qualit\xE9 audio."), " Toute d\xE9cision arbitre en faveur du r\xE9alisme de l'\xE9coute."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Priorit\xE9 2 \u2014 Faible co\xFBt computationnel."), " Sous la contrainte de la priorit\xE9 1, on minimise la charge."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "D\xE9couplage audio / rendu."), " Wireframes d'aujourd'hui et visuels de demain se branchent sur le m\xEAme graphe de sc\xE8ne."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Sandbox sans boucle d'engagement."), " Le plaisir est dans la cr\xE9ation et l'\xE9coute.")))
}, {
  id: "moteur",
  nav: "Le moteur (le cœur)",
  crumb: "Le moteur",
  eyebrow: "Branche Cadrage · §3",
  title: "Le modèle du moteur",
  lead: "La matrice d'interactions est la rencontre, dans le cube, des Émetteurs et des Surfaces — entendue depuis la tête de l'auditeur.",
  render: C => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(C.Callout, {
    title: "\xC9nonc\xE9 fondateur."
  }, /*#__PURE__*/React.createElement("strong", null, "\xC9metteurs"), " \xD7 ", /*#__PURE__*/React.createElement("strong", null, "Surfaces"), ", m\xE9di\xE9s par l'", /*#__PURE__*/React.createElement("strong", null, "\xE9tat du monde"), ", entendus depuis la ", /*#__PURE__*/React.createElement("strong", null, "t\xEAte de l'auditeur"), " \xE0 travers l'acoustique du cube."), /*#__PURE__*/React.createElement("h2", {
    className: "dx__h2"
  }, "3.3 Synth\xE8se granulaire"), /*#__PURE__*/React.createElement("p", {
    className: "dx__p"
  }, "Banques de ", /*#__PURE__*/React.createElement("strong", null, "grains"), " (impacts r\xE9els) dispers\xE9s proc\xE9duralement (timing, hauteur, gain, panoramique randomis\xE9s). La ", /*#__PURE__*/React.createElement("strong", null, "densit\xE9"), " est pilot\xE9e par un param\xE8tre d'intensit\xE9 \u2192 son ", /*#__PURE__*/React.createElement("strong", null, "infini, non r\xE9p\xE9titif"), "."), /*#__PURE__*/React.createElement("h2", {
    className: "dx__h2"
  }, "3.5 Spatialisation binaurale"), /*#__PURE__*/React.createElement("p", {
    className: "dx__p"
  }, "Autour de la t\xEAte, ", /*#__PURE__*/React.createElement("strong", null, "6 points"), " forment un bus de haut-parleurs virtuels solidaire d'elle. Seuls ces 6 canaux sont convolu\xE9s en ", /*#__PURE__*/React.createElement("strong", null, "HRTF"), "."), /*#__PURE__*/React.createElement(C.Callout, {
    title: "B\xE9n\xE9fice cl\xE9."
  }, " le co\xFBt de spatialisation est ", /*#__PURE__*/React.createElement("strong", null, "fixe (6 convolutions)"), ", ind\xE9pendant du nombre de grains jou\xE9s."))
}, {
  id: "perimetre",
  nav: "Périmètre de la v0",
  crumb: "Périmètre de la v0",
  eyebrow: "Branche Cadrage · §6",
  title: "Périmètre de la v0",
  titleTag: "spec",
  lead: "La v0 valide le moteur. Elle livre l'intégralité des mécaniques audio ; tout le reste est porté par les versions suivantes.",
  render: C => /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("h2", {
    className: "dx__h2"
  }, "Ce que livre la v0"), /*#__PURE__*/React.createElement("ul", {
    className: "dx__ul"
  }, /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Moteur audio complet"), " : graphe de sc\xE8ne, matrice d'interactions, synth\xE8se granulaire, \xE9tat du monde, bus 6 canaux, HRTF, r\xE9verb. param\xE9trique."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Sons :"), " uniquement ", /*#__PURE__*/React.createElement("strong", null, "pluie (on/off) \xD7 ", "{", "m\xE9tal, terre", "}"), "."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Graphismes :"), " ", /*#__PURE__*/React.createElement("strong", null, "wireframe, en noir / gris / blanc uniquement"), "."), /*#__PURE__*/React.createElement("li", null, /*#__PURE__*/React.createElement("strong", null, "Contenu :"), " une seule sc\xE8ne vitrine.")), /*#__PURE__*/React.createElement(C.Callout, {
    title: "Objectif."
  }, " prouver que la m\xE9canique \xAB sonne juste \xBB \u2014 la pluie sur m\xE9tal et sur terre, entendue depuis une t\xEAte qui se d\xE9place."))
}];
window.DOCS_PAGES = DOCS_PAGES;
function Glyph() {
  return /*#__PURE__*/React.createElement("span", {
    className: "dx__glyph"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dx__gcube"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dx__gface",
    style: {
      transform: "translateZ(8px)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dx__gface",
    style: {
      transform: "rotateY(90deg) translateZ(8px)",
      borderColor: "var(--gris-500)"
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "dx__gface",
    style: {
      transform: "rotateX(90deg) translateZ(8px)",
      borderColor: "var(--gris-500)"
    }
  })));
}
function DocsApp() {
  const DS = window.DioramaSonoreDesignSystem_6d9bc4;
  const C = {
    Callout: DS.Callout,
    Card: DS.Card,
    Tag: DS.Tag,
    Eyebrow: DS.Eyebrow
  };
  const pages = window.DOCS_PAGES;
  const [idx, setIdx] = React.useState(0);
  const page = pages[idx];
  const go = i => {
    if (i >= 0 && i < pages.length) setIdx(i);
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "dx"
  }, /*#__PURE__*/React.createElement("aside", {
    className: "dx__side"
  }, /*#__PURE__*/React.createElement("button", {
    className: "dx__brand",
    onClick: () => go(0),
    style: {
      background: "none",
      border: "none",
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement(Glyph, null), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    className: "dx__bname"
  }, "Diorama sonore"), /*#__PURE__*/React.createElement("span", {
    className: "dx__bsub"
  }, "Documentation"))), /*#__PURE__*/React.createElement("nav", {
    className: "dx__nav"
  }, /*#__PURE__*/React.createElement("span", {
    className: "dx__ntitle"
  }, "Branche \xB7 Cadrage"), /*#__PURE__*/React.createElement("ul", null, pages.map((p, i) => /*#__PURE__*/React.createElement("li", {
    key: p.id
  }, /*#__PURE__*/React.createElement("button", {
    className: "dx__link" + (i === idx ? " active" : ""),
    onClick: () => go(i)
  }, p.nav)))), /*#__PURE__*/React.createElement("span", {
    className: "dx__ntitle"
  }, "Autres branches"), /*#__PURE__*/React.createElement("span", {
    className: "dx__ndis"
  }, "\xC0 venir"))), /*#__PURE__*/React.createElement("main", {
    className: "dx__main"
  }, /*#__PURE__*/React.createElement("article", {
    className: "dx__article"
  }, /*#__PURE__*/React.createElement("div", {
    className: "dx__crumb"
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => go(0)
  }, "Documentation"), /*#__PURE__*/React.createElement("span", null, "/"), /*#__PURE__*/React.createElement("button", {
    onClick: () => go(0)
  }, "Cadrage"), /*#__PURE__*/React.createElement("span", null, "/"), page.crumb), /*#__PURE__*/React.createElement(C.Eyebrow, null, page.eyebrow), /*#__PURE__*/React.createElement("h1", {
    className: "dx__h1"
  }, page.title, page.titleTag && /*#__PURE__*/React.createElement(C.Tag, {
    variant: "spec"
  }, "sp\xE9cifi\xE9e")), /*#__PURE__*/React.createElement("p", {
    className: "dx__lead"
  }, page.lead), page.render(C), /*#__PURE__*/React.createElement("div", {
    className: "dx__foot"
  }, idx > 0 ? /*#__PURE__*/React.createElement("button", {
    className: "dx__pager",
    onClick: () => go(idx - 1)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dx__plabel"
  }, "Pr\xE9c\xE9dent"), "\u2190 ", pages[idx - 1].nav) : /*#__PURE__*/React.createElement("span", null), idx < pages.length - 1 ? /*#__PURE__*/React.createElement("button", {
    className: "dx__pager next",
    onClick: () => go(idx + 1)
  }, /*#__PURE__*/React.createElement("span", {
    className: "dx__plabel"
  }, "Suivant"), pages[idx + 1].nav, " \u2192") : /*#__PURE__*/React.createElement("span", null)))));
}
window.DocsApp = DocsApp;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/docs/DocsSite.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Callout = __ds_scope.Callout;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Eyebrow = __ds_scope.Eyebrow;

__ds_ns.Slider = __ds_scope.Slider;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.Tag = __ds_scope.Tag;

})();
