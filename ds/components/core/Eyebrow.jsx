import React from "react";

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

export function Eyebrow({ children, tone = "muted", as = "span", className = "", ...rest }) {
  ensureStyles();
  const Tag = as;
  const cls = [
    "ds-eyebrow",
    tone === "inverse" ? "ds-eyebrow--inverse" : "",
    tone === "ink" ? "ds-eyebrow--ink" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <Tag className={cls} {...rest}>
      {children}
    </Tag>
  );
}
