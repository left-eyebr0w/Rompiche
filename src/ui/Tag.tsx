import React from 'react'

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
`
let injected = false
function ensureStyles() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const el = document.createElement('style')
  el.setAttribute('data-ds', 'Tag')
  el.textContent = CSS
  document.head.appendChild(el)
}

export type TagVariant = 'default' | 'spec' | 'tbd' | 'solid'

export interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: TagVariant
  inverse?: boolean
  dot?: boolean
}

export function Tag({
  children,
  variant = 'default',
  inverse = false,
  dot = false,
  className = '',
  ...rest
}: TagProps) {
  ensureStyles()
  const cls = [
    'ds-tag',
    variant !== 'default' ? `ds-tag--${variant}` : '',
    inverse ? 'ds-tag--inverse' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <span className={cls} {...rest}>
      {dot && <span className="ds-tag__dot" />}
      {children}
    </span>
  )
}
