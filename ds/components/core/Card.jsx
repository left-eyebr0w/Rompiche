import React from "react";

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

export function Card({
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
  const cls = [
    "ds-card",
    interactive ? "ds-card--interactive" : "",
    disabled ? "ds-card--disabled" : "",
    flush ? "ds-card--flush" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const hasHead = title != null || meta != null;
  return (
    <Tag className={cls} {...rest}>
      {hasHead && (
        <div className="ds-card__head">
          {title != null && <h3 className="ds-card__title">{title}</h3>}
          {meta}
        </div>
      )}
      {children != null && <div className="ds-card__body">{children}</div>}
    </Tag>
  );
}
