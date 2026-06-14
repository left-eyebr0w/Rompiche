import React from 'react'

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
`
let injected = false
function ensureStyles() {
  if (injected || typeof document === 'undefined') return
  injected = true
  const el = document.createElement('style')
  el.setAttribute('data-ds', 'Switch')
  el.textContent = CSS
  document.head.appendChild(el)
}

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'label'> {
  checked?: boolean
  defaultChecked?: boolean
  onChange?: React.ChangeEventHandler<HTMLInputElement>
  label?: React.ReactNode
  showState?: boolean
  inverse?: boolean
  disabled?: boolean
}

export function Switch({
  checked,
  defaultChecked,
  onChange,
  label = null,
  showState = false,
  inverse = false,
  disabled = false,
  className = '',
  ...rest
}: SwitchProps) {
  ensureStyles()
  const cls = [
    'ds-switch',
    inverse ? 'ds-switch--inverse' : '',
    disabled ? 'ds-switch--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  // derive ON/OFF for the state label when controlled or uncontrolled
  const stateOn = checked != null ? checked : defaultChecked
  return (
    <label className={cls}>
      <input
        type="checkbox"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={onChange}
        disabled={disabled}
        {...rest}
      />
      <span className="ds-switch__track">
        <span className="ds-switch__thumb" />
      </span>
      {label != null && <span className="ds-switch__label">{label}</span>}
      {showState && <span className="ds-switch__state">{stateOn ? 'on' : 'off'}</span>}
    </label>
  )
}
