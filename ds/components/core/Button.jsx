import React from "react";

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

export function Button({
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
  const cls = [
    "ds-btn",
    `ds-btn--${variant}`,
    `ds-btn--${size}`,
    mono ? "ds-btn--mono" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {iconLeft}
      {children != null && <span>{children}</span>}
      {iconRight}
    </Tag>
  );
}
