import React from "react";

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

export function Callout({ children, variant = "default", title = null, className = "", ...rest }) {
  ensureStyles();
  const cls = [
    "ds-callout",
    variant !== "default" ? `ds-callout--${variant}` : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} {...rest}>
      {title && <strong className="ds-callout__title">{title} </strong>}
      {children}
    </div>
  );
}
